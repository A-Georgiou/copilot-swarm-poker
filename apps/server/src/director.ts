/**
 * Director — lightweight social nudge system.
 *
 * Analyses game events and identifies moments where AI agents should
 * consider chatting. Does NOT force chat — it merely suggests
 * opportunities that the orchestrator can pass to the chat scheduler.
 */

import type {
  GameEvent,
  PlayerPublicInfo,
} from '@poker/shared';

// ── Types ──────────────────────────────────────────────────────────────

export type SocialTrigger =
  | 'bad_beat'
  | 'big_bluff'
  | 'rivalry_moment'
  | 'quiet_table'
  | 'short_stack_pressure'
  | 'winning_streak';

export interface ChatOpportunity {
  agentId: string;
  trigger: SocialTrigger;
  /** 0–1 urgency — higher means the agent is more likely to speak. */
  urgency: number;
}

// ── Director ───────────────────────────────────────────────────────────

export class Director {
  /** Track consecutive wins per player for streak detection. */
  private winStreaks: Map<string, number> = new Map();

  /** Timestamp of the most recent chat event. */
  private lastChatTimestamp: number = 0;

  /** Number of events since the last chat for quiet-table detection. */
  private eventsSinceLastChat: number = 0;

  /** Starting chip count for short-stack percentage calculations. */
  private readonly startingChips: number;

  constructor(startingChips: number = 1000) {
    this.startingChips = startingChips;
  }

  /**
   * Inspect a game event and return any chat opportunities it creates.
   *
   * @param event   The event that just fired.
   * @param players Current public player info (for chip counts, etc.).
   * @param aiIds   IDs of AI players (only they get chat opportunities).
   */
  analyzeEvent(
    event: GameEvent,
    players: PlayerPublicInfo[],
    aiIds: string[],
  ): ChatOpportunity[] {
    const opportunities: ChatOpportunity[] = [];
    this.eventsSinceLastChat++;

    switch (event.type) {
      case 'hand_result': {
        const winnerIds: string[] = event.winners.map((w) => w.playerId);

        // Update streak tracking
        for (const id of aiIds) {
          const currentStreak: number = this.winStreaks.get(id) ?? 0;
          this.winStreaks.set(id, winnerIds.includes(id) ? currentStreak + 1 : 0);
        }

        // Winning streak (3+ hands)
        for (const id of aiIds) {
          if ((this.winStreaks.get(id) ?? 0) >= 3) {
            opportunities.push({ agentId: id, trigger: 'winning_streak', urgency: 0.8 });
          }
        }

        // Bad beat: loser had a large pot (big loss)
        if (event.pot > this.startingChips * 0.4) {
          for (const id of aiIds) {
            if (!winnerIds.includes(id)) {
              opportunities.push({ agentId: id, trigger: 'bad_beat', urgency: 0.7 });
            }
          }
        }

        // Big bluff: winner won without showdown (description says 'Last player standing')
        const foldWin: boolean =
          event.winners.length === 1 &&
          event.winners[0]!.handDescription === 'Last player standing' &&
          event.pot > this.startingChips * 0.2;
        if (foldWin) {
          const blufferId: string = event.winners[0]!.playerId;
          if (aiIds.includes(blufferId)) {
            opportunities.push({ agentId: blufferId, trigger: 'big_bluff', urgency: 0.6 });
          }
        }
        break;
      }

      case 'player_acted': {
        // Short-stack pressure: player below 20% of starting chips
        const actor: PlayerPublicInfo | undefined = players.find(
          (p) => p.id === event.playerId,
        );
        if (actor && actor.chips < this.startingChips * 0.2 && aiIds.includes(actor.id)) {
          opportunities.push({
            agentId: actor.id,
            trigger: 'short_stack_pressure',
            urgency: 0.5,
          });
        }

        // Rivalry moment: large bet/raise against a specific player
        if (
          (event.action.type === 'raise' || event.action.type === 'all-in') &&
          event.pot > this.startingChips * 0.3
        ) {
          for (const id of aiIds) {
            if (id !== event.playerId) {
              opportunities.push({ agentId: id, trigger: 'rivalry_moment', urgency: 0.4 });
            }
          }
        }
        break;
      }

      case 'chat_message': {
        this.lastChatTimestamp = Date.now();
        this.eventsSinceLastChat = 0;
        break;
      }

      default: {
        // Quiet table: many events without chat
        if (this.eventsSinceLastChat > 15) {
          const randomAi: string | undefined =
            aiIds[Math.floor(Math.random() * aiIds.length)];
          if (randomAi) {
            opportunities.push({ agentId: randomAi, trigger: 'quiet_table', urgency: 0.3 });
            this.eventsSinceLastChat = 0; // Reset so we don't spam
          }
        }
        break;
      }
    }

    return opportunities;
  }

  /** Reset state for a new game session. */
  reset(): void {
    this.winStreaks.clear();
    this.lastChatTimestamp = 0;
    this.eventsSinceLastChat = 0;
  }
}
