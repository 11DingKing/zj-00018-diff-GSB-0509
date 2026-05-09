import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:13018',
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
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface User {
  id: string;
  username: string;
  name: string;
  role: 'ADMIN' | 'USER';
}

export interface Repository {
  id: string;
  name: string;
  description?: string;
  branches: { id: string; name: string }[];
  _count?: { changes: number };
  createdAt: string;
}

export interface Change {
  id: string;
  title: string;
  description: string;
  status: 'Draft' | 'Open' | 'Review' | 'Merged' | 'Abandoned';
  repositoryId: string;
  authorId: string;
  sourceBranch: string;
  targetBranch: string;
  createdAt: string;
  updatedAt: string;
  author: User;
  repository: { id: string; name: string };
  patchsets: Patchset[];
  reviewers: { user: User }[];
  checks: Check[];
  votes: Vote[];
  comments?: Comment[];
}

export interface Patchset {
  id: string;
  changeId: string;
  number: number;
  message?: string;
  createdAt: string;
  diffFiles?: DiffFile[];
  votes?: Vote[];
}

export interface DiffFile {
  id: string;
  patchsetId: string;
  filePath: string;
  diffText: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  comments?: Comment[];
}

export interface Comment {
  id: string;
  changeId: string;
  diffFileId?: string;
  authorId: string;
  parentId?: string;
  content: string;
  lineNumber?: number;
  side?: 'left' | 'right';
  resolved: boolean;
  createdAt: string;
  author: User;
  children?: Comment[];
}

export interface Vote {
  id: string;
  changeId: string;
  patchsetId: string;
  userId: string;
  value: 'V2_NEG' | 'V1_NEG' | 'V0' | 'V1_POS' | 'V2_POS';
  user: User;
}

export interface Check {
  id: string;
  changeId: string;
  name: string;
  status: 'Pending' | 'Running' | 'Passed' | 'Failed';
  message?: string;
  isRequired: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  changeId?: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export const authAPI = {
  register: (data: { username: string; password: string; name: string }) =>
    api.post('/api/auth/register', data),
  login: (data: { username: string; password: string }) =>
    api.post('/api/auth/login', data),
  me: () => api.get('/api/auth/me'),
  list: () => api.get('/api/auth'),
};

export const repositoryAPI = {
  list: (params?: { cursor?: string; limit?: number }) =>
    api.get('/api/repositories', { params }),
  get: (id: string) => api.get(`/api/repositories/${id}`),
  create: (data: { name: string; description?: string; branches?: string[] }) =>
    api.post('/api/repositories', data),
};

export const changeAPI = {
  list: (params?: { cursor?: string; limit?: number; status?: string; authorId?: string }) =>
    api.get('/api/changes', { params }),
  get: (id: string) => api.get(`/api/changes/${id}`),
  create: (data: any) => api.post('/api/changes', data),
  updateStatus: (id: string, status: string) =>
    api.post(`/api/changes/${id}/status`, { status }),
  addReviewer: (id: string, userId: string) =>
    api.post(`/api/changes/${id}/reviewers`, { userId }),
  retryCheck: (id: string, checkName: string) =>
    api.post(`/api/changes/${id}/checks/${checkName}/retry`),
};

export const patchsetAPI = {
  create: (changeId: string, data: any) =>
    api.post(`/api/changes/${changeId}/patchsets`, data),
  get: (changeId: string, number: number) =>
    api.get(`/api/changes/${changeId}/patchsets/${number}`),
  vote: (changeId: string, number: number, value: string) =>
    api.post(`/api/changes/${changeId}/patchsets/${number}/vote`, { value }),
};

export const commentAPI = {
  list: (changeId: string, params?: { cursor?: string; limit?: number }) =>
    api.get(`/api/changes/${changeId}/comments`, { params }),
  create: (changeId: string, data: any) =>
    api.post(`/api/changes/${changeId}/comments`, data),
  resolve: (changeId: string, commentId: string, resolved: boolean) =>
    api.put(`/api/changes/${changeId}/comments/${commentId}/resolve`, { resolved }),
};

export const notificationAPI = {
  list: (params?: { cursor?: string; limit?: number; unread?: boolean }) =>
    api.get('/api/notifications', { params }),
  unreadCount: () => api.get('/api/notifications/unread-count'),
  markRead: (id: string) => api.post(`/api/notifications/${id}/read`),
  markAllRead: () => api.post('/api/notifications/read-all'),
};

export default api;
