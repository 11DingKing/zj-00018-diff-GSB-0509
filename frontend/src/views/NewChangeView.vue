<template>
  <div class="new-change-view">
    <div class="view-header">
      <h1>Create New Change</h1>
      <button class="btn btn-secondary" @click="$router.back()">Cancel</button>
    </div>

    <div class="card">
      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label class="label">Repository</label>
          <select class="input" v-model="form.repositoryId" required>
            <option value="">Select a repository</option>
            <option v-for="repo in repositories" :key="repo.id" :value="repo.id">
              {{ repo.name }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label class="label">Title</label>
          <input type="text" class="input" v-model="form.title" required />
        </div>

        <div class="form-group">
          <label class="label">Description (Markdown)</label>
          <textarea class="textarea" v-model="form.description" rows="5"></textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="label">Source Branch</label>
            <select class="input" v-model="form.sourceBranch" required>
              <option value="">Select source branch</option>
              <option v-for="branch in selectedRepoBranches" :key="branch" :value="branch">
                {{ branch }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label class="label">Target Branch</label>
            <select class="input" v-model="form.targetBranch" required>
              <option value="">Select target branch</option>
              <option v-for="branch in selectedRepoBranches" :key="branch" :value="branch">
                {{ branch }}
              </option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="label">Reviewers</label>
          <div class="reviewer-select">
            <label v-for="user in users" :key="user.id" class="reviewer-option">
              <input type="checkbox" :value="user.id" v-model="form.reviewers" />
              {{ user.name }} ({{ user.username }})
            </label>
          </div>
        </div>

        <div class="form-group">
          <div class="diffs-header">
            <label class="label">Diff Files</label>
            <button type="button" class="btn btn-secondary" @click="addDiffFile">
              + Add File
            </button>
          </div>
          <div v-for="(diff, idx) in form.patchset.diffs" :key="idx" class="diff-input">
            <div class="diff-input-header">
              <input
                type="text"
                class="input"
                v-model="diff.filePath"
                placeholder="File path (e.g., src/file.ts)"
                required
              />
              <select class="input" v-model="diff.status" style="width: 120px">
                <option value="modified">modified</option>
                <option value="added">added</option>
                <option value="deleted">deleted</option>
                <option value="renamed">renamed</option>
              </select>
              <button type="button" class="btn btn-secondary" @click="removeDiffFile(idx)">
                Remove
              </button>
            </div>
            <textarea
              class="textarea"
              v-model="diff.diffText"
              rows="10"
              placeholder="Unified diff text (e.g., diff --git a/...)"
              required
            ></textarea>
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" :disabled="submitting">
            {{ submitting ? 'Creating...' : 'Create Change' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { changeAPI, repositoryAPI, authAPI, Repository, User } from '@/api';

const router = useRouter();

const repositories = ref<Repository[]>([]);
const users = ref<User[]>([]);
const submitting = ref(false);

const form = ref({
  repositoryId: '',
  title: '',
  description: '',
  sourceBranch: '',
  targetBranch: '',
  reviewers: [] as string[],
  patchset: {
    message: '',
    diffs: [
      {
        filePath: '',
        diffText: '',
        status: 'modified' as const,
      },
    ],
  },
});

const selectedRepoBranches = computed(() => {
  const repo = repositories.value.find((r) => r.id === form.value.repositoryId);
  return repo?.branches.map((b) => b.name) || [];
});

const addDiffFile = () => {
  form.value.patchset.diffs.push({
    filePath: '',
    diffText: '',
    status: 'modified',
  });
};

const removeDiffFile = (idx: number) => {
  if (form.value.patchset.diffs.length > 1) {
    form.value.patchset.diffs.splice(idx, 1);
  }
};

const handleSubmit = async () => {
  if (form.value.patchset.diffs.some((d) => !d.filePath || !d.diffText)) {
    alert('Please fill in all diff file fields');
    return;
  }

  submitting.value = true;
  try {
    const { data } = await changeAPI.create(form.value);
    router.push(`/changes/${data.change.id}`);
  } catch (e: any) {
    alert(e.response?.data?.error || 'Failed to create change');
  } finally {
    submitting.value = false;
  }
};

onMounted(async () => {
  const [reposRes, usersRes] = await Promise.all([
    repositoryAPI.list(),
    authAPI.list(),
  ]);
  repositories.value = reposRes.data.repositories;
  users.value = usersRes.data.users;
});
</script>

<style scoped>
.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.reviewer-select {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 0.5rem;
}

.reviewer-option {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
}

.diffs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.diff-input {
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  padding: 0.75rem;
  margin-bottom: 1rem;
}

.diff-input-header {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.diff-input-header .input:first-child {
  flex: 1;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1.5rem;
}
</style>
