import React, { useState } from 'react';
import {
  BarChart3,
  FileText,
  Calendar,
  Users,
  DollarSign,
  Download,
  Filter,
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { Card, Button, DatePicker, Select, Badge } from '../components/UI';
import { reportsApi } from '../services/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';

type ReportType = 'project_summary' | 'gantt_export' | 'crew_schedule' | 'financial';

const Reports: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<ReportType>('project_summary');
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);

  // Mock data for charts
  const projectsByStatus = [
    { name: 'Planning', value: 5, color: '#6b7280' },
    { name: 'In Progress', value: 8, color: '#3b82f6' },
    { name: 'Completed', value: 12, color: '#10b981' },
    { name: 'On Hold', value: 2, color: '#f59e0b' },
  ];

  const projectsByMonth = [
    { month: 'Aug', projects: 4, revenue: 45000 },
    { month: 'Sep', projects: 6, revenue: 62000 },
    { month: 'Oct', projects: 5, revenue: 55000 },
    { month: 'Nov', projects: 8, revenue: 78000 },
    { month: 'Dec', projects: 7, revenue: 71000 },
    { month: 'Jan', projects: 9, revenue: 85000 },
  ];

  const crewUtilization = [
    { name: 'John Smith', hours: 160, utilization: 95 },
    { name: 'Jane Doe', hours: 145, utilization: 87 },
    { name: 'Bob Johnson', hours: 152, utilization: 91 },
    { name: 'Alice Williams', hours: 138, utilization: 83 },
  ];

  const reports = [
    {
      id: 'project_summary',
      name: 'Project Summary',
      icon: BarChart3,
      description: 'Overview of all projects with status breakdown',
    },
    {
      id: 'gantt_export',
      name: 'Gantt Export',
      icon: Calendar,
      description: 'Export Gantt chart data for selected projects',
    },
    {
      id: 'crew_schedule',
      name: 'Crew Schedule',
      icon: Users,
      description: 'Crew assignments and availability report',
    },
    {
      id: 'financial',
      name: 'Financial',
      icon: DollarSign,
      description: 'Revenue and invoice tracking',
    },
  ];

  const handleExportPdf = async () => {
    setLoading(true);
    try {
      const response = await reportsApi.exportPdf(selectedReport, {
        dateRange,
        status: statusFilter,
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedReport}-report.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting PDF:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    setLoading(true);
    try {
      const response = await reportsApi.exportCsv(selectedReport, {
        dateRange,
        status: statusFilter,
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedReport}-report.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting CSV:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-gray-500">Generate and export custom reports</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<Download className="w-4 h-4" />}
            onClick={handleExportCsv}
            loading={loading}
          >
            Export CSV
          </Button>
          <Button
            variant="primary"
            icon={<Download className="w-4 h-4" />}
            onClick={handleExportPdf}
            loading={loading}
          >
            Export PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Report Type Selection */}
        <div className="lg:col-span-1 space-y-4">
          <Card padding="sm">
            <h3 className="font-semibold mb-3">Report Type</h3>
            <div className="space-y-2">
              {reports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => setSelectedReport(report.id as ReportType)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                    selectedReport === report.id
                      ? 'bg-primary-50 text-primary-700 border border-primary-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <report.icon className="w-5 h-5" />
                  <div>
                    <p className="font-medium text-sm">{report.name}</p>
                    <p className="text-xs text-gray-500">{report.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Filters */}
          <Card padding="sm">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4" />
              <h3 className="font-semibold">Filters</h3>
            </div>
            <div className="space-y-3">
              <DatePicker
                label="Start Date"
                value={dateRange.start}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, start: e.target.value }))
                }
              />
              <DatePicker
                label="End Date"
                value={dateRange.end}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, end: e.target.value }))
                }
              />
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: '', label: 'All Status' },
                  { value: 'planning', label: 'Planning' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'on_hold', label: 'On Hold' },
                ]}
              />
            </div>
          </Card>
        </div>

        {/* Report Content */}
        <div className="lg:col-span-3 space-y-6">
          {selectedReport === 'project_summary' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Status Distribution */}
                <Card>
                  <h3 className="font-semibold mb-4">Projects by Status</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={projectsByStatus}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {projectsByStatus.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* Monthly Trend */}
                <Card>
                  <h3 className="font-semibold mb-4">Projects per Month</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={projectsByMonth}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="projects" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              {/* Summary Stats */}
              <Card>
                <h3 className="font-semibold mb-4">Summary Statistics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-primary-600">27</p>
                    <p className="text-sm text-gray-500">Total Projects</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">12</p>
                    <p className="text-sm text-gray-500">Completed</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">8</p>
                    <p className="text-sm text-gray-500">In Progress</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">92%</p>
                    <p className="text-sm text-gray-500">On-Time Rate</p>
                  </div>
                </div>
              </Card>
            </>
          )}

          {selectedReport === 'financial' && (
            <>
              <Card>
                <h3 className="font-semibold mb-4">Revenue Trend</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={projectsByMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#10b981"
                        strokeWidth={2}
                        name="Revenue"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <h3 className="font-semibold mb-4">Financial Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">$396K</p>
                    <p className="text-sm text-gray-500">Total Revenue</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">$85K</p>
                    <p className="text-sm text-gray-500">This Month</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">32</p>
                    <p className="text-sm text-gray-500">Invoices Sent</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-orange-600">$12K</p>
                    <p className="text-sm text-gray-500">Outstanding</p>
                  </div>
                </div>
              </Card>
            </>
          )}

          {selectedReport === 'crew_schedule' && (
            <Card>
              <h3 className="font-semibold mb-4">Crew Utilization</h3>
              <div className="space-y-4">
                {crewUtilization.map((crew) => (
                  <div key={crew.name} className="flex items-center gap-4">
                    <div className="w-32 font-medium">{crew.name}</div>
                    <div className="flex-1">
                      <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-600 rounded-full transition-all"
                          style={{ width: `${crew.utilization}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-20 text-right">
                      <Badge
                        variant={
                          crew.utilization > 90
                            ? 'success'
                            : crew.utilization > 70
                            ? 'primary'
                            : 'warning'
                        }
                      >
                        {crew.utilization}%
                      </Badge>
                    </div>
                    <div className="w-24 text-right text-sm text-gray-500">
                      {crew.hours}h
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {selectedReport === 'gantt_export' && (
            <Card className="text-center py-12">
              <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">
                Export Gantt Data
              </h3>
              <p className="text-gray-500 mb-4 max-w-md mx-auto">
                Export all Gantt chart data for selected projects within the date range.
                The export will include all tasks, dates, crew assignments, and dependencies.
              </p>
              <div className="flex justify-center gap-3">
                <Button
                  variant="secondary"
                  icon={<Download className="w-4 h-4" />}
                  onClick={handleExportCsv}
                >
                  Export as CSV
                </Button>
                <Button
                  variant="primary"
                  icon={<Download className="w-4 h-4" />}
                  onClick={handleExportPdf}
                >
                  Export as PDF
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
