// Prototype model sets, built in code for comparison before the owner models them in Blender.
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { protoModel, PROTO_KINDS, type HighlandVariant, type ProtoKind, type ProtoStyle } from './sets';

export { protoModel, PROTO_STYLES, PROTO_KINDS, HIGHLAND_VARIANTS, isProtoStyle } from './sets';
export type { ProtoStyle, ProtoKind, HighlandVariant } from './sets';

/** Encode one prototype as a binary glTF (.glb). */
export async function protoGlb(style: ProtoStyle, kind: ProtoKind, variant?: HighlandVariant): Promise<ArrayBuffer> {
  const scene = new THREE.Scene();
  scene.add(protoModel(style, kind, variant));
  const out = await new GLTFExporter().parseAsync(scene, { binary: true });
  return out as ArrayBuffer;
}

function download(name: string, data: ArrayBuffer): void {
  const url = URL.createObjectURL(new Blob([data], { type: 'model/gltf-binary' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Download every kind of one style as <style>_<kind>.glb (highland adds the palette name). The
 * browser may ask once to allow several downloads.
 */
export async function downloadProtoStyle(style: ProtoStyle, variant?: HighlandVariant): Promise<void> {
  for (const kind of PROTO_KINDS) {
    const suffix = style === 'highland' && variant ? `_${variant}` : '';
    download(`${style}${suffix}_${kind}.glb`, await protoGlb(style, kind, variant));
    await new Promise((r) => setTimeout(r, 250));
  }
}
