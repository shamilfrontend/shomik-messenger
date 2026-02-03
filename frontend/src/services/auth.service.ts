import api from './api';
import { AuthResponse, User } from '../types';

export const authService = {
  async register(username: string, email: string, password: string): Promise<AuthResponse> {
    const response = await api.post('/auth/register', { username, email, password });
    return response.data;
  },

  async login(username: string, password: string): Promise<AuthResponse> {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },

  async getMe(): Promise<User> {
    const response = await api.get('/auth/me');
    return response.data;
  }
};
