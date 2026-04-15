import { motion, type Variants } from 'framer-motion';

interface ThinkingIndicatorProps {
  playerName: string;
}

const dotVariants: Variants = {
  animate: (i: number) => ({
    y: [0, -4, 0],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      delay: i * 0.15,
      ease: 'easeInOut' as const,
    },
  }),
};

export default function ThinkingIndicator({ playerName }: ThinkingIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-400 italic">
      <span>{playerName} is thinking</span>
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            custom={i}
            variants={dotVariants}
            animate="animate"
            className="inline-block w-1 h-1 rounded-full bg-gray-400"
          />
        ))}
      </span>
    </div>
  );
}
