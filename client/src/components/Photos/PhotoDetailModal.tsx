import React, { useState } from 'react';
import {
  X,
  Download,
  ExternalLink,
  Tag,
  Calendar,
  HardDrive,
  Cloud,
  Trash2,
} from 'lucide-react';
import { Photo, PhotoTag } from '../../types';
import { photosApi } from '../../services/api';
import { Button, Badge } from '../UI';
import toast from 'react-hot-toast';

interface PhotoDetailModalProps {
  photo: Photo;
  tags: PhotoTag[];
  onClose: () => void;
  onUpdate: () => void;
}

const PhotoDetailModal: React.FC<PhotoDetailModalProps> = ({
  photo,
  tags,
  onClose,
  onUpdate,
}) => {
  const [selectedTags, setSelectedTags] = useState<string[]>(photo.tags.map(t => t.id));
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => {
      const newTags = prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId];
      setHasChanges(true);
      return newTags;
    });
  };

  const handleSaveTags = async () => {
    setSaving(true);
    try {
      await photosApi.setTags(photo.id, selectedTags);
      toast.success('Tags updated');
      setHasChanges(false);
      onUpdate();
    } catch (error) {
      toast.error('Failed to update tags');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
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
      toast.error('Download failed');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this photo?')) return;
    try {
      await photosApi.delete(photo.id);
      toast.success('Photo deleted');
      onUpdate();
    } catch (error) {
      toast.error('Failed to delete photo');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-75">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-full"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex">
        {/* Image Preview */}
        <div className="flex-1 bg-gray-900 flex items-center justify-center min-h-[400px]">
          <img
            src={photo.type === 'onedrive_link' ? photo.oneDriveUrl : photosApi.getPreviewUrl(photo.id)}
            alt={photo.name}
            className="max-w-full max-h-[80vh] object-contain"
          />
        </div>

        {/* Details Panel */}
        <div className="w-80 flex flex-col bg-white">
          {/* Header */}
          <div className="p-4 border-b">
            <h3 className="font-semibold text-lg truncate" title={photo.name}>
              {photo.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              {photo.type === 'onedrive_link' ? (
                <Badge variant="info">
                  <Cloud className="w-3 h-3 mr-1" />
                  OneDrive
                </Badge>
              ) : (
                <Badge variant="success">
                  <HardDrive className="w-3 h-3 mr-1" />
                  Local
                </Badge>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <HardDrive className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">Size:</span>
              <span className="font-medium">{formatSize(photo.size)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">Uploaded:</span>
              <span className="font-medium">{formatDate(photo.createdAt)}</span>
            </div>
          </div>

          {/* Tags */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-gray-700">Tags</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
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
            </div>

            {hasChanges && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveTags}
                loading={saving}
                className="mt-4 w-full"
              >
                Save Tags
              </Button>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 border-t space-y-2">
            <Button
              variant="secondary"
              className="w-full"
              icon={photo.type === 'onedrive_link' ? <ExternalLink className="w-4 h-4" /> : <Download className="w-4 h-4" />}
              onClick={handleDownload}
            >
              {photo.type === 'onedrive_link' ? 'Open in OneDrive' : 'Download'}
            </Button>
            <Button
              variant="danger"
              className="w-full"
              icon={<Trash2 className="w-4 h-4" />}
              onClick={handleDelete}
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoDetailModal;
