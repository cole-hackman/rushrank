import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Users, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import type { Event, EventWithAttendance, PNM } from '@shared/schema';

interface AttendanceModalProps {
  event: Event;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AttendanceModal({ event, open, onOpenChange }: AttendanceModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch event attendance
  const { data: eventWithAttendance, isLoading } = useQuery<EventWithAttendance>({
    queryKey: ['/api/events', event.id, 'attendance'],
    enabled: open,
  });

  // Fetch all PNMs
  const { data: allPNMs = [] } = useQuery<PNM[]>({
    queryKey: ['/api/pnms'],
    enabled: open,
  });

  // Mark attendance mutation
  const markAttendanceMutation = useMutation({
    mutationFn: async ({ pnmId, checkedInBy }: { pnmId: string; checkedInBy?: string }) => {
      const response = await apiRequest('POST', '/api/attendance', {
        eventId: event.id,
        pnmId,
        checkedInBy: checkedInBy || 'Admin',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', event.id, 'attendance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pnms/attendance'] });
    },
  });

  // Remove attendance mutation
  const removeAttendanceMutation = useMutation({
    mutationFn: async (pnmId: string) => {
      const response = await apiRequest('DELETE', `/api/attendance/${event.id}/${pnmId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', event.id, 'attendance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pnms/attendance'] });
    },
  });

  const attendeeIds = eventWithAttendance?.attendees.map(a => a.pnmId) || [];
  
  const filteredPNMs = allPNMs.filter(pnm => 
    pnm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pnm.major.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAttendanceToggle = (pnmId: string, isChecked: boolean) => {
    if (isChecked) {
      markAttendanceMutation.mutate({ pnmId });
    } else {
      removeAttendanceMutation.mutate(pnmId);
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[80vh]">
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading attendance...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <span>{event.name}</span>
          </DialogTitle>
          <DialogDescription className="flex items-center space-x-2 text-sm">
            <Calendar className="w-4 h-4" />
            <span>{format(new Date(event.date), 'MMM d, yyyy • h:mm a')}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 py-4">
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-green-600">
                {eventWithAttendance?.attendeeCount || 0}
              </div>
              <div className="text-xs text-green-700">Present</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-gray-600">
                {allPNMs.length - (eventWithAttendance?.attendeeCount || 0)}
              </div>
              <div className="text-xs text-gray-700">Absent</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search PNMs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-pnms"
          />
        </div>

        {/* PNM List */}
        <ScrollArea className="flex-1 max-h-96">
          <div className="space-y-2">
            {filteredPNMs.length > 0 ? (
              filteredPNMs.map(pnm => {
                const isAttending = attendeeIds.includes(pnm.id);
                const attendanceRecord = eventWithAttendance?.attendees.find(a => a.pnmId === pnm.id);
                
                return (
                  <Card key={pnm.id} className={`transition-colors ${
                    isAttending ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                  }`}>
                    <CardContent className="p-3">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={isAttending}
                          onCheckedChange={(checked) => 
                            handleAttendanceToggle(pnm.id, checked as boolean)
                          }
                          data-testid={`checkbox-attendance-${pnm.id}`}
                        />
                        
                        <div className="w-10 h-10 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
                          {pnm.photoPath ? (
                            <img
                              src={pnm.photoPath.startsWith('/objects/') ? pnm.photoPath : `/objects/${pnm.photoPath}`}
                              alt={`${pnm.name} profile`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
                              <span className="text-white text-xs font-bold">
                                {pnm.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium text-gray-900">{pnm.name}</h3>
                            {isAttending && (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{pnm.major}</p>
                          {isAttending && attendanceRecord?.checkedInAt && (
                            <p className="text-xs text-green-700">
                              Checked in: {format(new Date(attendanceRecord.checkedInAt), 'h:mm a')}
                            </p>
                          )}
                          {pnm.tags && pnm.tags.length > 0 && (
                            <div className="flex gap-1 mt-1">
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
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No PNMs found</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end pt-4">
          <Button 
            onClick={() => onOpenChange(false)}
            data-testid="button-close-attendance"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}