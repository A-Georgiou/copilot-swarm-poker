/**
 * Type declarations for the 'pokersolver' npm package.
 * pokersolver does not ship its own types; this provides the subset we use.
 */
declare module 'pokersolver' {
  /** A single playing card as parsed by pokersolver. */
  export class Card {
    value: string;
    suit: string;
    rank: number;
    wildValue: string;
    toString(): string;
  }

  /** A solved poker hand (best 5 from the card pool). */
  export class Hand {
    /** Numeric rank where higher is better (1 = High Card … 9 = Straight Flush). */
    rank: number;
    /** Human-readable hand category, e.g. "Flush", "Full House". */
    name: string;
    /** Longer description, e.g. "Flush, A High". */
    descr: string;
    /** The 5 cards that form the best hand. */
    cards: Card[];
    /** All cards that were provided for evaluation. */
    cardPool: Card[];

    /**
     * Compare this hand against another.
     * Returns the losing hand, or `false` if this hand does not lose.
     */
    loseTo(other: Hand): Hand | false;

    /**
     * Solve the best possible hand from an array of card strings.
     * @param cards  Card strings like ['Ad', 'Kh', 'Ts', '3c', …]
     * @param game   Game variant (defaults to 'standard' for Texas Hold'em)
     */
    static solve(cards: string[], game?: string): Hand;

    /**
     * Given an array of solved hands, return the winner(s).
     * Handles ties by returning multiple hands.
     */
    static winners(hands: Hand[]): Hand[];
  }
}
