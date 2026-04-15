/**
 * Game orchestrator — the core game loop that wires together the engine,
 * event bus, chat scheduler, director, and AI stubs.
 *
 * Manages the full lifecycle of a poker game: starting hands, processing
 * AI turns with realistic delays, waiting for human input, emitting
 * events, and scheduling social chat.
 */

import {
  type AgentPersona,
  type Card,
  type ChatMessage,
  type GameEvent,
  type LegalAction,
  type PlayerAction,
  type PlayerPublicInfo,
  type SpectatorView,
  PlayerStatus,
  Street,
} from '@poker/shared';

import { GameEngine, type HandResult } from './engine/index.js';
import { GameEventBus, ChatScheduler } from './events/index.js';
import { Director, type ChatOpportunity } from './director.js';
import { nanoid } from 'nanoid';

// ── Constants ──────────────────────────────────────────────────────────

const STARTING_CHIPS: number = 1000;
const SMALL_BLIND: number = 5;
const BIG_BLIND: number = 10;
const AI_THINK_MIN_MS: number = 1000;
const AI_THINK_MAX_MS: number = 3000;
const HAND_DELAY_MS: number = 3000;
const CHAT_MIN_MS: number = 1500;
const CHAT_MAX_MS: number = 5000;

/** Pre-defined AI personas used when no external agent module is available. */
const AI_PERSONAS: AgentPersona[] = [
  {
    id: 'ai-ace',
    name: 'Ace',
    style: 'tight-aggressive',
    chatStyle: 'polite and strategic',
    bluffFrequency: 0.2,
    tiltResistance: 0.8,
    riskTolerance: 0.5,
    skillLevel: 0.7,
    talkativeness: 0.4,
    rivals: [],
    goals: ['Play solid poker', 'Build chip lead gradually'],
    avatar: '🎩',
  },
  {
    id: 'ai-maverick',
    name: 'Maverick',
    style: 'loose-aggressive',
    chatStyle: 'trash-talking and playful',
    bluffFrequency: 0.5,
    tiltResistance: 0.4,
    riskTolerance: 0.8,
    skillLevel: 0.5,
    talkativeness: 0.8,
    rivals: [],
    goals: ['Have fun', 'Make big bluffs'],
    avatar: '😎',
  },
  {
    id: 'ai-nova',
    name: 'Nova',
    style: 'balanced-analytical',
    chatStyle: 'calm and observant',
    bluffFrequency: 0.3,
    tiltResistance: 0.9,
    riskTolerance: 0.4,
    skillLevel: 0.8,
    talkativeness: 0.3,
    rivals: [],
    goals: ['Read opponents', 'Make optimal decisions'],
    avatar: '🤖',
  },
];

/** Stub chat messages grouped by persona name and trigger. */
const CHAT_TEMPLATES: Record<string, Record<string, string[]>> = {
  Ace: {
    win: ['Good hand.', "I'll take that.", 'Well earned.'],
    lose: ['Well played.', 'Nice hand.', 'You got me there.'],
    fold: ['Not this time.', "I'll wait for a better spot.", 'Patience pays.'],
    bad_beat: ['Tough break.', 'That stings a little.', 'Variance is real.'],
    general: ['Interesting board.', "Let's see...", 'Hmm, noted.'],
    winning_streak: ['Steady as she goes.', 'The cards are cooperating.'],
    quiet_table: ['Everyone playing tight today?', "It's been quiet."],
    short_stack_pressure: ['Need to pick my spots carefully.', 'Time to tighten up.'],
  },
  Maverick: {
    win: ['Too easy! 💰', "Who's next?", 'Pay up!'],
    lose: ['Whatever, just warming up.', 'Lucky...', 'Next hand is mine!'],
    fold: ['Taking a breather.', 'Boring hand.', "I'll be back."],
    bad_beat: ["You can't be serious!", 'Rigged! 😤', 'That was my pot!'],
    general: ['Anyone scared yet?', "Let's make this interesting!", 'Big pot incoming!'],
    winning_streak: ["Can't stop, won't stop! 🔥", "I'm on fire!"],
    quiet_table: ['Wake up people!', "This table is dead. Let's go!"],
    short_stack_pressure: ['All or nothing baby!', 'Time to gamble!'],
  },
  Nova: {
    win: ['As calculated.', 'Expected value realised.', 'Optimal play confirmed.'],
    lose: ['Variance.', 'Interesting outcome.', 'Adjusting strategy.'],
    fold: ['Fold equity preserved.', 'Not +EV.', 'Discipline.'],
    bad_beat: ['Statistically unlikely.', 'The math was in my favour.'],
    general: ['Analysing...', 'The math says...', 'Patterns emerging.'],
    winning_streak: ['Positive trend detected.', 'Running above EV.'],
    quiet_table: ['Sample size still small.', 'Need more data.'],
    short_stack_pressure: ['ICM pressure increasing.', 'Adjusting ranges.'],
  },
};

