<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notification';

const authStore = useAuthStore();
const notificationStore = useNotificationStore();

onMounted(async () => {
  if (authStore.isAuthenticated) {
    await authStore.fetchMe();
    notificationStore.fetchUnreadCount();
    setInterval(() => {
      notificationStore.fetchUnreadCount();
    }, 30000);
  }
});
</script>
