import axios from 'axios';
import {
  Project,
  CategoryTemplate,
  GanttItem,
  ProjectFile,
  Invoice,
  InvoiceLineItem,
  CompanySettings,
  User,
  Notification,
  ReportConfig,
  ApiResponse,
  PaginatedResponse,
  DashboardStats,
  UpcomingProject,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth interceptor
api.interceptors.request.use((config) => {
  const userStr = sessionStorage.getItem('user');
  if (userStr) {
    const user = JSON.parse(userStr);
    config.headers['X-User-Id'] = user.id;
    config.headers['X-User-Email'] = user.email;
  }
  return config;
});

// Projects API
export const projectsApi = {
  getAll: (params?: { status?: string; search?: string; page?: number; pageSize?: number }) =>
    api.get<PaginatedResponse<Project>>('/projects', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<Project>>(`/projects/${id}`),

  create: (data: Partial<Project>) =>
    api.post<ApiResponse<Project>>('/projects', data),

  update: (id: string, data: Partial<Project>) =>
    api.put<ApiResponse<Project>>(`/projects/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/projects/${id}`),

  createFromTemplate: (templateId: string, data: Partial<Project>) =>
    api.post<ApiResponse<Project>>(`/projects/from-template/${templateId}`, data),

  getTemplates: () =>
    api.get<ApiResponse<Project[]>>('/projects/templates'),
};

// Category Templates API
export const categoriesApi = {
  getAll: () =>
    api.get<ApiResponse<CategoryTemplate[]>>('/categories'),

  create: (data: Partial<CategoryTemplate>) =>
    api.post<ApiResponse<CategoryTemplate>>('/categories', data),

  update: (id: string, data: Partial<CategoryTemplate>) =>
    api.put<ApiResponse<CategoryTemplate>>(`/categories/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/categories/${id}`),

  reorder: (ids: string[]) =>
    api.put<ApiResponse<void>>('/categories/reorder', { ids }),
};

// Gantt Items API
export const ganttApi = {
  getByProject: (projectId: string) =>
    api.get<ApiResponse<GanttItem[]>>(`/projects/${projectId}/gantt`),

  create: (projectId: string, data: Partial<GanttItem>) =>
    api.post<ApiResponse<GanttItem>>(`/projects/${projectId}/gantt`, data),

  update: (projectId: string, id: string, data: Partial<GanttItem>) =>
    api.put<ApiResponse<GanttItem>>(`/projects/${projectId}/gantt/${id}`, data),

  delete: (projectId: string, id: string) =>
    api.delete<ApiResponse<void>>(`/projects/${projectId}/gantt/${id}`),

  bulkCreate: (projectId: string, items: Partial<GanttItem>[]) =>
    api.post<ApiResponse<GanttItem[]>>(`/projects/${projectId}/gantt/bulk`, { items }),

  bulkDelete: (projectId: string, ids: string[]) =>
    api.post<ApiResponse<void>>(`/projects/${projectId}/gantt/bulk-delete`, { ids }),

  reorder: (projectId: string, ids: string[]) =>
    api.put<ApiResponse<void>>(`/projects/${projectId}/gantt/reorder`, { ids }),
};

// Files API
export const filesApi = {
  getByProject: (projectId: string) =>
    api.get<ApiResponse<ProjectFile[]>>(`/projects/${projectId}/files`),

  getGlobal: () =>
    api.get<ApiResponse<ProjectFile[]>>('/files/global'),

  upload: (projectId: string | null, file: File, categoryId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (categoryId) formData.append('categoryId', categoryId);

    const url = projectId ? `/projects/${projectId}/files/upload` : '/files/upload';
    return api.post<ApiResponse<ProjectFile>>(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  linkOneDrive: (projectId: string | null, data: { itemId: string; name: string; url: string; mimeType: string; size: number }) => {
    const url = projectId ? `/projects/${projectId}/files/onedrive` : '/files/onedrive';
    return api.post<ApiResponse<ProjectFile>>(url, data);
  },

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/files/${id}`),

  download: (id: string) =>
    api.get(`/files/${id}/download`, { responseType: 'blob' }),
};

// Invoices API
export const invoicesApi = {
  getByProject: (projectId: string) =>
    api.get<ApiResponse<Invoice[]>>(`/projects/${projectId}/invoices`),

  getById: (id: string) =>
    api.get<ApiResponse<Invoice>>(`/invoices/${id}`),

  create: (projectId: string, data: Partial<Invoice>) =>
    api.post<ApiResponse<Invoice>>(`/projects/${projectId}/invoices`, data),

  update: (id: string, data: Partial<Invoice>) =>
    api.put<ApiResponse<Invoice>>(`/invoices/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/invoices/${id}`),

  addLineItem: (invoiceId: string, data: Partial<InvoiceLineItem>) =>
    api.post<ApiResponse<InvoiceLineItem>>(`/invoices/${invoiceId}/items`, data),

  updateLineItem: (invoiceId: string, itemId: string, data: Partial<InvoiceLineItem>) =>
    api.put<ApiResponse<InvoiceLineItem>>(`/invoices/${invoiceId}/items/${itemId}`, data),

  deleteLineItem: (invoiceId: string, itemId: string) =>
    api.delete<ApiResponse<void>>(`/invoices/${invoiceId}/items/${itemId}`),

  generatePdf: (id: string) =>
    api.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),

  sendEmail: (id: string, email: string) =>
    api.post<ApiResponse<void>>(`/invoices/${id}/send`, { email }),
};

// Company Settings API
export const settingsApi = {
  get: () =>
    api.get<ApiResponse<CompanySettings>>('/settings/company'),

  update: (data: Partial<CompanySettings>) =>
    api.put<ApiResponse<CompanySettings>>('/settings/company', data),

  uploadLogo: (file: File) => {
    const formData = new FormData();
    formData.append('logo', file);
    return api.post<ApiResponse<{ url: string }>>('/settings/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Users API
export const usersApi = {
  getAll: () =>
    api.get<ApiResponse<User[]>>('/users'),

  getById: (id: string) =>
    api.get<ApiResponse<User>>(`/users/${id}`),

  updateRole: (id: string, role: string) =>
    api.put<ApiResponse<User>>(`/users/${id}/role`, { role }),
};

// Dashboard API
export const dashboardApi = {
  getStats: () =>
    api.get<ApiResponse<DashboardStats>>('/dashboard/stats'),

  getUpcoming: (days?: number) =>
    api.get<ApiResponse<UpcomingProject[]>>('/dashboard/upcoming', { params: { days } }),

  getNotifications: () =>
    api.get<ApiResponse<Notification[]>>('/dashboard/notifications'),

  markNotificationRead: (id: string) =>
    api.put<ApiResponse<void>>(`/dashboard/notifications/${id}/read`),
};

// Reports API
export const reportsApi = {
  getSavedConfigs: () =>
    api.get<ApiResponse<ReportConfig[]>>('/reports/configs'),

  saveConfig: (config: Partial<ReportConfig>) =>
    api.post<ApiResponse<ReportConfig>>('/reports/configs', config),

  deleteConfig: (id: string) =>
    api.delete<ApiResponse<void>>(`/reports/configs/${id}`),

  generate: (type: string, filters: Record<string, unknown>) =>
    api.post<ApiResponse<unknown>>('/reports/generate', { type, filters }),

  exportPdf: (type: string, filters: Record<string, unknown>) =>
    api.post('/reports/export/pdf', { type, filters }, { responseType: 'blob' }),

  exportCsv: (type: string, filters: Record<string, unknown>) =>
    api.post('/reports/export/csv', { type, filters }, { responseType: 'blob' }),
};

export default api;