// ── Helpers ────────────────────────────────────────────────────────────

/** Promise-based delay. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Random integer in [min, max]. */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pick a random element from an array. */
function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Stub AI decision maker — produces a reasonable action without an LLM.
 * Weights are derived from the persona's traits.
 */
function makeStubDecision(
  legalActions: LegalAction[],
  persona: AgentPersona,
): PlayerAction {
  const types: Set<string> = new Set(legalActions.map((a) => a.type));
  const rng: number = Math.random();

  // No bet to face — can check / bet
  if (types.has('check')) {
    const aggression: number = persona.riskTolerance * persona.bluffFrequency;

    if (rng < aggression * 0.5 && types.has('bet')) {
      const betAction: LegalAction = legalActions.find((a) => a.type === 'bet')!;
      return { type: 'bet', amount: pickBetSize(betAction, persona) };
    }
    return { type: 'check' };
  }

  // Facing a bet — can call / raise / fold
  if (types.has('call')) {
    const foldChance: number = (1 - persona.riskTolerance) * 0.25;
    const raiseChance: number = persona.riskTolerance * persona.bluffFrequency * 0.3;

    if (rng < foldChance) return { type: 'fold' };

    if (rng < foldChance + raiseChance && types.has('raise')) {
      const raiseAction: LegalAction = legalActions.find((a) => a.type === 'raise')!;
      return { type: 'raise', amount: pickBetSize(raiseAction, persona) };
    }
    return { type: 'call' };
  }

  // Only fold / all-in available (short stack)
  if (types.has('all-in')) {
    return rng < 0.6 ? { type: 'all-in' } : { type: 'fold' };
  }

  return { type: 'fold' };
}

/** Pick a bet/raise size scaled by persona aggression. */
function pickBetSize(action: LegalAction, persona: AgentPersona): number {
  const min: number = action.minAmount ?? 0;
  const max: number = action.maxAmount ?? min;
  const scale: number = 0.2 + persona.riskTolerance * 0.4; // 0.2–0.6 of range
  return Math.round(min + (max - min) * scale);
}

/** Pick a stub chat message for the given persona and trigger. */
function pickStubChat(personaName: string, trigger: string): string | null {
  const personaMessages: Record<string, string[]> | undefined =
    CHAT_TEMPLATES[personaName];
  if (!personaMessages) return null;

  const pool: string[] = personaMessages[trigger] ?? personaMessages['general'] ?? [];
  if (pool.length === 0) return null;

  return pickRandom(pool);
}

// ── Callbacks ──────────────────────────────────────────────────────────

type HumanTurnCallback = (view: SpectatorView, legalActions: LegalAction[]) => void;
type StateUpdateCallback = (view: SpectatorView) => void;

// ── GameOrchestrator ───────────────────────────────────────────────────

export class GameOrchestrator {
  private readonly engine: GameEngine;
  private readonly eventBus: GameEventBus = new GameEventBus();
  private readonly chatScheduler: ChatScheduler = new ChatScheduler();
  private readonly director: Director;
  private readonly humanPlayerId: string;
  private readonly aiPlayerIds: string[];
  private readonly personaMap: Map<string, AgentPersona> = new Map();

  private isRunning: boolean = false;
  private onHumanTurnCb: HumanTurnCallback | null = null;
  private onStateUpdateCb: StateUpdateCallback | null = null;

