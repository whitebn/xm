import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  Users,
  FileText,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { Card, Button, Badge, Modal, Input, DatePicker, Select } from '../components/UI';
import { GanttChart } from '../components/Gantt';
import { FileManager } from '../components/Files';
import { InvoiceEditor, InvoiceList } from '../components/Invoice';
import { projectsApi, ganttApi, filesApi, invoicesApi, settingsApi } from '../services/api';
import { Project, GanttItem, ProjectFile, Invoice, CompanySettings } from '../types';
import { useAuth } from '../context/AuthContext';

type TabType = 'overview' | 'gantt' | 'files' | 'invoices';

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [ganttItems, setGanttItems] = useState<GanttItem[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (id) {
      loadProject();
    }
  }, [id]);

  const loadProject = async () => {
    setLoading(true);
    try {
      const [projectRes, ganttRes, filesRes, invoicesRes, settingsRes] = await Promise.all([
        projectsApi.getById(id!),
        ganttApi.getByProject(id!),
        filesApi.getByProject(id!),
        invoicesApi.getByProject(id!),
        settingsApi.get(),
      ]);

      if (projectRes.data.data) setProject(projectRes.data.data);
      if (ganttRes.data.data) setGanttItems(ganttRes.data.data);
      if (filesRes.data.data) setFiles(filesRes.data.data);
      if (invoicesRes.data.data) setInvoices(invoicesRes.data.data);
      if (settingsRes.data.data) setCompanySettings(settingsRes.data.data);
    } catch (error) {
      console.error('Error loading project:', error);
      // Mock data for demo
      setProject({
        id: id!,
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
      });
      setGanttItems([
        {
          id: '1',
          projectId: id!,
          type: 'Crew Hotel',
          description: 'Book hotel for installation crew',
          startDate: '2024-02-09',
          endDate: '2024-02-18',
          numberOfDays: 10,
          strikeStartDate: null,
          strikeEndDate: null,
          numberOfStrikeDays: 0,
          crewNumber: 8,
          dependsOnId: null,
          isCompleted: true,
          order: 0,
          color: '#3b82f6',
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        },
        {
          id: '2',
          projectId: id!,
          type: 'Equipment List',
          description: 'Stage equipment and lighting',
          startDate: '2024-02-10',
          endDate: '2024-02-12',
          numberOfDays: 3,
          strikeStartDate: '2024-02-17',
          strikeEndDate: '2024-02-18',
          numberOfStrikeDays: 2,
          crewNumber: 12,
          dependsOnId: null,
          isCompleted: false,
          order: 1,
          color: '#10b981',
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Gantt handlers
  const handleGanttCreate = async (data: Partial<GanttItem>) => {
    const response = await ganttApi.create(id!, data);
    if (response.data.data) {
      setGanttItems((prev) => [...prev, response.data.data!]);
    }
  };

  const handleGanttUpdate = async (itemId: string, data: Partial<GanttItem>) => {
    const response = await ganttApi.update(id!, itemId, data);
    if (response.data.data) {
      setGanttItems((prev) =>
        prev.map((item) => (item.id === itemId ? response.data.data! : item))
      );
    }
  };

  const handleGanttDelete = async (itemId: string) => {
    await ganttApi.delete(id!, itemId);
    setGanttItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleGanttBulkCreate = async (items: Partial<GanttItem>[]) => {
    const response = await ganttApi.bulkCreate(id!, items);
    if (response.data.data) {
      setGanttItems((prev) => [...prev, ...response.data.data!]);
    }
  };

  // File handlers
  const handleFileUpload = async (file: File, categoryId?: string) => {
    const response = await filesApi.upload(id!, file, categoryId);
    if (response.data.data) {
      setFiles((prev) => [...prev, response.data.data!]);
    }
  };

  const handleFileLinkOneDrive = async (data: {
    itemId: string;
    name: string;
    url: string;
    mimeType: string;
    size: number;
  }) => {
    const response = await filesApi.linkOneDrive(id!, data);
    if (response.data.data) {
      setFiles((prev) => [...prev, response.data.data!]);
    }
  };

  const handleFileDelete = async (fileId: string) => {
    await filesApi.delete(fileId);
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleFileDownload = async (fileId: string) => {
    const response = await filesApi.download(fileId);
    const file = files.find((f) => f.id === fileId);
    if (file) {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  // Invoice handlers
  const handleCreateInvoice = async () => {
    const response = await invoicesApi.create(id!, {
      invoiceNumber: `INV-${Date.now()}`,
      status: 'draft',
      issueDate: format(new Date(), 'yyyy-MM-dd'),
    });
    if (response.data.data) {
      setInvoices((prev) => [...prev, response.data.data!]);
      setSelectedInvoice(response.data.data);
    }
  };

  const handleDeleteProject = async () => {
    await projectsApi.delete(id!);
    navigate('/projects');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <Card className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-600 mb-2">Project not found</h3>
        <Button variant="primary" onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
      </Card>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'gantt', label: 'Gantt Chart' },
    { id: 'files', label: 'Files' },
    { id: 'invoices', label: 'Invoices' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/projects')}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{project.name}</h1>
              {getStatusBadge(project.status)}
            </div>
            <p className="text-gray-500">Contract: {project.contractNumber || 'N/A'}</p>
          </div>
        </div>

        {canEdit() && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={<Edit className="w-4 h-4" />}
              onClick={() => navigate(`/projects/${id}/edit`)}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 className="w-4 h-4" />}
              onClick={() => setDeleteModalOpen(true)}
            >
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Project Info */}
          <Card>
            <h3 className="font-semibold text-lg mb-4">Project Information</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Project Name</p>
                  <p className="font-medium">{project.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Contract Number</p>
                  <p className="font-medium">{project.contractNumber || 'N/A'}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Dates */}
          <Card>
            <h3 className="font-semibold text-lg mb-4">Dates</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Calendar className="w-5 h-5 text-blue-500" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Install Dates</p>
                  <p className="font-medium">
                    {project.installStartDate && project.installEndDate
                      ? `${format(new Date(project.installStartDate), 'MMM d')} - ${format(new Date(project.installEndDate), 'MMM d, yyyy')}`
                      : 'Not set'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Calendar className="w-5 h-5 text-green-500" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Event Dates</p>
                  <p className="font-medium">
                    {project.eventStartDate && project.eventEndDate
                      ? `${format(new Date(project.eventStartDate), 'MMM d')} - ${format(new Date(project.eventEndDate), 'MMM d, yyyy')}`
                      : 'Not set'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Calendar className="w-5 h-5 text-orange-500" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Strike Dates</p>
                  <p className="font-medium">
                    {project.strikeStartDate && project.strikeEndDate
                      ? `${format(new Date(project.strikeStartDate), 'MMM d')} - ${format(new Date(project.strikeEndDate), 'MMM d, yyyy')}`
                      : 'Not set'}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Team */}
          <Card>
            <h3 className="font-semibold text-lg mb-4">Team</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Users className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Project Manager</p>
                  <p className="font-medium">
                    {project.projectManager?.name || 'Not assigned'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Users className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Crew Lead</p>
                  <p className="font-medium">
                    {project.crewLead?.name || 'Not assigned'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Users className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Sales Rep</p>
                  <p className="font-medium">
                    {project.salesRep?.name || 'Not assigned'}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Quick Stats */}
          <Card>
            <h3 className="font-semibold text-lg mb-4">Quick Stats</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary-600">{ganttItems.length}</p>
                <p className="text-sm text-gray-500">Gantt Items</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{files.length}</p>
                <p className="text-sm text-gray-500">Files</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{invoices.length}</p>
                <p className="text-sm text-gray-500">Invoices</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'gantt' && (
        <GanttChart
          items={ganttItems}
          projectId={id!}
          onItemCreate={handleGanttCreate}
          onItemUpdate={handleGanttUpdate}
          onItemDelete={handleGanttDelete}
          onBulkCreate={handleGanttBulkCreate}
          readOnly={!canEdit()}
        />
      )}

      {activeTab === 'files' && (
        <FileManager
          files={files}
          projectId={id!}
          onUpload={handleFileUpload}
          onLinkOneDrive={handleFileLinkOneDrive}
          onDelete={handleFileDelete}
          onDownload={handleFileDownload}
          readOnly={!canEdit()}
          categories={[
            { id: 'crew_hotel', name: 'Crew Hotel' },
            { id: 'equipment', name: 'Equipment List' },
            { id: 'photos', name: 'Photos' },
            { id: 'heavy_equipment', name: 'Heavy Equipment' },
            { id: 'invoices_quotes', name: 'Invoices & Quotes' },
            { id: 'hours', name: 'Hours' },
            { id: 'recap', name: 'Recap' },
          ]}
        />
      )}

      {activeTab === 'invoices' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <InvoiceList
            invoices={invoices}
            selectedId={selectedInvoice?.id || null}
            onSelect={setSelectedInvoice}
            onCreate={handleCreateInvoice}
            readOnly={!canEdit()}
          />
          <div className="lg:col-span-2">
            {selectedInvoice ? (
              <InvoiceEditor
                invoice={selectedInvoice}
                companySettings={companySettings}
                onSave={async (data) => {
                  const response = await invoicesApi.update(selectedInvoice.id, data);
                  if (response.data.data) {
                    setSelectedInvoice(response.data.data);
                    setInvoices((prev) =>
                      prev.map((inv) =>
                        inv.id === selectedInvoice.id ? response.data.data! : inv
                      )
                    );
                  }
                }}
                onAddLineItem={async (item) => {
                  const response = await invoicesApi.addLineItem(selectedInvoice.id, item);
                  if (response.data.data) {
                    // Reload invoice to get updated line items
                    const invoiceRes = await invoicesApi.getById(selectedInvoice.id);
                    if (invoiceRes.data.data) {
                      setSelectedInvoice(invoiceRes.data.data);
                    }
                  }
                }}
                onUpdateLineItem={async (itemId, item) => {
                  await invoicesApi.updateLineItem(selectedInvoice.id, itemId, item);
                  const invoiceRes = await invoicesApi.getById(selectedInvoice.id);
                  if (invoiceRes.data.data) {
                    setSelectedInvoice(invoiceRes.data.data);
                  }
                }}
                onDeleteLineItem={async (itemId) => {
                  await invoicesApi.deleteLineItem(selectedInvoice.id, itemId);
                  const invoiceRes = await invoicesApi.getById(selectedInvoice.id);
                  if (invoiceRes.data.data) {
                    setSelectedInvoice(invoiceRes.data.data);
                  }
                }}
                onGeneratePdf={async () => {
                  const response = await invoicesApi.generatePdf(selectedInvoice.id);
                  const url = window.URL.createObjectURL(new Blob([response.data]));
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', `invoice-${selectedInvoice.invoiceNumber}.pdf`);
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                }}
                onSendEmail={async (email) => {
                  await invoicesApi.sendEmail(selectedInvoice.id, email);
                }}
                readOnly={!canEdit()}
              />
            ) : (
              <Card className="text-center py-12 text-gray-500">
                Select an invoice or create a new one
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Project"
        size="sm"
      >
        <div className="p-6">
          <p className="text-gray-600 mb-6">
            Are you sure you want to delete "{project.name}"? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteProject}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProjectDetail;
