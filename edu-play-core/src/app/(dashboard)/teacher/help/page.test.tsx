import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '@/shared/lib/constants/routes';

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
    'utility.help.metadataTitle': 'Help · EduPlay',
    'utility.help.heading': 'Help',
    'utility.help.subtitle': 'Teacher Resources',
    'utility.help.resourcesTitle': 'Teacher Resources',
    'utility.help.viewAll': 'View All',
    'utility.help.spotlight.title': 'Seesaw Spotlight',
    'utility.help.spotlight.type': 'Video',
    'utility.help.learningCentral.title': 'Learning Central',
    'utility.help.learningCentral.type': 'Website',
    'utility.help.timelyTopics.title': 'Timely Topics',
    'utility.help.timelyTopics.type': 'Website',
    'utility.help.community.title': 'Community and Events',
    'utility.help.community.type': 'Website',
    'utility.help.colorPicker.title': 'Color Picker',
    'utility.help.colorPicker.description': 'Grab colors from the canvas when creating activities',
    'utility.help.ready.title': 'Ready-to-teach activities for June',
    'utility.help.ready.description': 'Activities for skill development and holidays',
    'utility.help.whatsNew': "What's New",
    'utility.help.whatsNewCount': '1',
    'utility.help.contactSupport': 'Contact Support',
    'utility.help.helpCenter': 'Help Center',
    'utility.help.privacyPolicy': 'Privacy Policy',
    'utility.help.scanQr': 'Scan',
    'utility.help.backToDashboard': 'Home',
    'shell.sidebar.languageSettings': 'Language Settings',
    'shell.sidebar.accountSettings': 'Account Settings',
    'shell.sidebar.mySchool': 'My School',
    'shell.sidebar.deviceInformation': 'Device Information',
    'shell.sidebar.trial': 'Seesaw Plus',
  }[key] ?? key),
}));


import TeacherHelpPage from './page';

beforeEach(() => {
  redirectMock.mockClear();
  supabaseGetUserMock.mockReset();
  profileSingleMock.mockReset();
  supabase.from.mockClear();
});

describe('/teacher/help', () => {
  it('is exposed through teacher route constants', () => {
    expect(ROUTES.TEACHER.HELP).toBe('/teacher/help');
    expect(ROUTES.TEACHER.SCAN).toBe('/teacher/scan');
    expect(ROUTES.TEACHER.TRIAL).toBe('/teacher/trial');
    expect(ROUTES.TEACHER.LANGUAGE).toBe('/teacher/language');
  });

  it('redirects unauthenticated users to login', async () => {
    supabaseGetUserMock.mockResolvedValue({ data: { user: null } });

    await expect(TeacherHelpPage()).rejects.toThrowError(/NEXT_REDIRECT:\/login/);
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  it('renders the reference help menu with i18n copy', async () => {
    supabaseGetUserMock.mockResolvedValue({ data: { user: { id: 'teacher-1' } } });
    profileSingleMock.mockResolvedValue({
      data: { id: 'teacher-1', role: 'teacher' },
    });

    render(await TeacherHelpPage());

    expect(screen.getByRole('heading', { name: 'Help', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Teacher Resources')).toBeInTheDocument();
    expect(screen.getByText("What's New")).toBeInTheDocument();
    expect(screen.getByText('Contact Support')).toBeInTheDocument();
    expect(screen.getByText('Help Center')).toBeInTheDocument();
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Scan/i })).toHaveAttribute('href', '/teacher/scan');
    expect(screen.queryByRole('button', { name: /What's New/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact Support' })).toHaveAttribute('href', 'mailto:support@eduplay.ro');
    expect(screen.getByRole('link', { name: 'Help Center' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /Language Settings/i })).toHaveAttribute('href', '/teacher/language');
    expect(screen.getByRole('link', { name: /Account Settings/i })).toHaveAttribute('href', '/teacher/account/settings');
  });
});
