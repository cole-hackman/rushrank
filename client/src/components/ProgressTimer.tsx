import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { Clock } from 'lucide-react';

interface ProgressTimerProps {
  isActive: boolean;
  currentIndex: number;
  totalItems: number;
  autoAdvanceSeconds?: number;
}

export function ProgressTimer({ 
  isActive, 
  currentIndex, 
  totalItems, 
  autoAdvanceSeconds = 30 
}: ProgressTimerProps) {
  const [timeLeft, setTimeLeft] = useState(autoAdvanceSeconds);
  const [isRunning, setIsRunning] = useState(isActive);

  useEffect(() => {
    setIsRunning(isActive);
    if (isActive) {
      setTimeLeft(autoAdvanceSeconds);
    }
  }, [isActive, currentIndex, autoAdvanceSeconds]);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  const overallProgress = totalItems > 0 ? ((currentIndex + 1) / totalItems) * 100 : 0;
  const timerProgress = ((autoAdvanceSeconds - timeLeft) / autoAdvanceSeconds) * 100;

  if (!isActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-soft border border-gray-200 dark:border-gray-700"
    >
      {/* Overall Progress */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Voting Progress
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {currentIndex + 1} of {totalItems}
        </span>
      </div>
      <Progress value={overallProgress} className="mb-3 progress-animated" />

      {/* Timer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600 dark:text-gray-400">Time remaining</span>
        </div>
        <div className="flex items-center space-x-2">
          <Progress 
            value={timerProgress} 
            className="w-16 h-2" 
          />
          <motion.span
            key={timeLeft}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className={`text-sm font-mono font-bold ${
              timeLeft <= 5 
                ? 'text-red-600 dark:text-red-400' 
                : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            {timeLeft}s
          </motion.span>
        </div>
      </div>
    </motion.div>
  );
}