/**
 * Global test setup for Vitest
 * This file runs before each test file
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import i18next, { type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { afterEach, vi } from 'vitest';

// Bootstrap i18next with the real bundled namespace JSONs so components that
// call `useTranslation('player')` (or any other namespace) render translated
// strings in unit tests. Avoids per-test i18n mocking and keeps assertions
// matching the actual user-visible copy.
const localesRoot = path.resolve(__dirname, '..', 'public', 'locales');
const i18nResources: Record<string, Record<string, unknown>> = {};
try {
  for (const lang of readdirSync(localesRoot)) {
    const langDir = path.join(localesRoot, lang);
    const namespaces: Record<string, unknown> = {};
    for (const file of readdirSync(langDir)) {
      if (!file.endsWith('.json')) continue;
      const ns = file.replace(/\.json$/, '');
      const raw = readFileSync(path.join(langDir, file), 'utf8');
      namespaces[ns] = JSON.parse(raw);
    }
    i18nResources[lang] = namespaces;
  }
} catch {
  // public/locales may not exist in all checkouts — fall back to empty resources.
}

if (!i18next.isInitialized) {
  void i18next.use(initReactI18next).init({
    lng: 'ro',
    fallbackLng: 'ro',
    defaultNS: 'common',
    ns: Object.keys(i18nResources.ro ?? { common: {} }),
    resources: i18nResources as unknown as Resource,
    interpolation: { escapeValue: false },
    returnNull: false,
    returnEmptyString: false,
    react: { useSuspense: false },
  });
}

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Next.js router
vi.mock('next/navigation', async () => ({
  unstable_rethrow: (await vi.importActual<typeof import('next/navigation')>('next/navigation')).unstable_rethrow,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: vi.fn(),
}));

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => {
    return <a href={href} {...props}>{children}</a>;
  },
}));

// Mock Supabase client for unit tests
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    })),
  }),
}));

// Avoid vi.fn here because Vitest resets mocks between tests.
const matchMedia = (query: string): MediaQueryList =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: matchMedia,
});

Object.defineProperty(globalThis, 'matchMedia', {
  configurable: true,
  writable: true,
  value: matchMedia,
});

function createMockCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  return {
    canvas,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    arc: () => {},
    clearRect: () => {},
    fillRect: () => {},
    stroke: () => {},
    fill: () => {},
    save: () => {},
    restore: () => {},
    scale: () => {},
    setTransform: () => {},
    drawImage: () => {},
    measureText: () => ({ width: 0 }) as TextMetrics,
    createImageData: () => new ImageData(1, 1),
    getImageData: () => new ImageData(1, 1),
    putImageData: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }) as CanvasGradient,
    createRadialGradient: () => ({ addColorStop: () => {} }) as CanvasGradient,
    createPattern: () => null,
  } as unknown as CanvasRenderingContext2D;
}

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  writable: true,
  value(this: HTMLCanvasElement, contextId: string) {
    return contextId === '2d' ? createMockCanvasContext(this) : null;
  },
});

// Mock ResizeObserver for floating UI libraries without relying on resettable mocks.
class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  configurable: true,
  writable: true,
  value: TestResizeObserver,
});

Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  writable: true,
  value: TestResizeObserver,
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Suppress console.error for expected test failures
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    // Filter out expected React warnings
    const message = args[0]?.toString() || '';
    if (
      message.includes('Warning: ReactDOM.render is no longer supported') ||
      message.includes('Warning: An update to') ||
      message.includes('act(...)')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
