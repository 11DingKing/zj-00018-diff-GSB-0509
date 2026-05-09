<template>
  <div class="repositories-view">
    <div class="view-header">
      <h1>Repositories</h1>
      <button class="btn btn-primary" @click="showCreateModal = true">
        + New Repository
      </button>
    </div>

    <div v-if="loading" class="loading">Loading...</div>
    <div v-else-if="repositories.length === 0" class="empty">
      No repositories yet. Create one to get started.
    </div>
    <div v-else class="repo-list">
      <div v-for="repo in repositories" :key="repo.id" class="repo-card card">
        <div class="repo-header">
          <router-link :to="`/repositories/${repo.id}`" class="repo-name">
            {{ repo.name }}
          </router-link>
          <span class="repo-changes">{{ repo._count?.changes || 0 }} changes</span>
        </div>
        <p v-if="repo.description" class="repo-desc">{{ repo.description }}</p>
        <div class="repo-branches">
          <span class="branch-label">Branches:</span>
          <span v-for="branch in repo.branches" :key="branch.id" class="branch-tag">
            {{ branch.name }}
          </span>
        </div>
      </div>
    </div>

    <div v-if="showCreateModal" class="modal-overlay" @click="showCreateModal = false">
      <div class="modal" @click.stop>
        <h2>Create Repository</h2>
        <form @submit.prevent="handleCreate">
          <div class="form-group">
            <label class="label">Name</label>
            <input type="text" class="input" v-model="newRepo.name" required />
          </div>
          <div class="form-group">
            <label class="label">Description</label>
            <textarea class="textarea" v-model="newRepo.description"></textarea>
          </div>
          <div class="form-group">
            <label class="label">Branches (comma separated)</label>
            <input type="text" class="input" v-model="branchesInput" placeholder="main, develop" />
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="showCreateModal = false">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="creating">
              {{ creating ? 'Creating...' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { repositoryAPI, Repository } from '@/api';

const repositories = ref<Repository[]>([]);
const loading = ref(true);
const showCreateModal = ref(false);
const creating = ref(false);
const newRepo = ref({ name: '', description: '' });
const branchesInput = ref('main, develop');

const loadRepositories = async () => {
  loading.value = true;
  try {
    const { data } = await repositoryAPI.list();
    repositories.value = data.repositories;
  } finally {
    loading.value = false;
  }
};

const handleCreate = async () => {
  creating.value = true;
  try {
    const branches = branchesInput.value
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);

    await repositoryAPI.create({
      name: newRepo.value.name,
      description: newRepo.value.description,
      branches: branches.length > 0 ? branches : ['main'],
    });

    showCreateModal.value = false;
    newRepo.value = { name: '', description: '' };
    branchesInput.value = 'main, develop';
    await loadRepositories();
  } catch (e: any) {
    alert(e.response?.data?.error || 'Failed to create repository');
  } finally {
    creating.value = false;
  }
};

onMounted(() => {
  loadRepositories();
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

.repo-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.repo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.repo-name {
  font-size: 1.125rem;
  font-weight: 600;
}

.repo-changes {
  font-size: 0.875rem;
  color: #586069;
}

.repo-desc {
  color: #586069;
  margin-bottom: 0.75rem;
}

.repo-branches {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.branch-label {
  font-size: 0.875rem;
  color: #586069;
}

.branch-tag {
  background: #e1e4e8;
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal h2 {
  margin-bottom: 1.5rem;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}
</style>
