import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { ChatMessage as ChatMessageType } from '@poker/shared';
import ThinkingIndicator from './ThinkingIndicator';

interface ChatMessageProps {
  message: ChatMessageType;
  isOwnMessage: boolean;
}

const AGENT_COLORS: Record<string, string> = {
  default: 'text-blue-400',
  agent_0: 'text-red-400',
  agent_1: 'text-green-400',
  agent_2: 'text-purple-400',
  agent_3: 'text-yellow-400',
  agent_4: 'text-pink-400',
  agent_5: 'text-cyan-400',
};

function getAgentColor(playerId: string): string {
  const match = playerId.match(/(\d+)/);
  if (match) {
    const key = `agent_${parseInt(match[1], 10) % 6}`;
    return AGENT_COLORS[key] ?? AGENT_COLORS.default;
  }
  return AGENT_COLORS.default;
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatMessage({ message, isOwnMessage }: ChatMessageProps) {
  if (message.isThinking) {
    return <ThinkingIndicator playerName={message.playerName} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: isOwnMessage ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={clsx('flex flex-col gap-0.5 px-3 py-1.5 max-w-[85%]', {
        'self-end items-end': isOwnMessage,
        'self-start items-start': !isOwnMessage,
      })}
    >
      <div className="flex items-baseline gap-2">
        {!isOwnMessage && (
          <span className={clsx('text-xs font-semibold', getAgentColor(message.playerId))}>
            {message.playerName}
          </span>
        )}
        <span className="text-[10px] text-gray-500">{formatTimestamp(message.timestamp)}</span>
      </div>

      <div
        className={clsx('rounded-lg px-3 py-1.5 text-sm leading-relaxed break-words', {
          'bg-poker-accent/20 text-poker-accent': isOwnMessage,
          'bg-white/5 text-gray-200': !isOwnMessage,
        })}
      >
        {message.message}
      </div>
    </motion.div>
  );
}
