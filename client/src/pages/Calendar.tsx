import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  isWithinInterval,
} from 'date-fns';
import { Card, Button, Badge } from '../components/UI';
import { projectsApi } from '../services/api';
import { Project } from '../types';
import { useAuth } from '../context/AuthContext';

interface CalendarEvent {
  id: string;
  projectId: string;
  projectName: string;
  type: 'install' | 'event' | 'strike';
  startDate: Date;
  endDate: Date;
  color: string;
}

const Calendar: React.FC = () => {
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const response = await projectsApi.getAll();
      if (response.data.items) {
        setProjects(response.data.items);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      // Mock data
      setProjects([
        {
          id: '1',
          name: 'Corporate Event',
          contractNumber: 'CE-001',
          status: 'in_progress',
          installStartDate: '2024-02-10',
          installEndDate: '2024-02-12',
          eventStartDate: '2024-02-15',
          eventEndDate: '2024-02-16',
          strikeStartDate: '2024-02-17',
          strikeEndDate: '2024-02-18',
          projectManagerId: null,
          crewLeadId: null,
          salesRepId: null,
          templateId: null,
          isTemplate: false,
          createdAt: '',
          updatedAt: '',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDay = monthStart.getDay();

    // Get days from previous month to fill the first week
    const prevMonthEnd = new Date(monthStart);
    prevMonthEnd.setDate(prevMonthEnd.getDate() - 1);
    const prevMonthDays = startDay;

    const days: Date[] = [];

    // Previous month days
    for (let i = prevMonthDays - 1; i >= 0; i--) {
      const day = new Date(monthStart);
      day.setDate(day.getDate() - i - 1);
      days.push(day);
    }

    // Current month days
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    days.push(...monthDays);

    // Next month days to complete the grid (6 rows)
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const day = new Date(monthEnd);
      day.setDate(day.getDate() + i);
      days.push(day);
    }

    return days;
  }, [currentDate]);

  // Convert projects to calendar events
  const events = useMemo<CalendarEvent[]>(() => {
    const result: CalendarEvent[] = [];

    projects.forEach((project) => {
      if (project.installStartDate && project.installEndDate) {
        result.push({
          id: `${project.id}-install`,
          projectId: project.id,
          projectName: project.name,
          type: 'install',
          startDate: parseISO(project.installStartDate),
          endDate: parseISO(project.installEndDate),
          color: '#3b82f6',
        });
      }
      if (project.eventStartDate && project.eventEndDate) {
        result.push({
          id: `${project.id}-event`,
          projectId: project.id,
          projectName: project.name,
          type: 'event',
          startDate: parseISO(project.eventStartDate),
          endDate: parseISO(project.eventEndDate),
          color: '#10b981',
        });
      }
      if (project.strikeStartDate && project.strikeEndDate) {
        result.push({
          id: `${project.id}-strike`,
          projectId: project.id,
          projectName: project.name,
          type: 'strike',
          startDate: parseISO(project.strikeStartDate),
          endDate: parseISO(project.strikeEndDate),
          color: '#f59e0b',
        });
      }
    });

    return result;
  }, [projects]);

  // Get events for a specific day
  const getEventsForDay = (date: Date): CalendarEvent[] => {
    return events.filter((event) =>
      isWithinInterval(date, { start: event.startDate, end: event.endDate })
    );
  };

  // Get events for selected date
  const selectedDateEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="text-gray-500">View project schedules</p>
        </div>
        {canEdit() && (
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => navigate('/projects/new')}
          >
            New Project
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-3">
          <Card>
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={prevMonth}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-semibold min-w-[200px] text-center">
                  {format(currentDate, 'MMMM yyyy')}
                </h2>
                <button
                  onClick={nextMonth}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <Button variant="secondary" size="sm" onClick={goToToday}>
                Today
              </Button>
            </div>

            {/* Week Days Header */}
            <div className="grid grid-cols-7 mb-2">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-medium text-gray-500 py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-px bg-gray-200">
              {calendarDays.map((day, index) => {
                const dayEvents = getEventsForDay(day);
                const isToday = isSameDay(day, new Date());
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isSelected = selectedDate && isSameDay(day, selectedDate);

                return (
                  <div
                    key={index}
                    className={`bg-white min-h-[100px] p-2 cursor-pointer transition-colors ${
                      !isCurrentMonth ? 'bg-gray-50' : ''
                    } ${isSelected ? 'ring-2 ring-primary-500 ring-inset' : ''}`}
                    onClick={() => setSelectedDate(day)}
                  >
                    <div
                      className={`text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full ${
                        isToday
                          ? 'bg-primary-600 text-white'
                          : !isCurrentMonth
                          ? 'text-gray-400'
                          : ''
                      }`}
                    >
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          className="text-xs px-1.5 py-0.5 rounded truncate text-white"
                          style={{ backgroundColor: event.color }}
                          title={`${event.projectName} (${event.type})`}
                        >
                          {event.projectName}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-gray-500 px-1">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* Legend */}
          <Card>
            <h3 className="font-semibold mb-3">Legend</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded" />
                <span className="text-sm">Install</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded" />
                <span className="text-sm">Event</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-500 rounded" />
                <span className="text-sm">Strike</span>
              </div>
            </div>
          </Card>

          {/* Selected Date Events */}
          <Card>
            <h3 className="font-semibold mb-3">
              {selectedDate
                ? format(selectedDate, 'MMMM d, yyyy')
                : 'Select a date'}
            </h3>
            {selectedDate ? (
              selectedDateEvents.length > 0 ? (
                <div className="space-y-2">
                  {selectedDateEvents.map((event) => (
                    <div
                      key={event.id}
                      className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => navigate(`/projects/${event.projectId}`)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: event.color }}
                        />
                        <Badge
                          variant={
                            event.type === 'install'
                              ? 'info'
                              : event.type === 'event'
                              ? 'success'
                              : 'warning'
                          }
                          size="sm"
                        >
                          {event.type}
                        </Badge>
                      </div>
                      <p className="font-medium text-sm">{event.projectName}</p>
                      <p className="text-xs text-gray-500">
                        {format(event.startDate, 'MMM d')} -{' '}
                        {format(event.endDate, 'MMM d')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No events on this date</p>
              )
            ) : (
              <p className="text-gray-500 text-sm">
                Click on a date to see events
              </p>
            )}
          </Card>

          {/* Upcoming Events */}
          <Card>
            <h3 className="font-semibold mb-3">Upcoming</h3>
            <div className="space-y-2">
              {events
                .filter((e) => e.startDate >= new Date())
                .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
                .slice(0, 5)
                .map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:text-primary-600"
                    onClick={() => navigate(`/projects/${event.projectId}`)}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: event.color }}
                    />
                    <span className="flex-1 truncate">{event.projectName}</span>
                    <span className="text-gray-500 text-xs">
                      {format(event.startDate, 'MMM d')}
                    </span>
                  </div>
                ))}
              {events.filter((e) => e.startDate >= new Date()).length === 0 && (
                <p className="text-gray-500 text-sm">No upcoming events</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
