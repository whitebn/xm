import React, { useEffect, useState } from 'react';
import { FileManager } from '../components/Files';
import { filesApi } from '../services/api';
import { ProjectFile } from '../types';
import { useAuth } from '../context/AuthContext';

const Files: React.FC = () => {
  const { canEdit } = useAuth();
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const response = await filesApi.getGlobal();
      if (response.data.data) {
        setFiles(response.data.data);
      }
    } catch (error) {
      console.error('Error loading files:', error);
      // Mock data for demo
      setFiles([
        {
          id: 'f1',
          projectId: null,
          name: 'Company Logo.png',
          type: 'local',
          mimeType: 'image/png',
          size: 45678,
          path: '/uploads/company-logo.png',
          categoryId: null,
          uploadedById: '1',
          createdAt: '2024-01-15T10:00:00Z',
        },
        {
          id: 'f2',
          projectId: null,
          name: 'Standard Contract Template.docx',
          type: 'onedrive_link',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: 123456,
          path: 'onedrive-item-id',
          oneDriveUrl: 'https://onedrive.live.com/...',
          categoryId: null,
          uploadedById: '1',
          createdAt: '2024-01-10T10:00:00Z',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    const response = await filesApi.upload(null, file);
    if (response.data.data) {
      setFiles((prev) => [...prev, response.data.data!]);
    }
  };

  const handleFileLinkOneDrive = async (data: {
    itemId: string;
    name: string;
    url: string;
    mimeType: string;
    size: number;
  }) => {
    const response = await filesApi.linkOneDrive(null, data);
    if (response.data.data) {
      setFiles((prev) => [...prev, response.data.data!]);
    }
  };

  const handleFileDelete = async (fileId: string) => {
    await filesApi.delete(fileId);
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleFileDownload = async (fileId: string) => {
    const response = await filesApi.download(fileId);
    const file = files.find((f) => f.id === fileId);
    if (file) {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Global File Library</h1>
        <p className="text-gray-500">
          Files stored here are available across all projects
        </p>
      </div>

      <FileManager
        files={files}
        projectId={null}
        onUpload={handleFileUpload}
        onLinkOneDrive={handleFileLinkOneDrive}
        onDelete={handleFileDelete}
        onDownload={handleFileDownload}
        readOnly={!canEdit()}
      />
    </div>
  );
};

export default Files;
