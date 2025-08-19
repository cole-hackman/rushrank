import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Filter, Plus, RefreshCw } from 'lucide-react';
import { usePNMs, useUserChapters } from '@/hooks/usePNMs';
import { PNMCell } from '@/components/PNMCell';

interface PNM {
  id: string;
  name: string;
  major?: string;
  hometown?: string;
  year?: string;
  tags?: string[];
  photoPath?: string | null;
  notes_count?: number;
  flagged?: boolean;
  chapter_id: string;
}

interface PNMListModernProps {
  onAddPNM?: () => void;
}

export function PNMListModern({ onAddPNM }: PNMListModernProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const { data: chapters, isLoading: chaptersLoading } = useUserChapters();
  const currentChapter = chapters?.[0]; // Use first chapter for now
  const { data: pnms = [], isLoading: pnmsLoading, error, refetch } = usePNMs(currentChapter?.id);

  const filteredPNMs = (pnms as PNM[]).filter((pnm: PNM) => {
    const matchesSearch = pnm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         pnm.major?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         pnm.hometown?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTags = selectedTags.length === 0 || 
                       selectedTags.some(tag => pnm.tags?.includes(tag));
                       
    return matchesSearch && matchesTags;
  });

  // Get all unique tags
  const allTags = Array.from(new Set((pnms as PNM[]).flatMap((pnm: PNM) => pnm.tags || [])));

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleVote = (pnmId: string) => {
    console.log('Vote for PNM:', pnmId);
    // TODO: Implement voting logic
  };

  const handleNote = (pnmId: string) => {
    console.log('Add note for PNM:', pnmId);
    // TODO: Implement notes logic
  };

  const handleFlag = (pnmId: string) => {
    console.log('Flag PNM:', pnmId);
    // TODO: Implement flagging logic
  };

  if (error) {
    return (
      <div className="rounded-xl2 bg-card p-6 shadow-sm2 border border-stroke text-center">
        <div className="text-danger text-sm mb-3">Failed to load PNMs</div>
        <Button 
          onClick={() => refetch()} 
          size="sm" 
          className="bg-pop text-white hover:opacity-95"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Header */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-textDim" />
            <Input
              placeholder="Search PNMs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-full border-stroke bg-bg text-[15px] focus:ring-2 focus:ring-pop/20 focus:border-pop"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="rounded-full px-3 border-stroke hover:bg-stroke/20"
          >
            <Filter className="h-4 w-4" />
          </Button>
          {onAddPNM && (
            <Button
              onClick={onAddPNM}
              className="rounded-full px-3 bg-pop text-white hover:opacity-95"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Tag Filters */}
        {showFilters && allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 bg-card rounded-xl border border-stroke">
            <div className="text-sm text-textDim font-medium w-full mb-1">Filter by tags:</div>
            {allTags.map(tag => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? "default" : "outline"}
                onClick={() => toggleTag(tag)}
                className={`cursor-pointer rounded-full text-xs transition-colors duration-150 ${
                  selectedTags.includes(tag)
                    ? 'bg-pop text-white hover:opacity-90'
                    : 'border-stroke hover:bg-stroke/20'
                }`}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Results count */}
        <div className="flex items-center justify-between text-sm text-textDim">
          <span>{filteredPNMs.length} PNM{filteredPNMs.length !== 1 ? 's' : ''}</span>
          {selectedTags.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedTags([])}
              className="h-6 px-2 text-xs text-textDim hover:text-text"
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* PNM List */}
      <div className="rounded-xl2 bg-card border border-stroke shadow-sm2 overflow-hidden">
        {pnmsLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pop mx-auto mb-3"></div>
            <div className="text-textDim text-sm">Loading PNMs...</div>
          </div>
        ) : filteredPNMs.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-textDim text-sm mb-3">
              {searchTerm || selectedTags.length > 0 ? 'No PNMs match your filters' : 'No PNMs yet'}
            </div>
            {onAddPNM && (!searchTerm && selectedTags.length === 0) && (
              <Button
                onClick={onAddPNM}
                size="sm"
                className="bg-pop text-white hover:opacity-95"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First PNM
              </Button>
            )}
          </div>
        ) : (
          <div>
            {filteredPNMs.map((pnm, index) => (
              <PNMCell
                key={pnm.id}
                pnm={pnm}
                onVote={handleVote}
                onNote={handleNote}
                onFlag={handleFlag}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}