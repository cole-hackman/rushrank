import { useState } from 'react';
import { Plus, Calendar, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function DashboardClean() {
  const [showAddPNM, setShowAddPNM] = useState(false);

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
                <Button onClick={() => setShowAddPNM(true)} size="sm">
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