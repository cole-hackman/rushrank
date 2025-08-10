import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Heart, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VotingFeedbackProps {
  type: 'up' | 'down' | 'favorite' | 'skip';
  isVisible: boolean;
  onComplete?: () => void;
}

export function VotingFeedback({ type, isVisible, onComplete }: VotingFeedbackProps) {
  const { toast } = useToast();

  const feedbackConfig = {
    up: {
      icon: ThumbsUp,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      message: 'Great choice!',
      description: 'Positive vote recorded',
      className: 'vote-success'
    },
    down: {
      icon: ThumbsDown,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      message: 'Vote recorded',
      description: 'Negative vote recorded',
      className: 'vote-success'
    },
    favorite: {
      icon: Heart,
      color: 'text-pink-500',
      bg: 'bg-pink-500/10',
      message: 'Added to favorites!',
      description: 'This PNM is now marked as favorite',
      className: 'celebration'
    },
    skip: {
      icon: XCircle,
      color: 'text-gray-500',
      bg: 'bg-gray-500/10',
      message: 'Skipped',
      description: 'Moving to next PNM',
      className: 'vote-success'
    }
  };

  const config = feedbackConfig[type];
  const Icon = config.icon;

  // Show toast notification
  if (isVisible) {
    toast({
      title: config.message,
      description: config.description,
      duration: 2000,
    });
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          onAnimationComplete={() => {
            if (onComplete) {
              setTimeout(onComplete, 1000);
            }
          }}
        >
          <motion.div
            className={`${config.bg} ${config.className} rounded-full p-8 shadow-2xl backdrop-blur-sm`}
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: type === 'favorite' ? [0, 10, -10, 0] : 0
            }}
            transition={{ duration: 0.6 }}
          >
            <Icon className={`w-16 h-16 ${config.color}`} />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: 0.2 }}
            className="absolute bottom-32 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-lg border"
          >
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{config.message}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}