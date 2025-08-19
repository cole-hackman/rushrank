import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Vote, Settings, LogIn } from 'lucide-react';
import { Link } from 'wouter';
import { BottomNav } from '@/components/BottomNav';
import ThemeToggle from '@/components/ThemeToggle';

export default function HomeNew() {
  const [roomCode, setRoomCode] = useState('');

  return (
    <div className="min-h-screen bg-bg text-text">
      <main className="mx-auto max-w-md p-4 pb-24">
        <header className="sticky top-0 z-40 -mx-4 mb-6 bg-bg/80 backdrop-blur px-4 py-3 border-b border-stroke">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">RushRank</h1>
            <ThemeToggle />
          </div>
        </header>

        <section className="space-y-4">
          {/* Admin/Rush Chair Section */}
          <div className="rounded-xl2 bg-card p-5 shadow-md2 border border-stroke">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-pop/10">
                <Settings className="h-5 w-5 text-pop" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-text">Rush Chair / Admin</h2>
                <p className="mt-1 text-textDim text-[15px] leading-6">
                  Manage PNMs, events, and voting results
                </p>
                <Link href="/login">
                  <Button className="mt-4 inline-flex items-center justify-center rounded-full bg-pop px-4 py-2 text-white shadow-md2 hover:opacity-95 active:opacity-90 disabled:opacity-60 transition-all duration-150 active:scale-[.98]">
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign in
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Join Voting Round Section */}
          <div className="rounded-xl2 bg-card p-5 shadow-md2 border border-stroke">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-success/10">
                <Vote className="h-5 w-5 text-success" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-text">Join Voting Round</h2>
                <p className="mt-1 text-textDim text-[15px] leading-6">
                  Enter the code from your rush chair
                </p>
                <div className="mt-4 flex gap-2">
                  <Input
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    className="flex-1 rounded-full border border-stroke bg-bg px-4 py-2 text-[15px] outline-none focus:ring-2 focus:ring-pop/20 focus:border-pop transition-colors duration-150"
                    placeholder="ABC123"
                    maxLength={6}
                  />
                  <Button
                    disabled={roomCode.length < 4}
                    className="rounded-full bg-success px-4 py-2 text-white shadow-sm2 hover:opacity-95 active:opacity-90 disabled:opacity-60 transition-all duration-150 active:scale-[.98]"
                  >
                    Join
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats Section */}
          <div className="rounded-xl2 bg-card p-5 shadow-md2 border border-stroke">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-warn/10">
                <Users className="h-5 w-5 text-warn" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-text">About RushRank</h2>
                <p className="mt-1 text-textDim text-[15px] leading-6">
                  A mobile-first digital voting platform designed to streamline fraternity rush processes with real-time voting and comprehensive analytics.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-bg border border-stroke">
                    <div className="text-lg font-semibold text-text">Real-time</div>
                    <div className="text-sm text-textDim">Voting</div>
                  </div>
                  <div className="p-3 rounded-xl bg-bg border border-stroke">
                    <div className="text-lg font-semibold text-text">Mobile-first</div>
                    <div className="text-sm text-textDim">Design</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <BottomNav />
      </main>
    </div>
  );
}