  constructor(humanPlayerId: string) {
    this.humanPlayerId = humanPlayerId;
    this.aiPlayerIds = AI_PERSONAS.map((p) => p.id);

    // Build player configs: 1 human + 3 AI
    const playerConfigs = [
      { id: humanPlayerId, name: 'You', chips: STARTING_CHIPS },
      ...AI_PERSONAS.map((p) => ({ id: p.id, name: p.name, chips: STARTING_CHIPS })),
    ];

    this.engine = new GameEngine(playerConfigs, { small: SMALL_BLIND, big: BIG_BLIND });
    this.director = new Director(STARTING_CHIPS);

    // Index personas by ID
    for (const persona of AI_PERSONAS) {
      this.personaMap.set(persona.id, persona);
    }

    // Wire up chat scheduler
    this.chatScheduler.on('chat_ready', (payload: { agentId: string; message: string }) => {
      this.handleChatReady(payload.agentId, payload.message);
    });

    // Forward all game events to director for social analysis
    this.eventBus.onAny((event: GameEvent) => {
      const opportunities: ChatOpportunity[] = this.director.analyzeEvent(
        event,
        this.engine.getState().players,
        this.aiPlayerIds,
      );
      for (const opp of opportunities) {
        this.scheduleAiChat(opp.trigger, opp.agentId, opp.urgency);
      }
      this.notifyStateUpdate();
    });
  }

  // ── Public API ─────────────────────────────────────────────────────

  /** Start the game — begins the first hand. */
  async startGame(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    await this.startNewHand();
  }

  /**
   * Handle a human player's action (received via WebSocket).
   * Returns success/error; if successful, continues the game loop async.
   */
  handleHumanAction(action: PlayerAction): { success: boolean; error?: string } {
    if (!this.isRunning) return { success: false, error: 'Game not started' };

    const currentId: string | null = this.engine.getCurrentPlayerId();
    if (currentId !== this.humanPlayerId) {
      return { success: false, error: 'Not your turn' };
    }

    const result = this.processActionAndEmitEvents(this.humanPlayerId, action);
    if (!result.success) return result;

    // Continue game loop asynchronously
    void this.processTurns();
    return result;
  }

  /** Handle a chat message from the human player. */
  handleHumanChat(message: string): void {
    const chatMsg: ChatMessage = {
      id: nanoid(12),
      playerId: this.humanPlayerId,
      playerName: 'You',
      message,
      timestamp: Date.now(),
    };

    this.eventBus.emit({ type: 'chat_message', message: chatMsg });

    // Trigger a few AI reactions to human chat
    for (const aiId of this.aiPlayerIds) {
      const persona: AgentPersona | undefined = this.personaMap.get(aiId);
      if (!persona) continue;

      // Only respond based on talkativeness
      if (Math.random() < persona.talkativeness * 0.5) {
        this.scheduleAiChat('general', aiId, 0.4);
      }
    }
  }

  /** Get the current game state as seen by the human player. */
  getState(): SpectatorView {
    return this.engine.getSpectatorView(this.humanPlayerId);
  }

  /** Access the event bus for external subscribers (e.g. Socket.IO forwarding). */
  getEventBus(): GameEventBus {
    return this.eventBus;
  }

  /** Register a callback invoked when it's the human player's turn. */
  setOnHumanTurn(cb: HumanTurnCallback): void {
    this.onHumanTurnCb = cb;
  }

  /** Register a callback invoked whenever the game state changes. */
  setOnStateUpdate(cb: StateUpdateCallback): void {
    this.onStateUpdateCb = cb;
  }

  // ── Game Loop ──────────────────────────────────────────────────────

  /** Start a new hand: reset, deal, emit events, begin turn loop. */
  private async startNewHand(): Promise<void> {
    this.engine.startHand();
    this.emitHandStartEvents();
    await this.processTurns();
  }

