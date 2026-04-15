/**
 * useChat — Chat message management.
 *
 * Listens for 'chat_message' socket events to build up a message list,
 * and for 'game_event' events to track agent thinking indicators.
 * Provides sendChat() to emit outbound messages.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { ChatMessage, GameEvent } from '@poker/shared';

/* ------------------------------------------------------------------ */
/*  Return type                                                        */
/* ------------------------------------------------------------------ */

export interface UseChatReturn {
  /** All chat messages received so far, in chronological order. */
  messages: ChatMessage[];
  /** Send a chat message to the table. */
  sendChat: (message: string) => void;
  /** Names of agents currently "thinking" (shown as typing indicators). */
  thinkingAgents: string[];
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useChat(socket: Socket | null): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinkingAgents, setThinkingAgents] = useState<string[]>([]);

  useEffect(() => {
    if (!socket) return;

    /** Direct chat message from the server. */
    const handleChatMessage = (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    };

    /** Game events that affect chat state (thinking indicators). */
    const handleGameEvent = (event: GameEvent) => {
      switch (event.type) {
        case 'thinking_started':
          setThinkingAgents((prev) =>
            prev.includes(event.playerName)
              ? prev
              : [...prev, event.playerName],
          );
          break;

        case 'thinking_ended':
          setThinkingAgents((prev) =>
            prev.filter((name) => name !== event.playerName),
          );
          break;
      }
    };

    socket.on('chat_message', handleChatMessage);
    socket.on('game_event', handleGameEvent);

    return () => {
      socket.off('chat_message', handleChatMessage);
      socket.off('game_event', handleGameEvent);
    };
  }, [socket]);

  const sendChat = useCallback(
    (message: string) => {
      if (!socket || !message.trim()) return;
      socket.emit('chat_send', message);
    },
    [socket],
  );

  return { messages, sendChat, thinkingAgents };
}
