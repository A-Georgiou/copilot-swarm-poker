/**
 * Card types and hand evaluation types for Texas Hold'em.
 */

export enum Suit {
  HEARTS = 'h',
  DIAMONDS = 'd',
  CLUBS = 'c',
  SPADES = 's',
}

export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export type Card = `${Rank}${Suit}`;

export const ALL_RANKS: readonly Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;

export const ALL_SUITS: readonly Suit[] = [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES] as const;

export enum HandRank {
  HIGH_CARD = 1,
  ONE_PAIR = 2,
  TWO_PAIR = 3,
  THREE_OF_A_KIND = 4,
  STRAIGHT = 5,
  FLUSH = 6,
  FULL_HOUSE = 7,
  FOUR_OF_A_KIND = 8,
  STRAIGHT_FLUSH = 9,
  ROYAL_FLUSH = 10,
}

export interface EvaluatedHand {
  rank: HandRank;
  name: string;
  cards: Card[];
}
