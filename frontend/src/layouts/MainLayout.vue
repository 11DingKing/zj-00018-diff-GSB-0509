<template>
  <div class="app-layout">
    <header class="header">
      <div class="container header-content">
        <div class="logo">
          <router-link to="/">Mini Gerrit</router-link>
        </div>
        <nav class="nav">
          <router-link to="/">Dashboard</router-link>
          <router-link to="/changes">Changes</router-link>
          <router-link to="/repositories">Repositories</router-link>
        </nav>
        <div class="header-right">
          <div class="notification-dropdown" ref="notificationDropdown">
            <button class="notification-btn" @click="toggleNotifications">
              🔔
              <span v-if="notificationStore.unreadCount > 0" class="badge-count">
                {{ notificationStore.unreadCount > 99 ? '99+' : notificationStore.unreadCount }}
              </span>
            </button>
            <div v-if="showNotifications" class="notification-panel">
              <div class="notification-header">
                <span>Notifications</span>
                <button class="btn btn-secondary" @click="markAllRead" :disabled="notificationStore.unreadCount === 0">
                  Mark all read
                </button>
              </div>
              <div class="notification-list">
                <div v-if="notificationStore.notifications.length === 0" class="notification-empty">
                  No notifications
                </div>
                <div
                  v-for="notification in notificationStore.notifications"
                  :key="notification.id"
                  class="notification-item"
                  :class="{ unread: !notification.read }"
                  @click="handleNotificationClick(notification)"
                >
                  <div class="notification-message">{{ notification.message }}</div>
                  <div class="notification-time">{{ formatTime(notification.createdAt) }}</div>
                </div>
              </div>
            </div>
          </div>
          <span class="user-name">{{ authStore.user?.name }}</span>
          <button class="btn btn-secondary" @click="logout">Logout</button>
        </div>
      </div>
    </header>
    <main class="main">
      <div class="container">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notification';
import { Notification } from '@/api';

const authStore = useAuthStore();
const notificationStore = useNotificationStore();
const router = useRouter();

const showNotifications = ref(false);
const notificationDropdown = ref<HTMLElement | null>(null);

const toggleNotifications = async () => {
  showNotifications.value = !showNotifications.value;
  if (showNotifications.value) {
    await notificationStore.fetchNotifications();
  }
};

const handleNotificationClick = async (notification: Notification) => {
  if (!notification.read) {
    await notificationStore.markRead(notification.id);
  }
  if (notification.changeId) {
    router.push(`/changes/${notification.changeId}`);
  }
  showNotifications.value = false;
};

const markAllRead = async () => {
  await notificationStore.markAllRead();
};

const formatTime = (time: string) => {
  const date = new Date(time);
  return date.toLocaleString();
};

const handleClickOutside = (event: MouseEvent) => {
  if (notificationDropdown.value && !notificationDropdown.value.contains(event.target as Node)) {
    showNotifications.value = false;
  }
};

const logout = () => {
  authStore.logout();
  router.push('/login');
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: #24292e;
  color: white;
  padding: 0.75rem 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.logo a {
  font-size: 1.25rem;
  font-weight: bold;
  color: white;
  text-decoration: none;
}

.logo a:hover {
  text-decoration: none;
}

.nav {
  display: flex;
  gap: 1.5rem;
}

.nav a {
  color: white;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.nav a:hover,
.nav a.router-link-active {
  opacity: 1;
  text-decoration: none;
}

.header-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-name {
  font-size: 0.875rem;
}

.notification-dropdown {
  position: relative;
}

.notification-btn {
  background: none;
  border: none;
  color: white;
  font-size: 1.25rem;
  cursor: pointer;
  position: relative;
}

.badge-count {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #d73a49;
  color: white;
  font-size: 0.625rem;
  padding: 1px 5px;
  border-radius: 10px;
  font-weight: bold;
}

.notification-panel {
  position: absolute;
  right: 0;
  top: 100%;
  width: 360px;
  max-height: 480px;
  background: white;
  border: 1px solid #e1e4e8;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  margin-top: 0.5rem;
  color: #333;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e1e4e8;
  font-weight: 600;
}

.notification-list {
  flex: 1;
  overflow-y: auto;
}

.notification-item {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f1f3f5;
  cursor: pointer;
}

.notification-item:hover {
  background: #f6f8fa;
}

.notification-item.unread {
  background: #f0f7ff;
}

.notification-message {
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.notification-time {
  font-size: 0.75rem;
  color: #6a737d;
}

.notification-empty {
  padding: 2rem 1rem;
  text-align: center;
  color: #6a737d;
  font-size: 0.875rem;
}

.main {
  flex: 1;
  padding: 1.5rem 0;
}
</style>
