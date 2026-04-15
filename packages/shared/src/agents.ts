/**
 * AI agent persona and decision types.
 */

import type { PlayerAction } from './game-types.js';

export interface AgentPersona {
  id: string;
  name: string;
  style: string;
  chatStyle: string;
  bluffFrequency: number;
  tiltResistance: number;
  riskTolerance: number;
  skillLevel: number;
  talkativeness: number;
  rivals: string[];
  goals: string[];
  avatar: string;
}

export interface AgentDecision {
  action: PlayerAction;
  confidence: number;
  reasoningSummary: string;
}

export interface AgentHiddenState {
  mood: string;
  tiltLevel: number;
  confidenceLevel: number;
  recentMemory: string[];
  perceptions: Map<string, string>;
  currentGoal: string;
}
