/**
 * Test data fixtures for E2E tests
 * Contains reusable test data for various scenarios
 */

/**
 * Test teacher account
 * Note: These should match seeded data in your test database
 */
export const testTeacher = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'teacher@test.eduplay.ro',
  password: 'TestPassword123!',
  name: 'Profesor Test',
  role: 'teacher' as const,
};

/**
 * Test student account
 */
export const testStudent = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  username: 'e2e.child.a',
  pin: '1234',
  name: 'e2e.child.a',
  role: 'student' as const,
};

export const testParentChildren = [
  testStudent,
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    username: 'e2e.child.b',
    pin: '1234',
    name: 'e2e.child.b',
    role: 'student' as const,
  },
  {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    username: 'e2e.child.empty',
    pin: '1234',
    name: 'e2e.child.empty',
    role: 'student' as const,
  },
] as const;

/**
 * Test parent account
 */
export const testParent = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'parinte@test.eduplay.ro',
  password: 'ParentPass123!',
  name: 'Parinte Test',
  role: 'parent' as const,
};

/**
 * Test admin account
 */
export const testAdmin = {
  id: '99999999-9999-4999-8999-999999999999',
  email: 'admin@test.eduplay.ro',
  password: 'AdminPass123!',
  name: 'Admin Test',
  role: 'admin' as const,
};

/**
 * Invalid credentials for negative testing
 */
export const invalidCredentials = {
  email: 'invalid@test.ro',
  password: 'wrongpassword',
  username: 'nouser',
  pin: '0000',
};

/**
 * Test class data
 */
export const testClass = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Clasa Test 1A',
  gradeLevel: 'grade-1' as const,
  description: 'Clasa de test pentru E2E',
};

/**
 * Test game data
 */
export const testGame = {
  id: '44444444-4444-4444-8444-444444444444',
  name: 'Joc de Test',
  category: 'math' as const,
  minAge: 5,
  maxAge: 7,
};

/**
 * Form validation test cases
 */
export const validationTestCases = {
  login: {
    emptyEmail: {
      email: '',
      password: 'password123',
      expectedError: /email/i,
    },
    invalidEmail: {
      email: 'not-an-email',
      password: 'password123',
      expectedError: /email invalid/i,
    },
    shortPassword: {
      email: 'valid@email.ro',
      password: '123',
      expectedError: /cel puțin 6 caractere/i,
    },
  },
  studentLogin: {
    shortUsername: {
      username: 'ab',
      pin: '1234',
      expectedError: /cel puțin 3 caractere/i,
    },
    invalidPin: {
      username: 'validuser',
      pin: '123',
      expectedError: /4 cifre/i,
    },
    nonNumericPin: {
      username: 'validuser',
      pin: 'abcd',
      expectedError: /doar cifre/i,
    },
  },
};

/**
 * Routes for navigation testing
 */
export const testRoutes = {
  login: '/login',
  register: '/register',
  teacherDashboard: '/teacher',
  teacherClasses: '/teacher/classes',
  teacherStudents: '/teacher/students',
  teacherGames: '/teacher/games',
  teacherAssignments: '/teacher/assignments',
  teacherAssignmentNew: '/teacher/assignments/new',
  studentDashboard: '/student',
  studentGames: '/student/games',
  parentDashboard: '/parent',
  parentNotifications: '/parent/notifications',
};

/**
 * Timeouts for various operations
 */
export const timeouts = {
  navigation: 10000,
  animation: 500,
  toast: 5000,
  apiCall: 15000,
};
