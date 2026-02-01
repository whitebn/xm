import React from 'react';
import {
  CheckSquare,
  Square,
  Cloud,
  ExternalLink,
  Download,
  Trash2,
} from 'lucide-react';
import { Photo } from '../../types';
import { photosApi } from '../../services/api';
import { Badge } from '../UI';

interface PhotoGridProps {
  photos: Photo[];
  viewMode: 'grid' | 'list';
  selectedPhotos: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onPhotoClick: (photo: Photo) => void;
  onDelete: (id: string) => void;
}

const PhotoGrid: React.FC<PhotoGridProps> = ({
  photos,
  viewMode,
  selectedPhotos,
  onToggleSelect,
  onSelectAll,
  onPhotoClick,
  onDelete,
}) => {
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = async (photo: Photo) => {
    if (photo.type === 'onedrive_link' && photo.oneDriveUrl) {
      window.open(photo.oneDriveUrl, '_blank');
      return;
    }

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
      console.error('Download failed:', error);
    }
  };

  if (viewMode === 'grid') {
    return (
      <div>
        {/* Select All Header */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={onSelectAll}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            {selectedPhotos.size === photos.length && photos.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-primary-600" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            {selectedPhotos.size === photos.length && photos.length > 0 ? 'Deselect all' : 'Select all'}
          </button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className={`group relative rounded-lg overflow-hidden border-2 transition-colors ${
                selectedPhotos.has(photo.id)
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-transparent hover:border-gray-200'
              }`}
            >
              {/* Checkbox */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(photo.id);
                }}
                className="absolute top-2 left-2 z-10 p-1 bg-white rounded shadow-sm hover:bg-gray-50"
              >
                {selectedPhotos.has(photo.id) ? (
                  <CheckSquare className="w-4 h-4 text-primary-600" />
                ) : (
                  <Square className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {/* OneDrive badge */}
              {photo.type === 'onedrive_link' && (
                <div className="absolute top-2 right-2 z-10">
                  <Badge variant="info" size="sm">
                    <Cloud className="w-3 h-3" />
                  </Badge>
                </div>
              )}

              {/* Image */}
              <div
                onClick={() => onPhotoClick(photo)}
                className="aspect-square bg-gray-100 cursor-pointer"
              >
                <img
                  src={photo.type === 'onedrive_link' ? photo.oneDriveUrl : photosApi.getPreviewUrl(photo.id)}
                  alt={photo.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect fill="%23f3f4f6" width="100" height="100"/%3E%3Ctext x="50" y="50" font-family="Arial" font-size="12" fill="%239ca3af" text-anchor="middle" dy=".3em"%3ENo Preview%3C/text%3E%3C/svg%3E';
                  }}
                />
              </div>

              {/* Info */}
              <div className="p-2 bg-white">
                <p className="text-sm font-medium truncate" title={photo.name}>
                  {photo.name}
                </p>
                <p className="text-xs text-gray-500">{formatSize(photo.size)}</p>

                {/* Tags */}
                {photo.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {photo.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag.id}
                        className="px-1.5 py-0.5 text-xs rounded-full text-white"
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                    {photo.tags.length > 3 && (
                      <span className="px-1.5 py-0.5 text-xs rounded-full bg-gray-200 text-gray-600">
                        +{photo.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Hover Actions */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(photo);
                    }}
                    className="p-2 bg-white rounded-full hover:bg-gray-100 shadow-md"
                    title={photo.type === 'onedrive_link' ? 'Open in OneDrive' : 'Download'}
                  >
                    {photo.type === 'onedrive_link' ? (
                      <ExternalLink className="w-4 h-4" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(photo.id);
                    }}
                    className="p-2 bg-white rounded-full hover:bg-gray-100 shadow-md text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div>
      {/* Select All Header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-t-lg border-b">
        <button
          onClick={onSelectAll}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          {selectedPhotos.size === photos.length && photos.length > 0 ? (
            <CheckSquare className="w-4 h-4 text-primary-600" />
          ) : (
            <Square className="w-4 h-4" />
          )}
        </button>
        <span className="flex-1 text-sm font-medium text-gray-500">Name</span>
        <span className="w-24 text-sm font-medium text-gray-500">Size</span>
        <span className="w-32 text-sm font-medium text-gray-500">Tags</span>
        <span className="w-24 text-sm font-medium text-gray-500">Type</span>
        <span className="w-24 text-sm font-medium text-gray-500">Actions</span>
      </div>

      {/* List Items */}
      <div className="divide-y">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 ${
              selectedPhotos.has(photo.id) ? 'bg-primary-50' : ''
            }`}
          >
            <button onClick={() => onToggleSelect(photo.id)}>
              {selectedPhotos.has(photo.id) ? (
                <CheckSquare className="w-4 h-4 text-primary-600" />
              ) : (
                <Square className="w-4 h-4 text-gray-400" />
              )}
            </button>

            <div
              className="flex-1 flex items-center gap-3 cursor-pointer"
              onClick={() => onPhotoClick(photo)}
            >
              <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                <img
                  src={photo.type === 'onedrive_link' ? photo.oneDriveUrl : photosApi.getPreviewUrl(photo.id)}
                  alt={photo.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <span className="font-medium truncate">{photo.name}</span>
            </div>

            <span className="w-24 text-sm text-gray-500">{formatSize(photo.size)}</span>

            <div className="w-32">
              {photo.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {photo.tags.slice(0, 2).map(tag => (
                    <span
                      key={tag.id}
                      className="px-1.5 py-0.5 text-xs rounded-full text-white"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                  {photo.tags.length > 2 && (
                    <span className="px-1.5 py-0.5 text-xs rounded-full bg-gray-200 text-gray-600">
                      +{photo.tags.length - 2}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-sm text-gray-400">No tags</span>
              )}
            </div>

            <span className="w-24">
              {photo.type === 'onedrive_link' ? (
                <Badge variant="info" size="sm">OneDrive</Badge>
              ) : (
                <Badge variant="success" size="sm">Local</Badge>
              )}
            </span>

            <div className="w-24 flex items-center gap-1">
              <button
                onClick={() => handleDownload(photo)}
                className="p-1.5 hover:bg-gray-200 rounded"
                title={photo.type === 'onedrive_link' ? 'Open in OneDrive' : 'Download'}
              >
                {photo.type === 'onedrive_link' ? (
                  <ExternalLink className="w-4 h-4" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => onDelete(photo.id)}
                className="p-1.5 hover:bg-gray-200 rounded text-red-600"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PhotoGrid;
