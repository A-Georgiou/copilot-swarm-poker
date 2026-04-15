/**
 * GameContext — React context that composes all game hooks.
 *
 * Wraps the application in a single provider that exposes socket
 * connection, game state, chat, and animation data via useGame().
 */

import { createContext, useContext, type ReactNode } from 'react';
import type {
  PlayerGameView,
  LegalAction,
  PlayerAction,
  ChatMessage,
  GameEvent,
} from '@poker/shared';
import { useSocket } from '../hooks/useSocket';
import { useGameState } from '../hooks/useGameState';
import { useChat } from '../hooks/useChat';
import { useGameEvents, type AnimationItem } from '../hooks/useGameEvents';

/* ------------------------------------------------------------------ */
/*  Context value shape                                                */
/* ------------------------------------------------------------------ */

export interface GameContextValue {
  /* Connection */
  isConnected: boolean;

  /* Game state */
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

  /* Chat */
  messages: ChatMessage[];
  sendChat: (message: string) => void;
  thinkingAgents: string[];

  /* Events & animations */
  currentAnimations: AnimationItem[];
  eventLog: GameEvent[];
  clearAnimation: (id: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const GameContext = createContext<GameContextValue | null>(null);

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function GameProvider({ children }: { children: ReactNode }) {
  const { socket, isConnected } = useSocket();

  const {
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
  } = useGameState(socket);

  const { messages, sendChat, thinkingAgents } = useChat(socket);

  const { currentAnimations, eventLog, clearAnimation } =
    useGameEvents(socket);

  const value: GameContextValue = {
    isConnected,
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
    messages,
    sendChat,
    thinkingAgents,
    currentAnimations,
    eventLog,
    clearAnimation,
  };

  return (
    <GameContext.Provider value={value}>{children}</GameContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Consumer hook                                                      */
/* ------------------------------------------------------------------ */

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a <GameProvider>');
  }
  return context;
}
