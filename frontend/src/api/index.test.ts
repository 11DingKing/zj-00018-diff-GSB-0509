import { describe, it, expect, vi } from 'vitest';

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));

describe('API module', () => {
  it('should import without errors', async () => {
    const module = await import('@/api');
    expect(module).toBeDefined();
    expect(module.changeAPI).toBeDefined();
    expect(module.repositoryAPI).toBeDefined();
    expect(module.authAPI).toBeDefined();
    expect(module.patchsetAPI).toBeDefined();
    expect(module.commentAPI).toBeDefined();
    expect(module.notificationAPI).toBeDefined();
    expect(module.default).toBeDefined();
  });
});
