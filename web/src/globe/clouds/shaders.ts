// GLSL for the cloud layer. One low-step raymarch through a thin spherical shell, rendered into a
// small render target, then composited over the globe with a depth so things in front still occlude.
export const R_BASE = 1.074; // just over the tallest terrain (1.06)
export const R_TOP = 1.108;  // under the closest camera (CAM_MIN 1.12)

export const FS_VERT = /* glsl */ `
varying vec2 vNdc;
void main() {
  vNdc = position.xy;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const COMMON = /* glsl */ `
#define RB ${R_BASE.toFixed(4)}
#define RT ${R_TOP.toFixed(4)}
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform vec3 uCamPos;
varying vec2 vNdc;

vec2 sph(vec3 o, vec3 d, float r) {
  float b = dot(o, d), c = dot(o, o) - r * r, h = b * b - c;
  if (h < 0.0) return vec2(1e9, -1e9);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}
vec3 rayDir() {
  vec4 v = uInvProj * vec4(vNdc, 1.0, 1.0);
  return normalize(mat3(uCamWorld) * (v.xyz / v.w));
}
// The stretch of the ray inside the cloud shell that the planet does not hide. x > y means none.
vec2 shellSpan(vec3 o, vec3 d, out float ground) {
  vec2 outer = sph(o, d, RT), inner = sph(o, d, RB), planet = sph(o, d, 1.0);
  ground = planet.x > 0.0 && planet.x < 1e8 ? planet.x : -1.0;
  if (outer.y < 0.0 || outer.x > 1e8) return vec2(1.0, 0.0);
  float t0 = max(outer.x, 0.0), t1 = outer.y;
  bool below = dot(o, o) < RB * RB;
  if (below) t0 = inner.y;
  if (ground > 0.0) { if (below) return vec2(1.0, 0.0); t1 = inner.x; }
  return vec2(t0, t1);
}`;

export const MARCH_FRAG = /* glsl */ `
precision highp float;
${COMMON}
#define NSYS 8
#define MAX_STEPS 12
uniform samplerCube uNoise;
uniform vec3 uSun;
uniform float uTime;
uniform float uSteps;
uniform float uCover;
uniform vec4 uSys[NSYS];      // centre, radius
uniform vec4 uSysP[NSYS];     // intensity, storm, spin, rain
uniform vec4 uFlash[NSYS];    // position, brightness
uniform vec4 uClear;          // selected nation: centre, radius
uniform float uClearK;
uniform vec4 uPartA;          // the parting round a close camera: camera position, strength (0 from orbit)
uniform vec4 uPartB;          // unit axis from the camera to its look target on the ground, its length
uniform vec2 uPartR;          // clear radius at the camera, growth per unit along the axis

vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
vec3 rotAxis(vec3 p, vec3 k, float a) { float c = cos(a), s = sin(a); return p * c + cross(k, p) * s + k * dot(k, p) * (1.0 - c); }

// x heavy cloud, y storm, z rain, w the clear eye. Also swirls 'dir' inside a storm.
vec4 weather(inout vec3 dir) {
  vec4 w = vec4(0.0);
  vec3 src = dir;
  for (int i = 0; i < NSYS; i++) {
    vec4 s = uSys[i];
    if (s.w <= 0.0) continue;
    vec4 p = uSysP[i];
    float d = length(src - s.xyz) / s.w;
    if (d > 1.25) continue;
    float f = smoothstep(1.15, 0.3, d);
    float heavy = f * p.x;
    if (p.y > 0.0) {
      vec3 up = abs(s.y) > 0.95 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
      vec3 t1 = normalize(cross(up, s.xyz)), t2 = cross(s.xyz, t1);
      vec3 v = src - s.xyz;
      float th = atan(dot(v, t2), dot(v, t1));
      float arm = 0.5 + 0.5 * cos(2.0 * th + 9.0 * d - p.z);
      heavy = f * p.x * mix(0.22, 1.0, clamp(smoothstep(0.2, 0.8, arm) + smoothstep(0.42, 0.12, d), 0.0, 1.0));
      w.y = max(w.y, smoothstep(1.2, 0.5, d) * p.y);
      w.w = max(w.w, smoothstep(0.11, 0.03, d) * p.y);
      dir = rotAxis(dir, s.xyz, (p.z * 0.45 + 1.3 * (1.0 - d)) * smoothstep(1.15, 0.45, d) * p.y);
    }
    w.x = max(w.x, heavy);
    w.z = max(w.z, f * p.w * smoothstep(0.25, 0.6, f));
  }
  return w;
}

// 1 inside the clear zone round a close camera and along its line of sight to the ground (a sphere
// at the camera that opens into a cone, capped at the look target), feathering out to 0 at three
// times the clear radius. A storm closes it in a little.
float parting(vec3 p, float storm) {
  if (uPartA.w <= 0.001) return 0.0;
  vec3 v = p - uPartA.xyz;
  float s = clamp(dot(v, uPartB.xyz), 0.0, uPartB.w);
  float rad = (uPartR.x + uPartR.y * s) * (1.0 - 0.3 * storm);
  return uPartA.w * smoothstep(rad * 3.0, rad, length(v - uPartB.xyz * s));
}

