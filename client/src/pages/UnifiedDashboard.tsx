import { useState } from 'react';
import { Plus, Calendar, BarChart3, ArrowLeft, Search } from 'lucide-react';
import { useLocation } from 'wouter';
import { PrimaryButton, SecondaryButton } from '@/components/ui/unified-button';
import { UnifiedCard, UnifiedCardHeader, UnifiedCardBody } from '@/components/ui/unified-card';

export default function UnifiedDashboard() {
  const [showAddPNM, setShowAddPNM] = useState(false);
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-rr-bg">
      {/* Sticky Navigation */}
      <header className="sticky top-4 z-50">
        <nav className="mx-auto max-w-6xl rounded-2xl bg-black/40 backdrop-blur px-4 py-3 border border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setLocation('/')}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 text-white" />
              </button>
              <div className="h-7 w-7 rounded-xl bg-gradient-to-r from-rr-accent to-rr-accentDark text-white grid place-items-center font-bold text-sm">
                RR
              </div>
              <span className="font-semibold text-white">RushRank</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-white/70">Chapter Dashboard</div>
              <div className="h-8 w-8 rounded-full bg-rr-accent/20 text-rr-accent grid place-items-center font-medium text-sm">
                CO
              </div>
            </div>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10">
        {/* Stats Grid */}
        <section className="grid md:grid-cols-4 gap-6 mb-8">
          <UnifiedCard>
            <UnifiedCardBody>
              <div className="text-sm text-rr-muted">Total PNMs</div>
              <div className="text-3xl font-bold mt-1 text-white">0</div>
            </UnifiedCardBody>
          </UnifiedCard>
          
          <UnifiedCard>
            <UnifiedCardBody>
              <div className="text-sm text-rr-muted">Active voters</div>
              <div className="text-3xl font-bold mt-1 text-white">0</div>
            </UnifiedCardBody>
          </UnifiedCard>
          
          <UnifiedCard>
            <UnifiedCardBody>
              <div className="text-sm text-rr-muted">Upcoming events</div>
              <div className="text-3xl font-bold mt-1 text-white">0</div>
            </UnifiedCardBody>
          </UnifiedCard>
          
          <UnifiedCard>
            <UnifiedCardBody>
              <div className="text-sm text-rr-muted">System status</div>
              <div className="mt-2 inline-flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-white">All good</span>
              </div>
            </UnifiedCardBody>
          </UnifiedCard>
        </section>

        {/* Quick Actions */}
        <section className="grid md:grid-cols-3 gap-6 mb-8">
          <UnifiedCard>
            <UnifiedCardHeader title="Add new PNM" subtitle="Upload photo and details" />
            <UnifiedCardBody>
              <PrimaryButton onClick={() => setShowAddPNM(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add PNM
              </PrimaryButton>
            </UnifiedCardBody>
          </UnifiedCard>

          <UnifiedCard>
            <UnifiedCardHeader title="Events" subtitle="Track attendance" />
            <UnifiedCardBody>
              <SecondaryButton>
                <Calendar className="h-4 w-4 mr-2" />
                Open
              </SecondaryButton>
            </UnifiedCardBody>
          </UnifiedCard>

          <UnifiedCard>
            <UnifiedCardHeader title="Results" subtitle="View analytics" />
            <UnifiedCardBody>
              <SecondaryButton>
                <BarChart3 className="h-4 w-4 mr-2" />
                Open
              </SecondaryButton>
            </UnifiedCardBody>
          </UnifiedCard>
        </section>

        {/* PNM Management */}
        <section>
          <UnifiedCard>
            <UnifiedCardHeader title="Potential New Members" subtitle="Search and manage" />
            <UnifiedCardBody>
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-rr-muted h-5 w-5" />
                <input
                  placeholder="Search PNMs by name, major, or hometown…"
                  className="w-full rounded-xl bg-white/5 border border-rr-border pl-10 pr-4 py-3 text-white placeholder-rr-muted focus:outline-none focus:ring-2 focus:ring-rr-accent/40"
                />
              </div>
              
              <div className="rounded-xl border border-dashed border-rr-border p-10 text-center">
                <div className="text-rr-muted mb-4">No PNMs added yet</div>
                <div className="text-sm text-rr-muted mb-6">
                  Start by adding your first potential new member to begin tracking and voting.
                </div>
                <PrimaryButton onClick={() => setShowAddPNM(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First PNM
                </PrimaryButton>
              </div>
            </UnifiedCardBody>
          </UnifiedCard>
        </section>
      </main>
    </div>
  );
}