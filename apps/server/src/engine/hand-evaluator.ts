/**
 * Hand evaluator — thin wrapper around the 'pokersolver' package.
 *
 * Converts between our Card type and pokersolver's string format (they
 * happen to match — both use 'Ad', 'Kh', 'Ts', etc.) and maps the result
 * back to our EvaluatedHand / HandRank types.
 */

import pokersolver from 'pokersolver';
const { Hand } = pokersolver;

type SolvedHand = ReturnType<typeof Hand.solve>;

import {
  type Card,
  type EvaluatedHand,
  HandRank,
} from '@poker/shared';

/**
 * Map pokersolver's numeric rank (1-9) to our HandRank enum.
 * pokersolver: 1=HighCard … 9=StraightFlush. Royal Flush is a
 * StraightFlush whose `descr` starts with "Royal Flush".
 */
function toHandRank(solvedHand: SolvedHand): HandRank {
  if (solvedHand.descr.startsWith('Royal Flush')) {
    return HandRank.ROYAL_FLUSH;
  }

  const mapping: Record<number, HandRank> = {
    1: HandRank.HIGH_CARD,
    2: HandRank.ONE_PAIR,
    3: HandRank.TWO_PAIR,
    4: HandRank.THREE_OF_A_KIND,
    5: HandRank.STRAIGHT,
    6: HandRank.FLUSH,
    7: HandRank.FULL_HOUSE,
    8: HandRank.FOUR_OF_A_KIND,
    9: HandRank.STRAIGHT_FLUSH,
  };

  return mapping[solvedHand.rank] ?? HandRank.HIGH_CARD;
}

/** Convert a pokersolver Card back to our Card string. */
function toCard(pCard: { value: string; suit: string }): Card {
  return `${pCard.value}${pCard.suit}` as Card;
}

/** Evaluate a single player's best 5-card hand from hole + community cards. */
export function evaluateHand(
  holeCards: Card[],
  communityCards: Card[],
): EvaluatedHand {
  const allCards = [...holeCards, ...communityCards];
  const solved = Hand.solve(allCards as string[]);

  return {
    rank: toHandRank(solved),
    name: solved.descr,
    cards: solved.cards.map(toCard),
  };
}

/**
 * Compare multiple players' hands against the same community cards.
 * Returns the winning player IDs and every player's evaluation.
 */
export function compareHands(
  hands: Array<{ playerId: string; holeCards: Card[] }>,
  communityCards: Card[],
): {
  winners: string[];
  evaluations: Map<string, EvaluatedHand>;
} {
  const evaluations = new Map<string, EvaluatedHand>();
  const solvedByPlayer = new Map<string, SolvedHand>();

  for (const { playerId, holeCards } of hands) {
    const allCards = [...holeCards, ...communityCards];
    const solved = Hand.solve(allCards as string[]);

    solvedByPlayer.set(playerId, solved);
    evaluations.set(playerId, {
      rank: toHandRank(solved),
      name: solved.descr,
      cards: solved.cards.map(toCard),
    });
  }

  // Use pokersolver's built-in winner detection (handles ties correctly)
  const solvedHands = Array.from(solvedByPlayer.values());
  const winningHands = Hand.winners(solvedHands);
  const winningHandSet = new Set(winningHands);

  const winners: string[] = [];
  for (const [playerId, solved] of solvedByPlayer) {
    if (winningHandSet.has(solved)) {
      winners.push(playerId);
    }
  }

  return { winners, evaluations };
}
