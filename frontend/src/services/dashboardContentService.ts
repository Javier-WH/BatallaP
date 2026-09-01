import api from './api';

interface DashboardContentData {
  id: number;
  content: string;
  updatedBy?: number;
  updatedAt: string;
}

export const getContent = async (): Promise<DashboardContentData> => {
  const response = await api.get<DashboardContentData>('/dashboard-content');
  return response.data;
};

export const updateContent = async (content: string): Promise<DashboardContentData> => {
  const response = await api.put<DashboardContentData>('/dashboard-content', { content });
  return response.data;
};

export const uploadImage = async (file: File): Promise<{ url: string; filename: string }> => {
  const formData = new FormData();
  formData.append('image', file);

  const response = await api.post<{ url: string; filename: string }>('/dashboard-content/images', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  // Construct full URL using backend baseURL
  const fullUrl = response.data.url;
  
  return {
    url: fullUrl,
    filename: response.data.filename
  };
};

export const deleteImage = async (filename: string): Promise<void> => {
  await api.delete(`/dashboard-content/images/${filename}`);
};
