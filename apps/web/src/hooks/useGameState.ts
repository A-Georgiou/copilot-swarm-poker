/**
 * useGameState — Manages the full poker game state.
 *
 * Listens for server events to keep state in sync:
 *   • 'game_state'  → full state snapshot (PlayerGameView)
 *   • 'your_turn'   → signals it is the human's turn with legal actions
 *   • 'game_event'  → incremental updates (hand_started, player_acted, etc.)
 *
 * Exposes actions: sendAction, startGame, nextHand.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type {
  PlayerGameView,
  LegalAction,
  PlayerAction,
  GameEvent,
} from '@poker/shared';
import { Street } from '@poker/shared';

/* ------------------------------------------------------------------ */
/*  Return type                                                        */
/* ------------------------------------------------------------------ */

export interface UseGameStateReturn {
  gameState: PlayerGameView | null;
  isMyTurn: boolean;
  legalActions: LegalAction[];
  sendAction: (action: PlayerAction) => void;
  startGame: () => void;
  nextHand: () => void;
  isProcessing: boolean;
  gameStarted: boolean;
  handInProgress: boolean;
  handNumber: number;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useGameState(socket: Socket | null): UseGameStateReturn {
  const [gameState, setGameState] = useState<PlayerGameView | null>(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [legalActions, setLegalActions] = useState<LegalAction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [handInProgress, setHandInProgress] = useState(false);
  const [handNumber, setHandNumber] = useState(0);

  /* ── Socket listeners ──────────────────────────────────────────── */

  useEffect(() => {
    if (!socket) return;

    /** Full state snapshot from the server. */
    const handleGameState = (state: PlayerGameView) => {
      setGameState(state);
      setGameStarted(true);
      setHandInProgress(state.street !== Street.SHOWDOWN);
    };

    /** Server signals it is our turn. */
    const handleYourTurn = (data: { legalActions: LegalAction[] }) => {
      setIsMyTurn(true);
      setLegalActions(data.legalActions);
      setIsProcessing(false);
    };

    /** Incremental game events for optimistic UI updates. */
    const handleGameEvent = (event: GameEvent) => {
      switch (event.type) {
        case 'hand_started':
          setHandNumber(event.handNumber);
          setHandInProgress(true);
          break;

        case 'hand_result':
          setHandInProgress(false);
          setIsMyTurn(false);
          setLegalActions([]);
          break;

        case 'player_acted':
          setGameState((prev) =>
            prev ? { ...prev, pot: event.pot } : prev,
          );
          break;

        case 'street_advanced':
          setGameState((prev) =>
            prev
              ? {
                  ...prev,
                  street: event.street,
                  communityCards: event.communityCards,
                  pot: event.pot,
                }
              : prev,
          );
          break;
      }
    };

    socket.on('game_state', handleGameState);
    socket.on('your_turn', handleYourTurn);
    socket.on('game_event', handleGameEvent);

    return () => {
      socket.off('game_state', handleGameState);
      socket.off('your_turn', handleYourTurn);
      socket.off('game_event', handleGameEvent);
    };
  }, [socket]);

  /* ── Actions ───────────────────────────────────────────────────── */

  const sendAction = useCallback(
    (action: PlayerAction) => {
      if (!socket || isProcessing) return;
      setIsProcessing(true);
      setIsMyTurn(false);
      socket.emit('player_action', action);
    },
    [socket, isProcessing],
  );

  const startGame = useCallback(() => {
    if (!socket) return;
    socket.emit('start_game');
    setGameStarted(true);
  }, [socket]);

  const nextHand = useCallback(() => {
    if (!socket) return;
    socket.emit('next_hand');
  }, [socket]);

  return {
    gameState,
    isMyTurn,
    legalActions,
    sendAction,
    startGame,
    nextHand,
    isProcessing,
    gameStarted,
    handInProgress,
    handNumber,
  };
}
