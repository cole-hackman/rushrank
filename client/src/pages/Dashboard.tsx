import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Hand, PlayCircle, UserPlus, BarChart, Clock, Copy, Trash2, MoreVertical, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import { AddPNMModal } from '@/components/AddPNMModal';
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
import type { PNM, VotingRoundWithDetails } from '@shared/schema';

export default function Dashboard() {
  const [showAddPNMModal, setShowAddPNMModal] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pnmToDelete, setPNMToDelete] = useState<{ id: string; name: string } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch PNMs
  const { data: pnms = [], isLoading: pnmsLoading } = useQuery<PNM[]>({
    queryKey: ['/api/pnms'],
  });

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
      toast({
        title: "Voting round started!",
        description: `Room code: ${data.roomCode}`,
      });
    },
    onError: () => {
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
      toast({
        title: "Copied!",
        description: "Room code copied to clipboard.",
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-lg">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
          <Link href="/">
            <div className="flex items-center space-x-3">
              <Users className="text-primary text-xl" />
              <h1 className="text-xl font-bold text-gray-900">RushRank</h1>
            </div>
          </Link>
          <div className="flex items-center space-x-2">
            <Badge variant={activeRound ? "default" : "secondary"}>
              {activeRound ? "Live" : "Idle"}
            </Badge>
          </div>
        </header>

        <div className="p-4 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-600 text-sm font-medium">Total PNMs</p>
                    <p className="text-2xl font-bold text-blue-900" data-testid="stat-total-pnms">
                      {pnmsLoading ? "..." : pnms.length}
                    </p>
                  </div>
                  <Users className="text-blue-400 text-xl" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-600 text-sm font-medium">Active Voters</p>
                    <p className="text-2xl font-bold text-green-900" data-testid="stat-active-voters">
                      {roundLoading ? "..." : (activeRound?.voterCount || 0)}
                    </p>
                  </div>
                  <Hand className="text-green-400 text-xl" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
            
            {!activeRound ? (
              <Button
                onClick={handleStartRound}
                disabled={startRoundMutation.isPending || pnms.length === 0}
                className="w-full bg-primary text-white p-4 rounded-xl flex items-center justify-between hover:bg-blue-700"
                data-testid="button-start-round"
              >
                <div className="flex items-center space-x-3">
                  <PlayCircle className="text-xl" />
                  <div className="text-left">
                    <div className="font-semibold">
                      {startRoundMutation.isPending ? "Starting..." : "Start Voting Round"}
                    </div>
                    <div className="text-blue-100 text-sm">Begin new voting session</div>
                  </div>
                </div>
              </Button>
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
          </div>

          {/* Recent PNMs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent PNMs</h2>
              {pnms.length > 3 && (
                <Button variant="ghost" size="sm" className="text-primary">
                  View All ({pnms.length})
                </Button>
              )}
            </div>
            
            {pnmsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-gray-200 animate-pulse rounded-xl h-20"></div>
                ))}
              </div>
            ) : recentPNMs.length > 0 ? (
              recentPNMs.map((pnm) => (
                <Card key={pnm.id} className="border border-gray-200">
                  <CardContent className="p-3 flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
                      {pnm.photoPath ? (
                        <img
                          src={`/objects/${pnm.photoPath.replace('/objects/', '')}`}
                          alt={`${pnm.name} profile`}
                          className="w-full h-full object-cover"
                          data-testid={`pnm-photo-${pnm.id}`}
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                          <Users className="w-6 h-6 text-gray-500" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900" data-testid={`pnm-name-${pnm.id}`}>
                        {pnm.name}
                      </h3>
                      <p className="text-gray-500 text-sm">{pnm.major}</p>
                      {pnm.hometown && (
                        <p className="text-gray-400 text-xs">{pnm.hometown}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {pnm.tags && pnm.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {pnm.tags.slice(0, 2).map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {pnm.tags.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{pnm.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="p-1">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={() => handleDeletePNM(pnm.id, pnm.name)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete PNM
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="border border-gray-200">
                <CardContent className="p-6 text-center text-gray-500">
                  <UserPlus className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No PNMs added yet</p>
                  <Button
                    onClick={() => setShowAddPNMModal(true)}
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-primary"
                    data-testid="button-add-first-pnm"
                  >
                    Add your first PNM
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <AddPNMModal
          open={showAddPNMModal}
          onOpenChange={setShowAddPNMModal}
        />

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
