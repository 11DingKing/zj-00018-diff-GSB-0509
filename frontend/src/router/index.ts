import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/DashboardView.vue'),
      },
      {
        path: 'repositories',
        name: 'Repositories',
        component: () => import('@/views/RepositoriesView.vue'),
      },
      {
        path: 'repositories/:id',
        name: 'RepositoryDetail',
        component: () => import('@/views/RepositoryDetailView.vue'),
      },
      {
        path: 'changes',
        name: 'Changes',
        component: () => import('@/views/ChangesView.vue'),
      },
      {
        path: 'changes/new',
        name: 'NewChange',
        component: () => import('@/views/NewChangeView.vue'),
      },
      {
        path: 'changes/:id',
        name: 'ChangeDetail',
        component: () => import('@/views/ChangeDetailView.vue'),
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore();
  const isPublic = to.meta.public;

  if (!isPublic && !authStore.isAuthenticated) {
    next('/login');
    return;
  }

  if (isPublic && authStore.isAuthenticated) {
    next('/');
    return;
  }

  if (authStore.isAuthenticated && !authStore.user) {
    try {
      await authStore.fetchMe();
    } catch {
      authStore.logout();
      next('/login');
      return;
    }
  }

  next();
});

export default router;
