import api from './api';

export interface UpdateProfileData {
  username?: string;
  email?: string;
  avatar?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export const profileService = {
  async updateProfile(data: UpdateProfileData) {
    const response = await api.put('/users/profile', data);
    return response.data;
  },

  async changePassword(data: ChangePasswordData) {
    const response = await api.put('/users/password', data);
    return response.data;
  }
};
