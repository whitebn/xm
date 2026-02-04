export interface PhotoTag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Photo {
  id: string;
  name: string;
  type: string;
  mimeType: string;
  size: number;
  path: string;
  projectId: string | null;
  uploadedBy: string | null;
  tags: PhotoTag[];
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
