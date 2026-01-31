import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Layers,
  Copy,
  Edit,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import { format } from 'date-fns';
import { Card, Button, Badge, Modal } from '../components/UI';
import { projectsApi } from '../services/api';
import { Project } from '../types';
import { useAuth } from '../context/AuthContext';

const Templates: React.FC = () => {
  const navigate = useNavigate();
  const { canEdit, canManage } = useAuth();
  const [templates, setTemplates] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Project | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await projectsApi.getTemplates();
      if (response.data.data) {
        setTemplates(response.data.data);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      // Mock data for demo
      setTemplates([
        {
          id: 't1',
          name: 'Corporate Event Template',
          contractNumber: '',
          status: 'planning',
          installStartDate: null,
          installEndDate: null,
          eventStartDate: null,
          eventEndDate: null,
          strikeStartDate: null,
          strikeEndDate: null,
          projectManagerId: null,
          crewLeadId: null,
          salesRepId: null,
          templateId: null,
          isTemplate: true,
          createdAt: '2024-01-01T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        },
        {
          id: 't2',
          name: 'Concert Stage Template',
          contractNumber: '',
          status: 'planning',
          installStartDate: null,
          installEndDate: null,
          eventStartDate: null,
          eventEndDate: null,
          strikeStartDate: null,
          strikeEndDate: null,
          projectManagerId: null,
          crewLeadId: null,
          salesRepId: null,
          templateId: null,
          isTemplate: true,
          createdAt: '2024-01-05T10:00:00Z',
          updatedAt: '2024-01-10T10:00:00Z',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFromTemplate = (templateId: string) => {
    navigate(`/projects/new?template=${templateId}`);
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      await projectsApi.delete(selectedTemplate.id);
      setTemplates((prev) => prev.filter((t) => t.id !== selectedTemplate.id));
      setDeleteModalOpen(false);
      setSelectedTemplate(null);
    } catch (error) {
      console.error('Error deleting template:', error);
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Project Templates</h1>
          <p className="text-gray-500">
            Create templates with pre-configured Gantt chart headers
          </p>
        </div>
        {canManage() && (
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => navigate('/projects/new?isTemplate=true')}
          >
            New Template
          </Button>
        )}
      </div>

      {templates.length === 0 ? (
        <Card className="text-center py-12">
          <Layers className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No templates yet</h3>
          <p className="text-gray-500 mb-4">
            Templates help you quickly create projects with pre-configured settings
          </p>
          {canManage() && (
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => navigate('/projects/new?isTemplate=true')}
            >
              Create Template
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="relative">
              {/* Menu button */}
              {canManage() && (
                <div className="absolute top-4 right-4">
                  <button
                    onClick={() =>
                      setOpenMenuId(openMenuId === template.id ? null : template.id)
                    }
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <MoreVertical className="w-5 h-5 text-gray-400" />
                  </button>

                  {openMenuId === template.id && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setOpenMenuId(null)}
                      />
                      <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                        <button
                          onClick={() => {
                            setOpenMenuId(null);
                            navigate(`/projects/${template.id}/edit`);
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setOpenMenuId(null);
                            setSelectedTemplate(template);
                            setDeleteModalOpen(true);
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-primary-100 rounded-lg">
                  <Layers className="w-6 h-6 text-primary-600" />
                </div>
                <div className="flex-1 pr-8">
                  <h3 className="font-semibold text-lg">{template.name}</h3>
                  <p className="text-sm text-gray-500">
                    Created {format(new Date(template.createdAt), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Gantt Items:</span>
                  <span className="font-medium">
                    {template.ganttItems?.length || 0} headers
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Categories:</span>
                  <span className="font-medium">
                    {template.categories?.length || 0}
                  </span>
                </div>
              </div>

              {canEdit() && (
                <Button
                  variant="primary"
                  className="w-full"
                  icon={<Copy className="w-4 h-4" />}
                  onClick={() => handleCreateFromTemplate(template.id)}
                >
                  Use Template
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setSelectedTemplate(null);
        }}
        title="Delete Template"
        size="sm"
      >
        <div className="p-6">
          <p className="text-gray-600 mb-6">
            Are you sure you want to delete "{selectedTemplate?.name}"? This action
            cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteModalOpen(false);
                setSelectedTemplate(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteTemplate}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Templates;
