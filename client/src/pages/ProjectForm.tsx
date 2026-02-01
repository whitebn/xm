import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Layers } from 'lucide-react';
import { Card, Button, Input, Select, DatePicker } from '../components/UI';
import { projectsApi, usersApi } from '../services/api';
import { Project, User } from '../types';

const ProjectForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState<{
    name: string;
    contractNumber: string;
    status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
    installStartDate: string;
    installEndDate: string;
    eventStartDate: string;
    eventEndDate: string;
    strikeStartDate: string;
    strikeEndDate: string;
    projectManagerId: string;
    crewLeadId: string;
    salesRepId: string;
    isTemplate: boolean;
  }>({
    name: '',
    contractNumber: '',
    status: 'planning',
    installStartDate: '',
    installEndDate: '',
    eventStartDate: '',
    eventEndDate: '',
    strikeStartDate: '',
    strikeEndDate: '',
    projectManagerId: '',
    crewLeadId: '',
    salesRepId: '',
    isTemplate: false,
  });

  const [users, setUsers] = useState<User[]>([]);
  const [templates, setTemplates] = useState<Project[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, templatesRes] = await Promise.all([
        usersApi.getAll(),
        projectsApi.getTemplates(),
      ]);

      if (usersRes.data.data) setUsers(usersRes.data.data);
      if (templatesRes.data.data) setTemplates(templatesRes.data.data);

      if (id) {
        const projectRes = await projectsApi.getById(id);
        if (projectRes.data.data) {
          const project = projectRes.data.data;
          setFormData({
            name: project.name || '',
            contractNumber: project.contractNumber || '',
            status: project.status || 'planning',
            installStartDate: project.installStartDate?.split('T')[0] || '',
            installEndDate: project.installEndDate?.split('T')[0] || '',
            eventStartDate: project.eventStartDate?.split('T')[0] || '',
            eventEndDate: project.eventEndDate?.split('T')[0] || '',
            strikeStartDate: project.strikeStartDate?.split('T')[0] || '',
            strikeEndDate: project.strikeEndDate?.split('T')[0] || '',
            projectManagerId: project.projectManagerId || '',
            crewLeadId: project.crewLeadId || '',
            salesRepId: project.salesRepId || '',
            isTemplate: project.isTemplate || false,
          });
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      // Mock users for demo
      setUsers([
        { id: '1', email: 'john@example.com', name: 'John Smith', role: 'manager', createdAt: '', updatedAt: '' },
        { id: '2', email: 'jane@example.com', name: 'Jane Doe', role: 'manager', createdAt: '', updatedAt: '' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    }

    if (formData.installStartDate && formData.installEndDate) {
      if (formData.installStartDate > formData.installEndDate) {
        newErrors.installEndDate = 'End date must be after start date';
      }
    }

    if (formData.eventStartDate && formData.eventEndDate) {
      if (formData.eventStartDate > formData.eventEndDate) {
        newErrors.eventEndDate = 'End date must be after start date';
      }
    }

    if (formData.strikeStartDate && formData.strikeEndDate) {
      if (formData.strikeStartDate > formData.strikeEndDate) {
        newErrors.strikeEndDate = 'End date must be after start date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const data = {
        ...formData,
        projectManagerId: formData.projectManagerId || null,
        crewLeadId: formData.crewLeadId || null,
        salesRepId: formData.salesRepId || null,
        installStartDate: formData.installStartDate || null,
        installEndDate: formData.installEndDate || null,
        eventStartDate: formData.eventStartDate || null,
        eventEndDate: formData.eventEndDate || null,
        strikeStartDate: formData.strikeStartDate || null,
        strikeEndDate: formData.strikeEndDate || null,
      };

      let response;
      if (isEditing) {
        response = await projectsApi.update(id!, data);
      } else if (selectedTemplate) {
        response = await projectsApi.createFromTemplate(selectedTemplate, data);
      } else {
        response = await projectsApi.create(data);
      }

      if (response.data.data) {
        navigate(`/projects/${response.data.data.id}`);
      }
    } catch (error) {
      console.error('Error saving project:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statusOptions = [
    { value: 'planning', label: 'Planning' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'on_hold', label: 'On Hold' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const userOptions = [
    { value: '', label: 'Not Assigned' },
    ...users.map((u) => ({ value: u.id, label: u.name })),
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">
          {isEditing ? 'Edit Project' : 'New Project'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Template Selection (only for new projects) */}
        {!isEditing && templates.length > 0 && (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-5 h-5 text-primary-600" />
              <h2 className="font-semibold">Start from Template</h2>
            </div>
            <Select
              label="Template"
              name="template"
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              options={[
                { value: '', label: 'Blank Project' },
                ...templates.map((t) => ({ value: t.id, label: t.name })),
              ]}
            />
            <p className="text-sm text-gray-500 mt-2">
              Templates will copy Gantt chart headers to your new project
            </p>
          </Card>
        )}

        {/* Basic Information */}
        <Card>
          <h2 className="font-semibold text-lg mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Project Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              error={errors.name}
              required
            />
            <Input
              label="Contract Number"
              name="contractNumber"
              value={formData.contractNumber}
              onChange={handleChange}
            />
            <Select
              label="Status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              options={statusOptions}
            />
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="isTemplate"
                name="isTemplate"
                checked={formData.isTemplate}
                onChange={handleChange}
                className="rounded text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="isTemplate" className="text-sm font-medium text-gray-700">
                Save as Template
              </label>
            </div>
          </div>
        </Card>

        {/* Dates */}
        <Card>
          <h2 className="font-semibold text-lg mb-4">Project Dates</h2>

          <div className="space-y-6">
            {/* Install Dates */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Install Dates</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DatePicker
                  label="Start Date"
                  name="installStartDate"
                  value={formData.installStartDate}
                  onChange={handleChange}
                />
                <DatePicker
                  label="End Date"
                  name="installEndDate"
                  value={formData.installEndDate}
                  onChange={handleChange}
                  error={errors.installEndDate}
                />
              </div>
            </div>

            {/* Event Dates */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Event Dates</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DatePicker
                  label="Start Date"
                  name="eventStartDate"
                  value={formData.eventStartDate}
                  onChange={handleChange}
                />
                <DatePicker
                  label="End Date"
                  name="eventEndDate"
                  value={formData.eventEndDate}
                  onChange={handleChange}
                  error={errors.eventEndDate}
                />
              </div>
            </div>

            {/* Strike Dates */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Strike Dates</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DatePicker
                  label="Start Date"
                  name="strikeStartDate"
                  value={formData.strikeStartDate}
                  onChange={handleChange}
                />
                <DatePicker
                  label="End Date"
                  name="strikeEndDate"
                  value={formData.strikeEndDate}
                  onChange={handleChange}
                  error={errors.strikeEndDate}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Team Assignment */}
        <Card>
          <h2 className="font-semibold text-lg mb-4">Team Assignment</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Project Manager"
              name="projectManagerId"
              value={formData.projectManagerId}
              onChange={handleChange}
              options={userOptions}
            />
            <Select
              label="Crew Lead"
              name="crewLeadId"
              value={formData.crewLeadId}
              onChange={handleChange}
              options={userOptions}
            />
            <Select
              label="Sales Representative"
              name="salesRepId"
              value={formData.salesRepId}
              onChange={handleChange}
              options={userOptions}
            />
          </div>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" type="button" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            icon={<Save className="w-4 h-4" />}
            loading={saving}
          >
            {isEditing ? 'Update Project' : 'Create Project'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ProjectForm;
