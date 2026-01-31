import { Client } from '@microsoft/microsoft-graph-client';

interface OneDriveItem {
  id: string;
  name: string;
  size: number;
  webUrl: string;
  file?: {
    mimeType: string;
  };
  folder?: {
    childCount: number;
  };
  parentReference?: {
    path: string;
  };
  lastModifiedDateTime: string;
}

interface OneDriveResponse {
  value: OneDriveItem[];
  '@odata.nextLink'?: string;
}

class OneDriveService {
  private client: Client | null = null;

  initialize(accessToken: string) {
    this.client = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      },
    });
  }

  isInitialized(): boolean {
    return this.client !== null;
  }

  async getRootItems(): Promise<OneDriveItem[]> {
    if (!this.client) throw new Error('OneDrive client not initialized');

    const response: OneDriveResponse = await this.client
      .api('/me/drive/root/children')
      .select('id,name,size,webUrl,file,folder,parentReference,lastModifiedDateTime')
      .get();

    return response.value;
  }

  async getFolderItems(folderId: string): Promise<OneDriveItem[]> {
    if (!this.client) throw new Error('OneDrive client not initialized');

    const response: OneDriveResponse = await this.client
      .api(`/me/drive/items/${folderId}/children`)
      .select('id,name,size,webUrl,file,folder,parentReference,lastModifiedDateTime')
      .get();

    return response.value;
  }

  async searchFiles(query: string): Promise<OneDriveItem[]> {
    if (!this.client) throw new Error('OneDrive client not initialized');

    const response: OneDriveResponse = await this.client
      .api(`/me/drive/root/search(q='${encodeURIComponent(query)}')`)
      .select('id,name,size,webUrl,file,folder,parentReference,lastModifiedDateTime')
      .get();

    return response.value;
  }

  async getItemById(itemId: string): Promise<OneDriveItem> {
    if (!this.client) throw new Error('OneDrive client not initialized');

    const item: OneDriveItem = await this.client
      .api(`/me/drive/items/${itemId}`)
      .select('id,name,size,webUrl,file,folder,parentReference,lastModifiedDateTime')
      .get();

    return item;
  }

  async getDownloadUrl(itemId: string): Promise<string> {
    if (!this.client) throw new Error('OneDrive client not initialized');

    const response = await this.client
      .api(`/me/drive/items/${itemId}`)
      .select('@microsoft.graph.downloadUrl')
      .get();

    return response['@microsoft.graph.downloadUrl'];
  }

  async downloadFile(itemId: string): Promise<Blob> {
    if (!this.client) throw new Error('OneDrive client not initialized');

    const response = await this.client
      .api(`/me/drive/items/${itemId}/content`)
      .responseType('blob' as ResponseType)
      .get();

    return response;
  }

  async uploadFile(
    parentFolderId: string | null,
    fileName: string,
    content: ArrayBuffer
  ): Promise<OneDriveItem> {
    if (!this.client) throw new Error('OneDrive client not initialized');

    const path = parentFolderId
      ? `/me/drive/items/${parentFolderId}:/${fileName}:/content`
      : `/me/drive/root:/${fileName}:/content`;

    const response: OneDriveItem = await this.client
      .api(path)
      .put(content);

    return response;
  }

  async createFolder(parentFolderId: string | null, folderName: string): Promise<OneDriveItem> {
    if (!this.client) throw new Error('OneDrive client not initialized');

    const path = parentFolderId
      ? `/me/drive/items/${parentFolderId}/children`
      : '/me/drive/root/children';

    const response: OneDriveItem = await this.client
      .api(path)
      .post({
        name: folderName,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename',
      });

    return response;
  }

  async createShareLink(itemId: string): Promise<string> {
    if (!this.client) throw new Error('OneDrive client not initialized');

    const response = await this.client
      .api(`/me/drive/items/${itemId}/createLink`)
      .post({
        type: 'view',
        scope: 'organization',
      });

    return response.link.webUrl;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getFileIcon(mimeType: string | undefined): string {
    if (!mimeType) return 'file';

    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'music';
    if (mimeType.includes('pdf')) return 'file-text';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'file-text';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'table';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'archive';

    return 'file';
  }
}

export const oneDriveService = new OneDriveService();
export type { OneDriveItem };
