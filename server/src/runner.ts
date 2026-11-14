// The seam between the network layer and whatever produces the world. The mock runner
// implements it for `npm run mock`; the real engine (engine/runner.ts) for `npm run dev`.
import type { AgentStatus, World, WorldEvent } from '@terra/shared';

export type LlmMode = 'mock' | 'live';

export interface NewWorldOptions {
  prompt: string; nations?: number; era?: string; seaLevel?: number; aggression?: number;
  seed?: number; imageBase64?: string | null;
}

export type ControlMessage =
  | { action: 'cut' | 'restore' | 'silence' | 'wake' | 'delete'; countryId: number }
  | { action: 'blackout' | 'pause'; value: boolean }
  | { action: 'speed'; value: number }
  | { action: 'decree'; text: string };

export interface RunnerListener {
  snapshot?(world: World): void;
  events?(events: WorldEvent[]): void;
  agents?(agents: AgentStatus[]): void;
}

export interface WorldRunner {
  getWorld(): World | null;
  /** The whole run so far, for the timeline scrubber (X3 /api/world/log). */
  getLog(): { initial: World; events: WorldEvent[] } | null;
  /** Creates a fresh world (the engine waits for the world bible), starts running it and notifies
   *  listeners with a snapshot. */
  newWorld(opts: NewWorldOptions): Promise<World>;
  /** Restarts a saved run with no API calls. */
  replay(id: string): World | null;
  listReplays(): { id: string; name: string; events: number }[];
  /** True while a saved run is playing back (Tiger and the recorder skip their writes). Optional. */
  playback?(): boolean;
  start(): void;
  stop(): void;
  setSpeed(speed: number): void;
  setPaused(paused: boolean): void;
  control(msg: ControlMessage): void;
  /** The tile ownership as that nation's own replica sees it. */
  belief(countryId: number): number[] | null;
  subscribe(listener: RunnerListener): () => void;
}
