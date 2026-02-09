import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://155.212.218.104:5001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }

    const errorMessage = error.response?.data?.error || error.message || 'Произошла ошибка';

    if (error.response?.status !== 401) {
      console.error('API Error:', errorMessage);
    }

    return Promise.reject(error);
  },
);

export default api;
