import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const hashPassword = (password: string): string => {
  return bcrypt.hashSync(password, 10);
};

async function main() {
  console.log('Seeding database...');

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashPassword('admin123456'),
      name: 'Admin User',
      role: UserRole.ADMIN,
    },
  });
  console.log('Created admin user');

  const dev1 = await prisma.user.upsert({
    where: { username: 'dev1' },
    update: {},
    create: {
      username: 'dev1',
      password: hashPassword('dev123456'),
      name: 'Developer One',
      role: UserRole.USER,
    },
  });
  console.log('Created dev1 user');

  const reviewer1 = await prisma.user.upsert({
    where: { username: 'reviewer1' },
    update: {},
    create: {
      username: 'reviewer1',
      password: hashPassword('reviewer123456'),
      name: 'Reviewer One',
      role: UserRole.USER,
    },
  });
  console.log('Created reviewer1 user');

  const reviewer2 = await prisma.user.upsert({
    where: { username: 'reviewer2' },
    update: {},
    create: {
      username: 'reviewer2',
      password: hashPassword('reviewer123456'),
      name: 'Reviewer Two',
      role: UserRole.USER,
    },
  });
  console.log('Created reviewer2 user');

  const repo = await prisma.repository.upsert({
    where: { name: 'mini-gerrit' },
    update: {},
    create: {
      name: 'mini-gerrit',
      description: 'A lightweight code review system',
      branches: {
        create: [
          { name: 'main' },
          { name: 'develop' },
          { name: 'feature/new-ui' },
        ],
      },
    },
  });
  console.log('Created repository');

  const existingChange = await prisma.change.findFirst({
    where: { authorId: dev1.id, title: 'Implement user authentication module' },
  });

  if (!existingChange) {
    const diff1 = `diff --git a/src/auth/login.ts b/src/auth/login.ts
new file mode 100644
index 0000000..a1b2c3d
--- /dev/null
+++ b/src/auth/login.ts
@@ -0,0 +1,15 @@
+import { hashPassword, verifyPassword } from './utils';
+
+export async function login(username: string, password: string) {
+  const user = await findUserByUsername(username);
+  if (!user) {
+    throw new Error('User not found');
+  }
+  if (!verifyPassword(password, user.passwordHash)) {
+    throw new Error('Invalid credentials');
+  }
+  const token = generateJWT(user.id);
+  return { user, token };
+}
+
+export async function register(data: RegisterData) {
`;

    const diff2 = `diff --git a/src/auth/utils.ts b/src/auth/utils.ts
index abc1234..def5678 100644
--- a/src/auth/utils.ts
+++ b/src/auth/utils.ts
@@ -1,3 +1,8 @@
 export function generateId(): string {
   return Math.random().toString(36).substring(2, 15);
 }
+
+export function hashPassword(password: string): string {
+  // Use bcrypt with salt rounds
+  return bcrypt.hashSync(password, 10);
+}
`;

    const diff3 = `diff --git a/src/types/user.ts b/src/types/user.ts
index 1111111..2222222 100644
--- a/src/types/user.ts
+++ b/src/types/user.ts
@@ -1,5 +1,10 @@
 export interface User {
   id: string;
   username: string;
+  email: string;
+  passwordHash: string;
+  role: 'admin' | 'user';
   createdAt: Date;
 }
+
+export interface RegisterData {
+  username: string;
+  email: string;
+  password: string;
`;

    const change = await prisma.change.create({
      data: {
        title: 'Implement user authentication module',
        description: `## Overview
This change adds complete user authentication functionality including:

- User registration with password hashing
- Login with JWT token generation
- Password verification utilities
- User type definitions

## Changes
- Added \`login.ts\` for authentication endpoints
- Updated \`utils.ts\` with password helpers
- Extended \`user.ts\` type definitions

## Testing
All unit tests pass. Ready for review.`,
        repositoryId: repo.id,
        authorId: dev1.id,
        sourceBranch: 'feature/auth',
        targetBranch: 'develop',
        status: 'Open',
        patchsets: {
          create: {
            number: 1,
            message: 'Initial patchset with auth module',
            diffFiles: {
              create: [
                { filePath: 'src/auth/login.ts', diffText: diff1, status: 'added' },
                { filePath: 'src/auth/utils.ts', diffText: diff2, status: 'modified' },
                { filePath: 'src/types/user.ts', diffText: diff3, status: 'modified' },
              ],
            },
          },
        },
        reviewers: {
          create: [
            { userId: reviewer1.id },
            { userId: reviewer2.id },
          ],
        },
        checks: {
          create: [
            { name: 'lint', status: 'Passed', message: 'All checks passed', isRequired: true },
            { name: 'ci', status: 'Running', message: 'Running tests...', isRequired: true },
          ],
        },
      },
    });
    console.log('Created sample change');
  } else {
    console.log('Sample change already exists');
  }

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
