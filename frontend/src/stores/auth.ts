import { defineStore } from 'pinia';
import { authAPI, User } from '@/api';

interface AuthState {
  user: User | null;
  token: string | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: localStorage.getItem('token'),
  }),

  getters: {
    isAuthenticated: (state) => !!state.token,
    isAdmin: (state) => state.user?.role === 'ADMIN',
  },

  actions: {
    async login(username: string, password: string) {
      const { data } = await authAPI.login({ username, password });
      this.user = data.user;
      this.token = data.token;
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    },

    async register(username: string, password: string, name: string) {
      const { data } = await authAPI.register({ username, password, name });
      this.user = data.user;
      this.token = data.token;
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    },

    async fetchMe() {
      try {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          this.user = JSON.parse(savedUser);
        }
        const { data } = await authAPI.me();
        this.user = data.user;
        localStorage.setItem('user', JSON.stringify(data.user));
      } catch {
        this.logout();
      }
    },

    logout() {
      this.user = null;
      this.token = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
  },
});
