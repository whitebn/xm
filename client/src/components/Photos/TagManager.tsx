import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react';
import { PhotoTag } from '../../types';
import { photosApi } from '../../services/api';
import { Button, Input } from '../UI';
import toast from 'react-hot-toast';

interface TagManagerProps {
  tags: PhotoTag[];
  onTagsChange: () => void;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

const TagManager: React.FC<TagManagerProps> = ({
  tags,
  onTagsChange,
  onClose,
}) => {
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error('Tag name is required');
      return;
    }

    setCreating(true);
    try {
      const response = await photosApi.createTag({ name: newTagName.trim(), color: newTagColor });
      if (response.data.success) {
        toast.success('Tag created');
        setNewTagName('');
        setNewTagColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
        onTagsChange();
      }
    } catch (error: any) {
      if (error.response?.data?.error?.includes('already exists')) {
        toast.error('Tag name already exists');
      } else {
        toast.error('Failed to create tag');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateTag = async (id: string) => {
    if (!editName.trim()) {
      toast.error('Tag name is required');
      return;
    }

    try {
      const response = await photosApi.updateTag(id, { name: editName.trim(), color: editColor });
      if (response.data.success) {
        toast.success('Tag updated');
        setEditingTag(null);
        onTagsChange();
      }
    } catch (error: any) {
      if (error.response?.data?.error?.includes('already exists')) {
        toast.error('Tag name already exists');
      } else {
        toast.error('Failed to update tag');
      }
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tag? It will be removed from all photos.')) {
      return;
    }

    try {
      await photosApi.deleteTag(id);
      toast.success('Tag deleted');
      onTagsChange();
    } catch (error) {
      toast.error('Failed to delete tag');
    }
  };

  const startEditing = (tag: PhotoTag) => {
    setEditingTag(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const cancelEditing = () => {
    setEditingTag(null);
    setEditName('');
    setEditColor('');
  };

  return (
    <div className="p-4 space-y-6">
      {/* Create New Tag */}
      <div>
        <h4 className="font-medium text-gray-700 mb-3">Create New Tag</h4>
        <div className="flex items-center gap-3">
          <Input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Tag name"
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
          />

          <div className="flex items-center gap-1">
            {PRESET_COLORS.map(color => (
              <button
                key={color}
                onClick={() => setNewTagColor(color)}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  newTagColor === color ? 'scale-110 border-gray-800' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          <Button
            variant="primary"
            onClick={handleCreateTag}
            loading={creating}
            disabled={!newTagName.trim()}
            icon={<Plus className="w-4 h-4" />}
          >
            Add
          </Button>
        </div>
      </div>

      {/* Existing Tags */}
      <div>
        <h4 className="font-medium text-gray-700 mb-3">Existing Tags ({tags.length})</h4>

        {tags.length === 0 ? (
          <p className="text-gray-500 text-sm">No tags created yet</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {tags.map(tag => (
              <div
                key={tag.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
              >
                {editingTag === tag.id ? (
                  <>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateTag(tag.id);
                        if (e.key === 'Escape') cancelEditing();
                      }}
                    />

                    <div className="flex items-center gap-1">
                      {PRESET_COLORS.map(color => (
                        <button
                          key={color}
                          onClick={() => setEditColor(color)}
                          className={`w-5 h-5 rounded-full border-2 transition-transform ${
                            editColor === color ? 'scale-110 border-gray-800' : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>

                    <button
                      onClick={() => handleUpdateTag(tag.id)}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 font-medium">{tag.name}</span>

                    <button
                      onClick={() => startEditing(tag)}
                      className="p-1.5 text-gray-500 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 hover:opacity-100"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTag(tag.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Close Button */}
      <div className="flex justify-end pt-4 border-t">
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
};

export default TagManager;
