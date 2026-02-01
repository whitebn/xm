import React, { useState, useCallback } from 'react';
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import { PhotoTag } from '../../types';
import { photosApi } from '../../services/api';
import { Button } from '../UI';
import toast from 'react-hot-toast';

interface PhotoUploaderProps {
  projectId?: string;
  tags: PhotoTag[];
  onComplete: () => void;
  onCancel: () => void;
}

interface FileToUpload {
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  projectId,
  tags,
  onComplete,
  onCancel,
}) => {
  const [files, setFiles] = useState<FileToUpload[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback((fileList: FileList) => {
    const newFiles: FileToUpload[] = [];

    for (const file of Array.from(fileList)) {
      // Only accept images
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`);
        continue;
      }

      // Check for duplicates
      if (files.some(f => f.file.name === file.name && f.file.size === file.size)) {
        continue;
      }

      newFiles.push({
        file,
        preview: URL.createObjectURL(file),
        status: 'pending',
      });
    }

    setFiles(prev => [...prev, ...newFiles]);
  }, [files]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tagId)) {
        return prev.filter(id => id !== tagId);
      }
      return [...prev, tagId];
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);

    // Update all files to uploading status
    setFiles(prev => prev.map(f => ({ ...f, status: 'uploading' as const })));

    try {
      const response = await photosApi.upload(
        files.map(f => f.file),
        projectId,
        undefined,
        selectedTags.length > 0 ? selectedTags : undefined
      );

      if (response.data.success) {
        // Update all files to success
        setFiles(prev => prev.map(f => ({ ...f, status: 'success' as const })));
        toast.success(`Uploaded ${files.length} photos`);

        // Wait a moment to show success state, then complete
        setTimeout(() => {
          onComplete();
        }, 1000);
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setFiles(prev => prev.map(f => ({ ...f, status: 'error' as const, error: 'Upload failed' })));
      toast.error('Failed to upload photos');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragOver
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p className="text-lg font-medium text-gray-700">
          Drag and drop photos here
        </p>
        <p className="text-sm text-gray-500 mt-1">or</p>
        <label className="mt-4 inline-block">
          <Button variant="primary" onClick={() => {}}>
            Browse Files
          </Button>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileInput}
            className="hidden"
          />
        </label>
        <p className="text-xs text-gray-400 mt-4">
          Supports: JPG, PNG, GIF, WebP, HEIC (max 50MB per file)
        </p>
      </div>

      {/* File Preview Grid */}
      {files.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-700">{files.length} photos selected</h4>
            <button
              onClick={() => {
                files.forEach(f => URL.revokeObjectURL(f.preview));
                setFiles([]);
              }}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Clear all
            </button>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-48 overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={index}
                className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden group"
              >
                <img
                  src={file.preview}
                  alt={file.file.name}
                  className="w-full h-full object-cover"
                />

                {/* Status overlay */}
                {file.status === 'uploading' && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {file.status === 'success' && (
                  <div className="absolute inset-0 bg-green-500 bg-opacity-50 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                )}

                {file.status === 'error' && (
                  <div className="absolute inset-0 bg-red-500 bg-opacity-50 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-white" />
                  </div>
                )}

                {/* Remove button */}
                {file.status === 'pending' && (
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute top-1 right-1 p-1 bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                )}

                {/* File info tooltip */}
                <div className="absolute bottom-0 left-0 right-0 p-1 bg-black bg-opacity-50 text-white text-xs truncate opacity-0 group-hover:opacity-100 transition-opacity">
                  {file.file.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tag Selection */}
      {tags.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-700 mb-2">Add tags (optional)</h4>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                disabled={uploading}
                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                  selectedTags.includes(tag.id)
                    ? 'text-white'
                    : 'bg-white hover:bg-gray-50'
                } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
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
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button
          variant="secondary"
          onClick={onCancel}
          disabled={uploading}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleUpload}
          loading={uploading}
          disabled={files.length === 0 || uploading}
        >
          Upload {files.length > 0 ? `${files.length} photos` : ''}
        </Button>
      </div>
    </div>
  );
};

export default PhotoUploader;
