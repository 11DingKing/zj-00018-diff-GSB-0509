<template>
  <div class="changes-view">
    <div class="view-header">
      <h1>Changes</h1>
      <div class="filters">
        <select class="input" v-model="statusFilter">
          <option value="">All Status</option>
          <option value="Open">Open</option>
          <option value="Review">Review</option>
          <option value="Merged">Merged</option>
          <option value="Abandoned">Abandoned</option>
          <option value="Draft">Draft</option>
        </select>
      </div>
      <router-link to="/changes/new" class="btn btn-primary">
        + New Change
      </router-link>
    </div>

    <div v-if="loading" class="loading">Loading...</div>
    <div v-else-if="changes.length === 0" class="empty">
      No changes found.
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
          <span><strong>Author:</strong> {{ change.author.name }}</span>
          <span><strong>Repo:</strong> {{ change.repository.name }}</span>
          <span><strong>Branch:</strong> {{ change.sourceBranch }} → {{ change.targetBranch }}</span>
        </div>
        <div class="change-footer">
          <div class="reviewers">
            <span class="reviewer-label">Reviewers:</span>
            <span v-if="change.reviewers.length === 0" class="no-reviewers">None</span>
            <span v-for="r in change.reviewers" :key="r.user.id" class="reviewer-name">
              {{ r.user.name }}
            </span>
          </div>
          <div class="votes">
            <span v-for="vote in change.votes" :key="vote.id" :class="getVoteClass(vote.value)">
              {{ formatVote(vote.value) }} {{ vote.user.name }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="nextCursor" class="load-more">
      <button class="btn btn-secondary" @click="loadMore" :disabled="loading">
        Load more
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { changeAPI, Change } from '@/api';

const changes = ref<Change[]>([]);
const loading = ref(true);
const statusFilter = ref('');
const nextCursor = ref<string | null>(null);

const loadChanges = async (reset = true) => {
  loading.value = true;
  try {
    const params: any = { limit: 20 };
    if (statusFilter.value) params.status = statusFilter.value;
    if (!reset && nextCursor.value) params.cursor = nextCursor.value;

    const { data } = await changeAPI.list(params);
    if (reset) {
      changes.value = data.changes;
    } else {
      changes.value = [...changes.value, ...data.changes];
    }
    nextCursor.value = data.nextCursor;
  } finally {
    loading.value = false;
  }
};

const loadMore = () => loadChanges(false);

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

watch(statusFilter, () => {
  loadChanges(true);
});

onMounted(() => {
  loadChanges(true);
});
</script>

<style scoped>
.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  gap: 1rem;
}

.filters {
  display: flex;
  gap: 0.5rem;
}

.filters .input {
  width: 150px;
}

.loading,
.empty {
  text-align: center;
  padding: 3rem;
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
  gap: 1.5rem;
  font-size: 0.875rem;
  color: #586069;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.change-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.reviewers {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.reviewer-label {
  font-size: 0.875rem;
  color: #586069;
}

.reviewer-name {
  background: #e1e4e8;
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
}

.no-reviewers {
  font-size: 0.75rem;
  color: #959da5;
}

.votes {
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
  flex-wrap: wrap;
}

.load-more {
  text-align: center;
  margin-top: 1.5rem;
}
</style>