  /**
   * Main turn loop.
   *
   * Processes AI turns sequentially with realistic delays.
   * When it's the human's turn, the loop pauses and control returns
   * to the event handler. `handleHumanAction` resumes the loop.
   */
  private async processTurns(): Promise<void> {
    while (!this.engine.isHandComplete()) {
      const currentId: string | null = this.engine.getCurrentPlayerId();
      if (!currentId) break;

      if (currentId === this.humanPlayerId) {
        this.notifyHumanTurn();
        return; // Pause — human acts via handleHumanAction
      }

      // AI player turn
      await this.processAiTurn(currentId);
    }

    // Hand is complete
    if (this.engine.isHandComplete()) {
      await this.handleHandComplete();
    }
  }

  /** Process a single AI player's turn with a thinking delay. */
  private async processAiTurn(playerId: string): Promise<void> {
    const persona: AgentPersona | undefined = this.personaMap.get(playerId);
    const playerName: string = persona?.name ?? 'AI';

    // Emit thinking indicator
    this.eventBus.emit({ type: 'thinking_started', playerId, playerName });

    // Artificial thinking delay (1–3 seconds)
    const thinkTime: number = randomInt(AI_THINK_MIN_MS, AI_THINK_MAX_MS);
    await delay(thinkTime);

    // Make decision
    const legalActions: LegalAction[] = this.engine.getLegalActions(playerId);
    if (legalActions.length === 0) {
      this.eventBus.emit({ type: 'thinking_ended', playerId, playerName });
      return;
    }

    const action: PlayerAction = persona
      ? makeStubDecision(legalActions, persona)
      : { type: 'fold' };

    this.eventBus.emit({ type: 'thinking_ended', playerId, playerName });

    // Apply action and emit events
    this.processActionAndEmitEvents(playerId, action);
  }

  /**
   * Apply an action to the engine, then emit the corresponding game events
   * (player_acted, street_advanced if applicable).
   */
  private processActionAndEmitEvents(
    playerId: string,
    action: PlayerAction,
  ): { success: boolean; error?: string } {
    const previousStreet: Street = this.engine.getState().street;
    const result = this.engine.applyAction(playerId, action);

    if (!result.success) return result;

    const state = this.engine.getState();
    const player: PlayerPublicInfo | undefined = state.players.find(
      (p) => p.id === playerId,
    );

    // Emit player action event
    this.eventBus.emit({
      type: 'player_acted',
      playerId,
      playerName: player?.name ?? 'Unknown',
      action,
      pot: state.pot,
      playerChips: player?.chips ?? 0,
    });

    // Emit street advancement if the street changed and hand isn't over
    const currentStreet: Street = state.street;
    if (!this.engine.isHandComplete() && currentStreet !== previousStreet) {
      this.eventBus.emit({
        type: 'street_advanced',
        street: currentStreet,
        communityCards: [...state.communityCards],
        pot: state.pot,
      });
    }

    return result;
  }

  /** Handle a completed hand: emit results, schedule reactions, start next. */
  private async handleHandComplete(): Promise<void> {
    const result: HandResult | null = this.engine.getHandResult();
    if (!result) return;

    const state = this.engine.getState();

    // Emit showdown event if the hand went to showdown (not a fold-win)
    const isFoldWin: boolean =
      result.winners.length === 1 &&
      result.winners[0]!.handDescription === 'Last player standing';

    if (!isFoldWin) {
      const showdownPlayers = state.players
        .filter(
          (p) =>
            p.status === PlayerStatus.ACTIVE ||
            p.status === PlayerStatus.ALL_IN,
        )
        .map((p) => ({
          playerId: p.id,
          playerName: p.name,
          holeCards: (state.holeCards.get(p.id) ?? []) as [Card, Card],
        }));

      this.eventBus.emit({
        type: 'showdown_started',
        players: showdownPlayers,
        communityCards: [...state.communityCards],
      });
    }

    // Emit hand result
    this.eventBus.emit({
      type: 'hand_result',
      winners: result.winners,
      sidePots: result.sidePots,
      pot: result.totalPot,
    });

    // Check for busted players
    for (const player of state.players) {
      if (player.chips <= 0 && player.status !== PlayerStatus.BUSTED) {
        const remaining: number = state.players.filter((p) => p.chips > 0).length;
        this.eventBus.emit({
          type: 'player_busted',
          playerId: player.id,
          playerName: player.name,
          finishPosition: remaining + 1,
        });
      }
    }

    // Schedule AI reactions to the hand result
    for (const aiId of this.aiPlayerIds) {
      const persona: AgentPersona | undefined = this.personaMap.get(aiId);
      if (!persona) continue;

      const isWinner: boolean = result.winners.some((w) => w.playerId === aiId);
      const trigger: string = isWinner ? 'win' : 'lose';

      if (Math.random() < persona.talkativeness) {
        this.scheduleAiChat(trigger, aiId, 0.6);
      }
    }

    // Wait before starting next hand
    await delay(HAND_DELAY_MS);

    // Start next hand if enough players remain
    const playersWithChips: number = this.engine
      .getState()
      .players.filter((p) => p.chips > 0).length;

    if (playersWithChips >= 2 && this.isRunning) {
      await this.startNewHand();
    } else {
      this.isRunning = false;
    }
  }

