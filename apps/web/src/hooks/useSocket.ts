/**
 * useSocket — Manages a Socket.IO client connection.
 *
 * Creates a single socket instance that connects to the game server,
 * handles auto-reconnection, and cleans up on unmount.
 */

import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';

export interface UseSocketReturn {
  /** The Socket.IO client instance, or null before connection is initialised. */
  socket: Socket | null;
  /** True when the socket is connected to the server. */
  isConnected: boolean;
}

export function useSocket(): UseSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    setSocket(newSocket);

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return { socket, isConnected };
}
