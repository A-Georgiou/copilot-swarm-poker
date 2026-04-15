/**
 * Core poker game engine — the deterministic state machine that is the single
 * source of truth for a Texas Hold'em hand.
 *
 * Fully synchronous, no I/O, no randomness beyond the initial deck shuffle.
 * Implements the information-firewall pattern: `getPlayerView` projects the
 * authoritative `FullGameState` into a filtered `PlayerGameView` per player.
 */

import {
  type Card,
  type Blinds,
  type FullGameState,
  type LegalAction,
  type PlayerAction,
  type PlayerGameView,
  type PlayerPublicInfo,
  type RecordedAction,
  type SidePot,
  type SpectatorView,
  PlayerStatus,
  Street,
} from '@poker/shared';

import { createDeck, shuffleDeck, dealCards } from './deck.js';
import { compareHands, evaluateHand } from './hand-evaluator.js';
import { PotManager } from './pot-manager.js';

// ── Local types ────────────────────────────────────────────────────────

export interface HandResult {
  winners: Array<{
    playerId: string;
    playerName: string;
    amount: number;
    handDescription: string;
    holeCards: [Card, Card];
  }>;
  sidePots: SidePot[];
  totalPot: number;
}

interface PlayerConfig {
  id: string;
  name: string;
  chips: number;
}

// ── GameEngine ─────────────────────────────────────────────────────────

export class GameEngine {
  private state: FullGameState;
  private potManager = new PotManager();

  /** Players who still need to act before the current betting round closes. */
  private playersYetToAct = new Set<string>();

  /** Size of the last raise increment (defaults to big blind). */
  private lastRaiseSize: number;

  /** Cached result once the hand finishes. */
  private handResult: HandResult | null = null;

  constructor(
    playerConfigs: PlayerConfig[],
    blinds: Blinds,
  ) {
    if (playerConfigs.length < 2) {
      throw new Error('At least 2 players are required');
    }

    this.lastRaiseSize = blinds.big;

    const players: PlayerPublicInfo[] = playerConfigs.map((cfg, i) => ({
      id: cfg.id,
      name: cfg.name,
      chips: cfg.chips,
      status: cfg.chips > 0 ? PlayerStatus.ACTIVE : PlayerStatus.BUSTED,
      currentBet: 0,
      seatIndex: i,
      isDealer: false,
      isSmallBlind: false,
      isBigBlind: false,
      isCurrent: false,
    }));

    this.state = {
      deck: [],
      holeCards: new Map(),
      communityCards: [],
      pot: 0,
      sidePots: [],
      street: Street.PREFLOP,
      dealerPosition: -1, // will be set to 0 on first startHand()
      currentPlayerIndex: 0,
      players,
      actionHistory: [],
      blinds,
      minRaise: blinds.big,
      handId: '',
      handNumber: 0,
    };
  }

  // ── Public API ─────────────────────────────────────────────────────

  /** Read-only access to the authoritative game state (server-side only). */
  getState(): FullGameState {
    return this.state;
  }

