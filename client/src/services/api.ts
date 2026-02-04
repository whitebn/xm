import axios from 'axios';
import { Photo, PhotoTag, Project, ApiResponse, PaginatedResponse } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Photos API
export const photosApi = {
  getAll: (params?: { search?: string; projectId?: string; tagIds?: string; page?: number; pageSize?: number }) =>
    api.get<{ success: boolean; data: PaginatedResponse<Photo> }>('/photos', { params }),

  getById: (id: string) =>
    api.get<ApiResponse<Photo>>(`/photos/${id}`),

  upload: (files: File[], projectId?: string, tagIds?: string[]) => {
    const formData = new FormData();
    files.forEach(file => formData.append('photos', file));
    if (projectId) formData.append('projectId', projectId);
    if (tagIds && tagIds.length > 0) formData.append('tagIds', JSON.stringify(tagIds));
    return api.post<ApiResponse<Photo[]>>('/photos/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/photos/${id}`),

  bulkDelete: (ids: string[]) =>
    api.post<ApiResponse<void>>('/photos/bulk-delete', { ids }),

  getPreviewUrl: (id: string) => `/api/photos/${id}/preview`,

  download: (id: string) =>
    api.get(`/photos/${id}/download`, { responseType: 'blob' }),

  // Tag operations
  getTags: () =>
    api.get<ApiResponse<PhotoTag[]>>('/photos/tags/all'),

  createTag: (data: { name: string; color?: string }) =>
    api.post<ApiResponse<PhotoTag>>('/photos/tags', data),

  updateTag: (id: string, data: { name?: string; color?: string }) =>
    api.put<ApiResponse<PhotoTag>>(`/photos/tags/${id}`, data),

  deleteTag: (id: string) =>
    api.delete<ApiResponse<void>>(`/photos/tags/${id}`),

  // Tag assignments
  addTags: (photoId: string, tagIds: string[]) =>
    api.post<ApiResponse<PhotoTag[]>>(`/photos/${photoId}/tags`, { tagIds }),

  setTags: (photoId: string, tagIds: string[]) =>
    api.put<ApiResponse<PhotoTag[]>>(`/photos/${photoId}/tags`, { tagIds }),

  // Bulk operations
  bulkTag: (photoIds: string[], tagIds: string[], action: 'add' | 'remove' | 'replace' = 'add') =>
    api.post<ApiResponse<void>>('/photos/bulk-tag', { photoIds, tagIds, action }),

  bulkAssignProject: (photoIds: string[], projectId: string | null) =>
    api.post<ApiResponse<void>>('/photos/bulk-assign-project', { photoIds, projectId }),
};

// Projects API
export const projectsApi = {
  getAll: () =>
    api.get<ApiResponse<Project[]>>('/projects'),

  create: (data: { name: string; description?: string }) =>
    api.post<ApiResponse<Project>>('/projects', data),

  update: (id: string, data: { name?: string; description?: string }) =>
    api.put<ApiResponse<Project>>(`/projects/${id}`, data),

  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/projects/${id}`),
};

export default api;
