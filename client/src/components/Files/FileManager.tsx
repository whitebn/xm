import React, { useState, useCallback } from 'react';
import {
  Upload,
  Cloud,
  Link,
  Folder,
  File,
  FileText,
  Image,
  Film,
  Music,
  Archive,
  Download,
  Trash2,
  ExternalLink,
  Grid,
  List,
  Search,
} from 'lucide-react';
import { ProjectFile } from '../../types';
import { Button, Input, Modal, Badge } from '../UI';
import { useAuth } from '../../context/AuthContext';
import { oneDriveService, OneDriveItem } from '../../services/onedrive';

interface FileManagerProps {
  files: ProjectFile[];
  projectId: string | null;
  onUpload: (file: File, categoryId?: string) => Promise<void>;
  onLinkOneDrive: (data: {
    itemId: string;
    name: string;
    url: string;
    mimeType: string;
    size: number;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDownload: (id: string) => void;
  readOnly?: boolean;
  categories?: { id: string; name: string }[];
}

const FileManager: React.FC<FileManagerProps> = ({
  files,
  projectId,
  onUpload,
  onLinkOneDrive,
  onDelete,
  onDownload,
  readOnly = false,
  categories = [],
}) => {
  const { getAccessToken } = useAuth();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showOneDriveModal, setShowOneDriveModal] = useState(false);
  const [oneDriveItems, setOneDriveItems] = useState<OneDriveItem[]>([]);
  const [oneDrivePath, setOneDrivePath] = useState<string[]>([]);
  const [oneDriveLoading, setOneDriveLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);

  // Filter files
  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get file icon
  const getFileIcon = (mimeType: string, type: string) => {
    if (type === 'onedrive_link') return <Cloud className="w-8 h-8 text-blue-500" />;
    if (mimeType.startsWith('image/')) return <Image className="w-8 h-8 text-green-500" />;
    if (mimeType.startsWith('video/')) return <Film className="w-8 h-8 text-purple-500" />;
    if (mimeType.startsWith('audio/')) return <Music className="w-8 h-8 text-pink-500" />;
    if (mimeType.includes('pdf')) return <FileText className="w-8 h-8 text-red-500" />;
    if (mimeType.includes('zip') || mimeType.includes('compressed'))
      return <Archive className="w-8 h-8 text-yellow-500" />;
    return <File className="w-8 h-8 text-gray-500" />;
  };

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        await onUpload(file, selectedCategory || undefined);
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Handle drag and drop
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      if (readOnly) return;

      const fileList = e.dataTransfer.files;
      if (fileList.length === 0) return;

      setUploading(true);
      try {
        for (const file of Array.from(fileList)) {
          await onUpload(file, selectedCategory || undefined);
        }
      } finally {
        setUploading(false);
      }
    },
    [onUpload, selectedCategory, readOnly]
  );

  // OneDrive functions
  const openOneDriveBrowser = async () => {
    setOneDriveLoading(true);
    setShowOneDriveModal(true);

    try {
      const token = await getAccessToken();
      if (token) {
        oneDriveService.initialize(token);
        const items = await oneDriveService.getRootItems();
        setOneDriveItems(items);
        setOneDrivePath([]);
      }
    } catch (error) {
      console.error('Error loading OneDrive:', error);
    } finally {
      setOneDriveLoading(false);
    }
  };

  const navigateOneDrive = async (folder: OneDriveItem) => {
    setOneDriveLoading(true);
    try {
      const items = await oneDriveService.getFolderItems(folder.id);
      setOneDriveItems(items);
      setOneDrivePath((prev) => [...prev, folder.name]);
    } finally {
      setOneDriveLoading(false);
    }
  };

  const navigateOneDriveBack = async () => {
    if (oneDrivePath.length === 0) return;

    setOneDriveLoading(true);
    try {
      if (oneDrivePath.length === 1) {
        const items = await oneDriveService.getRootItems();
        setOneDriveItems(items);
        setOneDrivePath([]);
      } else {
        // Would need to track folder IDs for proper navigation
        const items = await oneDriveService.getRootItems();
        setOneDriveItems(items);
        setOneDrivePath([]);
      }
    } finally {
      setOneDriveLoading(false);
    }
  };

  const linkOneDriveFile = async (item: OneDriveItem) => {
    try {
      await onLinkOneDrive({
        itemId: item.id,
        name: item.name,
        url: item.webUrl,
        mimeType: item.file?.mimeType || 'application/octet-stream',
        size: item.size,
      });
      setShowOneDriveModal(false);
    } catch (error) {
      console.error('Error linking OneDrive file:', error);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-lg">Files</h3>
          <Badge variant="info">{filteredFiles.length} files</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* View toggle */}
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 ${
                viewMode === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 ${
                viewMode === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Upload buttons */}
          {!readOnly && (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={<Cloud className="w-4 h-4" />}
                onClick={openOneDriveBrowser}
              >
                OneDrive
              </Button>
              <label className="cursor-pointer">
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Upload className="w-4 h-4" />}
                  loading={uploading}
                  onClick={() => {}}
                >
                  Upload
                </Button>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
              </label>
            </>
          )}
        </div>
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 flex items-center gap-2 overflow-x-auto">
          <span className="text-sm text-gray-600">Category:</span>
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-3 py-1 text-sm rounded-full ${
              selectedCategory === ''
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 text-sm rounded-full whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Drop zone / File grid */}
      <div
        className={`p-4 min-h-[300px] transition-colors ${
          dragOver ? 'bg-primary-50 border-2 border-dashed border-primary-500' : ''
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!readOnly) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Folder className="w-16 h-16 mb-4 text-gray-300" />
            <p>No files yet</p>
            {!readOnly && (
              <p className="text-sm mt-1">
                Drag and drop files here or use the upload button
              </p>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className="group relative bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
              >
                <div className="flex flex-col items-center">
                  {getFileIcon(file.mimeType, file.type)}
                  <p className="mt-2 text-sm font-medium text-center truncate w-full">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
                  {file.type === 'onedrive_link' && (
                    <Badge variant="info" size="sm">
                      OneDrive
                    </Badge>
                  )}
                </div>

                {/* Actions overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                  {file.type === 'onedrive_link' && file.oneDriveUrl && (
                    <a
                      href={file.oneDriveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-white rounded-full hover:bg-gray-100"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  {file.type !== 'onedrive_link' && (
                    <button
                      onClick={() => onDownload(file.id)}
                      className="p-2 bg-white rounded-full hover:bg-gray-100"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  {!readOnly && (
                    <button
                      onClick={() => onDelete(file.id)}
                      className="p-2 bg-white rounded-full hover:bg-gray-100 text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50"
              >
                {getFileIcon(file.mimeType, file.type)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {formatSize(file.size)} • Uploaded by {file.uploadedBy?.name || 'Unknown'}
                  </p>
                </div>
                {file.type === 'onedrive_link' && (
                  <Badge variant="info" size="sm">
                    OneDrive
                  </Badge>
                )}
                <div className="flex items-center gap-1">
                  {file.type === 'onedrive_link' && file.oneDriveUrl && (
                    <a
                      href={file.oneDriveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-gray-200 rounded-lg"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  {file.type !== 'onedrive_link' && (
                    <button
                      onClick={() => onDownload(file.id)}
                      className="p-2 hover:bg-gray-200 rounded-lg"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  {!readOnly && (
                    <button
                      onClick={() => onDelete(file.id)}
                      className="p-2 hover:bg-gray-200 rounded-lg text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* OneDrive Browser Modal */}
      <Modal
        isOpen={showOneDriveModal}
        onClose={() => setShowOneDriveModal(false)}
        title="Browse OneDrive"
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

          {/* Back button */}
          {oneDrivePath.length > 0 && (
            <button
              onClick={navigateOneDriveBack}
              className="mb-4 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              ← Back
            </button>
          )}

          {/* Items */}
          {oneDriveLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {oneDriveItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    if (item.folder) {
                      navigateOneDrive(item);
                    }
                  }}
                >
                  {item.folder ? (
                    <Folder className="w-6 h-6 text-yellow-500" />
                  ) : (
                    <File className="w-6 h-6 text-gray-500" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.name}</p>
                    {!item.folder && (
                      <p className="text-sm text-gray-500">
                        {oneDriveService.formatFileSize(item.size)}
                      </p>
                    )}
                  </div>
                  {!item.folder && (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Link className="w-4 h-4" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        linkOneDriveFile(item);
                      }}
                    >
                      Link
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default FileManager;