  /**
   * Start a new hand: rotate dealer, post blinds, deal hole cards,
   * set street to PREFLOP, and set the first player to act.
   */
  startHand(): void {
    const activePlayers = this.state.players.filter(
      (p) => p.status !== PlayerStatus.BUSTED && p.status !== PlayerStatus.SITTING_OUT,
    );
    if (activePlayers.length < 2) {
      throw new Error('Not enough active players to start a hand');
    }

    // ── Reset hand state ───────────────────────────────────────────
    this.handResult = null;
    this.potManager.reset();
    this.state.handNumber += 1;
    this.state.handId = `hand-${this.state.handNumber}`;
    this.state.communityCards = [];
    this.state.pot = 0;
    this.state.sidePots = [];
    this.state.actionHistory = [];
    this.state.holeCards = new Map();
    this.lastRaiseSize = this.state.blinds.big;
    this.state.minRaise = this.state.blinds.big;

    // Reset player per-hand fields
    for (const player of this.state.players) {
      if (player.status !== PlayerStatus.BUSTED && player.status !== PlayerStatus.SITTING_OUT) {
        player.status = PlayerStatus.ACTIVE;
      }
      player.currentBet = 0;
      player.isDealer = false;
      player.isSmallBlind = false;
      player.isBigBlind = false;
      player.isCurrent = false;
    }

    // ── Rotate dealer ──────────────────────────────────────────────
    this.state.dealerPosition = this.findNextEligibleSeat(this.state.dealerPosition);
    this.state.players[this.state.dealerPosition]!.isDealer = true;

    // ── Post blinds ────────────────────────────────────────────────
    const isHeadsUp = activePlayers.length === 2;
    const sbIndex = isHeadsUp
      ? this.state.dealerPosition
      : this.findNextEligibleSeat(this.state.dealerPosition);
    const bbIndex = this.findNextEligibleSeat(sbIndex);

    this.postBlind(sbIndex, this.state.blinds.small, 'small');
    this.postBlind(bbIndex, this.state.blinds.big, 'big');

    // ── Shuffle & deal hole cards ──────────────────────────────────
    this.state.deck = shuffleDeck(createDeck());

    for (const player of this.state.players) {
      if (player.status === PlayerStatus.ACTIVE || player.status === PlayerStatus.ALL_IN) {
        const { dealt, remaining } = dealCards(this.state.deck, 2);
        this.state.deck = remaining;
        this.state.holeCards.set(player.id, dealt as [Card, Card]);
      }
    }

    // ── Set street & first-to-act ──────────────────────────────────
    this.state.street = Street.PREFLOP;

    const firstToAct = isHeadsUp
      ? sbIndex // heads-up: SB (dealer) acts first preflop
      : this.findNextEligibleSeat(bbIndex);

    this.state.currentPlayerIndex = firstToAct;
    this.updateCurrentFlag();

    // Update displayed pot to include blinds
    this.state.pot = this.calculateCurrentPot();

    // Everyone active (non-folded, non-all-in) is yet to act
    this.initializePlayersYetToAct();
  }

  /** Return the legal actions available to the given player right now. */
  getLegalActions(playerId: string): LegalAction[] {
    const playerIndex = this.state.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) return [];

    const player = this.state.players[playerIndex]!;
    if (this.state.currentPlayerIndex !== playerIndex) return [];
    if (player.status !== PlayerStatus.ACTIVE) return [];
    if (this.state.street === Street.SHOWDOWN) return [];
    if (this.handResult !== null) return [];

    const actions: LegalAction[] = [];
    const highestBet = this.getHighestBet();
    const toCall = highestBet - player.currentBet;

    // Fold is always available
    actions.push({ type: 'fold' });

    if (toCall <= 0) {
      // No outstanding bet — player may check or open betting
      actions.push({ type: 'check' });

      if (player.chips > 0) {
        if (player.chips > this.state.blinds.big) {
          actions.push({
            type: 'bet',
            minAmount: this.state.blinds.big,
            maxAmount: player.chips,
          });
        }
        // All-in is always available when the player has chips
        actions.push({ type: 'all-in', minAmount: player.chips, maxAmount: player.chips });
      }
    } else {
      // There is a bet to match
      if (player.chips < toCall) {
        // Not enough to fully call — can only fold or go all-in
        actions.push({ type: 'all-in', minAmount: player.chips, maxAmount: player.chips });
      } else {
        // Can call
        actions.push({ type: 'call', minAmount: toCall, maxAmount: toCall });

        // Can raise?
        const minRaiseTo = highestBet + this.lastRaiseSize;
        const chipsNeededForMinRaise = minRaiseTo - player.currentBet;

        if (player.chips >= chipsNeededForMinRaise) {
          actions.push({
            type: 'raise',
            minAmount: minRaiseTo,
            maxAmount: player.chips + player.currentBet,
          });
        }

        // All-in is always available (covers short raise and max raise)
        actions.push({ type: 'all-in', minAmount: player.chips, maxAmount: player.chips });
      }
    }

