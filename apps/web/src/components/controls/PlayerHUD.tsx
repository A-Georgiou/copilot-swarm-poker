/**
 * PlayerHUD — Always-visible display at the human player's seat.
 *
 * Shows the player's chip stack, hole cards (rendered larger than other
 * seats), table position badge (Dealer / SB / BB), and an optional
 * hand-strength indicator such as "Top Pair" or "Flush Draw".
 */

import type { Card } from '@poker/shared';
import { clsx } from 'clsx';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface PlayerHUDProps {
  /** Player's current chip count. */
  chips: number;
  /** The player's two hole cards, or empty before cards are dealt. */
  holeCards: [Card, Card] | [];
  /** True if this player holds the dealer button. */
  isDealer: boolean;
  /** True if this player is the small blind. */
  isSmallBlind: boolean;
  /** True if this player is the big blind. */
  isBigBlind: boolean;
  /** Optional hand-strength label (e.g. "Top Pair", "Flush Draw"). */
  handStrength?: string;
}

/* ------------------------------------------------------------------ */
/*  Card rendering helpers                                             */
/* ------------------------------------------------------------------ */

const SUIT_SYMBOL: Record<string, string> = {
  h: '♥',
  d: '♦',
  c: '♣',
  s: '♠',
};

const SUIT_COLOR: Record<string, string> = {
  h: 'text-red-500',
  d: 'text-blue-400',
  c: 'text-green-400',
  s: 'text-gray-300',
};

/** Map single-char rank to display string. */
function displayRank(rank: string): string {
  return rank === 'T' ? '10' : rank;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

/** A single face-up playing card (larger size for the HUD). */
function HoleCard({ card }: { card: Card }) {
  const rank = card[0];
  const suit = card[1];

  return (
    <div
      className={clsx(
        'flex h-20 w-14 flex-col items-center justify-center rounded-lg border-2 border-gray-200 bg-white shadow-lg',
        SUIT_COLOR[suit],
      )}
    >
      <span className="text-lg font-bold leading-none">
        {displayRank(rank)}
      </span>
      <span className="text-xl leading-none">{SUIT_SYMBOL[suit]}</span>
    </div>
  );
}

/** Face-down card placeholder shown before cards are dealt. */
function CardBack() {
  return (
    <div className="h-20 w-14 rounded-lg border-2 border-felt-dark bg-felt" />
  );
}

/** Small coloured badge indicating table position. */
function PositionBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className={clsx(
        'rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide',
        color,
      )}
    >
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function PlayerHUD({
  chips,
  holeCards,
  isDealer,
  isSmallBlind,
  isBigBlind,
  handStrength,
}: PlayerHUDProps) {
  const hasCards = holeCards.length === 2;

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-700/50 bg-gray-900/80 p-3 backdrop-blur-sm">
      {/* ── Position badges ─────────────────────────────────── */}
      <div className="flex gap-1.5">
        {isDealer && (
          <PositionBadge label="D" color="bg-chip-gold text-gray-900" />
        )}
        {isSmallBlind && (
          <PositionBadge label="SB" color="bg-chip-blue text-white" />
        )}
        {isBigBlind && (
          <PositionBadge label="BB" color="bg-chip-red text-white" />
        )}
      </div>

      {/* ── Hole cards (larger than other seats) ────────────── */}
      <div className="flex gap-1.5">
        {hasCards ? (
          (holeCards as [Card, Card]).map((card) => (
            <HoleCard key={card} card={card} />
          ))
        ) : (
          <>
            <CardBack />
            <CardBack />
          </>
        )}
      </div>

      {/* ── Chip stack ──────────────────────────────────────── */}
      <div className="text-center">
        <span className="text-lg font-bold text-chip-gold">
          ${chips.toLocaleString()}
        </span>
      </div>

      {/* ── Hand strength indicator ─────────────────────────── */}
      {handStrength && (
        <div className="rounded-full bg-chip-gold/20 px-3 py-1 text-xs font-semibold text-chip-gold">
          {handStrength}
        </div>
      )}
    </div>
  );
}
