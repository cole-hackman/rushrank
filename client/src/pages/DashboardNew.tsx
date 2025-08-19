import { useState } from 'react';
import { Plus, Calendar, BarChart3, Users, Activity } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input as TextInput } from '@/components/ui/input';
import { Dialog as Modal, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function DashboardNew() {
  const [showAddPNM, setShowAddPNM] = useState(false);

  return (
    <AppShell>
      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card title="Total PNMs" subtitle="Current intake">
          <div className="text-3xl font-semibold text-text">0</div>
        </Card>
        
        <Card title="Active Voters" subtitle="Now online">
          <div className="text-3xl font-semibold text-text">0</div>
        </Card>
        
        <Card title="System Status" subtitle="All services">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
            <span className="h-2 w-2 rounded-full bg-green-500" /> 
            Idle
          </div>
        </Card>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card 
          title="Add New PNM" 
          subtitle="Upload photo and details" 
          action={
            <Button onClick={() => setShowAddPNM(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add PNM
            </Button>
          }
        >
          <p className="text-sm text-text-muted">
            Start by adding your first potential new member.
          </p>
        </Card>

        <Card 
          title="Events" 
          subtitle="Track attendance" 
          action={
            <Button variant="secondary">
              <Calendar className="h-4 w-4 mr-1" />
              Open
            </Button>
          }
        >
          <p className="text-sm text-text-muted">
            Manage rush events and attendance tracking.
          </p>
        </Card>

        <Card 
          title="Results" 
          subtitle="View analytics" 
          action={
            <Button variant="secondary">
              <BarChart3 className="h-4 w-4 mr-1" />
              Open
            </Button>
          }
        >
          <p className="text-sm text-text-muted">
            Analyze voting results and export data.
          </p>
        </Card>
      </div>

      {/* PNM Management */}
      <Card title="Potential New Members" subtitle="Search and manage">
        <div className="mb-4">
          <TextInput 
            placeholder="Search PNMs by name, major, or hometown..." 
            aria-label="Search PNMs"
          />
        </div>
        
        <EmptyState
          title="No PNMs yet"
          description="Get started by adding a PNM. You can import from CSV later."
          action={
            <Button onClick={() => setShowAddPNM(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add PNM
            </Button>
          }
        />
      </Card>

      {/* Add PNM Modal */}
      <Modal open={showAddPNM} onClose={() => setShowAddPNM(false)} title="Add New PNM">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setShowAddPNM(false); }}>
          <div>
            <label className="block text-sm font-medium text-text mb-2">Full Name</label>
            <TextInput
              data-autofocus
              placeholder="Enter PNM's full name"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text mb-2">Year</label>
              <TextInput placeholder="e.g., Sophomore" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-2">Major</label>
              <TextInput placeholder="e.g., Business" />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text mb-2">Hometown</label>
            <TextInput placeholder="e.g., Austin, TX" />
          </div>
          
          <div className="flex items-center justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setShowAddPNM(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Add PNM
            </Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}