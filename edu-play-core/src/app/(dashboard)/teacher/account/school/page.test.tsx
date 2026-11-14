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
const classesOrderMock = vi.fn();

const profilesBuilder: Record<string, unknown> = {};
profilesBuilder.select = vi.fn(() => profilesBuilder);
profilesBuilder.eq = vi.fn(() => profilesBuilder);
profilesBuilder.single = () => profileSingleMock();

const classesBuilder: Record<string, unknown> = {};
classesBuilder.select = vi.fn(() => classesBuilder);
classesBuilder.eq = vi.fn(() => classesBuilder);
classesBuilder.order = () => classesOrderMock();

const supabase = {
  auth: { getUser: () => supabaseGetUserMock() },
  from: vi.fn((table: string) => {
    if (table === 'profiles') return profilesBuilder;
    if (table === 'classes') return classesBuilder;
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
    'account.school.metadataTitle': 'My School · EduPlay',
    'account.school.back': 'Back to teacher dashboard',
    'account.school.eyebrow': 'Teacher Account',
    'account.school.heading': 'My School',
    'account.school.currentSchool': 'Current School',
    'account.school.schoolName': 'School Name',
    'account.school.organization': 'Organization',
    'account.school.connectedClasses': 'Connected Classes',
    'account.school.findSchool': 'Find Your School',
    'account.school.country': 'Country',
    'account.school.state': 'State or Territory',
    'account.school.city': 'City',
    'account.school.loading': 'Loading...',
    'account.school.addSchool': 'Add School',
    'account.school.myClasses': 'My Classes',
    'account.school.active': 'Active',
    'account.school.inactive': 'Inactive',
    'account.school.empty': 'No connected classes yet.',
    'account.school.workspace': 'Workspace for {{name}} · {{summary}}',
    'account.school.classSummaryOne': '{{count}} active class',
    'account.school.classSummaryOther': '{{count}} active classes',
    'account.school.noSchoolConnected': 'No school connected',
    'account.school.findSchoolUnavailable': 'School search is unavailable',
  }[key] ?? key),
}));

import TeacherAccountSchoolPage from './page';

beforeEach(() => {
  redirectMock.mockClear();
  supabaseGetUserMock.mockReset();
  profileSingleMock.mockReset();
  classesOrderMock.mockReset();
  supabase.from.mockClear();
});

describe('/teacher/account/school', () => {
  it('redirects unauthenticated users to login', async () => {
    supabaseGetUserMock.mockResolvedValue({ data: { user: null } });

    await expect(TeacherAccountSchoolPage()).rejects.toThrowError(/NEXT_REDIRECT:\/login/);
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  it('renders the Seesaw add-school flow with i18n copy', async () => {
    supabaseGetUserMock.mockResolvedValue({ data: { user: { id: 'teacher-1', email: 'maria@example.test' } } });
    profileSingleMock.mockResolvedValue({ data: { id: 'teacher-1', role: 'teacher', full_name: 'Prof. Maria Ionescu' } });
    classesOrderMock.mockResolvedValue({
      data: [{ id: 'class-1', name: 'Bradiceni', grade_level: '1st Grade', school_year: '2026', is_active: true }],
    });

    render(await TeacherAccountSchoolPage());

    expect(screen.getByRole('heading', { name: 'My School' })).toBeInTheDocument();
    expect(screen.getAllByText('No school connected').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('School search is unavailable').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('1 active class')).toBeInTheDocument();
    expect(screen.queryByText('Prof. Maria Ionescu')).not.toBeInTheDocument();
    expect(screen.queryByText('Country')).not.toBeInTheDocument();
    expect(screen.queryByText('State or Territory')).not.toBeInTheDocument();
    expect(screen.queryByText('City')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add School' })).not.toBeInTheDocument();
    expect(screen.getByText('Bradiceni')).toBeInTheDocument();
  });
});
