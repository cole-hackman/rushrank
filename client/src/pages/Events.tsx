import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Calendar, MapPin, Clock, Users, QrCode, Hash, MoreVertical, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format } from 'date-fns';
import type { Event, EventWithAttendance, PNMWithAttendance } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { AddEventModal } from '@/components/AddEventModal';
import { AttendanceModal } from '@/components/AttendanceModal';

export default function Events() {
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [selectedEventForAttendance, setSelectedEventForAttendance] = useState<Event | null>(null);
  const [showQRCode, setShowQRCode] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch events
  const { data: events = [], isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

  // Fetch PNMs with attendance
  const { data: pnmsWithAttendance = [], isLoading: attendanceLoading } = useQuery<PNMWithAttendance[]>({
    queryKey: ['/api/pnms/attendance'],
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const response = await apiRequest('DELETE', `/api/events/${eventId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pnms/attendance'] });
      toast({
        title: "Event deleted",
        description: "The event has been removed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete event.",
        variant: "destructive",
      });
    },
  });

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'mandatory':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'invite-only':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'mandatory':
        return '⚠️';
      case 'invite-only':
        return '🎯';
      default:
        return '📅';
    }
  };

  const isEventPast = (eventDate: string) => {
    return new Date(eventDate) < new Date();
  };

  const copyCheckInCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied!",
      description: "Check-in code copied to clipboard.",
    });
  };

  const upcomingEvents = events.filter(event => !isEventPast(event.date) && event.isActive);
  const pastEvents = events.filter(event => isEventPast(event.date) || !event.isActive);

  if (eventsLoading || attendanceLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto bg-white min-h-screen shadow-lg">
          <div className="p-4">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-gray-200 animate-pulse rounded-xl h-32"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-lg">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">Events</h1>
          <Button
            onClick={() => setShowAddEventModal(true)}
            size="sm"
            data-testid="button-add-event"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </header>

        {/* Events Summary */}
        <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-200">
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-3 text-center">
                <div className="text-lg font-bold text-indigo-600">{events.length}</div>
                <div className="text-xs text-gray-600">Total Events</div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-3 text-center">
                <div className="text-lg font-bold text-green-600">{upcomingEvents.length}</div>
                <div className="text-xs text-gray-600">Upcoming</div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-3 text-center">
                <div className="text-lg font-bold text-gray-600">
                  {pnmsWithAttendance.length > 0 
                    ? Math.round(pnmsWithAttendance.reduce((acc, pnm) => acc + pnm.attendancePercentage, 0) / pnmsWithAttendance.length)
                    : 0}%
                </div>
                <div className="text-xs text-gray-600">Avg Attendance</div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-indigo-600" />
                Upcoming Events
              </h2>
              <div className="space-y-3">
                {upcomingEvents.map((event, index) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="text-lg">{getEventTypeIcon(event.type)}</span>
                              <h3 className="font-semibold text-gray-900" data-testid={`event-name-${event.id}`}>
                                {event.name}
                              </h3>
                              <Badge className={getEventTypeColor(event.type)}>
                                {event.type}
                              </Badge>
                            </div>
                            
                            <div className="space-y-1 text-sm text-gray-600">
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-2" />
                                {format(new Date(event.date), 'MMM d, yyyy • h:mm a')}
                              </div>
                              {event.location && (
                                <div className="flex items-center">
                                  <MapPin className="w-4 h-4 mr-2" />
                                  {event.location}
                                </div>
                              )}
                              {event.checkInCode && (
                                <div className="flex items-center">
                                  <Hash className="w-4 h-4 mr-2" />
                                  <code 
                                    className="bg-gray-100 px-2 py-1 rounded cursor-pointer hover:bg-gray-200"
                                    onClick={() => copyCheckInCode(event.checkInCode!)}
                                    data-testid={`checkin-code-${event.id}`}
                                  >
                                    {event.checkInCode}
                                  </code>
                                </div>
                              )}
                              {event.description && (
                                <p className="text-gray-700 mt-2">{event.description}</p>
                              )}
                            </div>
                          </div>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="p-1">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem
                                onClick={() => setSelectedEventForAttendance(event)}
                              >
                                <Users className="w-4 h-4 mr-2" />
                                Manage Attendance
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setShowQRCode(event.checkInCode || '')}
                              >
                                <QrCode className="w-4 h-4 mr-2" />
                                Show QR Code
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => deleteEventMutation.mutate(event.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Delete Event
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Past Events */}
          {pastEvents.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2 text-gray-600" />
                Past Events
              </h2>
              <div className="space-y-3">
                {pastEvents.map((event, index) => (
                  <Card key={event.id} className="bg-gray-50 border-gray-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 opacity-75">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-lg">{getEventTypeIcon(event.type)}</span>
                            <h3 className="font-medium text-gray-700">{event.name}</h3>
                            <Badge variant="outline" className="text-xs">
                              {event.type}
                            </Badge>
                          </div>
                          
                          <div className="text-sm text-gray-500">
                            <div className="flex items-center">
                              <Clock className="w-4 h-4 mr-2" />
                              {format(new Date(event.date), 'MMM d, yyyy')}
                            </div>
                          </div>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEventForAttendance(event)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <Users className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {events.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">No Events Yet</h2>
              <p className="text-gray-600 mb-4">Create your first rush event to start tracking attendance.</p>
              <Button
                onClick={() => setShowAddEventModal(true)}
                data-testid="button-add-first-event"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Event
              </Button>
            </div>
          )}
        </div>

        {/* Add Event Modal */}
        <AddEventModal
          open={showAddEventModal}
          onOpenChange={setShowAddEventModal}
        />

        {/* Attendance Modal */}
        {selectedEventForAttendance && (
          <AttendanceModal
            event={selectedEventForAttendance}
            open={!!selectedEventForAttendance}
            onOpenChange={(open) => !open && setSelectedEventForAttendance(null)}
          />
        )}

        {/* QR Code Display Modal */}
        <Dialog open={!!showQRCode} onOpenChange={() => setShowQRCode(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Event Check-in Code</DialogTitle>
              <DialogDescription>
                Share this code for PNMs to check themselves in
              </DialogDescription>
            </DialogHeader>
            <div className="text-center py-8">
              <div className="text-6xl font-mono font-bold text-indigo-600 mb-4">
                {showQRCode}
              </div>
              <Button
                onClick={() => showQRCode && copyCheckInCode(showQRCode)}
                variant="outline"
                className="w-full"
              >
                Copy Code
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}