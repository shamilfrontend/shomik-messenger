import api from './api';

export const uploadService = {
  async uploadFile(file: File): Promise<{ url: string; filename: string; type: string; size: number }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/upload/file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    return response.data;
  }
};
