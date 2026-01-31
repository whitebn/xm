import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  Calendar,
  AlertCircle,
  TrendingUp,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { Card, Badge, Button } from '../components/UI';
import { dashboardApi, projectsApi } from '../services/api';
import { DashboardStats, UpcomingProject, Project } from '../types';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingProject[]>([]);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [statsRes, upcomingRes, projectsRes] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getUpcoming(14),
        projectsApi.getAll({ pageSize: 5 }),
      ]);

      if (statsRes.data.data) setStats(statsRes.data.data);
      if (upcomingRes.data.data) setUpcoming(upcomingRes.data.data);
      if (projectsRes.data.items) setRecentProjects(projectsRes.data.items);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      // Set mock data for demo
      setStats({
        totalProjects: 12,
        activeProjects: 5,
        upcomingInstalls: 3,
        overdueItems: 2,
      });
      setUpcoming([
        { id: '1', name: 'Corporate Event Setup', date: '2024-02-15', type: 'install', daysUntil: 5 },
        { id: '2', name: 'Concert Stage Build', date: '2024-02-18', type: 'install', daysUntil: 8 },
        { id: '3', name: 'Trade Show Booth', date: '2024-02-20', type: 'event', daysUntil: 10 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'install':
        return 'bg-blue-100 text-blue-800';
      case 'event':
        return 'bg-green-100 text-green-800';
      case 'strike':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button
          variant="primary"
          onClick={() => navigate('/projects/new')}
        >
          New Project
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="flex items-center gap-4">
          <div className="p-3 bg-primary-100 rounded-lg">
            <FolderKanban className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Projects</p>
            <p className="text-2xl font-bold">{stats?.totalProjects || 0}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <TrendingUp className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Active Projects</p>
            <p className="text-2xl font-bold">{stats?.activeProjects || 0}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Calendar className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Upcoming Installs</p>
            <p className="text-2xl font-bold">{stats?.upcomingInstalls || 0}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="p-3 bg-red-100 rounded-lg">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Overdue Items</p>
            <p className="text-2xl font-bold">{stats?.overdueItems || 0}</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Events */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Upcoming Events</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/calendar')}
            >
              View Calendar
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {upcoming.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No upcoming events</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                  onClick={() => navigate(`/projects/${event.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Clock className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-medium">{event.name}</p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(event.date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(event.type)}`}>
                      {event.type}
                    </span>
                    <span className="text-sm text-gray-500">
                      {event.daysUntil === 0
                        ? 'Today'
                        : event.daysUntil === 1
                        ? 'Tomorrow'
                        : `${event.daysUntil} days`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Projects */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Projects</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/projects')}
            >
              View All
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {recentProjects.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No projects yet</p>
          ) : (
            <div className="space-y-3">
              {recentProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <p className="text-sm text-gray-500">
                      Contract: {project.contractNumber || 'N/A'}
                    </p>
                  </div>
                  <Badge
                    variant={
                      project.status === 'completed'
                        ? 'success'
                        : project.status === 'in_progress'
                        ? 'primary'
                        : 'default'
                    }
                  >
                    {project.status.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/projects/new')}
            className="p-4 text-center rounded-lg border-2 border-dashed border-gray-300 hover:border-primary-500 hover:bg-primary-50 transition-colors"
          >
            <FolderKanban className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <span className="text-sm font-medium">New Project</span>
          </button>
          <button
            onClick={() => navigate('/templates')}
            className="p-4 text-center rounded-lg border-2 border-dashed border-gray-300 hover:border-primary-500 hover:bg-primary-50 transition-colors"
          >
            <FolderKanban className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <span className="text-sm font-medium">Templates</span>
          </button>
          <button
            onClick={() => navigate('/files')}
            className="p-4 text-center rounded-lg border-2 border-dashed border-gray-300 hover:border-primary-500 hover:bg-primary-50 transition-colors"
          >
            <FolderKanban className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <span className="text-sm font-medium">File Library</span>
          </button>
          <button
            onClick={() => navigate('/reports')}
            className="p-4 text-center rounded-lg border-2 border-dashed border-gray-300 hover:border-primary-500 hover:bg-primary-50 transition-colors"
          >
            <TrendingUp className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <span className="text-sm font-medium">Reports</span>
          </button>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
