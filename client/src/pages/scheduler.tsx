import { useState, useCallback } from "react";
import { Calendar, momentLocalizer, View, Event } from "react-big-calendar";
import moment from "moment";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Plus, Filter } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ScheduleEvent, Doctor, Patient } from "@shared/schema";
import "react-big-calendar/lib/css/react-big-calendar.css";

const localizer = momentLocalizer(moment);

// Define custom event interface for react-big-calendar
interface CalendarEvent extends Event {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: ScheduleEvent;
}

export default function Scheduler() {
  const [view, setView] = useState<View>("month");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEventType, setSelectedEventType] = useState<string>("all");

  const queryClient = useQueryClient();

  // Fetch schedule events
  const { data: scheduleEvents = [], isLoading } = useQuery<ScheduleEvent[]>({
    queryKey: ["/api/schedule"],
    refetchInterval: 30000,
  });

  // Fetch doctors for event details
  const { data: doctors = [] } = useQuery<Doctor[]>({
    queryKey: ["/api/doctors"],
  });

  // Fetch patients for event details
  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
  });

  // Convert schedule events to calendar events
  const calendarEvents: CalendarEvent[] = scheduleEvents
    .filter(event => selectedEventType === "all" || event.eventType === selectedEventType)
    .map(event => ({
      id: event.id,
      title: event.title,
      start: new Date(event.startTime),
      end: new Date(event.endTime),
      resource: event,
    }));

  // Event style based on type
  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const eventType = event.resource.eventType;
    let backgroundColor = '#3174ad';
    
    switch (eventType) {
      case 'opd':
        backgroundColor = '#2563eb'; // Blue
        break;
      case 'inpatient':
        backgroundColor = '#16a34a'; // Green
        break;
      case 'surgery':
        backgroundColor = '#dc2626'; // Red
        break;
      case 'doctor_shift':
        backgroundColor = '#6b7280'; // Gray
        break;
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        border: 'none',
        color: 'white',
        fontSize: '12px',
        padding: '2px 6px',
      }
    };
  }, []);

  // Handle date change
  const handleNavigate = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  // Handle view change
  const handleViewChange = useCallback((newView: View) => {
    setView(newView);
  }, []);

  // Handle event selection
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    console.log('Selected event:', event);
    // TODO: Open edit modal
  }, []);

  // Handle slot selection (for creating new events)
  const handleSelectSlot = useCallback((slotInfo: any) => {
    console.log('Selected slot:', slotInfo);
    // TODO: Open create modal
  }, []);

  // Get doctor name
  const getDoctorName = (doctorId: string) => {
    const doctor = doctors.find(d => d.id === doctorId);
    return doctor?.name || 'Unknown Doctor';
  };

  // Get patient name
  const getPatientName = (patientId?: string | null) => {
    if (!patientId) return null;
    const patient = patients.find(p => p.id === patientId);
    return patient?.name || 'Unknown Patient';
  };

  // Custom event component
  const EventComponent = ({ event }: { event: CalendarEvent }) => {
    const doctorName = getDoctorName(event.resource.doctorId);
    const patientName = getPatientName(event.resource.patientId);
    
    return (
      <div className="p-1">
        <div className="font-medium text-xs">{event.title}</div>
        <div className="text-xs opacity-90">{doctorName}</div>
        {patientName && (
          <div className="text-xs opacity-75">{patientName}</div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-medical-blue rounded-lg flex items-center justify-center">
              <CalendarIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-dark">Scheduler</h1>
              <p className="text-text-muted">Manage doctor appointments and schedules</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Event Type Filter */}
            <select
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg text-sm"
              data-testid="filter-event-type"
            >
              <option value="all">All Events</option>
              <option value="opd">OPD Appointments</option>
              <option value="inpatient">Inpatient Visits</option>
              <option value="surgery">Surgeries</option>
              <option value="doctor_shift">Doctor Shifts</option>
            </select>

            <Button
              onClick={() => console.log('Create new event')}
              className="bg-medical-blue hover:bg-medical-blue/90"
              data-testid="button-create-event"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Event
            </Button>
          </div>
        </div>

        {/* Event Type Legend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Event Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded bg-blue-600"></div>
                <span className="text-sm">OPD Appointments</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded bg-green-600"></div>
                <span className="text-sm">Inpatient Visits</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded bg-red-600"></div>
                <span className="text-sm">Surgeries</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded bg-gray-600"></div>
                <span className="text-sm">Doctor Shifts</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calendar */}
        <Card>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-blue mx-auto"></div>
                  <p className="mt-2 text-text-muted">Loading schedule...</p>
                </div>
              </div>
            ) : (
              <div style={{ height: '600px' }}>
                <Calendar
                  localizer={localizer}
                  events={calendarEvents}
                  startAccessor="start"
                  endAccessor="end"
                  style={{ height: '100%' }}
                  view={view}
                  onView={handleViewChange}
                  date={selectedDate}
                  onNavigate={handleNavigate}
                  onSelectEvent={handleSelectEvent}
                  onSelectSlot={handleSelectSlot}
                  selectable
                  eventPropGetter={eventStyleGetter}
                  components={{
                    event: EventComponent,
                  }}
                  views={['month', 'week', 'day', 'agenda']}
                  step={30}
                  showMultiDayTimes
                  defaultDate={new Date()}
                  formats={{
                    timeGutterFormat: 'HH:mm',
                    eventTimeRangeFormat: ({ start, end }: any, culture: any, localizer: any) =>
                      localizer?.format(start, 'HH:mm', culture) + ' - ' + localizer?.format(end, 'HH:mm', culture),
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Total Events", value: calendarEvents.length, color: "bg-blue-100 text-blue-800" },
            { label: "OPD Appointments", value: calendarEvents.filter(e => e.resource.eventType === 'opd').length, color: "bg-green-100 text-green-800" },
            { label: "Surgeries", value: calendarEvents.filter(e => e.resource.eventType === 'surgery').length, color: "bg-red-100 text-red-800" },
            { label: "Doctor Shifts", value: calendarEvents.filter(e => e.resource.eventType === 'doctor_shift').length, color: "bg-gray-100 text-gray-800" },
          ].map((stat, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-muted">{stat.label}</p>
                    <p className="text-2xl font-bold text-text-dark">{stat.value}</p>
                  </div>
                  <Badge className={stat.color}>
                    {stat.value}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}