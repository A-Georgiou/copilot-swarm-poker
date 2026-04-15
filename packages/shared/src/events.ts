/**
 * Game event types — discriminated union for all events emitted during a hand.
 */

import type { Card } from './cards.js';
import type {
  Blinds,
  PlayerAction,
  PlayerPublicInfo,
  SidePot,
  Street,
} from './game-types.js';

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
  isThinking?: boolean;
}

export interface HandStartedEvent {
  type: 'hand_started';
  handId: string;
  handNumber: number;
  dealerPosition: number;
  players: PlayerPublicInfo[];
  blinds: Blinds;
}

export interface BlindsPostedEvent {
  type: 'blinds_posted';
  smallBlindPlayerId: string;
  smallBlindAmount: number;
  bigBlindPlayerId: string;
  bigBlindAmount: number;
  pot: number;
}

export interface CardsDealtEvent {
  type: 'cards_dealt';
  playerId: string;
  cards: [Card, Card];
}

export interface PlayerActedEvent {
  type: 'player_acted';
  playerId: string;
  playerName: string;
  action: PlayerAction;
  pot: number;
  playerChips: number;
}

export interface StreetAdvancedEvent {
  type: 'street_advanced';
  street: Street;
  communityCards: Card[];
  pot: number;
}

export interface ShowdownStartedEvent {
  type: 'showdown_started';
  players: Array<{
    playerId: string;
    playerName: string;
    holeCards: [Card, Card];
  }>;
  communityCards: Card[];
}

export interface HandResultEvent {
  type: 'hand_result';
  winners: Array<{
    playerId: string;
    playerName: string;
    amount: number;
    handDescription: string;
    holeCards: [Card, Card];
  }>;
  sidePots: SidePot[];
  pot: number;
}

export interface PlayerBustedEvent {
  type: 'player_busted';
  playerId: string;
  playerName: string;
  finishPosition: number;
}

export interface ChatMessageEvent {
  type: 'chat_message';
  message: ChatMessage;
}

export interface GameErrorEvent {
  type: 'game_error';
  error: string;
  playerId?: string;
}

export interface ThinkingStartedEvent {
  type: 'thinking_started';
  playerId: string;
  playerName: string;
}

export interface ThinkingEndedEvent {
  type: 'thinking_ended';
  playerId: string;
  playerName: string;
}

export type GameEvent =
  | HandStartedEvent
  | BlindsPostedEvent
  | CardsDealtEvent
  | PlayerActedEvent
  | StreetAdvancedEvent
  | ShowdownStartedEvent
  | HandResultEvent
  | PlayerBustedEvent
  | ChatMessageEvent
  | GameErrorEvent
  | ThinkingStartedEvent
  | ThinkingEndedEvent;
