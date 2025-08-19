import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Hand, PlayCircle, UserPlus, BarChart, Clock, Copy, Trash2, MoreVertical, Calendar, Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import { AddPNMModal } from '@/components/AddPNMModal';
import { PNMList } from '@/components/PNMList';
import { AuthHeader } from '@/components/AuthHeader';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LiveIndicator } from '@/components/LiveIndicator';
import { ProgressTimer } from '@/components/ProgressTimer';
import { AvatarWithFallback } from '@/components/AvatarWithFallback';
import { OnboardingTooltip } from '@/components/OnboardingTooltip';
import { VotingFeedback } from '@/components/VotingFeedback';
import { useTheme } from '@/components/ThemeProvider';
import type { PNM, VotingRoundWithDetails } from '@shared/schema';

export default function Dashboard() {
  const [showAddPNMModal, setShowAddPNMModal] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pnmToDelete, setPNMToDelete] = useState<{ id: string; name: string } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [votingFeedback, setVotingFeedback] = useState<{
    type: 'up' | 'down' | 'favorite' | 'skip';
    isVisible: boolean;
  } | null>(null);
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();

  // Fetch PNMs
  const { data: pnms = [], isLoading: pnmsLoading } = useQuery<PNM[]>({
    queryKey: ['/api/pnms'],
  });

  // Check if user is new and should see onboarding
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('rushrank-onboarding-seen');
    const isFirstVisit = !hasSeenOnboarding && pnms.length === 0;
    if (isFirstVisit) {
      setShowOnboarding(true);
    }
  }, [pnms.length]);

  // Fetch active round
  const { data: activeRound, isLoading: roundLoading } = useQuery<VotingRoundWithDetails | null>({
    queryKey: ['/api/rounds/active'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Start voting round mutation
  const startRoundMutation = useMutation({
    mutationFn: async (selectedPNMIds: string[]) => {
      const response = await apiRequest('POST', '/api/rounds', {
        selectedPNMIds,
        isActive: true,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/rounds/active'] });
      // Show celebration feedback
      setVotingFeedback({ type: 'favorite', isVisible: true });
      toast({
        title: "🎉 Voting round started!",
        description: `Room code: ${data.roomCode} - Share with brothers to start voting`,
      });
    },
    onError: () => {
      setVotingFeedback({ type: 'skip', isVisible: true });
      toast({
        title: "Error",
        description: "Failed to start voting round.",
        variant: "destructive",
      });
    },
  });

  // Delete PNM mutation
  const deletePNMMutation = useMutation({
    mutationFn: async (pnmId: string) => {
      const response = await apiRequest('DELETE', `/api/pnms/${pnmId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pnms'] });
      toast({
        title: "PNM deleted",
        description: "The PNM has been removed successfully.",
      });
      setDeleteDialogOpen(false);
      setPNMToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete PNM.",
        variant: "destructive",
      });
    },
  });

  // End round mutation  
  const endRoundMutation = useMutation({
    mutationFn: async (roundId: string) => {
      const response = await apiRequest('PUT', `/api/rounds/${roundId}/end`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rounds/active'] });
      toast({
        title: "Round ended",
        description: "The voting round has been ended successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to end voting round.",
        variant: "destructive",
      });
    },
  });

  const handleStartRound = () => {
    if (pnms.length === 0) {
      toast({
        title: "No PNMs available",
        description: "Please add some PNMs before starting a voting round.",
        variant: "destructive",
      });
      return;
    }
    
    // Start round with all PNMs
    const allPNMIds = pnms.map(pnm => pnm.id);
    startRoundMutation.mutate(allPNMIds);
  };

  const handleEndRound = () => {
    if (activeRound) {
      endRoundMutation.mutate(activeRound.id);
    }
  };

  const copyRoomCode = () => {
    if (activeRound?.roomCode) {
      navigator.clipboard.writeText(activeRound.roomCode);
      setVotingFeedback({ type: 'up', isVisible: true });
      toast({
        title: "✅ Copied!",
        description: "Room code copied to clipboard. Share it with brothers!",
      });
    }
  };

  const handleDeletePNM = (id: string, name: string) => {
    setPNMToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const confirmDeletePNM = () => {
    if (pnmToDelete) {
      deletePNMMutation.mutate(pnmToDelete.id);
    }
  };

  const recentPNMs = pnms.slice(0, 3);

  // Onboarding steps
  const onboardingSteps = [
    {
      id: 'welcome',
      title: 'Welcome to RushRank!',
      description: 'RushRank helps you streamline your fraternity rush process with digital voting, real-time results, and comprehensive PNM management. Let\'s get you started!'
    },
    {
      id: 'add-pnms',
      title: 'Add Your First PNMs',
      description: 'Start by adding potential new members with their photos, personal information, and tags. This will be the foundation of your voting rounds.'
    },
    {
      id: 'start-voting',
      title: 'Create Voting Rounds',
      description: 'Once you have PNMs added, start a voting round to generate a room code. Brothers can join using this code to vote on their mobile devices.'
    },
    {
      id: 'track-results',
      title: 'View Results & Analytics',
      description: 'Monitor real-time voting progress, view detailed analytics, and track attendance at rush events. Everything you need for data-driven decisions.'
    }
  ];

  const ThemeToggle = () => {
    const getIcon = () => {
      switch (theme) {
        case 'light':
          return <Sun className="w-4 h-4" />;
        case 'dark':
          return <Moon className="w-4 h-4" />;
        case 'system':
          return <Monitor className="w-4 h-4" />;
      }
    };

    const nextTheme = () => {
      const themes: Array<typeof theme> = ['light', 'dark', 'system'];
      const currentIndex = themes.indexOf(theme);
      const nextIndex = (currentIndex + 1) % themes.length;
      setTheme(themes[nextIndex]);
    };

    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={nextTheme}
        className="btn-interactive"
        data-testid="button-theme-toggle"
      >
        {getIcon()}
      </Button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-800">
      <div className="max-w-md mx-auto bg-white dark:bg-gray-900 min-h-screen shadow-strong">
        {/* Enhanced Header */}
        <header className="bg-gradient-primary glass-effect border-b border-white/20 px-4 py-4 sticky top-0 z-40">
          <div className="flex items-center justify-between">
            <Link href="/">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="flex items-center space-x-3"
              >
                <Users className="text-white text-xl" />
                <h1 className="text-xl font-bold text-white">RushRank</h1>
              </motion.div>
            </Link>
            <div className="flex items-center space-x-2">
              <LiveIndicator
                isLive={activeRound?.isActive || false}
                voterCount={activeRound?.voterCount || 0}
              />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="p-4 space-y-6">
          {/* Enhanced Stats Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 gap-4"
          >
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Card className="card-elevated bg-gradient-to-br from-blue-500 to-blue-600 border-blue-300 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm font-medium">Total PNMs</p>
                      <motion.p
                        key={pnms.length}
                        initial={{ scale: 1.2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-2xl font-bold text-white"
                        data-testid="stat-total-pnms"
                      >
                        {pnmsLoading ? "..." : pnms.length}
                      </motion.p>
                    </div>
                    <Users className="text-blue-200 text-xl" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Card className="card-elevated bg-gradient-to-br from-green-500 to-green-600 border-green-300 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-sm font-medium">Active Voters</p>
                      <motion.p
                        key={activeRound?.voterCount || 0}
                        initial={{ scale: 1.2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-2xl font-bold text-white"
                        data-testid="stat-active-voters"
                      >
                        {roundLoading ? "..." : (activeRound?.voterCount || 0)}
                      </motion.p>
                    </div>
                    <Hand className="text-green-200 text-xl" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-3"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Quick Actions</h2>
            
            {!activeRound ? (
              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button
                  onClick={handleStartRound}
                  disabled={startRoundMutation.isPending || pnms.length === 0}
                  className="w-full bg-gradient-primary text-white p-4 rounded-xl flex items-center justify-between btn-interactive shadow-strong hover:shadow-xl transition-all duration-300"
                  data-testid="button-start-round"
                >
                  <div className="flex items-center space-x-3">
                    <motion.div
                      animate={startRoundMutation.isPending ? { rotate: 360 } : {}}
                      transition={{ duration: 2, repeat: startRoundMutation.isPending ? Infinity : 0 }}
                    >
                      <PlayCircle className="text-xl" />
                    </motion.div>
                    <div className="text-left">
                      <div className="font-semibold">
                        {startRoundMutation.isPending ? "Starting..." : "Start Voting Round"}
                      </div>
                      <div className="text-white/80 text-sm">Begin new voting session</div>
                    </div>
                  </div>
                </Button>
              </motion.div>
            ) : (
              <Card className="bg-yellow-50 border-yellow-200">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <Clock className="text-yellow-600" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-yellow-900">Round in Progress</h3>
                      <p className="text-yellow-700 text-sm">
                        Currently voting on: <span className="font-medium">
                          {activeRound.currentPNM?.name || "Loading..."}
                        </span>
                      </p>
                      <div className="mt-2 flex items-center space-x-4">
                        <Button
                          onClick={copyRoomCode}
                          variant="ghost"
                          size="sm"
                          className="text-yellow-600 p-0 h-auto hover:bg-transparent"
                          data-testid="button-copy-room-code"
                        >
                          Room Code: <span className="font-mono font-bold ml-1">{activeRound.roomCode}</span>
                          <Copy className="w-3 h-3 ml-1" />
                        </Button>
                        <span className="text-xs text-yellow-600">
                          {(activeRound.currentPNMIndex || 0) + 1}/{activeRound.totalPNMs} PNMs
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex space-x-2">
                    <Link href="/voting">
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                        View Voting
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleEndRound}
                      disabled={endRoundMutation.isPending}
                      className="border-yellow-300"
                      data-testid="button-end-round"
                    >
                      {endRoundMutation.isPending ? "Ending..." : "End Round"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button
              onClick={() => setShowAddPNMModal(true)}
              variant="outline"
              className="w-full border border-gray-200 p-4 rounded-xl flex items-center justify-between hover:bg-gray-50"
              data-testid="button-add-pnm"
            >
              <div className="flex items-center space-x-3">
                <UserPlus className="text-gray-600 text-xl" />
                <div className="text-left">
                  <div className="font-semibold text-gray-900">Add New PNM</div>
                  <div className="text-gray-500 text-sm">Upload photo and details</div>
                </div>
              </div>
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Link href="/events">
                <Button
                  variant="outline"
                  className="w-full border border-gray-200 p-4 rounded-xl flex flex-col items-center justify-center hover:bg-gray-50"
                  data-testid="button-manage-events"
                >
                  <Calendar className="text-gray-600 text-lg mb-1" />
                  <div className="font-semibold text-gray-900 text-sm">Events</div>
                  <div className="text-gray-500 text-xs">Track attendance</div>
                </Button>
              </Link>
              
              <Link href="/results">
                <Button
                  variant="outline"
                  className="w-full border border-gray-200 p-4 rounded-xl flex flex-col items-center justify-center hover:bg-gray-50"
                  data-testid="button-view-results"
                >
                  <BarChart className="text-gray-600 text-lg mb-1" />
                  <div className="font-semibold text-gray-900 text-sm">Results</div>
                  <div className="text-gray-500 text-xs">View analytics</div>
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Enhanced PNM Management */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-3"
          >
            <PNMList />

          </motion.div>
        </div>

        <AddPNMModal
          open={showAddPNMModal}
          onOpenChange={setShowAddPNMModal}
        />

        {/* Enhanced Feedback Systems */}
        <OnboardingTooltip
          steps={onboardingSteps}
          isVisible={showOnboarding}
          onComplete={() => setShowOnboarding(false)}
        />

        {votingFeedback && (
          <VotingFeedback
            type={votingFeedback.type}
            isVisible={votingFeedback.isVisible}
            onComplete={() => setVotingFeedback(null)}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete PNM</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {pnmToDelete?.name}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeletePNM}
                className="bg-red-600 hover:bg-red-700"
                disabled={deletePNMMutation.isPending}
              >
                {deletePNMMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