    return actions;
  }

  /**
   * Apply a player action. Returns success/failure with an optional error.
   *
   * Amount semantics:
   *  - bet / raise: total bet amount (raise TO)
   *  - call: ignored (engine computes the call amount)
   *  - all-in: ignored (engine uses remaining chips)
   *  - fold / check: ignored
   */
  applyAction(
    playerId: string,
    action: PlayerAction,
  ): { success: boolean; error?: string } {
    // ── Validate ───────────────────────────────────────────────────
    const playerIndex = this.state.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) return { success: false, error: 'Unknown player' };

    const player = this.state.players[playerIndex]!;
    if (this.state.currentPlayerIndex !== playerIndex) {
      return { success: false, error: 'Not your turn' };
    }
    if (player.status !== PlayerStatus.ACTIVE) {
      return { success: false, error: 'Player cannot act' };
    }

    const legalActions = this.getLegalActions(playerId);
    const matchingLegal = legalActions.find((la) => la.type === action.type);
    if (!matchingLegal) {
      return { success: false, error: `Illegal action: ${action.type}` };
    }

    // ── Apply ──────────────────────────────────────────────────────
    const highestBet = this.getHighestBet();

    switch (action.type) {
      case 'fold': {
        player.status = PlayerStatus.FOLDED;
        break;
      }

      case 'check': {
        // Nothing changes — player passes
        break;
      }

      case 'call': {
        const callAmount = Math.min(highestBet - player.currentBet, player.chips);
        player.chips -= callAmount;
        player.currentBet += callAmount;
        if (player.chips === 0) player.status = PlayerStatus.ALL_IN;
        break;
      }

      case 'bet': {
        const betAmount = this.clampAmount(
          action.amount ?? this.state.blinds.big,
          matchingLegal,
        );
        player.chips -= betAmount;
        player.currentBet += betAmount;
        this.lastRaiseSize = betAmount;
        this.state.minRaise = betAmount;
        if (player.chips === 0) player.status = PlayerStatus.ALL_IN;
        this.reopenAction(playerId);
        break;
      }

      case 'raise': {
        const raiseTo = this.clampAmount(
          action.amount ?? (highestBet + this.lastRaiseSize),
          matchingLegal,
        );
        const additionalChips = raiseTo - player.currentBet;
        this.lastRaiseSize = raiseTo - highestBet;
        this.state.minRaise = this.lastRaiseSize;
        player.chips -= additionalChips;
        player.currentBet = raiseTo;
        if (player.chips === 0) player.status = PlayerStatus.ALL_IN;
        this.reopenAction(playerId);
        break;
      }

      case 'all-in': {
        const allInAmount = player.chips;
        const newTotalBet = player.currentBet + allInAmount;

        // If this exceeds the current highest bet, it acts as a raise
        if (newTotalBet > highestBet) {
          const raiseIncrement = newTotalBet - highestBet;
          if (raiseIncrement >= this.lastRaiseSize) {
            this.lastRaiseSize = raiseIncrement;
            this.state.minRaise = raiseIncrement;
          }
          this.reopenAction(playerId);
        }

        player.currentBet = newTotalBet;
        player.chips = 0;
        player.status = PlayerStatus.ALL_IN;
        break;
      }
    }

    // ── Record action ──────────────────────────────────────────────
    this.state.actionHistory.push({
      playerId,
      action,
      street: this.state.street,
      timestamp: Date.now(),
    });

    // Remove from yet-to-act
    this.playersYetToAct.delete(playerId);

    // ── Update pot total ───────────────────────────────────────────
    this.state.pot = this.calculateCurrentPot();

    // ── Post-action state transitions ──────────────────────────────
    const nonFolded = this.getNonFoldedPlayers();

    // 1) Only one player left → hand ends immediately
    if (nonFolded.length <= 1) {
      this.collectCurrentBets();
      this.endHandByFold(nonFolded[0]!);
      return { success: true };
    }

    // 2) Check if betting round is complete
    if (this.isBettingRoundComplete()) {
      this.collectCurrentBets();

      // All remaining players are all-in (or only one active)?
      // → run out the board to showdown
      if (this.shouldRunOutBoard()) {
        this.runOutBoard();
        return { success: true };
      }

      // More streets to play
      if (this.state.street === Street.RIVER) {
        this.state.street = Street.SHOWDOWN;
        this.handResult = this.handleShowdown();
      } else {
        this.advanceStreet();
      }
    } else {
      this.advanceToNextPlayer();
    }

    return { success: true };
  }

  /** Deal community cards for the next street and reset betting. */
  advanceStreet(): void {
    // Reset per-round state
    for (const player of this.state.players) {
      player.currentBet = 0;
    }
    this.lastRaiseSize = this.state.blinds.big;
    this.state.minRaise = this.state.blinds.big;

    switch (this.state.street) {
      case Street.PREFLOP: {
        const { dealt, remaining } = dealCards(this.state.deck, 3);
        this.state.communityCards = dealt;
        this.state.deck = remaining;
        this.state.street = Street.FLOP;
        break;
      }
      case Street.FLOP: {
        const { dealt, remaining } = dealCards(this.state.deck, 1);
        this.state.communityCards.push(...dealt);
        this.state.deck = remaining;
        this.state.street = Street.TURN;
        break;
      }
      case Street.TURN: {
        const { dealt, remaining } = dealCards(this.state.deck, 1);
        this.state.communityCards.push(...dealt);
        this.state.deck = remaining;
        this.state.street = Street.RIVER;
        break;
      }
      default:
        return;
    }

    // Set first-to-act for postflop: first active player left of dealer
    const firstActive = this.findNextActiveSeat(this.state.dealerPosition);
    if (firstActive !== -1) {
      this.state.currentPlayerIndex = firstActive;
      this.updateCurrentFlag();
    }

    this.initializePlayersYetToAct();
  }

  /**
   * Evaluate remaining hands, determine winners per pot, distribute chips.
   * Called when the river betting round completes with 2+ players remaining.
   */
  handleShowdown(): HandResult {
    const nonFolded = this.getNonFoldedPlayers();
    const foldedIds = new Set(
      this.state.players
        .filter((p) => p.status === PlayerStatus.FOLDED)
        .map((p) => p.id),
    );

    const pots = this.potManager.calculateSidePots(foldedIds);
    this.state.sidePots = pots;

    // Determine winners for each pot
    const winnersPerPot: string[][] = pots.map((pot) => {
      const eligible = pot.eligiblePlayerIds;
      const handsToCompare = eligible
        .map((id) => ({
          playerId: id,
          holeCards: this.state.holeCards.get(id) ?? [],
        }))
        .filter((h) => h.holeCards.length > 0);

      if (handsToCompare.length === 0) return [];
      if (handsToCompare.length === 1) return [handsToCompare[0]!.playerId];

      const { winners } = compareHands(
        handsToCompare as Array<{ playerId: string; holeCards: Card[] }>,
        this.state.communityCards,
      );
      return winners;
    });

    // Distribute chips
    const awards = this.potManager.distributePots(pots, winnersPerPot);

    // Build result and apply awards
    const resultWinners: HandResult['winners'] = [];
    const seen = new Set<string>();

    for (const [winnerId, amount] of awards) {
      const player = this.state.players.find((p) => p.id === winnerId);
      if (!player) continue;
      player.chips += amount;

      if (!seen.has(winnerId)) {
        seen.add(winnerId);
        const holeCards = this.state.holeCards.get(winnerId) as [Card, Card] | undefined;
        const evaluation = holeCards
          ? evaluateHand(holeCards, this.state.communityCards)
          : null;

        resultWinners.push({
          playerId: winnerId,
          playerName: player.name,
          amount,
          handDescription: evaluation?.name ?? 'Unknown',
          holeCards: holeCards ?? ([] as unknown as [Card, Card]),
        });
      }
    }

    this.handResult = {
      winners: resultWinners,
      sidePots: pots,
      totalPot: this.state.pot,
    };

    this.state.street = Street.SHOWDOWN;
    this.state.currentPlayerIndex = -1;
    this.updateCurrentFlag();

    return this.handResult;
  }

  /**
   * Information firewall — project the full state into what a single player
   * is allowed to see: their own hole cards, public info, and legal actions
   * only when it's their turn.
   */
  getPlayerView(playerId: string): PlayerGameView {
    return {
      communityCards: [...this.state.communityCards],
      pot: this.state.pot,
      sidePots: [...this.state.sidePots],
      street: this.state.street,
      dealerPosition: this.state.dealerPosition,
      currentPlayerIndex: this.state.currentPlayerIndex,
      players: this.state.players.map((p) => ({ ...p })),
      blinds: { ...this.state.blinds },
      minRaise: this.state.minRaise,
      myHoleCards: this.state.holeCards.get(playerId)
        ? ([...this.state.holeCards.get(playerId)!] as [Card, Card])
        : [],
      myPlayerId: playerId,
      legalActions: this.getLegalActions(playerId),
      actionHistory: [...this.state.actionHistory],
      handId: this.state.handId,
    };
  }

  /** Spectator view — identical shape to PlayerGameView. */
  getSpectatorView(humanPlayerId: string): SpectatorView {
    return this.getPlayerView(humanPlayerId) as SpectatorView;
  }

  /** True once the current hand has concluded. */
  isHandComplete(): boolean {
    return this.handResult !== null;
  }

  /** The player who must act next, or null if no action is pending. */
  getCurrentPlayerId(): string | null {
    if (this.handResult !== null) return null;
    if (this.state.currentPlayerIndex < 0) return null;
    if (this.state.currentPlayerIndex >= this.state.players.length) return null;
    return this.state.players[this.state.currentPlayerIndex]?.id ?? null;
  }

  /** Get the result of the completed hand (null if hand is still in progress). */
  getHandResult(): HandResult | null {
    return this.handResult;
  }

  // ── Private helpers ──────────────────────────────────────────────────

  /** Post a blind for the player at `seatIndex`. */
  private postBlind(
    seatIndex: number,
    amount: number,
    type: 'small' | 'big',
  ): void {
    const player = this.state.players[seatIndex]!;
    const blindAmount = Math.min(amount, player.chips);

    player.chips -= blindAmount;
    player.currentBet = blindAmount;

    if (type === 'small') player.isSmallBlind = true;
    if (type === 'big') player.isBigBlind = true;

    if (player.chips === 0) {
      player.status = PlayerStatus.ALL_IN;
    }
  }

  /** Find the next seat (clockwise) occupied by an eligible player. */
  private findNextEligibleSeat(fromSeat: number): number {
    const n = this.state.players.length;
    for (let offset = 1; offset <= n; offset++) {
      const idx = (fromSeat + offset) % n;
      const player = this.state.players[idx]!;
      if (
        player.status !== PlayerStatus.BUSTED &&
        player.status !== PlayerStatus.SITTING_OUT
      ) {
        return idx;
      }
    }
    return 0;
  }

  /** Find the next ACTIVE (can still bet) player clockwise from a seat. */
  private findNextActiveSeat(fromSeat: number): number {
    const n = this.state.players.length;
    for (let offset = 1; offset <= n; offset++) {
      const idx = (fromSeat + offset) % n;
      if (this.state.players[idx]!.status === PlayerStatus.ACTIVE) {
        return idx;
      }
    }
    return -1;
  }

  /** Move the turn indicator to the next player who can act. */
  private advanceToNextPlayer(): void {
    const nextSeat = this.findNextActiveSeat(this.state.currentPlayerIndex);
    if (nextSeat !== -1) {
      this.state.currentPlayerIndex = nextSeat;
    }
    this.updateCurrentFlag();
  }

  /** Set `isCurrent` on exactly the player at `currentPlayerIndex`. */
  private updateCurrentFlag(): void {
    for (let i = 0; i < this.state.players.length; i++) {
      this.state.players[i]!.isCurrent = i === this.state.currentPlayerIndex;
    }
  }

  /** Get all non-folded, non-busted, non-sitting-out players. */
  private getNonFoldedPlayers(): PlayerPublicInfo[] {
    return this.state.players.filter(
      (p) =>
        p.status === PlayerStatus.ACTIVE || p.status === PlayerStatus.ALL_IN,
    );
  }

  /** The highest current bet in this betting round. */
  private getHighestBet(): number {
    return Math.max(0, ...this.state.players.map((p) => p.currentBet));
  }

  /** Sum all current bets + pot manager total to get the displayed pot. */
  private calculateCurrentPot(): number {
    const currentBets = this.state.players.reduce((sum, p) => sum + p.currentBet, 0);
    return this.potManager.getTotalPot() + currentBets;
  }

  /** Move current-round bets into the pot manager's contribution tracking. */
  private collectCurrentBets(): void {
    const bets = this.state.players
      .filter((p) => p.currentBet > 0)
      .map((p) => ({ playerId: p.id, amount: p.currentBet }));

    this.potManager.collectBets(bets);

    for (const player of this.state.players) {
      player.currentBet = 0;
    }

    this.state.pot = this.potManager.getTotalPot();
  }

  /**
   * Initialize the set of players who must act before the round closes.
   * Includes all ACTIVE (non-folded, non-all-in) players.
   */
  private initializePlayersYetToAct(): void {
    this.playersYetToAct.clear();
    for (const player of this.state.players) {
      if (player.status === PlayerStatus.ACTIVE) {
        this.playersYetToAct.add(player.id);
      }
    }
  }

  /**
   * After a bet or raise, re-add all other active players to the
   * yet-to-act set (they must respond to the new aggression).
   */
  private reopenAction(aggressorId: string): void {
    for (const player of this.state.players) {
      if (player.status === PlayerStatus.ACTIVE && player.id !== aggressorId) {
        this.playersYetToAct.add(player.id);
      }
    }
  }

  /** The betting round is over when every active player has acted. */
  private isBettingRoundComplete(): boolean {
    // No one left to act
    if (this.playersYetToAct.size > 0) return false;

    // Double-check: all active players have matching bets
    const activePlayers = this.state.players.filter(
      (p) => p.status === PlayerStatus.ACTIVE,
    );
    if (activePlayers.length === 0) return true;

    const highestBet = this.getHighestBet();
    return activePlayers.every((p) => p.currentBet === highestBet);
  }

  /**
   * Should we run out the board? True when there are 2+ non-folded players
   * but at most 1 is ACTIVE (the rest are ALL_IN).
   */
  private shouldRunOutBoard(): boolean {
    const nonFolded = this.getNonFoldedPlayers();
    const active = nonFolded.filter((p) => p.status === PlayerStatus.ACTIVE);
    return nonFolded.length >= 2 && active.length <= 1;
  }

  /** Deal remaining community cards without betting and go to showdown. */
  private runOutBoard(): void {
    while (
      this.state.street !== Street.RIVER &&
      this.state.street !== Street.SHOWDOWN
    ) {
      this.advanceStreetInternal();
    }

    // If we advanced to RIVER but betting was skipped, go to showdown
    if (this.state.street === Street.RIVER) {
      this.state.street = Street.SHOWDOWN;
    }

    this.handResult = this.handleShowdown();
  }

  /**
   * Deal community cards for the next street without resetting action tracking.
   * Used by `runOutBoard` to deal remaining cards when all players are all-in.
   */
  private advanceStreetInternal(): void {
    switch (this.state.street) {
      case Street.PREFLOP: {
        const { dealt, remaining } = dealCards(this.state.deck, 3);
        this.state.communityCards = dealt;
        this.state.deck = remaining;
        this.state.street = Street.FLOP;
        break;
      }
      case Street.FLOP: {
        const { dealt, remaining } = dealCards(this.state.deck, 1);
        this.state.communityCards.push(...dealt);
        this.state.deck = remaining;
        this.state.street = Street.TURN;
        break;
      }
      case Street.TURN: {
        const { dealt, remaining } = dealCards(this.state.deck, 1);
        this.state.communityCards.push(...dealt);
        this.state.deck = remaining;
        this.state.street = Street.RIVER;
        break;
      }
      default:
        break;
    }
  }

  /** End the hand when all but one player have folded. */
  private endHandByFold(winner: PlayerPublicInfo): void {
    const totalPot = this.potManager.getTotalPot();
    winner.chips += totalPot;

    this.handResult = {
      winners: [
        {
          playerId: winner.id,
          playerName: winner.name,
          amount: totalPot,
          handDescription: 'Last player standing',
          holeCards: this.state.holeCards.get(winner.id) as [Card, Card] ??
            ([] as unknown as [Card, Card]),
        },
      ],
      sidePots: [],
      totalPot,
    };

    this.state.street = Street.SHOWDOWN;
    this.state.currentPlayerIndex = -1;
    this.updateCurrentFlag();
  }

  /** Clamp an action amount to the legal min/max range. */
  private clampAmount(amount: number, legal: LegalAction): number {
    const min = legal.minAmount ?? 0;
    const max = legal.maxAmount ?? amount;
    return Math.max(min, Math.min(max, amount));
  }
}
