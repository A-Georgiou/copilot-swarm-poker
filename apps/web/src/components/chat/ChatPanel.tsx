import { useEffect, useRef } from 'react';
import type { ChatMessage as ChatMessageType } from '@poker/shared';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

interface ChatPanelProps {
  messages: ChatMessageType[];
  onSendMessage: (message: string) => void;
  currentPlayerId: string;
  disabled?: boolean;
}

export default function ChatPanel({
  messages,
  onSendMessage,
  currentPlayerId,
  disabled = false,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full w-full bg-poker-surface border-l border-white/10">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-white/10">
        <h2 className="text-sm font-semibold text-white tracking-wide uppercase">Table Chat</h2>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1 py-2 scrollbar-thin">
        {messages.length === 0 && (
          <p className="text-center text-gray-500 text-xs mt-8 italic">
            No messages yet. The table is quiet...
          </p>
        )}
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            isOwnMessage={msg.playerId === currentPlayerId}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={onSendMessage} disabled={disabled} />
    </div>
  );
}
