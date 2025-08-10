import { useState } from 'react';
import { Link } from 'wouter';
import { VoteIcon as Vote, Settings, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { JoinRoundModal } from '@/components/JoinRoundModal';

export default function Home() {
  const [showJoinModal, setShowJoinModal] = useState(false);

  const handleJoinSuccess = (roundData: any) => {
    // Store voter ID in sessionStorage
    const voterId = Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('voterId', voterId);
    sessionStorage.setItem('roundId', roundData.id);
    // Navigate to voting page
    window.location.href = '/voting';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-lg">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-6">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-2">
              <Vote className="w-8 h-8 text-primary" />
              <h1 className="text-2xl font-bold text-gray-900" data-testid="app-title">
                RushRank
              </h1>
            </div>
            <p className="text-gray-600 text-sm">Digital Rush Voting Platform</p>
          </div>
        </header>

        {/* Main Content */}
        <div className="p-6 space-y-8">
          {/* Welcome Section */}
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Welcome to RushRank
            </h2>
            <p className="text-gray-600">
              Streamline your fraternity rush process with real-time voting and comprehensive analytics.
            </p>
          </div>

          {/* Action Cards */}
          <div className="space-y-4">
            {/* Join Round Card */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6">
              <div className="text-center space-y-4">
                <PlayCircle className="w-12 h-12 text-blue-600 mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold text-blue-900">Join a Voting Round</h3>
                  <p className="text-blue-700 text-sm mt-1">
                    Enter a room code to participate in active voting
                  </p>
                </div>
                <Button
                  onClick={() => setShowJoinModal(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  data-testid="button-join-round"
                >
                  Join Round
                </Button>
              </div>
            </div>

            {/* Admin Dashboard Card */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-6">
              <div className="text-center space-y-4">
                <Settings className="w-12 h-12 text-gray-600 mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Admin Dashboard</h3>
                  <p className="text-gray-700 text-sm mt-1">
                    Manage PNMs, start rounds, and view results
                  </p>
                </div>
                <Link href="/dashboard">
                  <Button
                    variant="outline"
                    className="w-full border-gray-300 hover:bg-gray-50"
                    data-testid="button-admin-dashboard"
                  >
                    Open Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Features List */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Key Features</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span className="text-gray-700 text-sm">Real-time swipe voting interface</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span className="text-gray-700 text-sm">Comprehensive PNM profiles with photos</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span className="text-gray-700 text-sm">Advanced results filtering and analytics</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span className="text-gray-700 text-sm">Data export capabilities</span>
              </div>
            </div>
          </div>
        </div>

        <JoinRoundModal
          open={showJoinModal}
          onOpenChange={setShowJoinModal}
          onJoinSuccess={handleJoinSuccess}
        />
      </div>
    </div>
  );
}
