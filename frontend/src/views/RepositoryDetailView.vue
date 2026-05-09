<template>
  <div class="repository-detail">
    <div class="view-header">
      <h1>{{ repository?.name }}</h1>
      <router-link
        v-if="repository"
        :to="{
          path: '/changes/new',
          query: { repo: repository.id },
        }"
        class="btn btn-primary"
      >
        + New Change
      </router-link>
    </div>

    <div v-if="loading" class="loading">Loading...</div>
    <div v-else-if="!repository" class="empty">Repository not found</div>
    <div v-else>
      <div class="card">
        <p v-if="repository.description" class="repo-desc">{{ repository.description }}</p>
        <div class="repo-branches">
          <strong>Branches:</strong>
          <span v-for="branch in repository.branches" :key="branch.id" class="branch-tag">
            {{ branch.name }}
          </span>
        </div>
      </div>

      <h2>Changes</h2>
      <div v-if="changesLoading" class="loading">Loading changes...</div>
      <div v-else-if="changes.length === 0" class="empty">
        No changes for this repository.
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
            <span>{{ change.sourceBranch }} → {{ change.targetBranch }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { repositoryAPI, changeAPI, Repository, Change } from '@/api';

const route = useRoute();
const repository = ref<Repository | null>(null);
const changes = ref<Change[]>([]);
const loading = ref(true);
const changesLoading = ref(true);

const loadData = async () => {
  loading.value = true;
  try {
    const { data } = await repositoryAPI.get(route.params.id as string);
    repository.value = data.repository;

    changesLoading.value = true;
    const changesRes = await changeAPI.list();
    changes.value = changesRes.data.changes.filter(
      (c: Change) => c.repository.id === repository.value?.id
    );
  } finally {
    loading.value = false;
    changesLoading.value = false;
  }
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.loading,
.empty {
  text-align: center;
  padding: 3rem;
  color: #586069;
}

.repo-desc {
  margin-bottom: 1rem;
}

.repo-branches {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.branch-tag {
  background: #e1e4e8;
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
}

h2 {
  margin: 2rem 0 1rem;
  font-size: 1.25rem;
}

.change-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.change-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.change-title {
  font-weight: 600;
}

.change-meta {
  display: flex;
  gap: 1.5rem;
  font-size: 0.875rem;
  color: #586069;
}
</style>