float density(vec3 p, bool fine, out vec4 w) {
  float r = length(p);
  vec3 dir = p / r;
  float h = (r - RB) / (RT - RB);
  w = vec4(0.0);
  if (h < 0.0 || h > 1.0) return 0.0;
  vec3 q = dir;
  w = weather(q);
  float n = textureCube(uNoise, rotY(q, uTime * 0.010)).r;
  float det = fine ? textureCube(uNoise, rotAxis(q, vec3(0.28, 0.9, 0.33), -uTime * 0.017)).g : 0.5;
  float dw = mix(0.24, 0.4, w.y);
  float cov = n * (1.0 - dw) + det * dw;
  float clear = uClearK * smoothstep(1.3, 0.5, length(dir - uClear.xyz) / max(uClear.w, 0.01)) * (1.0 - w.y);
  // The parting raises the threshold first (the cloud edges erode, so it reads as drifting apart)
  // and scales the rest away, so the middle of the clear zone is exactly empty.
  float part = parting(p, w.y);
  float thr = uCover - mix(0.17, 0.42, w.y) * w.x - 0.03 * w.y + 0.16 * clear + 0.7 * w.w + 0.25 * part;
  float top = mix(0.6, 1.0, max(w.x, w.y));           // fair-weather clouds are shallow, storms tower
  float hh = h / top;
  float prof = smoothstep(0.0, 0.14, hh) * smoothstep(1.0, 0.6, hh);
  float d = cov - thr - 0.09 * hh * hh;               // tops are narrower than bases: puffs
  return clamp(d * (mix(10.0, 15.0, w.x) + 9.0 * w.y), 0.0, 1.0) * prof * (1.0 - part);
}

