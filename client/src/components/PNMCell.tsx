import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Flag, Vote } from 'lucide-react';

interface PNMCellProps {
  pnm: {
    id: string;
    name: string;
    year?: string;
    major?: string;
    hometown?: string;
    photoPath?: string | null;
    tags?: string[];
  };
  onVote?: (pnmId: string) => void;
  onNote?: (pnmId: string) => void;
  onFlag?: (pnmId: string) => void;
}

export function PNMCell({ pnm, onVote, onNote, onFlag }: PNMCellProps) {
  return (
    <div className="flex gap-3 px-4 py-3 border-b border-stroke bg-card hover:bg-stroke/20 transition-colors duration-150">
      <div className="h-12 w-12 rounded-full bg-stroke overflow-hidden flex-shrink-0">
        {pnm.photoPath ? (
          <img 
            src={pnm.photoPath} 
            alt={pnm.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-stroke flex items-center justify-center text-textDim font-semibold">
            {pnm.name.split(' ').map(n => n[0]).join('')}
          </div>
        )}
      </div>
      
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text text-[15px]">{pnm.name}</span>
          {(pnm.year || pnm.major) && (
            <span className="text-textDim text-sm">
              {pnm.year}{pnm.year && pnm.major && ' • '}{pnm.major}
            </span>
          )}
        </div>
        
        {pnm.hometown && (
          <div className="mt-0.5 text-textDim text-sm">{pnm.hometown}</div>
        )}
        
        {pnm.tags?.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pnm.tags.slice(0, 4).map((tag: string) => (
              <Badge
                key={tag}
                variant="outline"
                className="rounded-full border-stroke px-2 py-0.5 text-[11px] text-textDim bg-transparent hover:bg-stroke/40"
              >
                {tag}
              </Badge>
            ))}
            {pnm.tags.length > 4 && (
              <Badge
                variant="outline"
                className="rounded-full border-stroke px-2 py-0.5 text-[11px] text-textDim bg-transparent"
              >
                +{pnm.tags.length - 4}
              </Badge>
            )}
          </div>
        ) : null}
        
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNote?.(pnm.id)}
            className="rounded-full border-stroke px-3 py-1 h-8 text-xs hover:bg-stroke/20 transition-colors duration-150"
          >
            <MessageSquare className="h-3 w-3 mr-1" />
            Note
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onFlag?.(pnm.id)}
            className="rounded-full border-stroke px-3 py-1 h-8 text-xs hover:bg-stroke/20 transition-colors duration-150"
          >
            <Flag className="h-3 w-3 mr-1" />
            Flag
          </Button>
          <Button
            onClick={() => onVote?.(pnm.id)}
            className="rounded-full bg-pop text-white px-3 py-1 h-8 text-xs shadow-sm2 hover:opacity-95 active:opacity-90 transition-all duration-150 active:scale-[.98]"
          >
            <Vote className="h-3 w-3 mr-1" />
            Vote
          </Button>
        </div>
      </div>
    </div>
  );
}