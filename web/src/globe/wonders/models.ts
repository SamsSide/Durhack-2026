// Wonder models: `manifest.wonders.<kind>` (X4, row A30) through the structures loader when the file exists,
// else the code-built fallback. Each kind is resolved once. Lane b.
import { loadFile, loadModels } from '../structures/models';
import type { ModelPart } from '../structures/models';
import { fallbackWonder } from './fallback';
import type { WonderKind } from './types';

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');

export interface WonderModel { parts: ModelPart[]; footprint: number; real: boolean }

type Entry = { file?: string; footprint?: number };
let manifest: Promise<Record<string, Entry>> | null = null;

function wonderEntries(): Promise<Record<string, Entry>> {
  if (!manifest) {
    manifest = fetch(`${BASE}models/manifest.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((m: { wonders?: Record<string, Entry> }) => m?.wonders ?? {})
      .catch(() => ({}));
  }
  return manifest;
}

const resolved = new Map<WonderKind, Promise<WonderModel>>();

export function wonderModel(kind: WonderKind): Promise<WonderModel> {
  let p = resolved.get(kind);
  if (!p) {
    p = (async (): Promise<WonderModel> => {
      const e = (await wonderEntries())[kind];
      if (e?.file) {
        try {
          const set = await loadModels();
          const parts = await loadFile(set, e.file);
          if (parts) return { parts, footprint: e.footprint || 1, real: true };
        } catch { /* fall through to the code-built model */ }
      }
      return { parts: fallbackWonder(kind), footprint: 1, real: false };
    })();
    resolved.set(kind, p);
  }
  return p;
}

/** Synchronous fallback, for the first frames before the manifest answers. */
export function fallbackModel(kind: WonderKind): WonderModel {
  return { parts: fallbackWonder(kind), footprint: 1, real: false };
}
