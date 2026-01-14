"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { DropdownMenu } from "@/ui/components/DropdownMenu";
import { IconButton } from "@/ui/components/IconButton";
import { IconWithBackground } from "@/ui/components/IconWithBackground";
import { Progress } from "@/ui/components/Progress";
import { Table } from "@/ui/components/Table";
import { TextField } from "@/ui/components/TextField";
import { Dialog } from "@/ui/components/Dialog";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { useActiveEvent } from "@/hooks/useActiveEvent";
import { SkeletonTable } from "@/components/ui/SkeletonTable";
import { FeatherAward } from "@subframe/core";
import { FeatherCalendar } from "@subframe/core";
import { FeatherClock } from "@subframe/core";
import { FeatherDownload } from "@subframe/core";
import { FeatherDumbbell } from "@subframe/core";
import { FeatherEdit } from "@subframe/core";
import { FeatherEye } from "@subframe/core";
import { FeatherFilter } from "@subframe/core";
import { FeatherGamepad } from "@subframe/core";
import { FeatherHome } from "@subframe/core";
import { FeatherMapPin } from "@subframe/core";
import { FeatherMoreHorizontal } from "@subframe/core";
import { FeatherPlus } from "@subframe/core";
import { FeatherPlay } from "@subframe/core";
import { FeatherSave } from "@subframe/core";
import { FeatherSearch } from "@subframe/core";
import { FeatherTrash } from "@subframe/core";
import { FeatherTrendingUp } from "@subframe/core";
import { FeatherUserCheck } from "@subframe/core";
import { FeatherUsers } from "@subframe/core";
import { FeatherUtensils } from "@subframe/core";
import { FeatherX } from "@subframe/core";
import * as SubframeCore from "@subframe/core";

type Event = {
  id: string;
  name: string;
  date: string;
  location?: string | null;
  type: string;
  chapter_id: string;
  description?: string | null;
  is_active?: boolean;
  created_at?: string;
};

type EventWithAttendance = Event & {
  attendeeCount?: number;
  capacity?: number;
};

function RushRankEventPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { setActiveEventId } = useActiveEvent();
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventWithAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: "",
    location: "",
    date: "",
    startTime: "",
    endTime: "",
    description: "",
    capacity: "",
  });

  // Handler for "Open Check-in" button
  const handleOpenCheckIn = (eventId: string) => {
    setActiveEventId(eventId);
    router.push("/rush");
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const chapters = await api<{ id: string; name: string }[]>("/chapters");
      const cid = chapters[0]?.id;
      setChapterId(cid || null);
      if (cid) {
        const data = await api<Event[]>(`/events?chapter_id=${cid}`);
        // Fetch attendance for each event
        const eventsWithAttendance = await Promise.all(
          data.map(async (event) => {
            try {
              const attendance = await api<any[]>(`/events/${event.id}/attendance`).catch(() => []);
              return {
                ...event,
                attendeeCount: attendance.length,
                capacity: undefined, // TODO: Add capacity field to Event model if needed
              };
            } catch {
              return { ...event, attendeeCount: 0, capacity: undefined };
            }
          })
        );
        setEvents(eventsWithAttendance);
      }
    } catch (e: any) {
      console.error("Failed to load events:", e);
      const errorMsg = e?.message || "Unable to fetch events. Please try again.";

      if (errorMsg.includes("Cannot connect to backend") || errorMsg.includes("Failed to fetch")) {
        toast({
          title: "Cannot connect to backend",
          description: `Backend server is not reachable. Please check if the server is running at ${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api"}.`
        });
      } else if (errorMsg.includes("Authentication failed") || errorMsg.includes("401")) {
        toast({
          title: "Authentication failed",
          description: "Your session may have expired. Please try logging out and back in."
        });
      } else {
        toast({
          title: "Failed to load events",
          description: errorMsg,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalEvents = events.length;
    const totalAttendance = events.reduce((sum, e) => sum + (e.attendeeCount || 0), 0);
    const avgAttendance = totalEvents > 0 ? Math.round(totalAttendance / totalEvents) : 0;
    const now = new Date();
    const upcoming = events.filter((e) => {
      const eventDate = new Date(e.date);
      return eventDate >= now && e.is_active !== false;
    }).length;
    return { totalEvents, totalAttendance, avgAttendance, upcoming };
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (!search.trim()) return events;
    const term = search.toLowerCase();
    return events.filter(
      (e) =>
        e.name.toLowerCase().includes(term) ||
        (e.location && e.location.toLowerCase().includes(term))
    );
  }, [events, search]);

  const handleCreateEvent = async () => {
    if (!chapterId) {
      toast({ title: "Error", description: "No chapter available. Please contact an administrator to join a chapter." });
      return;
    }
    if (!createFormData.name || !createFormData.date) {
      toast({ title: "Error", description: "Name and date are required" });
      return;
    }

    try {
      // Combine date and times into ISO datetime
      const dateTime = new Date(`${createFormData.date}T${createFormData.startTime || "12:00"}`);
      const endDateTime = createFormData.endTime
        ? new Date(`${createFormData.date}T${createFormData.endTime}`)
        : null;

      await api<Event>(`/events?chapter_id=${chapterId}`, {
        method: "POST",
        body: {
          name: createFormData.name,
          description: createFormData.description || null,
          date: dateTime.toISOString(),
          location: createFormData.location || null,
          type: "optional", // Default to optional
        },
      });

      toast({ title: "Success", description: "Event created successfully" });
      setShowCreateForm(false);
      setCreateFormData({
        name: "",
        location: "",
        date: "",
        startTime: "",
        endTime: "",
        description: "",
        capacity: "",
      });
      await loadData();
    } catch (e: any) {
      toast({
        title: "Failed to create event",
        description: e?.message || "Unable to create event. Please try again.",
      });
    }
  };

  const handleExportAttendance = async () => {
    if (!chapterId) {
      toast({ title: "Error", description: "No chapter available. Please contact an administrator to join a chapter." });
      return;
    }
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";
      const token = localStorage.getItem("access_token");
      const response = await fetch(
        `${API_BASE}/events/export?chapter_id=${chapterId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      if (!response.ok) {
        throw new Error("Failed to export attendance");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_export_${chapterId}_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Success",
        description: "Attendance export downloaded",
      });
    } catch (e: any) {
      toast({
        title: "Failed to export attendance",
        description: e?.message || "Unable to export attendance. Please try again.",
      });
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return;
    try {
      await api(`/events/${eventId}`, { method: "DELETE" });
      toast({ title: "Success", description: "Event deleted successfully" });
      await loadData();
    } catch (e: any) {
      toast({
        title: "Failed to delete event",
        description: e?.message || "Unable to delete event.",
      });
    }
  };

  const getEventIcon = (eventName: string) => {
    const name = eventName.toLowerCase();
    if (name.includes("bbq") || name.includes("dinner") || name.includes("food")) {
      return <FeatherUtensils />;
    }
    if (name.includes("sport") || name.includes("game")) {
      return <FeatherDumbbell />;
    }
    if (name.includes("tour") || name.includes("house")) {
      return <FeatherHome />;
    }
    if (name.includes("game") || name.includes("night")) {
      return <FeatherGamepad />;
    }
    if (name.includes("bid") || name.includes("celebration")) {
      return <FeatherAward />;
    }
    return null;
  };

  const getEventStatus = (event: EventWithAttendance) => {
    const eventDate = new Date(event.date);
    const now = new Date();
    if (eventDate < now) {
      return { label: "Completed", variant: "neutral" as const };
    }
    return { label: "Upcoming", variant: "warning" as const };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <Breadcrumbs>
        <Breadcrumbs.Item>Home</Breadcrumbs.Item>
        <Breadcrumbs.Divider />
        <Breadcrumbs.Item active={true}>Events</Breadcrumbs.Item>
      </Breadcrumbs>
      <div className="flex w-full flex-col items-start gap-1">
        <span className="text-heading-1 font-heading-1 text-default-font">Events</span>
        <span className="text-body font-body text-subtext-color">
          Manage rush events and track attendance
        </span>
      </div>
      <div className="flex w-full items-center gap-2">
        <Button
          variant="neutral-secondary"
          icon={<FeatherDownload />}
          onClick={handleExportAttendance}
        >
          Export Attendance
        </Button>
        <Button
          variant="brand-primary"
          icon={<FeatherPlus />}
          onClick={() => {
            if (!chapterId) {
              toast({ title: "Error", description: "No chapter available. Please contact an administrator to join a chapter." });
              return;
            }
            setShowCreateForm(true);
          }}
          disabled={loading}
        >
          Add Event
        </Button>
      </div>
      <div className="flex w-full flex-col items-start gap-8">

        {/* Stats Cards */}
        <div className="grid w-full grid-cols-4 gap-4 mobile:grid-cols-2">
          <div className="flex w-full flex-col items-start gap-2 rounded-xl bg-neutral-100 px-6 py-6 mobile:px-4 mobile:py-4">
            <div className="flex w-full items-center gap-2">
              <IconWithBackground
                variant="neutral"
                size="small"
                icon={<FeatherCalendar />}
              />
              <span className="text-caption-bold font-caption-bold text-subtext-color mobile:text-[10px] mobile:leading-3">
                TOTAL EVENTS
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-default-font mobile:text-heading-2">
              {loading ? "..." : stats.totalEvents}
            </span>
          </div>
          <div className="flex w-full flex-col items-start gap-2 rounded-xl bg-success-50 px-6 py-6 mobile:px-4 mobile:py-4 border border-success-100">
            <div className="flex w-full items-center gap-2">
              <IconWithBackground
                variant="success"
                size="small"
                icon={<FeatherUsers />}
              />
              <span className="text-caption-bold font-caption-bold text-success-700 mobile:text-[10px] mobile:leading-3">
                TOTAL ATTENDANCE
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-success-700 mobile:text-heading-2">
              {loading ? "..." : stats.totalAttendance}
            </span>
          </div>
          <div className="flex w-full flex-col items-start gap-2 rounded-xl bg-brand-50 px-6 py-6 mobile:px-4 mobile:py-4 border border-brand-100">
            <div className="flex w-full items-center gap-2">
              <IconWithBackground size="small" icon={<FeatherTrendingUp />} />
              <span className="text-caption-bold font-caption-bold text-brand-700 mobile:text-[10px] mobile:leading-3">
                AVG ATTENDANCE
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-brand-700 mobile:text-heading-2">
              {loading ? "..." : stats.avgAttendance}
            </span>
          </div>
          <div className="flex w-full flex-col items-start gap-2 rounded-xl bg-warning-50 px-6 py-6 mobile:px-4 mobile:py-4 border border-warning-100">
            <div className="flex w-full items-center gap-2">
              <IconWithBackground
                variant="warning"
                size="small"
                icon={<FeatherClock />}
              />
              <span className="text-caption-bold font-caption-bold text-warning-700 mobile:text-[10px] mobile:leading-3">
                UPCOMING
              </span>
            </div>
            <span className="text-heading-1 font-heading-1 text-warning-700 mobile:text-heading-2">
              {loading ? "..." : stats.upcoming}
            </span>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex w-full flex-col items-start gap-4">
          <div className="flex w-full items-center gap-4 mobile:flex-col mobile:flex-nowrap mobile:gap-4">
            <TextField
              className="h-auto grow shrink-0 basis-0"
              variant="filled"
              label=""
              helpText=""
              icon={<FeatherSearch />}
            >
              <TextField.Input
                placeholder="Search events..."
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSearch(e.target.value)
                }
              />
            </TextField>
            <div className="flex items-center gap-2">
              <Button
                variant="neutral-tertiary"
                icon={<FeatherFilter />}
                onClick={() => {
                  // TODO: Implement filter dropdown
                  toast({ title: "Filter", description: "Filter options coming soon" });
                }}
              >
                Filter
              </Button>
            </div>
          </div>
        </div>

        {/* Events Table */}
        <div className="flex w-full flex-col items-start gap-4 overflow-hidden overflow-x-auto">
          {loading ? (
            <div className="rounded-xl border border-neutral-border bg-white dark:bg-neutral-800 overflow-hidden w-full">
              <SkeletonTable rows={5} columns={5} showCheckbox={false} />
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 px-4 w-full rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white dark:bg-neutral-800 shadow-sm">
                <FeatherCalendar className="h-8 w-8 text-neutral-400" />
              </div>
              <div className="flex flex-col gap-1 text-center">
                <p className="text-body-bold font-body-bold text-default-font">
                  {search ? "No events match your search" : "No events yet"}
                </p>
                <p className="text-caption text-subtext-color max-w-[280px]">
                  {search ? "Try a different search term" : "Create your first event to get started"}
                </p>
              </div>
              {!search && (
                <Button
                  variant="brand-primary"
                  icon={<FeatherPlus />}
                  onClick={() => {
                    if (!chapterId) {
                      toast({ title: "Error", description: "No chapter available. Please contact an administrator to join a chapter." });
                      return;
                    }
                    setShowCreateForm(true);
                  }}
                >
                  Create Event
                </Button>
              )}
            </div>
          ) : (
            <Table
              header={
                <Table.HeaderRow>
                  <Table.HeaderCell>EVENT NAME</Table.HeaderCell>
                  <Table.HeaderCell>DATE &amp; TIME</Table.HeaderCell>
                  <Table.HeaderCell>LOCATION</Table.HeaderCell>
                  <Table.HeaderCell>ATTENDANCE</Table.HeaderCell>
                  <Table.HeaderCell>STATUS</Table.HeaderCell>
                  <Table.HeaderCell>{""}</Table.HeaderCell>
                </Table.HeaderRow>
              }
            >
              {filteredEvents.map((event) => {
                const status = getEventStatus(event);
                const attendancePercent = event.capacity
                  ? Math.round(((event.attendeeCount || 0) / event.capacity) * 100)
                  : 0;
                return (
                  <Table.Row key={event.id}>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <IconWithBackground size="small" icon={getEventIcon(event.name)} />
                        <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                          {event.name}
                        </span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-col items-start">
                        <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                          {formatDate(event.date)}
                        </span>
                        <span className="text-caption font-caption text-subtext-color">
                          {formatTime(event.date)}
                        </span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="whitespace-nowrap text-body font-body text-subtext-color">
                        {event.location || "—"}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        {event.capacity ? (
                          <>
                            <Progress
                              className="h-auto w-16 flex-none"
                              value={attendancePercent}
                            />
                            <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                              {event.attendeeCount || 0}/{event.capacity}
                            </span>
                          </>
                        ) : (
                          <span className="whitespace-nowrap text-body-bold font-body-bold text-default-font">
                            {event.attendeeCount || 0}
                          </span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="small"
                          variant="brand-secondary"
                          icon={<FeatherPlay />}
                          onClick={() => handleOpenCheckIn(event.id)}
                        >
                          Open Check-in
                        </Button>
                        <IconButton
                          size="small"
                          icon={<FeatherUserCheck />}
                          onClick={() => router.push(`/events/${event.id}/checkin`)}
                        />
                        <SubframeCore.DropdownMenu.Root>
                          <SubframeCore.DropdownMenu.Trigger asChild={true}>
                            <IconButton
                              size="small"
                              icon={<FeatherMoreHorizontal />}
                              onClick={() => { }}
                            />
                          </SubframeCore.DropdownMenu.Trigger>
                          <SubframeCore.DropdownMenu.Portal>
                            <SubframeCore.DropdownMenu.Content
                              side="bottom"
                              align="end"
                              sideOffset={4}
                            >
                              <DropdownMenu.DropdownItem
                                icon={<FeatherEye />}
                                onClick={() => router.push(`/events/${event.id}/checkin`)}
                              >
                                View Details
                              </DropdownMenu.DropdownItem>
                              <DropdownMenu.DropdownItem icon={<FeatherEdit />}>
                                Edit Event
                              </DropdownMenu.DropdownItem>
                              <DropdownMenu.DropdownItem
                                icon={<FeatherDownload />}
                                onClick={handleExportAttendance}
                              >
                                Export Attendance
                              </DropdownMenu.DropdownItem>
                              <DropdownMenu.DropdownItem
                                icon={<FeatherTrash />}
                                onClick={() => handleDeleteEvent(event.id)}
                              >
                                Delete
                              </DropdownMenu.DropdownItem>
                            </SubframeCore.DropdownMenu.Content>
                          </SubframeCore.DropdownMenu.Portal>
                        </SubframeCore.DropdownMenu.Root>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table>
          )}
        </div>

        {/* Create Event Modal */}
        {showCreateForm && (
          <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
            <Dialog.Content className="max-w-2xl w-[95vw] mobile:w-full overflow-y-auto max-h-[90vh] z-[100]">
              <div className="flex w-full flex-col items-start gap-6 p-6 mobile:p-4 mobile:pb-24">
                <div className="flex w-full items-center justify-between">
                  <span className="text-heading-2 font-heading-2 text-default-font">
                    Create New Event
                  </span>
                  <IconButton
                    size="small"
                    icon={<FeatherX />}
                    onClick={() => setShowCreateForm(false)}
                  />
                </div>
                <div className="flex w-full flex-col items-start gap-4">
                  <div className="flex w-full items-start gap-4 mobile:flex-col mobile:flex-nowrap mobile:gap-4">
                    <TextField
                      className="h-auto grow shrink-0 basis-0"
                      label="Event Name"
                      helpText=""
                    >
                      <TextField.Input
                        placeholder="e.g., Fall BBQ"
                        value={createFormData.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setCreateFormData({ ...createFormData, name: e.target.value })
                        }
                      />
                    </TextField>
                    <TextField
                      className="h-auto grow shrink-0 basis-0"
                      label="Location"
                      helpText=""
                      icon={<FeatherMapPin />}
                    >
                      <TextField.Input
                        placeholder="e.g., Beta House Backyard"
                        value={createFormData.location}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setCreateFormData({ ...createFormData, location: e.target.value })
                        }
                      />
                    </TextField>
                  </div>
                  <div className="flex w-full items-start gap-4 mobile:flex-col mobile:flex-nowrap mobile:gap-4">
                    <TextField
                      className="h-auto grow shrink-0 basis-0"
                      label="Date"
                      helpText=""
                      icon={<FeatherCalendar />}
                    >
                      <TextField.Input
                        type="date"
                        value={createFormData.date}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setCreateFormData({ ...createFormData, date: e.target.value })
                        }
                      />
                    </TextField>
                    <TextField
                      className="h-auto grow shrink-0 basis-0"
                      label="Start Time"
                      helpText=""
                      icon={<FeatherClock />}
                    >
                      <TextField.Input
                        type="time"
                        value={createFormData.startTime}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setCreateFormData({ ...createFormData, startTime: e.target.value })
                        }
                      />
                    </TextField>
                    <TextField
                      className="h-auto grow shrink-0 basis-0"
                      label="End Time"
                      helpText=""
                      icon={<FeatherClock />}
                    >
                      <TextField.Input
                        type="time"
                        value={createFormData.endTime}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setCreateFormData({ ...createFormData, endTime: e.target.value })
                        }
                      />
                    </TextField>
                  </div>
                  <TextField
                    className="h-auto w-full flex-none"
                    label="Description"
                    helpText="Optional details about the event"
                  >
                    <TextField.Input
                      placeholder="Add event description..."
                      value={createFormData.description}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setCreateFormData({ ...createFormData, description: e.target.value })
                      }
                    />
                  </TextField>
                  <TextField
                    className="h-auto w-full flex-none"
                    label="Capacity Limit"
                    helpText="Optional maximum number of attendees"
                    icon={<FeatherUsers />}
                  >
                    <TextField.Input
                      type="number"
                      placeholder="e.g., 50"
                      value={createFormData.capacity}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setCreateFormData({ ...createFormData, capacity: e.target.value })
                      }
                    />
                  </TextField>
                </div>
                <div className="flex w-full items-center justify-end gap-2">
                  <Button
                    variant="neutral-secondary"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button variant="brand-primary" icon={<FeatherSave />} onClick={handleCreateEvent}>
                    Add Event
                  </Button>
                </div>
              </div>
            </Dialog.Content>
          </Dialog>
        )}
      </div>
    </div>
  );
}

export default RushRankEventPage;
