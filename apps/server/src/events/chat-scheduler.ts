/**
 * Async chat message scheduler.
 *
 * Accepts a *generator* function that is invoked when the timer fires (not at
 * schedule time) so the message can reflect current game state. If the
 * generator returns `null`, the message is silently cancelled.
 *
 * Emits `chat_ready` via an internal EventEmitter when a message is ready.
 */

import { EventEmitter } from 'node:events';

/** Payload emitted on the 'chat_ready' event. */
export interface ChatReadyPayload {
  agentId: string;
  message: string;
}

/** Internal bookkeeping for a pending scheduled message. */
interface ScheduledEntry {
  timerId: ReturnType<typeof setTimeout>;
  agentId: string;
}

export class ChatScheduler extends EventEmitter {
  private readonly pending: Map<string, ScheduledEntry> = new Map();

  constructor() {
    super();
  }

  // ── Scheduling ────────────────────────────────────────────────────

  /**
   * Schedule a delayed chat message.
   *
   * @param id        - Unique identifier for this scheduled message (for cancellation).
   * @param agentId   - The agent producing the message.
   * @param delayMs   - Milliseconds to wait before invoking the generator.
   * @param generator - Async factory called when the timer fires.
   *                    Return a string to emit the message, or `null` to cancel.
   */
  schedule(
    id: string,
    agentId: string,
    delayMs: number,
    generator: () => Promise<string | null>,
  ): void {
    // Cancel any existing entry with the same id.
    this.cancel(id);

    const timerId: ReturnType<typeof setTimeout> = setTimeout(() => {
      this.pending.delete(id);
      void this.executeGenerator(agentId, generator);
    }, delayMs);

    this.pending.set(id, { timerId, agentId });
  }

  /**
   * Schedule with a randomised delay within `[minMs, maxMs]`.
   *
   * Useful for making agent chat cadence feel natural.
   */
  scheduleWithJitter(
    id: string,
    agentId: string,
    minMs: number,
    maxMs: number,
    generator: () => Promise<string | null>,
  ): void {
    const delayMs: number = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    this.schedule(id, agentId, delayMs, generator);
  }

  // ── Cancellation ──────────────────────────────────────────────────

  /** Cancel a single pending message by id. */
  cancel(id: string): boolean {
    const entry: ScheduledEntry | undefined = this.pending.get(id);
    if (entry) {
      clearTimeout(entry.timerId);
      this.pending.delete(id);
      return true;
    }
    return false;
  }

  /** Cancel all pending messages for a specific agent. */
  cancelAllForAgent(agentId: string): void {
    for (const [id, entry] of this.pending) {
      if (entry.agentId === agentId) {
        clearTimeout(entry.timerId);
        this.pending.delete(id);
      }
    }
  }

  /** Cancel every pending message. */
  cancelAll(): void {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timerId);
    }
    this.pending.clear();
  }

  // ── Accessors ─────────────────────────────────────────────────────

  /** Number of messages currently waiting to fire. */
  get pendingCount(): number {
    return this.pending.size;
  }

  // ── Internal ──────────────────────────────────────────────────────

  /**
   * Invoke the generator and, if it returns a non-null string,
   * emit the `chat_ready` event.
   */
  private async executeGenerator(
    agentId: string,
    generator: () => Promise<string | null>,
  ): Promise<void> {
    try {
      const message: string | null = await generator();
      if (message !== null) {
        const payload: ChatReadyPayload = { agentId, message };
        this.emit('chat_ready', payload);
      }
    } catch (error: unknown) {
      // Surface the error so callers can attach an 'error' listener.
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }
}
