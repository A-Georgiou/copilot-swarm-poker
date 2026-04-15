/**
 * GameControls — Primary action bar shown when it is the human player's turn.
 *
 * Slides up from the bottom of the table area (framer-motion) and presents
 * context-sensitive action buttons: Fold, Check, Call, Raise/Bet, All-In.
 * Selecting Raise/Bet opens the BetSlider for amount selection.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LegalAction, PlayerAction } from '@poker/shared';
import { BetSlider } from './BetSlider';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface GameControlsProps {
  /** Actions the server says are currently legal for this player. */
  legalActions: LegalAction[];
  /** Current pot size (passed to BetSlider for pot-relative presets). */
  potSize: number;
  /** Player's remaining chip stack. */
  playerChips: number;
  /** Whether it is this player's turn to act. Controls visibility. */
  isMyTurn: boolean;
  /** While true, all buttons are disabled to prevent duplicate actions. */
  isProcessing: boolean;
  /** Callback invoked with the chosen action. */
  onAction: (action: PlayerAction) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function findAction(actions: LegalAction[], type: string): LegalAction | undefined {
  return actions.find((a) => a.type === type);
}

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const slideVariants = {
  hidden: { y: 100, opacity: 0 },
  visible: { y: 0, opacity: 1 },
  exit: { y: 100, opacity: 0 },
};

const springTransition = { type: 'spring' as const, damping: 25, stiffness: 300 };

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function GameControls({
  legalActions,
  potSize,
  playerChips,
  isMyTurn,
  isProcessing,
  onAction,
}: GameControlsProps) {
  const [showBetSlider, setShowBetSlider] = useState(false);

  /* Resolve which actions are available */
  const canFold = !!findAction(legalActions, 'fold');
  const canCheck = !!findAction(legalActions, 'check');
  const callAction = findAction(legalActions, 'call');
  const raiseAction = findAction(legalActions, 'raise');
  const betAction = findAction(legalActions, 'bet');
  const raiseOrBet = raiseAction ?? betAction;

  /** Dispatch an action and close the slider. */
  const handleAction = (action: PlayerAction) => {
    if (isProcessing) return;
    setShowBetSlider(false);
    onAction(action);
  };

  return (
    <AnimatePresence>
      {isMyTurn && (
        <motion.div
          variants={slideVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={springTransition}
          className="fixed inset-x-0 bottom-0 border-t border-gray-700 bg-gray-900/95 p-4 backdrop-blur-sm"
        >
          <div
            className={`mx-auto flex max-w-2xl flex-col gap-3 ${
              isProcessing ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            {/* ── Bet sizing slider (shown when Raise/Bet is toggled) ── */}
            {showBetSlider && raiseOrBet && (
              <BetSlider
                minBet={raiseOrBet.minAmount ?? 0}
                maxBet={raiseOrBet.maxAmount ?? playerChips}
                potSize={potSize}
                onConfirm={(amount) =>
                  handleAction({ type: raiseOrBet.type, amount })
                }
                onCancel={() => setShowBetSlider(false)}
              />
            )}

            {/* ── Action buttons ───────────────────────────────────── */}
            <div className="flex gap-2">
              {/* Fold — always red */}
              {canFold && (
                <ActionButton
                  label="Fold"
                  onClick={() => handleAction({ type: 'fold' })}
                  disabled={isProcessing}
                  className="bg-chip-red hover:bg-chip-red/80 text-white"
                />
              )}

              {/* Check — blue, only if legal */}
              {canCheck && (
                <ActionButton
                  label="Check"
                  onClick={() => handleAction({ type: 'check' })}
                  disabled={isProcessing}
                  className="bg-chip-blue hover:bg-chip-blue/80 text-white"
                />
              )}

              {/* Call $X — green */}
              {callAction && (
                <ActionButton
                  label={`Call $${callAction.minAmount?.toLocaleString() ?? ''}`}
                  onClick={() =>
                    handleAction({ type: 'call', amount: callAction.minAmount })
                  }
                  disabled={isProcessing}
                  className="bg-chip-green hover:bg-chip-green/80 text-white"
                />
              )}

              {/* Raise / Bet — gold, toggles BetSlider */}
              {raiseOrBet && (
                <ActionButton
                  label={raiseOrBet.type === 'raise' ? 'Raise' : 'Bet'}
                  onClick={() => setShowBetSlider((prev) => !prev)}
                  disabled={isProcessing}
                  className="bg-chip-gold hover:bg-chip-gold/80 text-gray-900"
                />
              )}

              {/* All-In — always available as an option */}
              <ActionButton
                label="All-In"
                onClick={() =>
                  handleAction({ type: 'all-in', amount: playerChips })
                }
                disabled={isProcessing}
                className="bg-gradient-to-r from-chip-red to-red-700 text-white ring-1 ring-red-400/30 hover:from-red-700 hover:to-chip-red"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  ActionButton — small reusable button within this module            */
/* ------------------------------------------------------------------ */

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  disabled: boolean;
  className: string;
}

function ActionButton({ label, onClick, disabled, className }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition-colors disabled:opacity-50 ${className}`}
    >
      {label}
    </button>
  );
}
