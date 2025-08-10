import { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Star, Heart, X, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PNM } from '@shared/schema';

interface SwipeCardProps {
  pnm: PNM;
  onVote: (vote: 'yes' | 'no' | 'dont_know', isFavorite?: boolean) => void;
  onFavorite?: (isFavorite: boolean) => void;
  className?: string;
}

export function SwipeCard({ pnm, onVote, onFavorite, className = '' }: SwipeCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  const [indicators, setIndicators] = useState({
    yes: 0,
    no: 0,
    dontKnow: 0,
  });

  useEffect(() => {
    const unsubscribeX = x.onChange((value) => {
      const threshold = 50;
      setIndicators({
        yes: Math.max(0, Math.min(1, value / 100)),
        no: Math.max(0, Math.min(1, Math.abs(value) / 100)) * (value < 0 ? 1 : 0),
        dontKnow: 0,
      });
    });

    const unsubscribeY = y.onChange((value) => {
      const threshold = 50;
      if (value < -threshold) {
        setIndicators({
          yes: 0,
          no: 0,
          dontKnow: Math.max(0, Math.min(1, Math.abs(value) / 100)),
        });
      }
    });

    return () => {
      unsubscribeX();
      unsubscribeY();
    };
  }, [x, y]);

  const handleDragEnd = (event: any, info: PanInfo) => {
    const threshold = 100;
    
    if (Math.abs(info.offset.x) > Math.abs(info.offset.y)) {
      // Horizontal swipe
      if (info.offset.x > threshold) {
        onVote('yes', isFavorite);
      } else if (info.offset.x < -threshold) {
        onVote('no', isFavorite);
      }
    } else if (info.offset.y < -threshold) {
      // Upward swipe
      onVote('dont_know', isFavorite);
    }
  };

  const handleButtonVote = (vote: 'yes' | 'no' | 'dont_know') => {
    onVote(vote, isFavorite);
  };

  const handleFavoriteToggle = () => {
    const newFavoriteState = !isFavorite;
    setIsFavorite(newFavoriteState);
    onFavorite?.(newFavoriteState);
  };

  const photoUrl = pnm.photoPath ? `/objects/${pnm.photoPath.replace('/objects/', '')}` : null;

  return (
    <div className={`relative ${className}`}>
      <motion.div
        ref={cardRef}
        className="swipe-card bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ x, y, rotate, opacity }}
        drag
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        onDragEnd={handleDragEnd}
        whileTap={{ scale: 1.02 }}
        data-testid="swipe-card"
      >
        {/* Swipe Indicators */}
        <div className="absolute top-4 left-4 right-4 flex justify-between pointer-events-none z-10">
          <motion.div
            className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold transform -rotate-12"
            style={{ opacity: indicators.no }}
            data-testid="indicator-no"
          >
            NOPE
          </motion.div>
          <motion.div
            className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold transform rotate-12"
            style={{ opacity: indicators.yes }}
            data-testid="indicator-yes"
          >
            YES
          </motion.div>
        </div>
        
        <motion.div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
          style={{ opacity: indicators.dontKnow }}
          data-testid="indicator-dont-know"
        >
          <div className="bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-bold">
            DON'T KNOW
          </div>
        </motion.div>

        {/* Profile Photo */}
        <div className="w-full h-64 bg-gray-200 overflow-hidden">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={`${pnm.name} profile`}
              className="w-full h-full object-cover"
              data-testid="pnm-photo"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <div className="text-gray-400 text-center">
                <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-2"></div>
                <p className="text-sm">No Photo</p>
              </div>
            </div>
          )}
        </div>

        {/* Profile Information */}
        <div className="p-6 space-y-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900" data-testid="pnm-name">
              {pnm.name}
            </h2>
            <p className="text-gray-600" data-testid="pnm-major">{pnm.major}</p>
            {pnm.hometown && (
              <p className="text-gray-500 text-sm" data-testid="pnm-hometown">
                {pnm.hometown}
              </p>
            )}
          </div>

          {/* Tags */}
          {pnm.tags && pnm.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {pnm.tags.map((tag, index) => (
                <span
                  key={index}
                  className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                  data-testid={`tag-${tag}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Fun Facts */}
          {(pnm.walkoutSong || pnm.weirdestTalent || pnm.chickFilAOrder) && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              {pnm.walkoutSong && (
                <div>
                  <p className="text-gray-600 text-sm font-medium">Walkout Song:</p>
                  <p className="text-gray-900" data-testid="walkout-song">
                    {pnm.walkoutSong}
                  </p>
                </div>
              )}
              {pnm.weirdestTalent && (
                <div>
                  <p className="text-gray-600 text-sm font-medium">Weirdest Talent:</p>
                  <p className="text-gray-900" data-testid="weirdest-talent">
                    {pnm.weirdestTalent}
                  </p>
                </div>
              )}
              {pnm.chickFilAOrder && (
                <div>
                  <p className="text-gray-600 text-sm font-medium">Chick-fil-A Order:</p>
                  <p className="text-gray-900" data-testid="chick-fil-a-order">
                    {pnm.chickFilAOrder}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-center space-x-4">
            {/* No Button */}
            <Button
              onClick={() => handleButtonVote('no')}
              className="w-16 h-16 bg-red-500 hover:bg-red-600 text-white rounded-full p-0 shadow-lg"
              data-testid="button-no"
            >
              <X className="w-6 h-6" />
            </Button>
            
            {/* Don't Know Button */}
            <Button
              onClick={() => handleButtonVote('dont_know')}
              className="w-14 h-14 bg-yellow-500 hover:bg-yellow-600 text-white rounded-full p-0 shadow-lg"
              data-testid="button-dont-know"
            >
              <HelpCircle className="w-5 h-5" />
            </Button>
            
            {/* Favorite Button */}
            <Button
              onClick={handleFavoriteToggle}
              className={`w-14 h-14 rounded-full p-0 shadow-lg transition-colors ${
                isFavorite
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-purple-500 hover:bg-purple-600 text-white'
              }`}
              data-testid="button-favorite"
            >
              <Star className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
            </Button>
            
            {/* Yes Button */}
            <Button
              onClick={() => handleButtonVote('yes')}
              className="w-16 h-16 bg-green-500 hover:bg-green-600 text-white rounded-full p-0 shadow-lg"
              data-testid="button-yes"
            >
              <Heart className="w-6 h-6" />
            </Button>
          </div>
          
          <div className="mt-3 text-center">
            <p className="text-gray-500 text-sm">Swipe or tap to vote</p>
          </div>
        </div>
      </div>
    </div>
  );
}
