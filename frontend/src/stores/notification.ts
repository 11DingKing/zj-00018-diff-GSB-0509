import { defineStore } from 'pinia';
import { notificationAPI, Notification } from '@/api';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
}

export const useNotificationStore = defineStore('notification', {
  state: (): NotificationState => ({
    notifications: [],
    unreadCount: 0,
    loading: false,
  }),

  actions: {
    async fetchUnreadCount() {
      try {
        const { data } = await notificationAPI.unreadCount();
        this.unreadCount = data.count;
      } catch {
        this.unreadCount = 0;
      }
    },

    async fetchNotifications(unreadOnly = false) {
      this.loading = true;
      try {
        const { data } = await notificationAPI.list({ unread: unreadOnly ? 'true' : undefined });
        this.notifications = data.notifications;
      } finally {
        this.loading = false;
      }
    },

    async markRead(id: string) {
      await notificationAPI.markRead(id);
      const idx = this.notifications.findIndex((n) => n.id === id);
      if (idx >= 0) {
        this.notifications[idx].read = true;
      }
      if (this.unreadCount > 0) {
        this.unreadCount--;
      }
    },

    async markAllRead() {
      await notificationAPI.markAllRead();
      this.notifications.forEach((n) => (n.read = true));
      this.unreadCount = 0;
    },
  },
});
