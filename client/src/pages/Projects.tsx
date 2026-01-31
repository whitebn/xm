import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Grid,
  List,
  FolderKanban,
} from 'lucide-react';
import { format } from 'date-fns';
import { Card, Button, Badge, Table } from '../components/UI';
import { projectsApi } from '../services/api';
import { Project } from '../types';
import { useAuth } from '../context/AuthContext';

const Projects: React.FC = () => {
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadProjects();
  }, [statusFilter]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const response = await projectsApi.getAll({
        status: statusFilter || undefined,
      });
      if (response.data.items) {
        setProjects(response.data.items);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      // Mock data for demo
      setProjects([
        {
          id: '1',
          name: 'Corporate Event 2024',
          contractNumber: 'CE-2024-001',
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
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-20T15:30:00Z',
        },
        {
          id: '2',
          name: 'Summer Festival Stage',
          contractNumber: 'SF-2024-015',
          status: 'planning',
          installStartDate: '2024-06-01',
          installEndDate: '2024-06-05',
          eventStartDate: '2024-06-10',
          eventEndDate: '2024-06-12',
          strikeStartDate: '2024-06-13',
          strikeEndDate: '2024-06-15',
          projectManagerId: null,
          crewLeadId: null,
          salesRepId: null,
          templateId: null,
          isTemplate: false,
          createdAt: '2024-01-10T09:00:00Z',
          updatedAt: '2024-01-18T11:00:00Z',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.contractNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    const aVal = a[sortBy as keyof Project] || '';
    const bVal = b[sortBy as keyof Project] || '';
    const comparison = String(aVal).localeCompare(String(bVal));
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'primary'> = {
      planning: 'default',
      in_progress: 'primary',
      completed: 'success',
      on_hold: 'warning',
      cancelled: 'danger',
    };
    return (
      <Badge variant={variants[status] || 'default'}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const columns = [
    {
      key: 'name',
      header: 'Project Name',
      sortable: true,
      render: (project: Project) => (
        <div>
          <p className="font-medium text-primary-600 hover:underline">{project.name}</p>
          <p className="text-sm text-gray-500">{project.contractNumber || 'No contract #'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (project: Project) => getStatusBadge(project.status),
    },
    {
      key: 'installStartDate',
      header: 'Install Date',
      sortable: true,
      render: (project: Project) =>
        project.installStartDate
          ? format(new Date(project.installStartDate), 'MMM d, yyyy')
          : '-',
    },
    {
      key: 'eventStartDate',
      header: 'Event Date',
      sortable: true,
      render: (project: Project) =>
        project.eventStartDate
          ? format(new Date(project.eventStartDate), 'MMM d, yyyy')
          : '-',
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      sortable: true,
      render: (project: Project) =>
        format(new Date(project.updatedAt), 'MMM d, yyyy'),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Projects</h1>
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

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Status</option>
            <option value="planning">Planning</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </Card>

      {/* Projects List/Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sortedProjects.length === 0 ? (
        <Card className="text-center py-12">
          <FolderKanban className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No projects found</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery || statusFilter
              ? 'Try adjusting your filters'
              : 'Create your first project to get started'}
          </p>
          {canEdit() && !searchQuery && !statusFilter && (
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => navigate('/projects/new')}
            >
              Create Project
            </Button>
          )}
        </Card>
      ) : viewMode === 'list' ? (
        <Card padding="none">
          <Table
            columns={columns}
            data={sortedProjects}
            keyField="id"
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            onRowClick={(project) => navigate(`/projects/${project.id}`)}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedProjects.map((project) => (
            <Card
              key={project.id}
              hover
              onClick={() => navigate(`/projects/${project.id}`)}
              className="cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{project.name}</h3>
                  <p className="text-sm text-gray-500">
                    {project.contractNumber || 'No contract #'}
                  </p>
                </div>
                {getStatusBadge(project.status)}
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                {project.installStartDate && (
                  <div className="flex justify-between">
                    <span>Install:</span>
                    <span>{format(new Date(project.installStartDate), 'MMM d, yyyy')}</span>
                  </div>
                )}
                {project.eventStartDate && (
                  <div className="flex justify-between">
                    <span>Event:</span>
                    <span>{format(new Date(project.eventStartDate), 'MMM d, yyyy')}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
                Updated {format(new Date(project.updatedAt), 'MMM d, yyyy')}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Projects;
