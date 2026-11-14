// The message bus (row A4). Nation agents publish their own events here; the bus hands them to every
// other agent whose link is up and to the observer (the server's true world, which feeds the
// browser). There is no central decision-maker: the bus only carries messages, every receiver
// applies them itself (applyTickBatch).
//
// Each agent has a link, 'up' or 'cut'. While it is cut nothing gets in or out: its outgoing events
// queue in its outbox (AgentStatus.pendingEvents) and the batches it should have heard queue in its
// inbox. Heartbeats are not queued: silence is the point. restore() hands both queues to the
// onRestore hook, which row A7 grows into reconciliation and disputes.
import { orderEvents, type WorldEvent } from '@terra/shared';

export type Link = 'up' | 'cut';

/** Anything that can hear the bus: a nation agent, or the observer. */
export interface BusEndpoint {
  /** One batch of events, to be applied with applyTickBatch. */
  receive(batch: WorldEvent[]): void;
  /** A heartbeat from a peer at a tick. */
  hear(from: number, tick: number): void;
}

export interface BusHooks {
  /** A link came back up. `missedByIt`: the batches it should have heard, in arrival order.
   *  `missedByOthers`: its own events queued while cut, in lamport order. Row A7 owns what happens next. */
  onRestore(countryId: number, missedByIt: WorldEvent[][], missedByOthers: WorldEvent[]): void;
}

interface Slot { endpoint: BusEndpoint; link: Link; outbox: WorldEvent[]; inbox: WorldEvent[][] }

export class MessageBus {
  private slots = new Map<number, Slot>();
  private observer: BusEndpoint | null = null;
  private inflight: WorldEvent[] = [];

  constructor(private hooks: BusHooks) {}

  setObserver(endpoint: BusEndpoint): void { this.observer = endpoint; }

  join(countryId: number, endpoint: BusEndpoint): void {
    this.slots.set(countryId, { endpoint, link: 'up', outbox: [], inbox: [] });
  }

  /** The agent is gone (deleted): its queues are dropped and it hears nothing more. */
  leave(countryId: number): void { this.slots.delete(countryId); }

  has(countryId: number): boolean { return this.slots.has(countryId); }
  link(countryId: number): Link | null { return this.slots.get(countryId)?.link ?? null; }
  /** Its own events waiting to go out (AgentStatus.pendingEvents). */
  pending(countryId: number): number { return this.slots.get(countryId)?.outbox.length ?? 0; }
  /** Batches waiting for it to come back. */
  backlog(countryId: number): number { return this.slots.get(countryId)?.inbox.reduce((n, b) => n + b.length, 0) ?? 0; }
  ids(): number[] { return [...this.slots.keys()].sort((a, b) => a - b); }

  /** An agent publishes its own events. Returns true if they are on the wire (it will hear them back
   *  in this tick's batch), false if its link is cut (queued; the agent applies them alone). */
  publish(from: number, events: WorldEvent[]): boolean {
    const s = this.slots.get(from);
    if (!s || !events.length) return !!s && s.link === 'up';
    if (s.link === 'cut') { s.outbox.push(...events); return false; }
    this.inflight.push(...events);
    return true;
  }

  /** A heartbeat: heard at once by every other up agent and the observer; lost if its link is cut. */
  heartbeat(from: number, tick: number): void {
    const s = this.slots.get(from);
    if (!s || s.link === 'cut') return;
    for (const [id, o] of this.slots) if (id !== from && o.link === 'up') o.endpoint.hear(from, tick);
    this.observer?.hear(from, tick);
  }

  /** End of a tick: everything published since the last flush goes out as one batch. */
  flush(): WorldEvent[] {
    const batch = this.inflight;
    this.inflight = [];
    this.deliver(batch);
    return batch;
  }

  /** Sends one batch to every up agent (except `except`) and the observer; cut agents get it queued. */
  deliver(batch: WorldEvent[], except?: number): void {
    if (!batch.length) return;
    for (const [id, s] of this.slots) {
      if (id === except) continue;
      if (s.link === 'up') s.endpoint.receive(batch);
      else s.inbox.push(batch);
    }
    this.observer?.receive(batch);
  }

  cut(countryId: number): boolean {
    const s = this.slots.get(countryId);
    if (!s || s.link === 'cut') return false;
    s.link = 'cut';
    return true;
  }

  /** Brings a link back up and hands both queues to the onRestore hook. */
  restore(countryId: number): boolean {
    const s = this.slots.get(countryId);
    if (!s || s.link === 'up') return false;
    s.link = 'up';
    const missedByIt = s.inbox;
    const missedByOthers = orderEvents(s.outbox);
    s.inbox = [];
    s.outbox = [];
    this.hooks.onRestore(countryId, missedByIt, missedByOthers);
    return true;
  }
}
