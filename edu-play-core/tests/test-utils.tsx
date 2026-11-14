/**
 * Test utilities for EduPlay
 * Provides common test helpers and custom render functions
 */
import React from 'react';
import { render as rtlRender, RenderOptions, RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Custom render function that includes all necessary providers
 */
function render(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  const user = userEvent.setup();
  const renderResult = rtlRender(ui, options);

  return {
    ...renderResult,
    user,
  };
}

/**
 * Create a mock FormData from an object
 */
function createFormData(data: Record<string, string | boolean>): FormData {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, String(value));
  });
  return formData;
}

/**
 * Wait for a specific amount of time
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock Supabase auth response
 */
interface MockAuthUser {
  id: string;
  email: string;
  role: 'teacher' | 'student' | 'parent' | 'admin';
}

function createMockAuthUser(overrides: Partial<MockAuthUser> = {}): MockAuthUser {
  return {
    id: 'mock-user-id',
    email: 'test@example.com',
    role: 'teacher',
    ...overrides,
  };
}

/**
 * Mock profile data
 */
interface MockProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'teacher' | 'student' | 'parent' | 'admin';
  avatar_url?: string;
}

function createMockProfile(overrides: Partial<MockProfile> = {}): MockProfile {
  return {
    id: 'mock-user-id',
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'teacher',
    ...overrides,
  };
}

/**
 * Mock student data
 */
interface MockStudent {
  id: string;
  username: string;
  display_name: string;
  class_id: string;
  pin_hash: string;
}

function createMockStudent(overrides: Partial<MockStudent> = {}): MockStudent {
  return {
    id: 'mock-student-id',
    username: 'elev.test',
    display_name: 'Elev Test',
    class_id: 'mock-class-id',
    pin_hash: 'hashed-pin',
    ...overrides,
  };
}

/**
 * Mock class data
 */
interface MockClass {
  id: string;
  name: string;
  grade_level: string;
  teacher_id: string;
  school_year: string;
}

function createMockClass(overrides: Partial<MockClass> = {}): MockClass {
  return {
    id: 'mock-class-id',
    name: 'Clasa 1A',
    grade_level: 'grade-1',
    teacher_id: 'mock-teacher-id',
    school_year: '2024-2025',
    ...overrides,
  };
}

/**
 * Mock game data
 */
interface MockGame {
  id: string;
  name: string;
  slug: string;
  category: string;
  min_age: number;
  max_age: number;
  thumbnail_url: string;
  game_url: string;
}

function createMockGame(overrides: Partial<MockGame> = {}): MockGame {
  return {
    id: 'mock-game-id',
    name: 'Numaram Impreuna',
    slug: 'counting-game',
    category: 'math',
    min_age: 5,
    max_age: 7,
    thumbnail_url: '/games/counting/thumbnail.png',
    game_url: '/games/counting/index.html',
    ...overrides,
  };
}

// Re-export everything from testing library
export * from '@testing-library/react';
export { userEvent };

// Export custom utilities
export {
  render,
  createFormData,
  wait,
  createMockAuthUser,
  createMockProfile,
  createMockStudent,
  createMockClass,
  createMockGame,
};

// Export types
export type { MockAuthUser, MockProfile, MockStudent, MockClass, MockGame };
