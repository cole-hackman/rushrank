import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

interface LiveIndicatorProps {
  isLive: boolean;
  voterCount?: number;
  className?: string;
}

export function LiveIndicator({ isLive, voterCount = 0, className }: LiveIndicatorProps) {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <motion.div
        animate={{ scale: isLive ? [1, 1.2, 1] : 1 }}
        transition={{ duration: 2, repeat: isLive ? Infinity : 0 }}
        className="relative"
      >
        <Badge 
          variant={isLive ? "default" : "secondary"}
          className={`${
            isLive 
              ? "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg status-live" 
              : "bg-gray-100 text-gray-600 status-idle"
          } transition-all duration-300`}
        >
          {isLive ? "Live" : "Idle"}
        </Badge>
      </motion.div>
      
      {isLive && voterCount > 0 && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center space-x-1 text-sm text-green-600"
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="w-2 h-2 bg-green-500 rounded-full"
          />
          <span className="font-medium">{voterCount} voting</span>
        </motion.div>
      )}
    </div>
  );
}