import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}));

vi.mock('next/headers', () => ({
  headers: () => Promise.resolve({
    get: (name: string) => name === 'user-agent'
      ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36'
      : null,
  }),
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
    'account.tabs.settings': 'Account Settings',
    'account.tabs.settingsDescription': 'Profile and preferences',
    'account.tabs.school': 'My School',
    'account.tabs.schoolDescription': 'School directory and classes',
    'account.tabs.device': 'Device Information',
    'account.tabs.deviceDescription': 'Browser and diagnostics',
    'account.device.metadataTitle': 'Device Information · EduPlay',
    'account.device.back': 'Back to teacher dashboard',
    'account.device.eyebrow': 'Teacher Account',
    'account.device.heading': 'Device Information',
    'account.device.browserLine': 'You are using {{browser}} {{version}}.',
    'account.device.copy': 'Copy to Clipboard',
  }[key] ?? key),
}));

import TeacherAccountDevicePage from './page';

beforeEach(() => {
  redirectMock.mockClear();
  supabaseGetUserMock.mockReset();
  profileSingleMock.mockReset();
  supabase.from.mockClear();
});

describe('/teacher/account/device', () => {
  it('redirects unauthenticated users to login', async () => {
    supabaseGetUserMock.mockResolvedValue({ data: { user: null } });

    await expect(TeacherAccountDevicePage()).rejects.toThrowError(/NEXT_REDIRECT:\/login/);
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  it('renders the EduPlay device information modal with i18n copy', async () => {
    supabaseGetUserMock.mockResolvedValue({ data: { user: { id: 'teacher-1' } } });
    profileSingleMock.mockResolvedValue({ data: { id: 'teacher-1', role: 'teacher' } });

    render(await TeacherAccountDevicePage());

    expect(screen.getAllByRole('heading', { name: 'Device Information' })).toHaveLength(2);
    expect(screen.getByText('You are using Chrome 147.')).toBeInTheDocument();
    expect(screen.getByText(/Chrome\/147\.0\.0\.0/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy to Clipboard' })).toBeEnabled();
  });
});
