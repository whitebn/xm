import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Upload,
  Tag,
  Trash2,
  FolderPlus,
  X,
  Filter,
  Grid,
  List,
  Settings,
  CheckSquare,
  Square,
  Download,
  Plus,
  Edit2,
  Check,
  Camera,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { Photo, PhotoTag, Project } from '../../types';
import { photosApi, projectsApi } from '../../services/api';
import { Button, Modal, Badge, Input } from '../UI';
import toast from 'react-hot-toast';

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

const PhotoLibrary: React.FC = () => {
  // State
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [tags, setTags] = useState<PhotoTag[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filterProject, setFilterProject] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showBulkTagModal, setShowBulkTagModal] = useState(false);
  const [showAssignProjectModal, setShowAssignProjectModal] = useState(false);
  const [showPhotoDetail, setShowPhotoDetail] = useState<Photo | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);

  // Upload state
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadTagIds, setUploadTagIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // Tag manager state
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('');

  // Bulk operations state
  const [bulkTagIds, setBulkTagIds] = useState<string[]>([]);
  const [bulkTagAction, setBulkTagAction] = useState<'add' | 'remove' | 'replace'>('add');
  const [assignProjectId, setAssignProjectId] = useState<string>('');

  // New project state
  const [newProjectName, setNewProjectName] = useState('');

  // Photo detail state
  const [detailTags, setDetailTags] = useState<string[]>([]);

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

  const fetchProjects = useCallback(async () => {
    try {
      const response = await projectsApi.getAll();
      if (response.data.success && response.data.data) {
        setProjects(response.data.data);
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
    fetchProjects();
  }, [fetchTags, fetchProjects]);

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

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

  // Delete handlers
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this photo?')) return;
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
    if (!confirm(`Delete ${selectedPhotos.size} photos?`)) return;
    try {
      await photosApi.bulkDelete(Array.from(selectedPhotos));
      toast.success(`Deleted ${selectedPhotos.size} photos`);
      setSelectedPhotos(new Set());
      fetchPhotos();
    } catch (error) {
      toast.error('Failed to delete photos');
    }
  };

  // Upload handlers
  const handleUpload = async () => {
    if (uploadFiles.length === 0) return;
    setUploading(true);
    try {
      await photosApi.upload(uploadFiles, filterProject || undefined, uploadTagIds);
      toast.success(`Uploaded ${uploadFiles.length} photos`);
      setShowUploadModal(false);
      setUploadFiles([]);
      setUploadTagIds([]);
      fetchPhotos();
    } catch (error) {
      toast.error('Failed to upload photos');
    } finally {
      setUploading(false);
    }
  };

  // Tag handlers
  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      await photosApi.createTag({ name: newTagName.trim(), color: newTagColor });
      toast.success('Tag created');
      setNewTagName('');
      setNewTagColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
      fetchTags();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create tag');
    }
  };

  const handleUpdateTag = async (id: string) => {
    if (!editTagName.trim()) return;
    try {
      await photosApi.updateTag(id, { name: editTagName.trim(), color: editTagColor });
      toast.success('Tag updated');
      setEditingTag(null);
      fetchTags();
    } catch (error) {
      toast.error('Failed to update tag');
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!confirm('Delete this tag?')) return;
    try {
      await photosApi.deleteTag(id);
      toast.success('Tag deleted');
      fetchTags();
    } catch (error) {
      toast.error('Failed to delete tag');
    }
  };

  // Bulk tag handler
  const handleBulkTag = async () => {
    if (selectedPhotos.size === 0 || bulkTagIds.length === 0) return;
    try {
      await photosApi.bulkTag(Array.from(selectedPhotos), bulkTagIds, bulkTagAction);
      toast.success('Tags updated');
      setShowBulkTagModal(false);
      setBulkTagIds([]);
      fetchPhotos();
    } catch (error) {
      toast.error('Failed to update tags');
    }
  };

  // Project handlers
  const handleAssignProject = async () => {
    if (selectedPhotos.size === 0) return;
    try {
      await photosApi.bulkAssignProject(Array.from(selectedPhotos), assignProjectId || null);
      toast.success('Photos assigned to project');
      setShowAssignProjectModal(false);
      setSelectedPhotos(new Set());
      fetchPhotos();
    } catch (error) {
      toast.error('Failed to assign photos');
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      await projectsApi.create({ name: newProjectName.trim() });
      toast.success('Project created');
      setNewProjectName('');
      setShowProjectModal(false);
      fetchProjects();
    } catch (error) {
      toast.error('Failed to create project');
    }
  };

  // Photo detail handlers
  const openPhotoDetail = (photo: Photo) => {
    setShowPhotoDetail(photo);
    setDetailTags(photo.tags.map(t => t.id));
  };

  const handleSavePhotoTags = async () => {
    if (!showPhotoDetail) return;
    try {
      await photosApi.setTags(showPhotoDetail.id, detailTags);
      toast.success('Tags saved');
      setShowPhotoDetail(null);
      fetchPhotos();
    } catch (error) {
      toast.error('Failed to save tags');
    }
  };

  const handleDownload = async (photo: Photo) => {
    try {
      const response = await photosApi.download(photo.id);
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = photo.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast.error('Download failed');
    }
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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Camera className="w-8 h-8 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">Photo Library</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {/* Toolbar */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="info">{total} photos</Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                    className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-40"
                  />
                </div>

                {/* Project filter */}
                <select
                  value={filterProject}
                  onChange={(e) => { setFilterProject(e.target.value); setPage(1); }}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All Projects</option>
                  <option value="none">No Project</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

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

                <Button variant="secondary" size="sm" icon={<FolderPlus className="w-4 h-4" />} onClick={() => setShowProjectModal(true)}>
                  Projects
                </Button>
                <Button variant="secondary" size="sm" icon={<Settings className="w-4 h-4" />} onClick={() => setShowTagManager(true)}>
                  Tags
                </Button>
                <Button variant="primary" size="sm" icon={<Upload className="w-4 h-4" />} onClick={() => setShowUploadModal(true)}>
                  Upload
                </Button>
              </div>
            </div>

            {/* Tag Filters */}
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTagFilter(tag.id)}
                    className={`px-2 py-1 text-xs rounded-full border transition-colors`}
                    style={{
                      backgroundColor: selectedTags.includes(tag.id) ? tag.color : 'white',
                      borderColor: tag.color,
                      color: selectedTags.includes(tag.id) ? 'white' : tag.color,
                    }}
                  >
                    {tag.name}
                  </button>
                ))}
                {selectedTags.length > 0 && (
                  <button onClick={() => setSelectedTags([])} className="text-xs text-gray-500 underline">
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Selection Bar */}
          {selectedPhotos.size > 0 && (
            <div className="px-4 py-2 bg-primary-50 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedPhotos(new Set())} className="text-gray-500 hover:text-gray-700">
                  <X className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-primary-700">
                  {selectedPhotos.size} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" icon={<Tag className="w-4 h-4" />} onClick={() => setShowBulkTagModal(true)}>
                  Tag
                </Button>
                <Button variant="secondary" size="sm" icon={<FolderPlus className="w-4 h-4" />} onClick={() => setShowAssignProjectModal(true)}>
                  Assign
                </Button>
                <Button variant="danger" size="sm" icon={<Trash2 className="w-4 h-4" />} onClick={handleBulkDelete}>
                  Delete
                </Button>
              </div>
            </div>
          )}

          {/* Photo Grid/List */}
          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : photos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Camera className="w-16 h-16 mb-4 text-gray-300" />
                <p>No photos yet</p>
                <p className="text-sm mt-1">Upload some photos to get started</p>
              </div>
            ) : (
              <>
                {/* Select All */}
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={selectAll} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
                    {selectedPhotos.size === photos.length ? <CheckSquare className="w-4 h-4 text-primary-600" /> : <Square className="w-4 h-4" />}
                    {selectedPhotos.size === photos.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>

                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {photos.map((photo) => (
                      <div
                        key={photo.id}
                        className={`group relative rounded-lg overflow-hidden border-2 transition-colors ${
                          selectedPhotos.has(photo.id) ? 'border-primary-500 bg-primary-50' : 'border-transparent hover:border-gray-200'
                        }`}
                      >
                        <button
                          onClick={() => toggleSelect(photo.id)}
                          className="absolute top-2 left-2 z-10 p-1 bg-white rounded shadow-sm"
                        >
                          {selectedPhotos.has(photo.id) ? <CheckSquare className="w-4 h-4 text-primary-600" /> : <Square className="w-4 h-4 text-gray-400" />}
                        </button>

                        <div onClick={() => openPhotoDetail(photo)} className="aspect-square bg-gray-100 cursor-pointer">
                          <img
                            src={photosApi.getPreviewUrl(photo.id)}
                            alt={photo.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>

                        <div className="p-2 bg-white">
                          <p className="text-sm font-medium truncate">{photo.name}</p>
                          <p className="text-xs text-gray-500">{formatSize(photo.size)}</p>
                          {photo.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {photo.tags.slice(0, 3).map(tag => (
                                <span key={tag.id} className="px-1.5 py-0.5 text-xs rounded-full text-white" style={{ backgroundColor: tag.color }}>
                                  {tag.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <div className="flex gap-2">
                            <button onClick={() => handleDownload(photo)} className="p-2 bg-white rounded-full hover:bg-gray-100 shadow-md">
                              <Download className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(photo.id)} className="p-2 bg-white rounded-full hover:bg-gray-100 shadow-md text-red-600">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="divide-y">
                    {photos.map((photo) => (
                      <div key={photo.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 ${selectedPhotos.has(photo.id) ? 'bg-primary-50' : ''}`}>
                        <button onClick={() => toggleSelect(photo.id)}>
                          {selectedPhotos.has(photo.id) ? <CheckSquare className="w-4 h-4 text-primary-600" /> : <Square className="w-4 h-4 text-gray-400" />}
                        </button>
                        <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden cursor-pointer" onClick={() => openPhotoDetail(photo)}>
                          <img src={photosApi.getPreviewUrl(photo.id)} alt={photo.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 cursor-pointer" onClick={() => openPhotoDetail(photo)}>
                          <p className="font-medium">{photo.name}</p>
                          <p className="text-sm text-gray-500">{formatSize(photo.size)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDownload(photo)} className="p-1.5 hover:bg-gray-200 rounded">
                            <Download className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(photo.id)} className="p-1.5 hover:bg-gray-200 rounded text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
                    <Button variant="secondary" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Upload Modal */}
      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} title="Upload Photos" size="lg">
        <div className="p-4 space-y-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
              setUploadFiles(prev => [...prev, ...files]);
            }}
            className="border-2 border-dashed rounded-lg p-8 text-center"
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium">Drag and drop photos here</p>
            <label className="mt-4 inline-block cursor-pointer">
              <Button variant="primary" onClick={() => {}}>Browse Files</Button>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files) {
                    setUploadFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                  }
                }}
                className="hidden"
              />
            </label>
          </div>

          {uploadFiles.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">{uploadFiles.length} files selected</p>
              <div className="grid grid-cols-6 gap-2 max-h-32 overflow-y-auto">
                {uploadFiles.map((file, i) => (
                  <div key={i} className="relative aspect-square bg-gray-100 rounded overflow-hidden">
                    <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setUploadFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 p-0.5 bg-black bg-opacity-50 rounded-full"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tags.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Add tags</p>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => setUploadTagIds(prev => prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id])}
                    className="px-3 py-1.5 text-sm rounded-full border"
                    style={{
                      backgroundColor: uploadTagIds.includes(tag.id) ? tag.color : 'white',
                      borderColor: tag.color,
                      color: uploadTagIds.includes(tag.id) ? 'white' : tag.color,
                    }}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => { setShowUploadModal(false); setUploadFiles([]); }}>Cancel</Button>
            <Button variant="primary" onClick={handleUpload} loading={uploading} disabled={uploadFiles.length === 0}>
              Upload {uploadFiles.length > 0 ? `${uploadFiles.length} photos` : ''}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Tag Manager Modal */}
      <Modal isOpen={showTagManager} onClose={() => setShowTagManager(false)} title="Manage Tags" size="md">
        <div className="p-4 space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Create New Tag</p>
            <div className="flex items-center gap-2">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Tag name"
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
              />
              <div className="flex gap-1">
                {PRESET_COLORS.slice(0, 5).map(color => (
                  <button
                    key={color}
                    onClick={() => setNewTagColor(color)}
                    className={`w-6 h-6 rounded-full border-2 ${newTagColor === color ? 'border-gray-800' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <Button variant="primary" onClick={handleCreateTag} icon={<Plus className="w-4 h-4" />}>Add</Button>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Existing Tags ({tags.length})</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {tags.map(tag => (
                <div key={tag.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
                  {editingTag === tag.id ? (
                    <>
                      <Input value={editTagName} onChange={(e) => setEditTagName(e.target.value)} className="flex-1" />
                      <div className="flex gap-1">
                        {PRESET_COLORS.slice(0, 5).map(color => (
                          <button
                            key={color}
                            onClick={() => setEditTagColor(color)}
                            className={`w-5 h-5 rounded-full border-2 ${editTagColor === color ? 'border-gray-800' : 'border-transparent'}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <button onClick={() => handleUpdateTag(tag.id)} className="p-1 text-green-600"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingTag(null)} className="p-1 text-gray-500"><X className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <>
                      <span className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />
                      <span className="flex-1">{tag.name}</span>
                      <button onClick={() => { setEditingTag(tag.id); setEditTagName(tag.name); setEditTagColor(tag.color); }} className="p-1 text-gray-500"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteTag(tag.id)} className="p-1 text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowTagManager(false)}>Done</Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Tag Modal */}
      <Modal isOpen={showBulkTagModal} onClose={() => setShowBulkTagModal(false)} title="Tag Photos" size="md">
        <div className="p-4 space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Action</p>
            <select
              value={bulkTagAction}
              onChange={(e) => setBulkTagAction(e.target.value as 'add' | 'remove' | 'replace')}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="add">Add tags</option>
              <option value="remove">Remove tags</option>
              <option value="replace">Replace all tags</option>
            </select>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Select Tags</p>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => setBulkTagIds(prev => prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id])}
                  className="px-3 py-1.5 text-sm rounded-full border"
                  style={{
                    backgroundColor: bulkTagIds.includes(tag.id) ? tag.color : 'white',
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
            <Button variant="secondary" onClick={() => setShowBulkTagModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleBulkTag} disabled={bulkTagIds.length === 0}>
              Apply to {selectedPhotos.size} photos
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assign Project Modal */}
      <Modal isOpen={showAssignProjectModal} onClose={() => setShowAssignProjectModal(false)} title="Assign to Project" size="md">
        <div className="p-4 space-y-4">
          <select
            value={assignProjectId}
            onChange={(e) => setAssignProjectId(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="">No Project</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowAssignProjectModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAssignProject}>
              Assign {selectedPhotos.size} photos
            </Button>
          </div>
        </div>
      </Modal>

      {/* Project Modal */}
      <Modal isOpen={showProjectModal} onClose={() => setShowProjectModal(false)} title="Manage Projects" size="md">
        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            <Input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="New project name"
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
            />
            <Button variant="primary" onClick={handleCreateProject} icon={<Plus className="w-4 h-4" />}>Add</Button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {projects.map(project => (
              <div key={project.id} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                <span>{project.name}</span>
                <button
                  onClick={async () => {
                    if (confirm('Delete this project?')) {
                      await projectsApi.delete(project.id);
                      toast.success('Project deleted');
                      fetchProjects();
                    }
                  }}
                  className="p-1 text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowProjectModal(false)}>Done</Button>
          </div>
        </div>
      </Modal>

      {/* Photo Detail Modal */}
      {showPhotoDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-75">
          <button onClick={() => setShowPhotoDetail(null)} className="absolute top-4 right-4 p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-full">
            <X className="w-6 h-6" />
          </button>
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex">
            <div className="flex-1 bg-gray-900 flex items-center justify-center">
              <img
                src={photosApi.getPreviewUrl(showPhotoDetail.id)}
                alt={showPhotoDetail.name}
                className="max-w-full max-h-[80vh] object-contain"
              />
            </div>
            <div className="w-72 flex flex-col">
              <div className="p-4 border-b">
                <h3 className="font-semibold truncate">{showPhotoDetail.name}</h3>
                <p className="text-sm text-gray-500">{formatSize(showPhotoDetail.size)}</p>
              </div>
              <div className="flex-1 p-4 overflow-y-auto">
                <p className="text-sm font-medium mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => setDetailTags(prev => prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id])}
                      className="px-3 py-1.5 text-sm rounded-full border"
                      style={{
                        backgroundColor: detailTags.includes(tag.id) ? tag.color : 'white',
                        borderColor: tag.color,
                        color: detailTags.includes(tag.id) ? 'white' : tag.color,
                      }}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
                <Button variant="primary" size="sm" onClick={handleSavePhotoTags} className="mt-4 w-full">
                  Save Tags
                </Button>
              </div>
              <div className="p-4 border-t space-y-2">
                <Button variant="secondary" className="w-full" icon={<Download className="w-4 h-4" />} onClick={() => handleDownload(showPhotoDetail)}>
                  Download
                </Button>
                <Button
                  variant="danger"
                  className="w-full"
                  icon={<Trash2 className="w-4 h-4" />}
                  onClick={() => {
                    handleDelete(showPhotoDetail.id);
                    setShowPhotoDetail(null);
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoLibrary;
