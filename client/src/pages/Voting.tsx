import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Forward, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { SwipeCard } from '@/components/SwipeCard';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Link } from 'wouter';
import type { PNM, VotingRoundWithDetails, InsertVote } from '@shared/schema';

export default function Voting() {
  const [voterId, setVoterId] = useState<string>('');
  const [roundId, setRoundId] = useState<string>('');
  const [currentPNM, setCurrentPNM] = useState<PNM | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalPNMs, setTotalPNMs] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize voter ID and round ID from session storage
  useEffect(() => {
    const storedVoterId = sessionStorage.getItem('voterId');
    const storedRoundId = sessionStorage.getItem('roundId');
    
    if (!storedVoterId) {
      const newVoterId = Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('voterId', newVoterId);
      setVoterId(newVoterId);
    } else {
      setVoterId(storedVoterId);
    }

    if (storedRoundId) {
      setRoundId(storedRoundId);
    }
  }, []);

  // Fetch active round if no round ID in session
  const { data: activeRound, isLoading: roundLoading } = useQuery<VotingRoundWithDetails | null>({
    queryKey: ['/api/rounds/active'],
    enabled: !roundId,
  });

  // Update round and PNM state when active round changes
  useEffect(() => {
    if (activeRound && !roundId) {
      setRoundId(activeRound.id);
      sessionStorage.setItem('roundId', activeRound.id);
      setCurrentPNM(activeRound.currentPNM || null);
      setCurrentIndex(activeRound.currentPNMIndex || 0);
      setTotalPNMs(activeRound.totalPNMs);
    }
  }, [activeRound, roundId]);

  // WebSocket setup
  const { joinRound, nextPNM, voteSubmitted } = useWebSocket({
    onRoundState: (data: VotingRoundWithDetails) => {
      setCurrentPNM(data.currentPNM || null);
      setCurrentIndex(data.currentPNMIndex || 0);
      setTotalPNMs(data.totalPNMs);
    },
    onPNMChanged: (data: any) => {
      setCurrentPNM(data.currentPNM);
      setCurrentIndex(data.currentIndex);
      setTotalPNMs(data.totalPNMs);
      toast({
        title: "Next PNM",
        description: `Now voting on: ${data.currentPNM?.name}`,
      });
    },
    onRoundEnded: () => {
      toast({
        title: "Round ended",
        description: "The voting round has been ended by the admin.",
      });
      sessionStorage.removeItem('roundId');
      // Redirect to results or home
      window.location.href = '/results';
    },
  });

  // Join round when both IDs are available
  useEffect(() => {
    if (roundId && voterId) {
      const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
      joinRound(roundId, voterId, isAdmin);
    }
  }, [roundId, voterId, joinRound]);

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async (voteData: InsertVote) => {
      const response = await apiRequest('POST', '/api/votes', voteData);
      return response.json();
    },
    onSuccess: (data, variables) => {
      voteSubmitted({
        pnmId: variables.pnmId,
        vote: variables.vote,
        isFavorite: variables.isFavorite,
      });
      toast({
        title: "Vote recorded",
        description: `Your vote has been recorded successfully.`,
      });
    },
    onError: () => {
      toast({
        title: "Vote failed",
        description: "Failed to record your vote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleVote = (vote: 'yes' | 'no' | 'dont_know', isFavorite = false) => {
    if (!currentPNM || !roundId || !voterId) return;

    const voteData: InsertVote = {
      roundId,
      pnmId: currentPNM.id,
      voterId,
      vote,
      isFavorite,
    };

    voteMutation.mutate(voteData);
  };

  const handleNextPNM = () => {
    nextPNM();
  };

  const progressPercentage = totalPNMs > 0 ? ((currentIndex + 1) / totalPNMs) * 100 : 0;

  if (roundLoading || (!currentPNM && !roundLoading)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white shadow-lg rounded-2xl p-6 text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {roundLoading ? "Loading..." : "No Active Round"}
          </h2>
          <p className="text-gray-600 mb-4">
            {roundLoading 
              ? "Connecting to voting round..." 
              : "There's no active voting round right now."
            }
          </p>
          <Link href="/">
            <Button>Return Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-lg relative">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">Voting</h1>
          <div className="w-8"></div> {/* Spacer for centering */}
        </header>

        {/* Room Code Display */}
        <div className="bg-primary text-white p-4 text-center">
          <p className="text-blue-100 text-sm">Room Code</p>
          <p className="text-2xl font-bold font-mono tracking-wider" data-testid="room-code">
            {activeRound?.roomCode || sessionStorage.getItem('roomCode') || 'Loading...'}
          </p>
          <p className="text-blue-100 text-xs mt-1">Share this code with brothers</p>
        </div>

        {/* Progress Bar */}
        <div className="p-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span data-testid="progress-text">{currentIndex + 1} of {totalPNMs}</span>
          </div>
          <Progress value={progressPercentage} className="h-2" data-testid="progress-bar" />
        </div>

        {/* Swipe Card Area */}
        <div className="px-4 pb-32" style={{ minHeight: 'calc(100vh - 280px)' }}>
          {currentPNM && (
            <SwipeCard
              pnm={currentPNM}
              onVote={handleVote}
              className="h-full"
            />
          )}

          {/* Next Card Preview */}
          <div className="absolute inset-x-6 top-6 bottom-32 bg-gray-100 rounded-2xl shadow-lg transform scale-95 -z-10"></div>
        </div>

        {/* Admin Controls */}
        {sessionStorage.getItem('isAdmin') === 'true' && (
          <div className="fixed top-20 right-4 z-50">
            <Button
              onClick={handleNextPNM}
              className="bg-primary text-white p-3 rounded-full shadow-lg hover:bg-blue-700"
              data-testid="button-admin-next"
            >
              <Forward className="w-5 h-5" />
            </Button>
          </div>
        )}

        {/* Loading overlay during vote submission */}
        {voteMutation.isPending && (
          <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-4 shadow-lg">
              <p className="text-gray-700">Recording vote...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
