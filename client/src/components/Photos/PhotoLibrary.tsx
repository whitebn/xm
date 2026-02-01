import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Upload,
  Cloud,
  Tag,
  Trash2,
  FolderPlus,
  X,
  Filter,
  Grid,
  List,
  Settings,
} from 'lucide-react';
import { Photo, PhotoTag, Project } from '../../types';
import { photosApi, projectsApi } from '../../services/api';
import { Button, Modal, Badge } from '../UI';
import { useAuth } from '../../context/AuthContext';
import { oneDriveService, OneDriveItem } from '../../services/onedrive';
import PhotoGrid from './PhotoGrid';
import PhotoUploader from './PhotoUploader';
import TagManager from './TagManager';
import PhotoDetailModal from './PhotoDetailModal';
import toast from 'react-hot-toast';

interface PhotoLibraryProps {
  projectId?: string;
  embedded?: boolean;
}

const PhotoLibrary: React.FC<PhotoLibraryProps> = ({ projectId, embedded = false }) => {
  const { getAccessToken } = useAuth();

  // State
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [tags, setTags] = useState<PhotoTag[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filterProject, setFilterProject] = useState<string>(projectId || '');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showBulkTagModal, setShowBulkTagModal] = useState(false);
  const [showAssignProjectModal, setShowAssignProjectModal] = useState(false);
  const [showOneDriveModal, setShowOneDriveModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  // OneDrive state
  const [oneDriveItems, setOneDriveItems] = useState<OneDriveItem[]>([]);
  const [oneDrivePath, setOneDrivePath] = useState<string[]>([]);
  const [oneDriveLoading, setOneDriveLoading] = useState(false);

  // Bulk tag state
  const [bulkTagIds, setBulkTagIds] = useState<string[]>([]);
  const [bulkTagAction, setBulkTagAction] = useState<'add' | 'remove' | 'replace'>('add');

  // Assign project state
  const [assignProjectId, setAssignProjectId] = useState<string>('');

  // Fetch photos
  const fetchPhotos = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = { page, pageSize: 50 };
      if (searchQuery) params.search = searchQuery;
      if (filterProject) params.projectId = filterProject;
      if (selectedTags.length > 0) params.tagIds = selectedTags.join(',');

      const response = await photosApi.getAll(params);
      if (response.data.success && response.data.data) {
        setPhotos(response.data.data.items);
        setTotalPages(response.data.data.totalPages);
        setTotal(response.data.data.total);
      }
    } catch (error) {
      console.error('Error fetching photos:', error);
      toast.error('Failed to load photos');
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, filterProject, selectedTags]);

  // Fetch tags
  const fetchTags = useCallback(async () => {
    try {
      const response = await photosApi.getTags();
      if (response.data.success && response.data.data) {
        setTags(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  }, []);

  // Fetch projects for filter
  const fetchProjects = useCallback(async () => {
    try {
      const response = await projectsApi.getAll({ pageSize: 100 });
      if (response.data.items) {
        setProjects(response.data.items);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  }, []);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  useEffect(() => {
    fetchTags();
    if (!projectId) {
      fetchProjects();
    }
  }, [fetchTags, fetchProjects, projectId]);

  // Selection handlers
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedPhotos);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedPhotos(newSelected);
  };

  const selectAll = () => {
    if (selectedPhotos.size === photos.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(photos.map(p => p.id)));
    }
  };

  const clearSelection = () => {
    setSelectedPhotos(new Set());
  };

  // Delete handlers
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;
    try {
      await photosApi.delete(id);
      toast.success('Photo deleted');
      fetchPhotos();
    } catch (error) {
      toast.error('Failed to delete photo');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPhotos.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedPhotos.size} photos?`)) return;
    try {
      await photosApi.bulkDelete(Array.from(selectedPhotos));
      toast.success(`Deleted ${selectedPhotos.size} photos`);
      setSelectedPhotos(new Set());
      fetchPhotos();
    } catch (error) {
      toast.error('Failed to delete photos');
    }
  };

  // Bulk tag handler
  const handleBulkTag = async () => {
    if (selectedPhotos.size === 0 || bulkTagIds.length === 0) return;
    try {
      await photosApi.bulkTag(Array.from(selectedPhotos), bulkTagIds, bulkTagAction);
      toast.success(`Tags ${bulkTagAction === 'remove' ? 'removed from' : 'added to'} ${selectedPhotos.size} photos`);
      setShowBulkTagModal(false);
      setBulkTagIds([]);
      fetchPhotos();
    } catch (error) {
      toast.error('Failed to update tags');
    }
  };

  // Assign project handler
  const handleAssignProject = async () => {
    if (selectedPhotos.size === 0) return;
    try {
      await photosApi.bulkAssignProject(Array.from(selectedPhotos), assignProjectId || null);
      toast.success(`Assigned ${selectedPhotos.size} photos to project`);
      setShowAssignProjectModal(false);
      setAssignProjectId('');
      setSelectedPhotos(new Set());
      fetchPhotos();
    } catch (error) {
      toast.error('Failed to assign photos to project');
    }
  };

  // OneDrive handlers
  const openOneDriveBrowser = async () => {
    setOneDriveLoading(true);
    setShowOneDriveModal(true);
    try {
      const token = await getAccessToken();
      if (token) {
        oneDriveService.initialize(token);
        const items = await oneDriveService.getRootItems();
        // Filter to show folders and images only
        setOneDriveItems(items.filter(item => item.folder || item.file?.mimeType?.startsWith('image/')));
        setOneDrivePath([]);
      }
    } catch (error) {
      console.error('Error loading OneDrive:', error);
      toast.error('Failed to connect to OneDrive');
    } finally {
      setOneDriveLoading(false);
    }
  };

  const navigateOneDrive = async (folder: OneDriveItem) => {
    setOneDriveLoading(true);
    try {
      const items = await oneDriveService.getFolderItems(folder.id);
      setOneDriveItems(items.filter(item => item.folder || item.file?.mimeType?.startsWith('image/')));
      setOneDrivePath(prev => [...prev, folder.name]);
    } finally {
      setOneDriveLoading(false);
    }
  };

  const navigateOneDriveBack = async () => {
    if (oneDrivePath.length === 0) return;
    setOneDriveLoading(true);
    try {
      const items = await oneDriveService.getRootItems();
      setOneDriveItems(items.filter(item => item.folder || item.file?.mimeType?.startsWith('image/')));
      setOneDrivePath([]);
    } finally {
      setOneDriveLoading(false);
    }
  };

  const linkOneDrivePhoto = async (item: OneDriveItem) => {
    try {
      await photosApi.linkOneDrive({
        itemId: item.id,
        name: item.name,
        url: item.webUrl,
        mimeType: item.file?.mimeType || 'image/jpeg',
        size: item.size,
        projectId: filterProject || projectId,
      });
      toast.success('Photo linked from OneDrive');
      fetchPhotos();
    } catch (error) {
      toast.error('Failed to link photo');
    }
  };

  // Upload complete handler
  const handleUploadComplete = () => {
    setShowUploadModal(false);
    fetchPhotos();
  };

  // Toggle tag filter
  const toggleTagFilter = (tagId: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tagId)) {
        return prev.filter(id => id !== tagId);
      }
      return [...prev, tagId];
    });
    setPage(1);
  };

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className={embedded ? '' : 'min-h-screen bg-gray-100 p-6'}>
      <div className={embedded ? '' : 'max-w-7xl mx-auto'}>
        {/* Header */}
        {!embedded && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Photo Library</h1>
            <p className="text-gray-600">Manage and organize your project photos</p>
          </div>
        )}

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {/* Toolbar */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">Photos</h3>
                <Badge variant="info">{total} photos</Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search photos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-48"
                  />
                </div>

                {/* Project filter */}
                {!projectId && (
                  <select
                    value={filterProject}
                    onChange={(e) => {
                      setFilterProject(e.target.value);
                      setPage(1);
                    }}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">All Projects</option>
                    <option value="global">Global (No Project)</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}

                {/* View toggle */}
                <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 ${viewMode === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 ${viewMode === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

                {/* Tag Manager */}
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Settings className="w-4 h-4" />}
                  onClick={() => setShowTagManager(true)}
                >
                  Tags
                </Button>

                {/* OneDrive */}
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Cloud className="w-4 h-4" />}
                  onClick={openOneDriveBrowser}
                >
                  OneDrive
                </Button>

                {/* Upload */}
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Upload className="w-4 h-4" />}
                  onClick={() => setShowUploadModal(true)}
                >
                  Upload
                </Button>
              </div>
            </div>

            {/* Tag Filters */}
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">Filter by tags:</span>
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTagFilter(tag.id)}
                    className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                      selectedTags.includes(tag.id)
                        ? 'text-white'
                        : 'bg-white hover:bg-gray-50'
                    }`}
                    style={{
                      backgroundColor: selectedTags.includes(tag.id) ? tag.color : undefined,
                      borderColor: tag.color,
                      color: selectedTags.includes(tag.id) ? 'white' : tag.color,
                    }}
                  >
                    {tag.name}
                  </button>
                ))}
                {selectedTags.length > 0 && (
                  <button
                    onClick={() => setSelectedTags([])}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Selection Bar */}
          {selectedPhotos.size > 0 && (
            <div className="px-4 py-2 bg-primary-50 border-b border-primary-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={clearSelection} className="text-gray-500 hover:text-gray-700">
                  <X className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-primary-700">
                  {selectedPhotos.size} photo{selectedPhotos.size > 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Tag className="w-4 h-4" />}
                  onClick={() => setShowBulkTagModal(true)}
                >
                  Tag
                </Button>
                {!projectId && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<FolderPlus className="w-4 h-4" />}
                    onClick={() => setShowAssignProjectModal(true)}
                  >
                    Assign Project
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Trash2 className="w-4 h-4" />}
                  onClick={handleBulkDelete}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}

          {/* Photo Grid */}
          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : photos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Cloud className="w-16 h-16 mb-4 text-gray-300" />
                <p>No photos yet</p>
                <p className="text-sm mt-1">Upload photos or import from OneDrive</p>
              </div>
            ) : (
              <>
                <PhotoGrid
                  photos={photos}
                  viewMode={viewMode}
                  selectedPhotos={selectedPhotos}
                  onToggleSelect={toggleSelect}
                  onSelectAll={selectAll}
                  onPhotoClick={(photo) => setSelectedPhoto(photo)}
                  onDelete={handleDelete}
                />

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page === totalPages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Photos"
        size="lg"
      >
        <PhotoUploader
          projectId={projectId || filterProject}
          tags={tags}
          onComplete={handleUploadComplete}
          onCancel={() => setShowUploadModal(false)}
        />
      </Modal>

      {/* Tag Manager Modal */}
      <Modal
        isOpen={showTagManager}
        onClose={() => setShowTagManager(false)}
        title="Manage Tags"
        size="md"
      >
        <TagManager
          tags={tags}
          onTagsChange={fetchTags}
          onClose={() => setShowTagManager(false)}
        />
      </Modal>

      {/* Bulk Tag Modal */}
      <Modal
        isOpen={showBulkTagModal}
        onClose={() => setShowBulkTagModal(false)}
        title="Bulk Tag Photos"
        size="md"
      >
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
            <select
              value={bulkTagAction}
              onChange={(e) => setBulkTagAction(e.target.value as 'add' | 'remove' | 'replace')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="add">Add tags</option>
              <option value="remove">Remove tags</option>
              <option value="replace">Replace all tags</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Tags</label>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => {
                    if (bulkTagIds.includes(tag.id)) {
                      setBulkTagIds(prev => prev.filter(id => id !== tag.id));
                    } else {
                      setBulkTagIds(prev => [...prev, tag.id]);
                    }
                  }}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    bulkTagIds.includes(tag.id)
                      ? 'text-white'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                  style={{
                    backgroundColor: bulkTagIds.includes(tag.id) ? tag.color : undefined,
                    borderColor: tag.color,
                    color: bulkTagIds.includes(tag.id) ? 'white' : tag.color,
                  }}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowBulkTagModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleBulkTag} disabled={bulkTagIds.length === 0}>
              Apply to {selectedPhotos.size} photos
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assign Project Modal */}
      <Modal
        isOpen={showAssignProjectModal}
        onClose={() => setShowAssignProjectModal(false)}
        title="Assign to Project"
        size="md"
      >
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Project</label>
            <select
              value={assignProjectId}
              onChange={(e) => setAssignProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">No Project (Global)</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowAssignProjectModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAssignProject}>
              Assign {selectedPhotos.size} photos
            </Button>
          </div>
        </div>
      </Modal>

      {/* OneDrive Modal */}
      <Modal
        isOpen={showOneDriveModal}
        onClose={() => setShowOneDriveModal(false)}
        title="Import from OneDrive"
        size="lg"
      >
        <div className="p-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-4 text-sm">
            <button
              onClick={() => {
                setOneDrivePath([]);
                openOneDriveBrowser();
              }}
              className="text-primary-600 hover:underline"
            >
              OneDrive
            </button>
            {oneDrivePath.map((folder, index) => (
              <React.Fragment key={index}>
                <span className="text-gray-400">/</span>
                <span className="text-gray-600">{folder}</span>
              </React.Fragment>
            ))}
          </div>

          {oneDrivePath.length > 0 && (
            <button
              onClick={navigateOneDriveBack}
              className="mb-4 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Back
            </button>
          )}

          {oneDriveLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
              {oneDriveItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => item.folder && navigateOneDrive(item)}
                  className={`p-3 border rounded-lg ${item.folder ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                >
                  {item.folder ? (
                    <div className="text-center">
                      <div className="w-12 h-12 mx-auto mb-2 bg-yellow-100 rounded-lg flex items-center justify-center">
                        <FolderPlus className="w-6 h-6 text-yellow-600" />
                      </div>
                      <p className="text-sm font-medium truncate">{item.name}</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="w-full h-20 mb-2 bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={item.thumbnails?.[0]?.medium?.url || ''}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <p className="text-xs font-medium truncate mb-2">{item.name}</p>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          linkOneDrivePhoto(item);
                        }}
                      >
                        Import
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Photo Detail Modal */}
      {selectedPhoto && (
        <PhotoDetailModal
          photo={selectedPhoto}
          tags={tags}
          onClose={() => setSelectedPhoto(null)}
          onUpdate={() => {
            fetchPhotos();
            setSelectedPhoto(null);
          }}
        />
      )}
    </div>
  );
};

export default PhotoLibrary;
