import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Heart, X, RotateCcw, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface PNM {
  id: string;
  name: string;
  major?: string;
  hometown?: string;
  year?: string;
  tags?: string[];
  photo_url?: string;
}

interface EnhancedVotingProps {
  roundId: string;
  pnms: PNM[];
  onComplete: () => void;
  onBack: () => void;
}

export function EnhancedVoting({ roundId, pnms, onComplete, onBack }: EnhancedVotingProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [votes, setVotes] = useState<Record<string, { score: number; is_favorite: boolean }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  const { toast } = useToast();

  const currentPNM = pnms[currentIndex];
  const progress = ((currentIndex + 1) / pnms.length) * 100;

  const submitVote = async (score: number, is_favorite: boolean = false) => {
    if (!currentPNM || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await apiRequest('POST', `/api/rounds/${roundId}/votes`, {
        pnm_id: currentPNM.id,
        score,
        is_favorite
      });

      setVotes(prev => ({
        ...prev,
        [currentPNM.id]: { score, is_favorite }
      }));

      // Move to next PNM or complete
      if (currentIndex < pnms.length - 1) {
        setDirection(score >= 3 ? 'right' : 'left');
        setTimeout(() => {
          setCurrentIndex(prev => prev + 1);
          setDirection(null);
        }, 300);
      } else {
        onComplete();
      }

    } catch (error: any) {
      toast({
        title: "Failed to submit vote",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwipe = (direction: 'left' | 'right') => {
    const score = direction === 'right' ? 4 : 2;
    submitVote(score);
  };

  const goBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  if (!currentPNM) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-blue-950 dark:to-purple-950">
      <div className="max-w-md mx-auto bg-white dark:bg-gray-950 min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="text-center">
            <p className="text-sm font-medium">Voting Round</p>
            <p className="text-xs text-muted-foreground">
              {currentIndex + 1} of {pnms.length}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={goBack} disabled={currentIndex === 0}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Progress */}
        <div className="p-4">
          <Progress value={progress} className="h-2" />
        </div>

        {/* Card Stack */}
        <div className="flex-1 p-4 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPNM.id}
              initial={{ 
                x: direction === 'left' ? -300 : direction === 'right' ? 300 : 0, 
                opacity: direction ? 0 : 1,
                scale: 0.8 
              }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ 
                x: direction === 'left' ? -300 : 300, 
                opacity: 0,
                scale: 0.8
              }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="w-full max-w-sm"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.x > 100) handleSwipe('right');
                else if (info.offset.x < -100) handleSwipe('left');
              }}
            >
              <Card className="rounded-2xl shadow-xl border-2 overflow-hidden">
                {/* Photo */}
                <div className="aspect-[3/4] bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900 dark:to-blue-900 relative overflow-hidden">
                  {currentPNM.photo_url ? (
                    <img 
                      src={currentPNM.photo_url} 
                      alt={currentPNM.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Avatar className="w-24 h-24">
                        <AvatarFallback className="text-2xl">
                          {currentPNM.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                  
                  {/* Voting feedback overlays */}
                  <motion.div
                    className="absolute inset-0 bg-red-500/20 flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: direction === 'left' ? 1 : 0 }}
                  >
                    <X className="w-16 h-16 text-red-500" />
                  </motion.div>
                  
                  <motion.div
                    className="absolute inset-0 bg-green-500/20 flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: direction === 'right' ? 1 : 0 }}
                  >
                    <Heart className="w-16 h-16 text-green-500" />
                  </motion.div>
                </div>

                {/* Info */}
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3 className="text-xl font-bold">{currentPNM.name}</h3>
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      {currentPNM.major && <span>{currentPNM.major}</span>}
                      {currentPNM.year && <span className="capitalize">• {currentPNM.year}</span>}
                      {currentPNM.hometown && <span>• {currentPNM.hometown}</span>}
                    </div>
                  </div>

                  {/* Tags */}
                  {currentPNM.tags && currentPNM.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {currentPNM.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Action Buttons */}
        <div className="p-6 border-t">
          <div className="flex justify-center gap-4">
            <Button
              variant="outline"
              size="lg"
              className="rounded-full w-16 h-16 border-red-200 hover:bg-red-50 hover:border-red-300"
              onClick={() => submitVote(1)}
              disabled={isSubmitting}
              data-testid="button-reject"
            >
              <X className="h-6 w-6 text-red-500" />
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              className="rounded-full w-16 h-16 border-yellow-200 hover:bg-yellow-50 hover:border-yellow-300"
              onClick={() => submitVote(3)}
              disabled={isSubmitting}
              data-testid="button-maybe"
            >
              <span className="text-yellow-600 font-bold">?</span>
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              className="rounded-full w-16 h-16 border-green-200 hover:bg-green-50 hover:border-green-300"
              onClick={() => submitVote(4)}
              disabled={isSubmitting}
              data-testid="button-like"
            >
              <Heart className="h-6 w-6 text-green-500" />
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              className="rounded-full w-16 h-16 border-purple-200 hover:bg-purple-50 hover:border-purple-300"
              onClick={() => submitVote(5, true)}
              disabled={isSubmitting}
              data-testid="button-favorite"
            >
              <Heart className="h-6 w-6 text-purple-500 fill-current" />
            </Button>
          </div>
          
          <div className="text-center mt-4 text-sm text-muted-foreground">
            Swipe left to pass, right to like • Tap for more options
          </div>
        </div>
      </div>
    </div>
  );
}