void main() {
  vec3 o = uCamPos, d = rayDir();
  float ground;
  vec2 span = shellSpan(o, d, ground);
  vec3 col = vec3(0.0);
  float T = 1.0;
  if (span.y > span.x) {
    float n = uSteps;
    // Grazing rays at the limb cross a long chord of the shell: march only the near part, so the
    // steps stay short enough not to show as dots.
    float dt = min(span.y - span.x, 0.2) / n;
    float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    for (int i = 0; i < MAX_STEPS; i++) {
      if (float(i) >= n) break;
      float t = span.x + (float(i) + jit) * dt;
      vec3 p = o + d * t;
      vec4 w;
      float de = density(p, true, w);
      if (de > 0.004) {
        vec4 w2;
        float ls = density(p + uSun * 0.016, false, w2);
        float sunVis = exp(-ls * 2.6);
        float r = length(p);
        float nd = dot(p / r, uSun);
        float h = (r - RB) / (RT - RB);
        float day = smoothstep(-0.2, 0.22, nd);
        float dusk = smoothstep(0.42, 0.0, nd) * smoothstep(-0.25, -0.02, nd);
        vec3 sunCol = mix(vec3(1.0, 0.97, 0.93), vec3(1.0, 0.56, 0.3), dusk);
        vec3 amb = mix(vec3(0.44, 0.49, 0.62), vec3(0.8, 0.85, 0.96), h) * (0.1 + 0.9 * day);
        vec3 c = amb * 0.5 + sunCol * day * (0.22 + 0.78 * sunVis) * 0.72;
        c += vec3(1.0, 0.5, 0.25) * dusk * (1.0 - sunVis) * 0.12;             // warm glow through thin edges at sunset
        c *= mix(1.0, 0.46, w.x * (1.0 - 0.3 * h));                            // rain cloud: dark, darker underneath
        c *= mix(1.0, 0.62, w.y);
        c += vec3(0.10, 0.12, 0.19) * (1.0 - day) + vec3(0.03, 0.035, 0.05);                                         // night floor so clouds still read over city lights
        for (int k = 0; k < NSYS; k++) {
          vec4 fl = uFlash[k];
          if (fl.w <= 0.01) continue;
          float fd = length(p / r - fl.xyz);
          c += vec3(0.78, 0.86, 1.0) * fl.w * (exp(-fd * fd / 0.003) * 2.4 + exp(-fd * fd / 0.02) * 0.32);
        }
        float a = 1.0 - exp(-de * dt * 130.0);
        // Thin out the cloud right in front of a close camera so towns, borders and names stay readable;
        // far cloud (the horizon in a tilted view) and storms keep their body.
        float keep = max(0.14, max(w.y * 0.6, w.x * 0.4));
        a *= mix(keep, 1.0, smoothstep(0.18, 0.85, t));
        a *= mix(0.5, 1.0, max(day, w.y));                                      // the night side keeps a thin veil only
        col += T * a * c;
        T *= 1.0 - a;
        if (T < 0.03) break;
      }
    }
  }
  // On the ground under the sky: a soft cloud shadow, and a grey rain haze under heavy cloud.
  if (ground > 0.0) {
    vec3 ps = normalize(o + d * ground);
    float nd = dot(ps, uSun);
    float day = smoothstep(-0.05, 0.3, nd);
    vec4 w;
    float sh = density(normalize(ps + uSun * 0.05) * (RB + 0.3 * (RT - RB)), false, w);
    vec4 wr;
    vec3 q = ps;
    wr = weather(q);
    float far = smoothstep(0.12, 0.7, ground);
    float sa = sh * 0.30 * day * mix(0.45, 1.0, far);
    col += T * sa * vec3(0.03, 0.045, 0.08);
    T *= 1.0 - sa;
    float ra = wr.z * mix(0.16, 0.34, far) * (1.0 - 0.55 * parting(o + d * ground, wr.y)); // thinner haze where the view is parted
    col += T * ra * vec3(0.36, 0.42, 0.5) * (0.12 + 0.88 * day);
    T *= 1.0 - ra;
  }
  gl_FragColor = vec4(col, 1.0 - T);
}`;

export const COMPOSITE_FRAG = /* glsl */ `
precision highp float;
${COMMON}
uniform sampler2D uMap;
uniform vec2 uTexel;
uniform mat4 uViewProj;
void main() {
  // A small tent blur hides the march's per-pixel jitter and the low resolution of the target.
  vec2 uv = vNdc * 0.5 + 0.5, px = uTexel;
  vec4 c = texture2D(uMap, uv) * 0.25
    + (texture2D(uMap, uv + vec2(px.x, 0.0)) + texture2D(uMap, uv - vec2(px.x, 0.0))
     + texture2D(uMap, uv + vec2(0.0, px.y)) + texture2D(uMap, uv - vec2(0.0, px.y))) * 0.125
    + (texture2D(uMap, uv + px) + texture2D(uMap, uv - px)
     + texture2D(uMap, uv + vec2(px.x, -px.y)) + texture2D(uMap, uv + vec2(-px.x, px.y))) * 0.0625;
  if (c.a < 0.003) discard;
  vec3 o = uCamPos, d = rayDir();
  float ground;
  vec2 span = shellSpan(o, d, ground);
  float t = span.y > span.x ? span.x : (ground > 0.0 ? ground : 0.2);
  vec4 clip = uViewProj * vec4(o + d * max(t, 0.02), 1.0);
  gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
  gl_FragColor = c;
}`;

export const RAIN_VERT = /* glsl */ `
#define NSYS 8
attribute vec3 aSeed;
attribute float aSys;
attribute float aEnd;
uniform vec4 uSys[NSYS];
uniform vec4 uSysP[NSYS];
uniform vec3 uSun;
uniform float uTime;
uniform float uFade;
varying float vAlpha;
void main() {
  int i = int(aSys + 0.5);
  vec4 s = uSys[i];
  vec4 p = uSysP[i];
  vec3 up = abs(s.y) > 0.95 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 t1 = normalize(cross(up, s.xyz)), t2 = cross(s.xyz, t1);
  float a = aSeed.x * 6.2831853, rr = sqrt(aSeed.y);
  vec3 dir = normalize(s.xyz + (t1 * cos(a) + t2 * sin(a)) * rr * s.w * 0.95);
  float speed = mix(0.75, 1.15, fract(aSeed.z * 7.31)) * (1.0 + 0.5 * p.y);
  float ph = fract(aSeed.z + uTime * speed);
  float r = mix(${R_BASE.toFixed(4)}, 0.996, ph);
  vec3 wind = normalize(cross(s.xyz, dir) + t1 * 0.35) * (0.0035 + 0.011 * p.y);
  float len = 0.011 + 0.007 * p.y;
  vec3 pos = dir * (r + aEnd * len) - wind * aEnd + wind * (1.0 - ph) * 2.0;
  float on = step(fract(aSeed.x * 91.7 + aSeed.y * 13.3), p.w * (1.0 - 0.75 * rr * rr));
  float day = smoothstep(-0.2, 0.25, dot(dir, uSun));
  vAlpha = on * uFade * (0.3 + 0.7 * day) * mix(0.95, 0.2, aEnd) * smoothstep(1.0, 0.9, ph) * (s.w > 0.0 ? 1.0 : 0.0);
  vAlpha *= smoothstep(0.025, 0.1, distance(pos, cameraPosition)); // no streaks right in front of the lens
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
}`;

export const RAIN_FRAG = /* glsl */ `
precision highp float;
varying float vAlpha;
void main() {
  if (vAlpha < 0.01) discard;
  gl_FragColor = vec4(vec3(0.74, 0.83, 0.97) * vAlpha, vAlpha);
}`;
