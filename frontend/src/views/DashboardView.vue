<template>
  <div class="dashboard">
    <div class="dashboard-header">
      <h1>Welcome, {{ authStore.user?.name }}</h1>
      <router-link to="/changes/new" class="btn btn-primary">
        + New Change
      </router-link>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ stats.open }}</div>
        <div class="stat-label">Open Changes</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.merged }}</div>
        <div class="stat-label">Merged Changes</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.repositories }}</div>
        <div class="stat-label">Repositories</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ notificationStore.unreadCount }}</div>
        <div class="stat-label">Unread Notifications</div>
      </div>
    </div>

    <div class="section">
      <h2>Recent Changes</h2>
      <div v-if="loading" class="loading">Loading...</div>
      <div v-else-if="changes.length === 0" class="empty">
        No changes yet.
        <router-link to="/changes/new" class="btn btn-primary">Create your first change</router-link>
      </div>
      <div v-else class="change-list">
        <div v-for="change in changes" :key="change.id" class="change-item card">
          <div class="change-header">
            <router-link :to="`/changes/${change.id}`" class="change-title">
              {{ change.title }}
            </router-link>
            <span :class="`badge badge-${change.status.toLowerCase()}`">{{ change.status }}</span>
          </div>
          <div class="change-meta">
            <span>{{ change.author.name }}</span>
            <span>{{ change.repository.name }}</span>
            <span>{{ change.sourceBranch }} → {{ change.targetBranch }}</span>
          </div>
          <div class="change-footer">
            <div class="votes">
              <span v-for="vote in change.votes" :key="vote.id" :class="getVoteClass(vote.value)">
                {{ formatVote(vote.value) }}
              </span>
            </div>
            <div class="checks">
              <span v-for="check in change.checks" :key="check.id" :class="`status-${check.status.toLowerCase()}`">
                ✕ {{ check.name }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notification';
import { changeAPI, repositoryAPI, Change, VoteValue } from '@/api';

const authStore = useAuthStore();
const notificationStore = useNotificationStore();

const changes = ref<Change[]>([]);
const loading = ref(true);
const stats = ref({
  open: 0,
  merged: 0,
  repositories: 0,
});

const loadData = async () => {
  loading.value = true;
  try {
    const [changesRes, reposRes, openRes, mergedRes] = await Promise.all([
      changeAPI.list({ limit: 10 }),
      repositoryAPI.list(),
      changeAPI.list({ status: 'Open', limit: 100 }),
      changeAPI.list({ status: 'Merged', limit: 100 }),
    ]);
    changes.value = changesRes.data.changes;
    stats.value = {
      open: openRes.data.changes.length,
      merged: mergedRes.data.changes.length,
      repositories: reposRes.data.repositories.length,
    };
  } finally {
    loading.value = false;
  }
};

const getVoteClass = (value: string) => {
  const map: Record<string, string> = {
    V2_POS: 'vote-positive-2',
    V1_POS: 'vote-positive-1',
    V0: 'vote-zero',
    V1_NEG: 'vote-negative-1',
    V2_NEG: 'vote-negative-2',
  };
  return map[value] || 'vote-zero';
};

const formatVote = (value: string) => {
  const map: Record<string, string> = {
    V2_POS: '+2',
    V1_POS: '+1',
    V0: '0',
    V1_NEG: '-1',
    V2_NEG: '-2',
  };
  return map[value] || '0';
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.dashboard-header h1 {
  font-size: 1.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stat-value {
  font-size: 2.5rem;
  font-weight: bold;
  color: #2ea44f;
}

.stat-label {
  color: #586069;
  margin-top: 0.25rem;
}

.section {
  margin-top: 2rem;
}

.section h2 {
  font-size: 1.25rem;
  margin-bottom: 1rem;
}

.loading,
.empty {
  text-align: center;
  padding: 2rem;
  color: #586069;
}

.change-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.change-item {
  transition: box-shadow 0.2s;
}

.change-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.change-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.change-title {
  font-weight: 600;
  font-size: 1rem;
}

.change-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: #586069;
  margin-bottom: 0.75rem;
}

.change-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.votes {
  display: flex;
  gap: 0.25rem;
}

.checks {
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
}
</style>
