/**
 * Typed event bus for all game events.
 *
 * Wraps Node's EventEmitter with strongly-typed emit/subscribe helpers
 * and an append-only event log for replay.
 */

import { EventEmitter } from 'node:events';
import type { GameEvent } from '@poker/shared';

/** Handler for a specific event type. */
export type GameEventHandler<T extends GameEvent['type']> = (
  event: Extract<GameEvent, { type: T }>,
) => void;

/** Catch-all handler that receives every event. */
export type AnyEventHandler = (event: GameEvent) => void;

/**
 * Internal channel name used for the catch-all "onAny" subscription.
 * Prefixed with `__` to avoid collisions with GameEvent type strings.
 */
const ANY_CHANNEL: string = '__any__';

export class GameEventBus extends EventEmitter {
  /** Append-only log of every emitted event (for replay / debugging). */
  public readonly eventLog: GameEvent[] = [];

  constructor() {
    super();
    // Allow many listeners — one per event type + catch-all + external subscribers.
    this.setMaxListeners(50);
  }

  // ── Typed emission ────────────────────────────────────────────────

  /**
   * Emit a typed game event.
   *
   * The event is appended to the log *before* listeners fire so that
   * any handler inspecting `eventLog` sees the triggering event.
   */
  override emit(event: GameEvent): boolean;
  override emit(event: string | symbol, ...args: unknown[]): boolean;
  override emit(eventOrType: GameEvent | string | symbol, ...args: unknown[]): boolean {
    // Support raw EventEmitter calls (e.g. 'error', 'newListener') as well.
    if (typeof eventOrType === 'string' || typeof eventOrType === 'symbol') {
      return super.emit(eventOrType, ...args);
    }

    const gameEvent: GameEvent = eventOrType;
    this.eventLog.push(gameEvent);

    // Emit on the type-specific channel.
    super.emit(gameEvent.type, gameEvent);
    // Emit on the catch-all channel.
    super.emit(ANY_CHANNEL, gameEvent);

    return true;
  }

  // ── Typed subscription ────────────────────────────────────────────

  /**
   * Subscribe to a specific event type with a strongly-typed handler.
   */
  onEvent<T extends GameEvent['type']>(type: T, handler: GameEventHandler<T>): this {
    super.on(type, handler as (...args: unknown[]) => void);
    return this;
  }

  /**
   * Subscribe once to a specific event type.
   */
  onceEvent<T extends GameEvent['type']>(type: T, handler: GameEventHandler<T>): this {
    super.once(type, handler as (...args: unknown[]) => void);
    return this;
  }

  /**
   * Catch-all subscription — receives every GameEvent.
   * Useful for logging, replay recording, or forwarding to WebSocket clients.
   */
  onAny(handler: AnyEventHandler): this {
    super.on(ANY_CHANNEL, handler as (...args: unknown[]) => void);
    return this;
  }

  /**
   * Remove a catch-all handler.
   */
  offAny(handler: AnyEventHandler): this {
    super.off(ANY_CHANNEL, handler as (...args: unknown[]) => void);
    return this;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  /**
   * Clear the event log and remove all listeners. Call between hands / games.
   */
  clear(): void {
    this.eventLog.length = 0;
    this.removeAllListeners();
  }
}
