/**
 * Server entry point.
 *
 * Loads environment variables, creates the Fastify + Socket.IO server,
 * and starts listening.
 */

import 'dotenv/config';
import { createServer } from './server.js';

const PORT: number = parseInt(process.env['PORT'] ?? '3001', 10);

const server = createServer();

server
  .start(PORT)
  .then((address: string) => {
    console.log(`🃏 Poker server running at ${address}`);
  })
  .catch((err: unknown) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

// Graceful shutdown
function shutdown(): void {
  console.log('\nShutting down...');
  void server.close().then(() => {
    console.log('Server closed');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
