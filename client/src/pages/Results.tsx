import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Star, AlertTriangle, Trophy, Filter, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import type { PNMWithVotes, VotingRoundWithDetails } from '@shared/schema';

interface ResultsData {
  results: PNMWithVotes[];
  stats: {
    totalVotes: number;
    uniqueVoters: number;
    avgYesPercentage: number;
    totalFavorites: number;
  };
}

type SortOption = 'highest-score' | 'most-favorited' | 'most-controversial' | 'alphabetical';
type FilterOption = 'all' | 'favorites-only';

export default function Results() {
  const [sortBy, setSortBy] = useState<SortOption>('highest-score');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');

  // Fetch active round
  const { data: activeRound } = useQuery<VotingRoundWithDetails | null>({
    queryKey: ['/api/rounds/active'],
  });

  // Fetch results for active round
  const { data: resultsData, isLoading } = useQuery<ResultsData>({
    queryKey: ['/api/rounds', activeRound?.id, 'results'],
    enabled: !!activeRound?.id,
  });

  const handleExport = () => {
    if (activeRound?.id) {
      window.open(`/api/exports/rounds/${activeRound.id}.csv`, '_blank');
    }
  };

  // Get unique tags from all PNMs
  const allTags = useMemo(() => {
    if (!resultsData?.results) return [];
    const tagSet = new Set<string>();
    resultsData.results.forEach(result => {
      result.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet);
  }, [resultsData?.results]);

  // Sort and filter results
  const processedResults = useMemo(() => {
    if (!resultsData?.results) return [];
    
    let filtered = resultsData.results;

    // Filter by favorites
    if (filterBy === 'favorites-only') {
      filtered = filtered.filter(result => result.favoriteCount > 0);
    }

    // Filter by tags
    if (tagFilter !== 'all') {
      filtered = filtered.filter(result => result.tags?.includes(tagFilter));
    }

    // Sort results
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'highest-score':
          return b.yesPercentage - a.yesPercentage;
        case 'most-favorited':
          return b.favoriteCount - a.favoriteCount;
        case 'most-controversial':
          return b.controversyScore - a.controversyScore;
        case 'alphabetical':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
  }, [resultsData?.results, sortBy, filterBy, tagFilter]);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 1:
        return <div className="w-5 h-5 bg-gray-400 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>;
      case 2:
        return <div className="w-5 h-5 bg-orange-400 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>;
      default:
        return <div className="w-5 h-5 bg-gray-300 text-white rounded-full flex items-center justify-center text-xs font-bold">{index + 1}</div>;
    }
  };

  const getCardClassName = (index: number, result: PNMWithVotes) => {
    if (index === 0) return "bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200";
    if (result.yesPercentage < 60) return "bg-red-50 border-red-200";
    return "bg-white border-gray-200";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto bg-white min-h-screen shadow-lg">
          <div className="p-4">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-gray-200 animate-pulse rounded-xl h-20"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!activeRound || !resultsData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white shadow-lg rounded-2xl p-6 text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Results Available</h2>
          <p className="text-gray-600 mb-4">No active voting round or results found.</p>
          <Link href="/dashboard">
            <Button>Return to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-lg">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">Results</h1>
          <Button
            onClick={handleExport}
            size="sm"
            variant="outline"
            data-testid="button-export"
          >
            <Download className="w-4 h-4" />
          </Button>
        </header>

        {/* Enhanced Stats Section */}
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600">Total Votes</p>
                    <p className="text-lg font-bold text-gray-900">{resultsData.stats.totalVotes}</p>
                  </div>
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600">Voters</p>
                    <p className="text-lg font-bold text-gray-900">{resultsData.stats.uniqueVoters}</p>
                  </div>
                  <Star className="w-6 h-6 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-200 bg-white space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filter & Sort</span>
          </div>
          <div className="flex space-x-2 overflow-x-auto pb-2">
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="w-40 flex-shrink-0" data-testid="select-sort">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="highest-score">Highest Score</SelectItem>
                <SelectItem value="most-favorited">Most Favorited</SelectItem>
                <SelectItem value="most-controversial">Most Controversial</SelectItem>
                <SelectItem value="alphabetical">Alphabetical</SelectItem>
              </SelectContent>
            </Select>

            {allTags.length > 0 && (
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="w-32 flex-shrink-0" data-testid="select-tag-filter">
                  <SelectValue placeholder="All Tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  {allTags.map(tag => (
                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex space-x-2">
            <Button
              variant={filterBy === 'favorites-only' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterBy(filterBy === 'favorites-only' ? 'all' : 'favorites-only')}
              className="text-xs"
              data-testid="button-favorites-filter"
            >
              <Star className="w-3 h-3 mr-1" />
              Favorites Only
            </Button>
          </div>
        </div>

        {/* Results List */}
        <div className="p-4 space-y-3">
          {processedResults.length > 0 ? processedResults.map((result, index) => (
            <motion.div
              key={result.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Card className={`${getCardClassName(index, result)} shadow-sm hover:shadow-md transition-shadow duration-200`}>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {getRankIcon(index)}
                    </div>
                    
                    <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
                      {result.photoPath ? (
                        <img
                          src={result.photoPath.startsWith('/objects/') ? result.photoPath : `/objects/${result.photoPath}`}
                          alt={`${result.name} profile`}
                          className="w-full h-full object-cover"
                          data-testid={`result-photo-${result.id}`}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">
                            {result.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-gray-900" data-testid={`result-name-${result.id}`}>
                          {result.name}
                        </h3>
                        {result.favoriteCount > 0 && (
                          <div className="flex items-center">
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            <span className="text-xs text-yellow-600 ml-1">{result.favoriteCount}</span>
                          </div>
                        )}
                        {result.controversyScore > 50 && (
                          <AlertTriangle className="w-4 h-4 text-red-500" title="Controversial" />
                        )}
                      </div>
                      <p className="text-gray-600 text-sm">{result.major}</p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-2">
                          <span 
                            className={`text-sm font-medium ${
                              result.yesPercentage >= 70 ? 'text-green-600' : 
                              result.yesPercentage >= 50 ? 'text-yellow-600' : 
                              'text-red-600'
                            }`}
                            data-testid={`result-percentage-${result.id}`}
                          >
                            {result.yesPercentage}% Yes
                          </span>
                          {result.tags && result.tags.length > 0 && (
                            <div className="flex gap-1">
                              {result.tags.slice(0, 2).map((tag, tagIndex) => (
                                <Badge key={tagIndex} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {result.tags.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{result.tags.length - 2}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className={`text-lg font-bold ${
                          index === 0 ? 'text-yellow-600' :
                          result.yesPercentage >= 70 ? 'text-green-600' : 
                          result.yesPercentage >= 50 ? 'text-gray-600' : 
                          'text-red-500'
                        }`} data-testid={`result-score-${result.id}`}>
                          {result.yesPercentage}%
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )) : (
            <div className="text-center py-8 text-gray-500">
              <p>No results match your current filters.</p>
            </div>
          )}
        </div>

        {/* Analytics Summary */}
        {resultsData.stats && (
          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Round Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600" data-testid="stat-avg-yes">
                  {resultsData.stats.avgYesPercentage}%
                </div>
                <div className="text-gray-600 text-sm">Avg Yes Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600" data-testid="stat-total-favorites">
                  {resultsData.stats.totalFavorites}
                </div>
                <div className="text-gray-600 text-sm">Total Favorites</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}