import { useState } from 'react';
import AppShell from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextInput } from '@/components/ui/input';  
import { Modal } from '@/components/ui/dialog';

export default function WelcomeNew() {
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState('');

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Joining with code:', code);
    // TODO: Navigate to voting round
    setJoinOpen(false);
  };

  return (
    <AppShell>
      <div className="grid gap-8 md:grid-cols-[1.2fr_.8fr]">
        <Card
          title="Welcome to RushRank"
          subtitle="Streamline your fraternity rush process with real-time voting and analytics."
          action={
            <Button onClick={() => setJoinOpen(true)}>
              Join a Voting Round
            </Button>
          }
        >
          <ul className="mt-2 space-y-2 text-sm text-text-muted">
            <li>• Real-time swipe voting interface</li>
            <li>• Comprehensive PNM profiles with photos</li>
            <li>• Advanced filtering & analytics</li>
            <li>• Export results securely</li>
          </ul>
        </Card>

        <Card
          title="Admin Dashboard"
          subtitle="Manage PNMs, start rounds, and view results."
          action={
            <Button variant="secondary">
              Open Dashboard
            </Button>
          }
        >
          <p className="text-sm text-text-muted">
            For rush chairs and admins only.
          </p>
        </Card>
      </div>

      <Modal open={joinOpen} onClose={() => setJoinOpen(false)} title="Join Voting Round">
        <form className="space-y-4" onSubmit={handleJoinSubmit}>
          <div>
            <label className="block text-sm font-medium text-text mb-2">Room Code</label>
            <TextInput
              data-autofocus
              inputMode="text"
              placeholder="e.g., ABC123"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              aria-describedby="join-help"
              maxLength={6}
            />
            <p id="join-help" className="text-xs text-text-muted mt-1">
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
      </Modal>
    </AppShell>
  );
}