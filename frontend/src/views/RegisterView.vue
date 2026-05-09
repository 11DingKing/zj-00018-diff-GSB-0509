<template>
  <div class="auth-container">
    <div class="auth-card">
      <h1>Mini Gerrit</h1>
      <h2>Register</h2>
      <form @submit.prevent="handleRegister">
        <div class="form-group">
          <label class="label">Name</label>
          <input type="text" class="input" v-model="name" required />
        </div>
        <div class="form-group">
          <label class="label">Username</label>
          <input type="text" class="input" v-model="username" required />
        </div>
        <div class="form-group">
          <label class="label">Password</label>
          <input type="password" class="input" v-model="password" required />
        </div>
        <div v-if="error" class="error">{{ error }}</div>
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Loading...' : 'Register' }}
        </button>
      </form>
      <p class="auth-link">
        Already have an account? <router-link to="/login">Login</router-link>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const router = useRouter();

const name = ref('');
const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

const handleRegister = async () => {
  error.value = '';
  loading.value = true;
  try {
    await authStore.register(username.value, password.value, name.value);
    router.push('/');
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Registration failed';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.auth-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 1rem;
}

.auth-card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.auth-card h1 {
  text-align: center;
  color: #24292e;
  margin-bottom: 0.5rem;
}

.auth-card h2 {
  text-align: center;
  color: #586069;
  font-size: 1.25rem;
  margin-bottom: 1.5rem;
  font-weight: normal;
}

.auth-card .btn {
  width: 100%;
  justify-content: center;
}

.error {
  color: #d73a49;
  font-size: 0.875rem;
  margin-bottom: 1rem;
  padding: 0.5rem;
  background: #ffeef0;
  border-radius: 4px;
}

.auth-link {
  text-align: center;
  margin-top: 1rem;
  font-size: 0.875rem;
  color: #586069;
}
</style>
