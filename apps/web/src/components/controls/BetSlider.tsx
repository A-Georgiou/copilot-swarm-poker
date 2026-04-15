/**
 * BetSlider — Range slider for bet/raise amount selection.
 *
 * Renders a slider, quick-bet preset buttons (Min, ½ Pot, Pot, All-In),
 * an amount display, and Confirm / Cancel buttons.
 * Styled with the poker gold accent colour.
 */

import { useState, useCallback } from 'react';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface BetSliderProps {
  /** Minimum legal bet/raise amount. */
  minBet: number;
  /** Maximum legal bet/raise amount (usually the player's remaining stack). */
  maxBet: number;
  /** Current pot size — used to compute pot-relative presets. */
  potSize: number;
  /** Called when the player confirms their chosen amount. */
  onConfirm: (amount: number) => void;
  /** Called when the player cancels bet sizing. */
  onCancel: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function BetSlider({
  minBet,
  maxBet,
  potSize,
  onConfirm,
  onCancel,
}: BetSliderProps) {
  const [amount, setAmount] = useState(minBet);

  /** Clamp a value to [minBet, maxBet]. */
  const clamp = useCallback(
    (value: number) => Math.min(Math.max(Math.round(value), minBet), maxBet),
    [minBet, maxBet],
  );

  const applyPreset = useCallback(
    (value: number) => setAmount(clamp(value)),
    [clamp],
  );

  const presetButtons = [
    { label: 'Min', value: minBet },
    { label: '½ Pot', value: Math.floor(potSize / 2) },
    { label: 'Pot', value: potSize },
    { label: 'All-In', value: maxBet },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-chip-gold/30 bg-poker-bg/90 p-4 backdrop-blur-sm">
      {/* ── Amount display ─────────────────────────────────────── */}
      <div className="text-center">
        <span className="text-sm text-gray-400">Bet Amount</span>
        <div className="text-2xl font-bold text-chip-gold">
          ${amount.toLocaleString()}
        </div>
      </div>

      {/* ── Slider ─────────────────────────────────────────────── */}
      <input
        type="range"
        min={minBet}
        max={maxBet}
        step={1}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-chip-gold"
        aria-label="Bet amount"
      />

      {/* Min / Max labels */}
      <div className="flex justify-between text-xs text-gray-500">
        <span>${minBet.toLocaleString()}</span>
        <span>${maxBet.toLocaleString()}</span>
      </div>

      {/* ── Preset quick-bet buttons ───────────────────────────── */}
      <div className="flex gap-2">
        {presetButtons.map(({ label, value }) => (
          <button
            key={label}
            type="button"
            onClick={() => applyPreset(value)}
            className="flex-1 rounded-lg border border-gray-600 bg-gray-800 px-2 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:bg-gray-700"
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Confirm / Cancel ───────────────────────────────────── */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-600"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={() => onConfirm(amount)}
          className="flex-1 rounded-lg bg-chip-gold px-4 py-2 text-sm font-bold text-gray-900 transition-colors hover:bg-chip-gold/80"
        >
          Confirm ${amount.toLocaleString()}
        </button>
      </div>
    </div>
  );
}
