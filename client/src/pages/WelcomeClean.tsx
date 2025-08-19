import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function WelcomeClean() {
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState('');

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Joining with code:', code);
    // TODO: Navigate to voting round
    setJoinOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white font-semibold text-sm">
              RR
            </div>
            <div className="leading-tight">
              <div className="text-lg font-semibold text-foreground">RushRank</div>
              <div className="text-xs text-muted-foreground">Digital Rush Voting Platform</div>
            </div>
          </div>
          <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 grid place-items-center font-medium text-sm">
            CO
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 md:grid-cols-[1.2fr_.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Welcome to RushRank</CardTitle>
              <CardDescription>
                Streamline your fraternity rush process with real-time voting and analytics.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-start">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Real-time swipe voting interface</li>
                  <li>• Comprehensive PNM profiles with photos</li>
                  <li>• Advanced filtering & analytics</li>
                  <li>• Export results securely</li>
                </ul>
                <Button onClick={() => setJoinOpen(true)} className="ml-4">
                  Join a Voting Round
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Admin Dashboard</CardTitle>
              <CardDescription>
                Manage PNMs, start rounds, and view results.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-start">
                <p className="text-sm text-muted-foreground">
                  For rush chairs and admins only.
                </p>
                <Button variant="secondary">
                  Open Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Join Modal */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Voting Round</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleJoinSubmit}>
            <div className="space-y-2">
              <Label htmlFor="room-code">Room Code</Label>
              <Input
                id="room-code"
                placeholder="e.g., ABC123"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Enter the code shared by your rush chair.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setJoinOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={code.length < 4}>
                Join Round
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}