/**
 * Core game state types for Texas Hold'em.
 * Implements the information firewall pattern: FullGameState (server-only)
 * is projected into PlayerGameView (per-player filtered view).
 */

import type { Card } from './cards.js';

export enum Street {
  PREFLOP = 'PREFLOP',
  FLOP = 'FLOP',
  TURN = 'TURN',
  RIVER = 'RIVER',
  SHOWDOWN = 'SHOWDOWN',
}

export enum PlayerStatus {
  ACTIVE = 'ACTIVE',
  FOLDED = 'FOLDED',
  ALL_IN = 'ALL_IN',
  SITTING_OUT = 'SITTING_OUT',
  BUSTED = 'BUSTED',
}

export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in';

export interface PlayerAction {
  type: ActionType;
  amount?: number;
}

export interface LegalAction {
  type: ActionType;
  minAmount?: number;
  maxAmount?: number;
}

export interface PlayerPublicInfo {
  id: string;
  name: string;
  chips: number;
  status: PlayerStatus;
  currentBet: number;
  seatIndex: number;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  isCurrent: boolean;
}

export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface Blinds {
  small: number;
  big: number;
}

export interface RecordedAction {
  playerId: string;
  action: PlayerAction;
  street: Street;
  timestamp: number;
}

/** Server-side authoritative game state — never sent to clients directly. */
export interface FullGameState {
  deck: Card[];
  holeCards: Map<string, [Card, Card]>;
  communityCards: Card[];
  pot: number;
  sidePots: SidePot[];
  street: Street;
  dealerPosition: number;
  currentPlayerIndex: number;
  players: PlayerPublicInfo[];
  actionHistory: RecordedAction[];
  blinds: Blinds;
  minRaise: number;
  handId: string;
  handNumber: number;
}

/** Per-player filtered view — safe to send to an individual player/agent. */
export interface PlayerGameView {
  communityCards: Card[];
  pot: number;
  sidePots: SidePot[];
  street: Street;
  dealerPosition: number;
  currentPlayerIndex: number;
  players: PlayerPublicInfo[];
  blinds: Blinds;
  minRaise: number;
  myHoleCards: [Card, Card] | [];
  myPlayerId: string;
  legalActions: LegalAction[];
  actionHistory: RecordedAction[];
  handId: string;
}

/** Spectator view for the human UI — includes the spectator's own hole cards. */
export interface SpectatorView {
  communityCards: Card[];
  pot: number;
  sidePots: SidePot[];
  street: Street;
  dealerPosition: number;
  currentPlayerIndex: number;
  players: PlayerPublicInfo[];
  blinds: Blinds;
  minRaise: number;
  myHoleCards: [Card, Card] | [];
  myPlayerId: string;
  legalActions: LegalAction[];
  actionHistory: RecordedAction[];
  handId: string;
}
