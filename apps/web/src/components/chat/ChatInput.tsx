import { useState, useCallback } from 'react';
import type { KeyboardEvent, ChangeEvent } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState<string>('');

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    onSend(trimmed);
    setValue('');
  }, [value, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  }, []);

  return (
    <div className="flex items-center gap-2 p-3 border-t border-white/10">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Say something to the table..."
        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white
                   placeholder-gray-500 outline-none focus:border-poker-accent/50 focus:ring-1
                   focus:ring-poker-accent/30 disabled:opacity-40 disabled:cursor-not-allowed
                   transition-colors"
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={disabled || value.trim().length === 0}
        className="px-3 py-2 bg-poker-accent/80 hover:bg-poker-accent text-black text-sm font-medium
                   rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Send
      </button>
    </div>
  );
}
