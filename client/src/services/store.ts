import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Project,
  CategoryTemplate,
  CompanySettings,
  Notification,
  GanttItem,
} from '../types';

interface AppState {
  // Projects
  projects: Project[];
  currentProject: Project | null;
  setProjects: (projects: Project[]) => void;
  setCurrentProject: (project: Project | null) => void;
  addProject: (project: Project) => void;
  updateProject: (project: Project) => void;
  deleteProject: (id: string) => void;

  // Category Templates
  categoryTemplates: CategoryTemplate[];
  setCategoryTemplates: (templates: CategoryTemplate[]) => void;
  addCategoryTemplate: (template: CategoryTemplate) => void;
  updateCategoryTemplate: (template: CategoryTemplate) => void;
  deleteCategoryTemplate: (id: string) => void;

  // Company Settings
  companySettings: CompanySettings | null;
  setCompanySettings: (settings: CompanySettings) => void;

  // Notifications
  notifications: Notification[];
  unreadCount: number;
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;

  // Gantt Clipboard
  ganttClipboard: GanttItem[];
  setGanttClipboard: (items: GanttItem[]) => void;
  clearGanttClipboard: () => void;

  // UI State
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Projects
      projects: [],
      currentProject: null,
      setProjects: (projects) => set({ projects }),
      setCurrentProject: (project) => set({ currentProject: project }),
      addProject: (project) =>
        set((state) => ({ projects: [...state.projects, project] })),
      updateProject: (project) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === project.id ? project : p
          ),
          currentProject:
            state.currentProject?.id === project.id
              ? project
              : state.currentProject,
        })),
      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          currentProject:
            state.currentProject?.id === id ? null : state.currentProject,
        })),

      // Category Templates
      categoryTemplates: [],
      setCategoryTemplates: (templates) =>
        set({ categoryTemplates: templates }),
      addCategoryTemplate: (template) =>
        set((state) => ({
          categoryTemplates: [...state.categoryTemplates, template],
        })),
      updateCategoryTemplate: (template) =>
        set((state) => ({
          categoryTemplates: state.categoryTemplates.map((t) =>
            t.id === template.id ? template : t
          ),
        })),
      deleteCategoryTemplate: (id) =>
        set((state) => ({
          categoryTemplates: state.categoryTemplates.filter((t) => t.id !== id),
        })),

      // Company Settings
      companySettings: null,
      setCompanySettings: (settings) => set({ companySettings: settings }),

      // Notifications
      notifications: [],
      unreadCount: 0,
      setNotifications: (notifications) =>
        set({
          notifications,
          unreadCount: notifications.filter((n) => !n.isRead).length,
        }),
      addNotification: (notification) =>
        set((state) => ({
          notifications: [notification, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        })),
      markAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        })),
      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({
            ...n,
            isRead: true,
          })),
          unreadCount: 0,
        })),

      // Gantt Clipboard
      ganttClipboard: [],
      setGanttClipboard: (items) => set({ ganttClipboard: items }),
      clearGanttClipboard: () => set({ ganttClipboard: [] }),

      // UI State
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: 'project-management-storage',
      partialize: (state) => ({
        companySettings: state.companySettings,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);

export default useStore;
