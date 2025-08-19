import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, MoreVertical, MessageSquare, Flag, User, MapPin } from 'lucide-react';
import { usePNMs, useUserChapters } from '@/hooks/usePNMs';
// import { Skeleton } from '@/components/ui/skeleton';

interface PNM {
  id: string;
  name: string;
  major?: string;
  hometown?: string;
  year?: string;
  tags?: string[];
  photo_url?: string;
  notes_count?: number;
  flagged?: boolean;
  chapter_id: string;
}

export function PNMList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const { data: chapters, isLoading: chaptersLoading } = useUserChapters();
  const currentChapter = chapters?.[0]; // Use first chapter for now
  const { data: pnms = [], isLoading: pnmsLoading, error } = usePNMs(currentChapter?.id);

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

  const getStatusBadge = (pnm: PNM) => {
    if (pnm.flagged) {
      return <Badge variant="destructive" className="text-xs">Flagged</Badge>;
    }
    if (pnm.notes_count && pnm.notes_count > 0) {
      return <Badge variant="secondary" className="text-xs">Has Notes</Badge>;
    }
    return <Badge variant="outline" className="text-xs">Active</Badge>;
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            {(error as Error).message.includes('Authentication') 
              ? 'Please sign in to view PNMs' 
              : 'Failed to load PNMs'
            }
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Potential New Members
            {!chaptersLoading && currentChapter && (
              <Badge variant="outline">{currentChapter.name}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search PNMs by name, major, or hometown..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-pnms"
            />
          </div>

          {/* Tag Filters */}
          <div className="flex flex-wrap gap-2">
            {allTags.map(tag => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? "default" : "outline"}
                className="cursor-pointer hover:bg-primary/80"
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>

          {/* Loading State */}
          {(chaptersLoading || pnmsLoading) && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-[200px] bg-muted animate-pulse rounded" />
                    <div className="h-4 w-[150px] bg-muted animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PNM List */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredPNMs.length === 0 && !pnmsLoading ? (
              <p className="text-center text-muted-foreground py-4">
                {searchTerm || selectedTags.length > 0 
                  ? 'No PNMs match your search criteria'
                  : 'No PNMs found'
                }
              </p>
            ) : (
              filteredPNMs.map((pnm: PNM) => (
                <div 
                  key={pnm.id} 
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  data-testid={`pnm-card-${pnm.id}`}
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={pnm.photo_url} alt={pnm.name} />
                      <AvatarFallback>
                        {pnm.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{pnm.name}</p>
                        {getStatusBadge(pnm)}
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground gap-3">
                        {pnm.major && <span>{pnm.major}</span>}
                        {pnm.hometown && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {pnm.hometown}
                          </span>
                        )}
                        {pnm.year && <span className="capitalize">{pnm.year}</span>}
                      </div>
                      {pnm.tags && pnm.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {pnm.tags.slice(0, 2).map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs px-1 py-0">
                              {tag}
                            </Badge>
                          ))}
                          {pnm.tags.length > 2 && (
                            <Badge variant="secondary" className="text-xs px-1 py-0">
                              +{pnm.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Add Note
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Flag className="mr-2 h-4 w-4" />
                        {pnm.flagged ? 'Remove Flag' : 'Flag for Review'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}