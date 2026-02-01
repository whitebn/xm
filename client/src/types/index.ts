// User and Authentication Types
export type UserRole = 'admin' | 'vp' | 'manager' | 'view_only';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// Project Types
export interface Project {
  id: string;
  name: string;
  contractNumber: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';

  // Dates
  installStartDate: string | null;
  installEndDate: string | null;
  eventStartDate: string | null;
  eventEndDate: string | null;
  strikeStartDate: string | null;
  strikeEndDate: string | null;

  // Team
  projectManagerId: string | null;
  crewLeadId: string | null;
  salesRepId: string | null;

  // Relations
  projectManager?: User;
  crewLead?: User;
  salesRep?: User;
  categories?: ProjectCategory[];
  ganttItems?: GanttItem[];
  files?: ProjectFile[];
  invoices?: Invoice[];

  // Template info
  templateId: string | null;
  isTemplate: boolean;

  createdAt: string;
  updatedAt: string;
}

// Category Types
export interface CategoryTemplate {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  isDefault: boolean;
  order: number;
  createdAt: string;
}

export interface ProjectCategory {
  id: string;
  projectId: string;
  categoryTemplateId: string;
  categoryTemplate?: CategoryTemplate;
  notes: string;
  order: number;
  createdAt: string;
}

// Gantt Chart Types
export interface GanttItem {
  id: string;
  projectId: string;
  type: string;
  description: string;
  startDate: string;
  endDate: string;
  numberOfDays: number; // calculated
  strikeStartDate: string | null;
  strikeEndDate: string | null;
  numberOfStrikeDays: number; // calculated
  crewNumber: number;
  dependsOnId: string | null; // dependency
  isCompleted: boolean;
  order: number;
  color: string;
  createdAt: string;
  updatedAt: string;
}

// File Types
export interface ProjectFile {
  id: string;
  projectId: string | null; // null for global files
  name: string;
  type: 'local' | 'onedrive' | 'onedrive_link';
  mimeType: string;
  size: number;
  path: string; // local path or OneDrive item ID
  oneDriveUrl?: string;
  categoryId: string | null;
  uploadedById: string;
  uploadedBy?: User;
  createdAt: string;
}

// Invoice Types
export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  order: number;
}

export interface Invoice {
  id: string;
  projectId: string;
  invoiceNumber: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

  // Company Info (editable)
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyLogo?: string;

  // Client Info
  clientName: string;
  clientAddress: string;
  clientEmail: string;

  // Invoice Details
  issueDate: string;
  dueDate: string;
  terms: string;
  notes: string;

  // Amounts
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;

  lineItems?: InvoiceLineItem[];

  createdAt: string;
  updatedAt: string;
}

// Company Settings
export interface CompanySettings {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  logo?: string;
  defaultTerms: string;
  defaultTaxRate: number;
}

// Dashboard Types
export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  upcomingInstalls: number;
  overdueItems: number;
}

export interface UpcomingProject {
  id: string;
  name: string;
  date: string;
  type: 'install' | 'event' | 'strike';
  daysUntil: number;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

// Report Types
export interface ReportConfig {
  id: string;
  name: string;
  description: string;
  type: 'project_summary' | 'gantt_export' | 'crew_schedule' | 'financial' | 'custom';
  filters: Record<string, unknown>;
  columns: string[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  createdAt: string;
}

// Photo Library Types
export interface PhotoTag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Photo {
  id: string;
  projectId: string | null;
  name: string;
  type: 'local' | 'onedrive' | 'onedrive_link';
  mimeType: string;
  size: number;
  path: string;
  oneDriveUrl?: string;
  categoryId: string | null;
  uploadedById: string;
  uploadedBy?: User;
  tags: PhotoTag[];
  createdAt: string;
}

// API Response Types
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
