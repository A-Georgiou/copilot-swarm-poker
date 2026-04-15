/**
 * Pot manager — tracks player contributions across all betting rounds and
 * computes side pots for all-in scenarios.
 *
 * Side-pot algorithm:
 *   1. Collect each player's total contribution across the hand.
 *   2. Sort contributions ascending.
 *   3. Layer by layer, create pots where each contributor at that level or
 *      above is eligible (unless they folded).
 *   4. Merge consecutive pots that share the same eligible set.
 */

import type { SidePot } from '@poker/shared';

export class PotManager {
  /** Total chips contributed by each player across the entire hand. */
  private contributions = new Map<string, number>();

  /** Reset for a new hand. */
  reset(): void {
    this.contributions.clear();
  }

  /** Record a player adding chips (e.g. posting a blind or betting). */
  addContribution(playerId: string, amount: number): void {
    const current = this.contributions.get(playerId) ?? 0;
    this.contributions.set(playerId, current + amount);
  }

  /** Get a single player's total contribution so far. */
  getContribution(playerId: string): number {
    return this.contributions.get(playerId) ?? 0;
  }

  /** Sum of all contributions. */
  getTotalPot(): number {
    let total = 0;
    for (const amount of this.contributions.values()) {
      total += amount;
    }
    return total;
  }

  /**
   * Collect bets from the current betting round into contributions.
   * Each entry represents the chips a player bet during this round.
   */
  collectBets(playerBets: Array<{ playerId: string; amount: number }>): void {
    for (const { playerId, amount } of playerBets) {
      if (amount > 0) {
        this.addContribution(playerId, amount);
      }
    }
  }

  /**
   * Build side pots from accumulated contributions.
   *
   * @param foldedPlayerIds  Players who folded — they contributed but are not
   *                         eligible to win any pot.
   */
  calculateSidePots(foldedPlayerIds: Set<string>): SidePot[] {
    const entries = Array.from(this.contributions.entries())
      .map(([id, amount]) => ({
        id,
        amount,
        eligible: !foldedPlayerIds.has(id),
      }))
      .sort((a, b) => a.amount - b.amount);

    const pots: SidePot[] = [];
    let previousLevel = 0;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      if (entry.amount <= previousLevel) continue;

      const layerSize = entry.amount - previousLevel;
      const contributorCount = entries.length - i;
      const potAmount = layerSize * contributorCount;

      const eligible = entries
        .slice(i)
        .filter((e) => e.eligible)
        .map((e) => e.id);

      if (potAmount > 0) {
        if (eligible.length > 0) {
          pots.push({ amount: potAmount, eligiblePlayerIds: eligible });
        } else if (pots.length > 0) {
          // Dead money from folded players — add to the previous pot
          pots[pots.length - 1]!.amount += potAmount;
        }
        // Edge: if no pots exist and no one is eligible, money is orphaned.
        // This shouldn't happen in a valid game (at least one player remains).
      }

      previousLevel = entry.amount;
    }

    return this.mergePots(pots);
  }

  /**
   * Distribute pots to winners. Returns a map of playerId → chips won.
   *
   * @param pots           The side pots (from calculateSidePots).
   * @param winnersPerPot  Parallel array — winnersPerPot[i] lists the winner
   *                       IDs for pots[i]. Ties split evenly; odd chips go to
   *                       the earliest winner in the array.
   */
  distributePots(
    pots: SidePot[],
    winnersPerPot: string[][],
  ): Map<string, number> {
    const awards = new Map<string, number>();

    for (let i = 0; i < pots.length; i++) {
      const pot = pots[i]!;
      const winners = winnersPerPot[i] ?? [];
      if (winners.length === 0) continue;

      const share = Math.floor(pot.amount / winners.length);
      const remainder = pot.amount % winners.length;

      for (let j = 0; j < winners.length; j++) {
        const winnerId = winners[j]!;
        const current = awards.get(winnerId) ?? 0;
        // Odd-chip rule: leftover chips go to the earliest winners
        const extra = j < remainder ? 1 : 0;
        awards.set(winnerId, current + share + extra);
      }
    }

    return awards;
  }

  // ── Private helpers ──────────────────────────────────────────────────

  /** Merge consecutive pots whose eligible sets are identical. */
  private mergePots(pots: SidePot[]): SidePot[] {
    if (pots.length <= 1) return pots;

    const merged: SidePot[] = [pots[0]!];

    for (let i = 1; i < pots.length; i++) {
      const prev = merged[merged.length - 1]!;
      const curr = pots[i]!;

      if (this.sameEligible(prev.eligiblePlayerIds, curr.eligiblePlayerIds)) {
        prev.amount += curr.amount;
      } else {
        merged.push(curr);
      }
    }

    return merged;
  }

  /** Check whether two eligibility arrays contain the same player IDs. */
  private sameEligible(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((v, i) => v === sortedB[i]);
  }
}
