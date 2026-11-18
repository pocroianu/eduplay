import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}));

const supabaseGetUserMock = vi.fn();
const profileSingleMock = vi.fn();

const profilesBuilder: Record<string, unknown> = {};
profilesBuilder.select = vi.fn(() => profilesBuilder);
profilesBuilder.eq = vi.fn(() => profilesBuilder);
profilesBuilder.single = () => profileSingleMock();

const supabase = {
  auth: { getUser: () => supabaseGetUserMock() },
  from: vi.fn((table: string) => {
    if (table === 'profiles') return profilesBuilder;
    throw new Error(`unexpected table=${table}`);
  }),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve(supabase),
}));

vi.mock('@/lib/i18n/server', () => ({
  getServerLanguage: () => Promise.resolve('en'),
  getServerTranslation: (_lang: string, _namespace: string, key: string) => Promise.resolve({
    'utility.scan.metadataTitle': 'Scan QR Code · EduPlay',
    'utility.scan.heading': 'Scan QR Code',
    'utility.scan.permissionTitle': 'Camera Permission Denied',
    'utility.scan.permissionBody': 'Please grant camera access in your browser settings and try again.',
    'utility.scan.ok': 'OK',
    'utility.scan.backHome': 'Home',
  }[key] ?? key),
}));

import TeacherScanPage from './page';

beforeEach(() => {
  redirectMock.mockClear();
  supabaseGetUserMock.mockReset();
  profileSingleMock.mockReset();
  supabase.from.mockClear();
});

describe('/teacher/scan', () => {
  it('redirects unauthenticated users to login', async () => {
    supabaseGetUserMock.mockResolvedValue({ data: { user: null } });

    await expect(TeacherScanPage()).rejects.toThrowError(/NEXT_REDIRECT:\/login/);
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  it('renders the reference scan QR permission-denied modal with i18n copy', async () => {
    supabaseGetUserMock.mockResolvedValue({ data: { user: { id: 'teacher-1' } } });
    profileSingleMock.mockResolvedValue({
      data: { id: 'teacher-1', role: 'teacher' },
    });

    render(await TeacherScanPage());

    expect(screen.getByRole('heading', { name: 'Scan QR Code', level: 1 })).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Camera Permission Denied' })).toBeInTheDocument();
    expect(screen.getByText('Please grant camera access in your browser settings and try again.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'OK' })).not.toBeInTheDocument();
  });
});
