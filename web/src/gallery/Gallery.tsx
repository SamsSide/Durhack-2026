// Model gallery (open the app with ?gallery or #gallery): every building style side by side, one row
// per style and one column per kind, plus code-built prototypes of the four proposed sets.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { HIGHLAND_VARIANTS, PROTO_KINDS, PROTO_STYLES, downloadProtoStyle, isProtoStyle, protoModel } from '../proto';
import type { HighlandVariant, ProtoKind, ProtoStyle } from '../proto';
import { TEAM_HEX } from '../proto/kit';
import { cellCopy, loadGlb, tint, useManifest, type Entry, type Manifest } from './useModels';
import './gallery.css';

const KINDS = ['capital', 'city', 'town', 'temple', 'fort', 'village', 'camp', 'farm', 'port'] as const;
const STYLED_KINDS = 5;
const SP = 1.6; // cell spacing in world units (a model is about 1 unit)
const PROTO_FOOTPRINT: Record<string, number> = { capital: 1, city: 1, town: 0.9, temple: 0.7, fort: 0.7 };

const SWATCHES: { name: string; hex: string }[] = [
  { name: 'Crimson', hex: '#b3261e' },
  { name: 'Royal blue', hex: '#3f6fb0' },
  { name: 'Forest', hex: '#4f8a3c' },
  { name: 'Gilt', hex: '#c9a24b' },
  { name: 'Purple', hex: '#6d4a9a' },
  { name: 'Neutral', hex: TEAM_HEX },
];

type Source = { type: 'glb'; entry: Entry } | { type: 'proto'; style: ProtoStyle; kind: ProtoKind };
interface Row { id: string; label: string; sub?: string; proto: boolean; cells: (Source | null)[] }
type Light = 'day' | 'dusk';

function pretty(id: string): string {
  return id.split('_').map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ');
}

function buildRows(manifest: Manifest | null): Row[] {
  const rows: Row[] = [];
  for (const [style, kinds] of Object.entries(manifest?.styles ?? {})) {
    rows.push({
      id: style, label: pretty(style), proto: false,
      cells: KINDS.map((k, i) => (i < STYLED_KINDS && kinds?.[k]?.file ? { type: 'glb', entry: kinds[k]! } : null)),
    });
  }
  const shared = manifest?.models ?? {};
  if (Object.keys(shared).length) {
    rows.push({
      id: 'shared', label: 'Shared default', sub: 'the fallback for every style', proto: false,
      cells: KINDS.map((k) => (shared[k]?.file ? { type: 'glb', entry: shared[k]! } : null)),
    });
  }
  for (const style of PROTO_STYLES) {
    rows.push({
      id: style, label: pretty(style), sub: 'PROTOTYPE (code-built, for comparison)', proto: true,
      cells: KINDS.map((k, i) => (i < STYLED_KINDS ? { type: 'proto', style, kind: k as ProtoKind } : null)),
    });
  }
  return rows;
}

// ------------------------------------------------------------------ scene pieces

function Lights({ mode, span }: { mode: Light; span: number }) {
  const day = mode === 'day';
  const s = span / 2 + 2;
  return (
    <>
      <hemisphereLight args={day ? ['#fff4e0', '#3a3020', 1.3] : ['#7a6a9a', '#1a1420', 0.7]} />
      <directionalLight
        castShadow
        position={day ? [6, 10, 5] : [-9, 3.2, 4]}
        intensity={day ? 2.4 : 2.1}
        color={day ? '#fff1d6' : '#ff9a5a'}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-s}
        shadow-camera-right={s}
        shadow-camera-top={s}
        shadow-camera-bottom={-s}
        shadow-camera-far={60}
      />
      {!day && <directionalLight position={[6, 4, -6]} intensity={0.5} color="#6f8fd0" />}
    </>
  );
}

function Plinth() {
  return (
    <group>
      <mesh position={[0, 0.015, 0]} receiveShadow>
        <cylinderGeometry args={[0.66, 0.68, 0.03, 40]} />
        <meshStandardMaterial color="#2a1f14" roughness={1} />
      </mesh>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[0.62, 0.64, 0.06, 40]} />
        <meshStandardMaterial color="#ecdfc0" roughness={0.95} />
      </mesh>
    </group>
  );
}