  // ── Event Emission Helpers ─────────────────────────────────────────

  /** Emit the cluster of events that mark the start of a new hand. */
  private emitHandStartEvents(): void {
    const state = this.engine.getState();

    // Hand started
    this.eventBus.emit({
      type: 'hand_started',
      handId: state.handId,
      handNumber: state.handNumber,
      dealerPosition: state.dealerPosition,
      players: state.players.map((p) => ({ ...p })),
      blinds: { ...state.blinds },
    });

    // Blinds posted
    const sbPlayer: PlayerPublicInfo | undefined = state.players.find(
      (p) => p.isSmallBlind,
    );
    const bbPlayer: PlayerPublicInfo | undefined = state.players.find(
      (p) => p.isBigBlind,
    );

    if (sbPlayer && bbPlayer) {
      this.eventBus.emit({
        type: 'blinds_posted',
        smallBlindPlayerId: sbPlayer.id,
        smallBlindAmount: state.blinds.small,
        bigBlindPlayerId: bbPlayer.id,
        bigBlindAmount: state.blinds.big,
        pot: state.pot,
      });
    }

    // Deal hole cards (per-player events — only the human's cards are visible)
    const humanCards = state.holeCards.get(this.humanPlayerId);
    if (humanCards) {
      this.eventBus.emit({
        type: 'cards_dealt',
        playerId: this.humanPlayerId,
        cards: humanCards,
      });
    }
  }

  /** Notify the human player that it's their turn. */
  private notifyHumanTurn(): void {
    const view: SpectatorView = this.getState();
    const legalActions: LegalAction[] = this.engine.getLegalActions(this.humanPlayerId);

    if (this.onHumanTurnCb) {
      this.onHumanTurnCb(view, legalActions);
    }
  }

  /** Notify external subscribers (e.g. Socket.IO) of a state change. */
  private notifyStateUpdate(): void {
    if (this.onStateUpdateCb) {
      this.onStateUpdateCb(this.getState());
    }
  }

  // ── Chat Scheduling ────────────────────────────────────────────────

  /** Schedule an AI chat message with jitter. */
  private scheduleAiChat(trigger: string, agentId: string, urgency: number): void {
    const persona: AgentPersona | undefined = this.personaMap.get(agentId);
    if (!persona) return;

    // Only chat if urgency passes the talkativeness threshold
    if (urgency < (1 - persona.talkativeness) * 0.5) return;

    const chatId: string = `chat-${agentId}-${nanoid(6)}`;

    this.chatScheduler.scheduleWithJitter(
      chatId,
      agentId,
      CHAT_MIN_MS,
      CHAT_MAX_MS,
      async (): Promise<string | null> => {
        return pickStubChat(persona.name, trigger);
      },
    );
  }

  /** Handle a chat message that's ready to be emitted. */
  private handleChatReady(agentId: string, message: string): void {
    const persona: AgentPersona | undefined = this.personaMap.get(agentId);

    const chatMsg: ChatMessage = {
      id: nanoid(12),
      playerId: agentId,
      playerName: persona?.name ?? 'AI',
      message,
      timestamp: Date.now(),
    };

    this.eventBus.emit({ type: 'chat_message', message: chatMsg });
  }
}
