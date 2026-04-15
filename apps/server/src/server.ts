/**
 * Fastify + Socket.IO server.
 *
 * Serves as the WebSocket gateway between the React frontend and the
 * GameOrchestrator. Each socket connection gets its own orchestrator
 * (single-player game against 3 AI opponents).
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { nanoid } from 'nanoid';

import type {
  ChatMessage,
  GameEvent,
  LegalAction,
  PlayerAction,
  SpectatorView,
} from '@poker/shared';

import { GameOrchestrator } from './orchestrator.js';

// ── Socket.IO typed events ─────────────────────────────────────────────

interface ServerToClientEvents {
  game_event: (event: GameEvent) => void;
  game_state: (state: SpectatorView) => void;
  your_turn: (data: { legalActions: LegalAction[]; view: SpectatorView }) => void;
  chat_message: (message: ChatMessage) => void;
}

interface ClientToServerEvents {
  player_action: (action: PlayerAction) => void;
  chat_send: (message: string) => void;
  start_game: () => void;
  new_hand: () => void;
}

// ── Server Factory ─────────────────────────────────────────────────────

export interface ServerInstance {
  fastify: FastifyInstance;
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
  start: (port?: number) => Promise<string>;
  close: () => Promise<void>;
}

/**
 * Create and configure the Fastify + Socket.IO server.
 *
 * @returns An object with `start()` and `close()` methods.
 */
export function createServer(): ServerInstance {
  const fastify: FastifyInstance = Fastify({ logger: true });

  // Attach Socket.IO to Fastify's underlying HTTP server
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(
    fastify.server,
    {
      cors: {
        origin: ['http://localhost:5173', 'http://localhost:3000'],
        methods: ['GET', 'POST'],
      },
    },
  );

  // ── Health check endpoint ──────────────────────────────────────────

  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: Date.now() };
  });

  // ── WebSocket connection handling ──────────────────────────────────

  io.on(
    'connection',
    (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
      const humanPlayerId: string = `human-${nanoid(8)}`;
      let orchestrator: GameOrchestrator | null = null;

      fastify.log.info(`Client connected: ${socket.id} (player: ${humanPlayerId})`);

      // ── start_game ───────────────────────────────────────────────
      socket.on('start_game', () => {
        if (orchestrator) {
          fastify.log.warn('Game already started for this socket');
          return;
        }

        orchestrator = new GameOrchestrator(humanPlayerId);

        // Forward all game events to the client
        orchestrator.getEventBus().onAny((event: GameEvent) => {
          socket.emit('game_event', event);
        });

        // Notify client when it's their turn
        orchestrator.setOnHumanTurn(
          (view: SpectatorView, legalActions: LegalAction[]) => {
            socket.emit('your_turn', { legalActions, view });
          },
        );

        // Push state updates
        orchestrator.setOnStateUpdate((view: SpectatorView) => {
          socket.emit('game_state', view);
        });

        // Send initial state and start the game
        socket.emit('game_state', orchestrator.getState());
        void orchestrator.startGame();

        fastify.log.info(`Game started for player ${humanPlayerId}`);
      });

      // ── player_action ────────────────────────────────────────────
      socket.on('player_action', (action: PlayerAction) => {
        if (!orchestrator) {
          fastify.log.warn('No active game — ignoring action');
          return;
        }

        const result = orchestrator.handleHumanAction(action);
        if (!result.success) {
          socket.emit('game_event', {
            type: 'game_error',
            error: result.error ?? 'Unknown error',
            playerId: humanPlayerId,
          });
        }
      });

      // ── chat_send ────────────────────────────────────────────────
      socket.on('chat_send', (message: string) => {
        if (!orchestrator) return;
        orchestrator.handleHumanChat(message);
      });

      // ── new_hand ─────────────────────────────────────────────────
      socket.on('new_hand', () => {
        // Currently the orchestrator auto-starts new hands.
        // This event is a no-op but reserved for manual control.
        fastify.log.info('new_hand requested (auto-managed by orchestrator)');
      });

      // ── disconnect ───────────────────────────────────────────────
      socket.on('disconnect', (reason: string) => {
        fastify.log.info(
          `Client disconnected: ${socket.id} (reason: ${reason})`,
        );
        orchestrator = null;
      });
    },
  );

  // ── Server lifecycle ───────────────────────────────────────────────

  async function start(port: number = 3001): Promise<string> {
    const address: string = await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Server listening at ${address}`);
    return address;
  }

  async function close(): Promise<void> {
    io.close();
    await fastify.close();
  }

  return { fastify, io, start, close };
}
