/**
 * Deck utilities — create, shuffle (Fisher-Yates), and deal cards.
 * All functions are pure and deterministic (given the same input).
 */

import { type Card, type Rank, ALL_RANKS, ALL_SUITS } from '@poker/shared';

/** Create a standard 52-card deck. */
export function createDeck(): Card[] {
  const deck: Card[] = [];

  for (const rank of ALL_RANKS) {
    for (const suit of ALL_SUITS) {
      deck.push(`${rank}${suit}` as Card);
    }
  }

  return deck;
}

/** Return a new array with cards shuffled using the Fisher-Yates algorithm. */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i]!, shuffled[j]!] = [shuffled[j]!, shuffled[i]!];
  }

  return shuffled;
}

/** Deal `count` cards from the top of the deck. */
export function dealCards(
  deck: Card[],
  count: number,
): { dealt: Card[]; remaining: Card[] } {
  if (count > deck.length) {
    throw new Error(`Cannot deal ${count} cards from a deck of ${deck.length}`);
  }

  return {
    dealt: deck.slice(0, count),
    remaining: deck.slice(count),
  };
}
