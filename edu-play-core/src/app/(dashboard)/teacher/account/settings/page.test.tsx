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
    'account.tabs.settings': 'Account Settings',
    'account.tabs.settingsDescription': 'Profile and preferences',
    'account.tabs.school': 'My School',
    'account.tabs.schoolDescription': 'School directory and classes',
    'account.tabs.device': 'Device Information',
    'account.tabs.deviceDescription': 'Browser and diagnostics',
    'account.settings.metadataTitle': 'Account Settings · EduPlay',
    'account.settings.back': 'Back to teacher dashboard',
    'account.settings.eyebrow': 'Teacher Account',
    'account.settings.heading': 'Account Settings',
    'account.settings.profile': 'Profile',
    'account.settings.firstName': 'First Name:',
    'account.settings.lastName': 'Last Name:',
    'account.settings.displayName': 'Display Name:',
    'account.settings.email': 'Email',
    'account.settings.preferredLanguage': 'Preferred language:',
    'account.settings.phone': 'Phone:',
    'account.settings.password': 'Password',
    'account.settings.change': 'Change',
    'account.settings.manage': 'Manage',
    'account.settings.mfa': 'Multi-Factor Authentication',
    'account.settings.accountActivity': 'Account Activity Details',
    'account.settings.schools': 'Schools',
    'account.settings.schoolDirectory': 'School Directory',
    'account.settings.classes': 'Classes',
    'account.settings.currentClasses': 'Current Classes',
    'account.settings.addToClass': 'Add to Class',
    'account.settings.premiumHeading': 'EDUPLAY PREMIUM FEATURES',
    'account.settings.tryTrial': 'Try Free for 60 Days',
    'account.settings.previewPremium': 'Preview Premium Features',
    'account.settings.learnMore': 'Learn More',
    'account.settings.manageSubscription': 'Manage Subscription',
    'account.settings.notifications': 'Class notifications',
    'account.settings.officeHours': 'Office Hours',
    'account.settings.emailNotifications': 'Email Notifications',
    'account.settings.pushNotifications': 'Push Notifications',
    'account.settings.smsNotifications': 'SMS notifications',
    'account.settings.tips': 'Tips, tricks, and EduPlay updates',
    'account.settings.parentNotifications': 'Parent notifications',
    'account.settings.archives': 'Journal archives',
    'account.settings.downloadArchives': 'Download Journal Archives',
    'account.settings.archivedClasses': 'Archived Classes',
    'account.settings.manageArchived': 'Manage Archived Classes',
    'account.settings.privacy': 'Student Privacy Policy',
    'account.settings.coppa': 'COPPA Direct Notice',
    'account.settings.deleteAccount': 'Delete Account',
    'account.settings.teacherRole': 'Teacher',
    'account.settings.unavailable': 'Unavailable',
    'account.settings.noPhone': 'Not added',
    'account.settings.readOnly': 'Read only',
  }[key] ?? key),
}));

import TeacherAccountSettingsPage from './page';

beforeEach(() => {
  redirectMock.mockClear();
  supabaseGetUserMock.mockReset();
  profileSingleMock.mockReset();
  supabase.from.mockClear();
});

describe('/teacher/account/settings', () => {
  it('is exposed through teacher route constants', () => {
    expect(ROUTES.TEACHER.ACCOUNT_SETTINGS).toBe('/teacher/account/settings');
    expect(ROUTES.TEACHER.ACCOUNT_SCHOOL).toBe('/teacher/account/school');
    expect(ROUTES.TEACHER.ACCOUNT_DEVICE).toBe('/teacher/account/device');
  });

  it('redirects unauthenticated users to login', async () => {
    supabaseGetUserMock.mockResolvedValue({ data: { user: null } });

    await expect(TeacherAccountSettingsPage()).rejects.toThrowError(
      /NEXT_REDIRECT:\/login/,
    );
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  it('redirects non-teacher users to login', async () => {
    supabaseGetUserMock.mockResolvedValue({ data: { user: { id: 'parent-1' } } });
    profileSingleMock.mockResolvedValue({
      data: { id: 'parent-1', role: 'parent', full_name: 'Părinte', email: 'parent@example.test', avatar_url: null },
    });

    await expect(TeacherAccountSettingsPage()).rejects.toThrowError(
      /NEXT_REDIRECT:\/login/,
    );
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  it('renders EduPlay reference account settings with i18n copy', async () => {
    supabaseGetUserMock.mockResolvedValue({
      data: { user: { id: 'teacher-1', email: 'maria@example.test' } },
    });
    profileSingleMock.mockResolvedValue({
      data: {
        id: 'teacher-1',
        role: 'teacher',
        full_name: 'Prof. Maria Ionescu',
        email: 'maria@example.test',
        avatar_url: null,
      },
    });

    render(await TeacherAccountSettingsPage());

    expect(screen.getByRole('heading', { name: 'Account Settings' })).toBeInTheDocument();
    expect(screen.getAllByText('Prof. Maria Ionescu').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('maria@example.test')).toBeInTheDocument();
    expect(screen.getByText('Preferred language:')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Manage' })[0]).toHaveAttribute('href', '/teacher/language');
    expect(screen.getByText('Phone:')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone: Read only')).toHaveTextContent('Not added');
    expect(screen.getByText('Password')).toBeInTheDocument();
    expect(screen.getByText('Multi-Factor Authentication')).toBeInTheDocument();
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(5);
    expect(screen.getByText('Account Activity Details')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /School Directory/i })).toHaveAttribute('href', '/teacher/account/school');
    expect(screen.getByText('Current Classes')).toBeInTheDocument();
    expect(screen.getByText('EDUPLAY PREMIUM FEATURES')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Try Free for 60 Days/i })).toHaveAttribute('href', '/teacher/trial');
    expect(screen.queryByRole('button', { name: /Change|Manage|Save/i })).not.toBeInTheDocument();
    expect(screen.getByText('Class notifications')).toBeInTheDocument();
    expect(screen.getByText('Journal archives')).toBeInTheDocument();
    expect(screen.getByText('Delete Account')).toBeInTheDocument();
  });
});