function Cell({ src, colour, rotate, variant, plinth, showTris, phase }: {
  src: Source; colour: string; rotate: boolean; variant: HighlandVariant; plinth: boolean; showTris: boolean; phase: number;
}) {
  const [obj, setObj] = useState<THREE.Object3D | null | 'missing'>(null);
  const spin = useRef<THREE.Group>(null);
  const key = src.type === 'glb' ? src.entry.file : `${src.style}/${src.kind}/${src.style === 'highland' ? variant : ''}`;

  useEffect(() => {
    let alive = true;
    if (src.type === 'proto') { setObj(cellCopy(protoModel(src.style, src.kind, variant))); return; }
    setObj(null);
    loadGlb(src.entry.file).then((g) => alive && setObj(g ? cellCopy(g) : 'missing'));
    return () => { alive = false; };
    // key covers src and variant
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { if (obj && obj !== 'missing') tint(obj, colour); }, [obj, colour]);

  useFrame((_, dt) => { if (rotate && spin.current) spin.current.rotation.y += dt * 0.35; });

  const scale = src.type === 'glb' ? src.entry.footprint || 0.8 : PROTO_FOOTPRINT[src.kind] ?? 1;
  const top = plinth ? 0.09 : 0;
  return (
    <group>
      {plinth && <Plinth />}
      <group ref={spin} position={[0, top, 0]} rotation={[0, phase, 0]} scale={scale}>
        {obj && obj !== 'missing' && <primitive object={obj} />}
      </group>
      {plinth && obj === null && (
        <Html position={[0, 0.4, 0]} center zIndexRange={[10, 0]} className="gal-cell-note">loading</Html>
      )}
      {plinth && obj === 'missing' && (
        <Html position={[0, 0.4, 0]} center zIndexRange={[10, 0]} className="gal-cell-note gal-cell-note--bad">file missing</Html>
      )}
      {showTris && obj && obj !== 'missing' && (
        <Html position={[0, 0.02, 0.78]} center zIndexRange={[10, 0]} className="gal-tris">
          {obj.userData.tris as number} tris
        </Html>
      )}
    </group>
  );
}

function CameraRig({ cols, rows, fitKey }: { cols: number; rows: number; fitKey: string }) {
  const { camera, controls } = useThree();
  useEffect(() => {
    // Centre on the five styled columns plus the row labels; pull back until every row fits.
    const span = Math.max(Math.min(cols, STYLED_KINDS + 2) * SP, rows * SP);
    const tx = -((cols - 1) * SP) / 2 + ((STYLED_KINDS - 2) * SP) / 2;
    const tz = rows > 4 ? -SP * 0.4 : 0;
    camera.position.set(tx, span * 0.95 + 2, tz + span * 0.95 + 3);
    const c = controls as unknown as { target?: THREE.Vector3; update?: () => void } | null;
    if (c?.target) { c.target.set(tx, 0, tz); c.update?.(); } else camera.lookAt(tx, 0, tz);
  }, [fitKey, camera, controls, cols, rows]);
  return null;
}

function Grid({ rows, colour, rotate, variant, onPick, picked, onExport }: {
  rows: Row[]; colour: string; rotate: boolean; variant: HighlandVariant;
  onPick: (id: string) => void; picked: string; onExport: (s: ProtoStyle) => void;
}) {
  const cols = Math.max(...rows.map((r) => r.cells.reduce((n, c, i) => (c ? i + 1 : n), 0)), 1);
  const x0 = -((cols - 1) * SP) / 2;
  const z0 = -((rows.length - 1) * SP) / 2;
  return (
    <group>
      {KINDS.slice(0, cols).map((k, i) => (
        <Html key={k} position={[x0 + i * SP, 0, z0 - SP * 0.62]} center zIndexRange={[10, 0]} className="gal-col gal-col--far">{k}</Html>
      ))}
      {KINDS.slice(0, cols).map((k, i) => (
        <Html key={`near-${k}`} position={[x0 + i * SP, 0, -z0 + SP * 0.82]} center zIndexRange={[10, 0]} className="gal-col">{k}</Html>
      ))}
      {rows.map((row, r) => (
        <group key={row.id} position={[0, 0, z0 + r * SP]}>
          <Html position={[x0 - SP * 0.55, 0.1, 0]} zIndexRange={[10, 0]} className="gal-row-anchor">
            <div className={`gal-row${row.proto ? ' gal-row--proto' : ''}${picked === row.id ? ' gal-row--picked' : ''}`}>
              <button type="button" className="gal-row-name" onClick={() => onPick(row.id)} title="Preview this row at globe scale">
                {row.label}{row.id === 'highland' ? ` (${variant})` : ''}
              </button>
              {row.sub && (
                <div className="gal-row-sub">
                  {row.sub}
                  {row.proto && isProtoStyle(row.id) && (
                    <button type="button" className="tn-button tn-button--lacquer tn-button--sm gal-btn" onClick={() => onExport(row.id as ProtoStyle)}>Export GLB</button>
                  )}
                </div>
              )}
            </div>
          </Html>
          {row.proto && (
            <mesh position={[x0 + ((STYLED_KINDS - 1) * SP) / 2, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[STYLED_KINDS * SP - 0.1, SP - 0.1]} />
              <meshBasicMaterial color="#2a2236" transparent opacity={0.55} />
            </mesh>
          )}
          {row.cells.map((src, c) => src && (
            <group key={c} position={[x0 + c * SP, 0, 0]}>
              <Cell src={src} colour={colour} rotate={rotate} variant={variant} plinth showTris={row.proto} phase={0.5 + c * 0.4 + r * 0.25} />
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

/** A row drawn the size it is on the globe from orbit: about 40 px per model, at 1 device pixel. */
function GlobeScale({ rows, colour, variant, light, zoomed }: { rows: Row[]; colour: string; variant: HighlandVariant; light: Light; zoomed: boolean }) {
  const PX = 40;
  const cell = 1.3;
  const w = STYLED_KINDS * cell * PX + 24;
  const h = rows.length * cell * PX * 0.8 + 24;
  return (
    <div className="gal-mini" style={{ width: zoomed ? w * 3 : w, height: zoomed ? h * 3 : h }}>
      <div className={`gal-mini-inner${zoomed ? ' gal-mini-inner--zoom' : ''}`} style={{ width: w, height: h }}>
      <Canvas orthographic dpr={1} shadows resize={{ offsetSize: true }} camera={{ zoom: PX, position: [0, 7, 7], near: 0.1, far: 100 }} gl={{ antialias: true }}>
        <color attach="background" args={['#c9b87a']} />
        <Lights mode={light} span={8} />
        {rows.map((row, r) => (
          <group key={row.id} position={[0, 0, (r - (rows.length - 1) / 2) * cell * 1.15]}>
            {row.cells.slice(0, STYLED_KINDS).map((src, c) => src && (
              <group key={c} position={[(c - (STYLED_KINDS - 1) / 2) * cell, 0, 0]}>
                <Cell src={src} colour={colour} rotate={false} variant={variant} plinth={false} showTris={false} phase={0.6} />
              </group>
            ))}
          </group>
        ))}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color="#c9b87a" roughness={1} />
        </mesh>
      </Canvas>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ page

export function Gallery() {
  const { manifest, error } = useManifest();
  const allRows = useMemo(() => buildRows(manifest), [manifest]);
  const [colour, setColour] = useState(SWATCHES[0]!.hex);
  const [rotate, setRotate] = useState(true);
  const [light, setLight] = useState<Light>('day');
  const [coldWar, setColdWar] = useState(false);
  const [mini, setMini] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [variant, setVariant] = useState<HighlandVariant>('himalayan');
  const [picked, setPicked] = useState<string>('soviet_bloc');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { document.title = 'Model gallery'; }, []);

  const rows = coldWar ? allRows.filter((r) => r.id === 'soviet_bloc' || r.id === 'western_modern') : allRows;
  const cols = Math.max(...rows.map((r) => r.cells.reduce((n, c, i) => (c ? i + 1 : n), 0)), 1);
  const miniRows = coldWar ? rows : allRows.filter((r) => r.id === picked);

  const exportStyles = async (styles: ProtoStyle[]) => {
    for (const s of styles) {
      setBusy(`Exporting ${pretty(s)}`);
      try { await downloadProtoStyle(s, variant); } catch (e) { console.warn('gallery: export failed', e); }
    }
    setBusy(null);
  };

  return (
    <div className="gal">
      <Canvas shadows camera={{ fov: 40, near: 0.1, far: 200, position: [0, 14, 16] }} dpr={[1, 2]}>
        <color attach="background" args={['#090b12']} />
        <fog attach="fog" args={['#090b12', 30, 60]} />
        <Lights mode={light} span={Math.max(cols, rows.length) * SP} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color="#0d1620" roughness={1} />
        </mesh>
        {manifest && (
          <Grid rows={rows} colour={colour} rotate={rotate} variant={variant} picked={picked}
            onPick={(id) => { setPicked(id); setMini(true); }} onExport={(s) => void exportStyles([s])} />
        )}
        <OrbitControls makeDefault enableDamping maxPolarAngle={Math.PI / 2.05} minDistance={2} maxDistance={45} />
        <CameraRig cols={cols} rows={rows.length} fitKey={`${coldWar}-${rows.length}`} />
      </Canvas>

      <header className="gal-bar tn-lacquer tn-lacquer--bar-top">
        <div className="gal-title">
          <h1>Model gallery</h1>
          <p>Every building style side by side. Drag to orbit, scroll to zoom. Click a row name to see it at globe scale.</p>
        </div>
        <div className="gal-tools">
          <div className="gal-group" role="group" aria-label="Nation colour">
            <span className="gal-label">Nation colour</span>
            {SWATCHES.map((s) => (
              <button key={s.hex} type="button" className={`gal-swatch${colour === s.hex ? ' is-on' : ''}`} style={{ background: s.hex }}
                title={s.name} aria-label={s.name} aria-pressed={colour === s.hex} onClick={() => setColour(s.hex)} />
            ))}
          </div>
          <div className="gal-group">
            <span className="gal-label">Light</span>
            <button type="button" className={`tn-button tn-button--lacquer gal-btn${light === 'day' ? ' is-active' : ''}`} onClick={() => setLight('day')}>Day</button>
            <button type="button" className={`tn-button tn-button--lacquer gal-btn${light === 'dusk' ? ' is-active' : ''}`} onClick={() => setLight('dusk')}>Dusk</button>
          </div>
          <div className="gal-group">
            <button type="button" className={`tn-button tn-button--lacquer gal-btn${rotate ? ' is-active' : ''}`} aria-pressed={rotate} onClick={() => setRotate(!rotate)}>Auto-rotate</button>
            <button type="button" className={`tn-button tn-button--lacquer gal-btn${mini ? ' is-active' : ''}`} aria-pressed={mini} onClick={() => setMini(!mini)}>Globe scale (40 px)</button>
            <button type="button" className={`tn-button tn-button--lacquer gal-btn${coldWar ? ' is-active' : ''}`} aria-pressed={coldWar} onClick={() => setColdWar(!coldWar)}>Cold War</button>
          </div>
          <div className="gal-group">
            <span className="gal-label">Highland</span>
            {HIGHLAND_VARIANTS.map((v) => (
              <button key={v} type="button" className={`tn-button tn-button--lacquer gal-btn${variant === v ? ' is-active' : ''}`} onClick={() => setVariant(v)}>{pretty(v)}</button>
            ))}
          </div>
          <div className="gal-group">
            <button type="button" className="tn-button tn-button--gilt gal-btn" disabled={!!busy} onClick={() => void exportStyles([...PROTO_STYLES])}>
              {busy ?? `Export all prototypes (${PROTO_STYLES.length * PROTO_KINDS.length} GLB)`}
            </button>
            <a className="tn-button tn-button--lacquer gal-btn" href={`${import.meta.env.BASE_URL ?? '/'}`}>Back to the app</a>
          </div>
        </div>
      </header>

      {!manifest && <div className="gal-status">Loading the model manifest</div>}
      {error && <div className="gal-status gal-status--bad">Manifest failed to load ({error}); showing prototypes only.</div>}

      {mini && miniRows.length > 0 && (
        <aside className="gal-mini-panel tn-lacquer tn-frame">
          <div className="gal-mini-head">
            <span className="gal-label">At globe scale: {miniRows.map((r) => r.label).join(' vs ')}</span>
            <button type="button" className={`tn-button tn-button--lacquer tn-button--sm gal-btn${zoomed ? ' is-active' : ''}`} onClick={() => setZoomed(!zoomed)}>Magnify x3</button>
            <button type="button" className="tn-button tn-button--lacquer tn-button--sm gal-btn" onClick={() => setMini(false)}>Close</button>
          </div>
          <GlobeScale rows={miniRows} colour={colour} variant={variant} light={light} zoomed={zoomed} />
          <p className="gal-mini-note">Rendered at 1 device pixel per pixel, so this is the real silhouette. Magnify only enlarges the pixels.</p>
        </aside>
      )}
    </div>
  );
}
