/**
 * useGameEvents — Processes the GameEvent stream for UI animations.
 *
 * Maintains an animation queue: when an event arrives that should
 * trigger a visual animation (card dealing, chip movement, etc.)
 * it is added to the queue and automatically removed after a timeout.
 * Also keeps a full chronological event log.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { GameEvent } from '@poker/shared';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AnimationItem {
  /** Unique identifier for this queued animation. */
  id: string;
  /** The event type that triggered this animation. */
  type: GameEvent['type'];
  /** The full event payload (consumers can read specific fields). */
  event: GameEvent;
  /** When this animation was queued (epoch ms). */
  timestamp: number;
}

export interface UseGameEventsReturn {
  /** Animations currently in the queue (not yet cleared). */
  currentAnimations: AnimationItem[];
  /** Full chronological log of all game events received. */
  eventLog: GameEvent[];
  /** Manually remove a completed animation from the queue. */
  clearAnimation: (id: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Event types that should spawn a visual animation. */
const ANIMATION_EVENTS = new Set<GameEvent['type']>([
  'cards_dealt',
  'player_acted',
  'street_advanced',
  'showdown_started',
  'hand_result',
]);

/** How long (ms) an animation stays in the queue before auto-clearing. */
const ANIMATION_DURATION_MS = 2_000;

let nextAnimationId = 0;

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useGameEvents(socket: Socket | null): UseGameEventsReturn {
  const [currentAnimations, setCurrentAnimations] = useState<AnimationItem[]>(
    [],
  );
  const [eventLog, setEventLog] = useState<GameEvent[]>([]);

  useEffect(() => {
    if (!socket) return;

    const handleGameEvent = (event: GameEvent) => {
      /* Always append to the event log */
      setEventLog((prev) => [...prev, event]);

      /* Queue an animation if this event type warrants one */
      if (ANIMATION_EVENTS.has(event.type)) {
        const id = `anim-${++nextAnimationId}`;

        const item: AnimationItem = {
          id,
          type: event.type,
          event,
          timestamp: Date.now(),
        };

        setCurrentAnimations((prev) => [...prev, item]);

        /* Auto-clear after the animation duration */
        setTimeout(() => {
          setCurrentAnimations((prev) => prev.filter((a) => a.id !== id));
        }, ANIMATION_DURATION_MS);
      }
    };

    socket.on('game_event', handleGameEvent);

    return () => {
      socket.off('game_event', handleGameEvent);
    };
  }, [socket]);

  const clearAnimation = useCallback((id: string) => {
    setCurrentAnimations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { currentAnimations, eventLog, clearAnimation };
}
