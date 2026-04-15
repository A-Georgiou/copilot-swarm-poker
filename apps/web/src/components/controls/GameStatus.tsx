/**
 * GameStatus — Top-of-screen status bar.
 *
 * Displays hand number, blinds level, current street name, and
 * game-flow controls: "Start Game" before the first hand, and
 * "Next Hand" (or auto-advance indicator) between hands.
 */

import type { Blinds, Street } from '@poker/shared';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface GameStatusProps {
  /** Sequential hand counter. */
  handNumber: number;
  /** Current small / big blind amounts. */
  blinds: Blinds;
  /** Current street within the hand. */
  street: Street;
  /** False before the very first hand has started. */
  gameStarted: boolean;
  /** True while a hand is actively being played. */
  handInProgress: boolean;
  /** Called when the user clicks "Start Game". */
  onStartGame: () => void;
  /** Called when the user clicks "Next Hand". */
  onNextHand: () => void;
  /** When true, show an auto-advance indicator instead of the button. */
  autoAdvance?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Human-readable label for each street. */
const STREET_LABEL: Record<Street, string> = {
  PREFLOP: 'Pre-Flop',
  FLOP: 'Flop',
  TURN: 'Turn',
  RIVER: 'River',
  SHOWDOWN: 'Showdown',
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function GameStatus({
  handNumber,
  blinds,
  street,
  gameStarted,
  handInProgress,
  onStartGame,
  onNextHand,
  autoAdvance,
}: GameStatusProps) {
  /* ── Pre-game state: show a "Start Game" CTA ──────────────── */
  if (!gameStarted) {
    return (
      <div className="flex items-center justify-center gap-4 border-b border-gray-700 bg-gray-900/90 px-6 py-3 backdrop-blur-sm">
        <span className="text-sm text-gray-400">Ready to play?</span>
        <button
          type="button"
          onClick={onStartGame}
          className="rounded-lg bg-chip-green px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-chip-green/80"
        >
          Start Game
        </button>
      </div>
    );
  }

  /* ── In-game status bar ───────────────────────────────────── */
  return (
    <div className="flex items-center justify-between border-b border-gray-700 bg-gray-900/90 px-6 py-2 backdrop-blur-sm">
      {/* Hand info */}
      <div className="flex items-center gap-4">
        <div className="text-sm">
          <span className="text-gray-500">Hand </span>
          <span className="font-semibold text-white">#{handNumber}</span>
        </div>

        <div className="h-4 w-px bg-gray-700" aria-hidden />

        <div className="text-sm">
          <span className="text-gray-500">Blinds </span>
          <span className="font-semibold text-white">
            ${blinds.small}/{blinds.big}
          </span>
        </div>
      </div>

      {/* Current street badge */}
      <div className="rounded-full border border-felt/40 bg-felt/30 px-3 py-1 text-sm font-semibold text-felt-light">
        {STREET_LABEL[street]}
      </div>

      {/* Next-hand controls (only shown between hands) */}
      {!handInProgress && (
        <div className="flex items-center gap-2">
          {autoAdvance ? (
            <span className="animate-pulse text-xs text-gray-500">
              Next hand starting…
            </span>
          ) : (
            <button
              type="button"
              onClick={onNextHand}
              className="rounded-lg bg-chip-blue px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-chip-blue/80"
            >
              Next Hand
            </button>
          )}
        </div>
      )}
    </div>
  );
}
