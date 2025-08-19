import { useState } from 'react';
import { Plus, Calendar, BarChart3, ArrowLeft, Search } from 'lucide-react';
import { useLocation } from 'wouter';
import { PrimaryButton, SecondaryButton } from '@/components/ui/unified-button';
import { UnifiedCard, UnifiedCardHeader, UnifiedCardBody } from '@/components/ui/unified-card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function DashboardClean() {
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

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total PNMs</CardTitle>
              <CardDescription>Current intake</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">0</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Voters</CardTitle>
              <CardDescription>Now online</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">0</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
              <CardDescription>All services</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                <span className="h-2 w-2 rounded-full bg-green-500" /> 
                Idle
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Add New PNM</CardTitle>
              <CardDescription>Upload photo and details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-start">
                <p className="text-sm text-muted-foreground">
                  Start by adding your first potential new member.
                </p>
                <Button 
                  onClick={() => setShowAddPNM(true)} 
                  size="sm"
                  className="bg-gradient-to-r from-accent-500 to-accent-600 hover:opacity-90 text-white border-0"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Events</CardTitle>
              <CardDescription>Track attendance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-start">
                <p className="text-sm text-muted-foreground">
                  Manage rush events and attendance.
                </p>
                <Button variant="secondary" size="sm">
                  <Calendar className="h-4 w-4 mr-1" />
                  Open
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>View analytics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-start">
                <p className="text-sm text-muted-foreground">
                  Analyze voting results and export data.
                </p>
                <Button variant="secondary" size="sm">
                  <BarChart3 className="h-4 w-4 mr-1" />
                  Open
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* PNM Management */}
        <Card>
          <CardHeader>
            <CardTitle>Potential New Members</CardTitle>
            <CardDescription>Search and manage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Input 
                placeholder="Search PNMs by name, major, or hometown..." 
                aria-label="Search PNMs"
              />
            </div>
            
            {/* Empty State */}
            <div className="grid place-items-center rounded-xl border border-dashed py-14 text-center">
              <div className="max-w-sm space-y-2">
                <h4 className="font-semibold">No PNMs yet</h4>
                <p className="text-sm text-muted-foreground">
                  Get started by adding a PNM. You can import from CSV later.
                </p>
                <Button onClick={() => setShowAddPNM(true)} className="mt-2">
                  <Plus className="h-4 w-4 mr-2" />
                  Add PNM
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Add PNM Modal */}
      <Dialog open={showAddPNM} onOpenChange={setShowAddPNM}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New PNM</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setShowAddPNM(false); }}>
            <div className="space-y-2">
              <Label htmlFor="pnm-name">Full Name</Label>
              <Input
                id="pnm-name"
                placeholder="Enter PNM's full name"
                required
                autoFocus
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="pnm-year">Year</Label>
                <Input id="pnm-year" placeholder="e.g., Sophomore" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pnm-major">Major</Label>
                <Input id="pnm-major" placeholder="e.g., Business" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="pnm-hometown">Hometown</Label>
              <Input id="pnm-hometown" placeholder="e.g., Austin, TX" />
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
        </DialogContent>
      </Dialog>
    </div>
  );
}