import { render, screen, within } from '@testing-library/react';
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
    'utility.trial.metadataTitle': 'Start 60 Day Trial · EduPlay',
    'utility.trial.heading': 'Maximize Engagement with Premium Features!',
    'utility.trial.subtitle': 'Get more with a premium EduPlay plan',
    'utility.trial.freePlan': 'Free Plan',
    'utility.trial.premiumPlan': 'Premium Plan',
    'utility.trial.recommended': 'Recommended',
    'utility.trial.activities': 'Activities in My Library',
    'utility.trial.classes': 'Classes',
    'utility.trial.classSingular': 'Class',
    'utility.trial.students': 'Students per Class',
    'utility.trial.teachers': 'Teachers per Class',
    'utility.trial.unlimited': 'Unlimited',
    'utility.trial.aiActivities': 'AI-Generated Activities',
    'utility.trial.multipage': 'Multipage Activities',
    'utility.trial.drafts': 'Activity Drafts and Send Back',
    'utility.trial.scheduled': 'Scheduled Activities',
    'utility.trial.aiAnnouncements': 'AI Generated Announcements',
    'utility.trial.noCard': 'No credit card required',
    'utility.trial.close': 'Close',
    'utility.trial.unavailableNote': 'Trial activation is not available in this demo.',
    'utility.trial.startUnavailable': 'Trial unavailable',
    'utility.trial.learnMoreUnavailable': 'Plan details unavailable',
  }[key] ?? key),
}));

import TeacherTrialPage from './page';

beforeEach(() => {
  redirectMock.mockClear();
  supabaseGetUserMock.mockReset();
  profileSingleMock.mockReset();
  supabase.from.mockClear();
});

describe('/teacher/trial', () => {
  it('redirects unauthenticated users to login', async () => {
    supabaseGetUserMock.mockResolvedValue({ data: { user: null } });

    await expect(TeacherTrialPage()).rejects.toThrowError(/NEXT_REDIRECT:\/login/);
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  it('renders the reference trial upsell comparison with i18n copy', async () => {
    supabaseGetUserMock.mockResolvedValue({ data: { user: { id: 'teacher-1' } } });
    profileSingleMock.mockResolvedValue({
      data: { id: 'teacher-1', role: 'teacher' },
    });

    render(await TeacherTrialPage());

    expect(screen.getByRole('heading', { name: 'Maximize Engagement with Premium Features!', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Get more with a premium EduPlay plan')).toBeInTheDocument();

    const freePlan = screen.getByRole('region', { name: 'Free Plan' });
    expect(within(freePlan).getAllByText('35')).toHaveLength(2);
    expect(within(freePlan).getByText('Activities in My Library')).toBeInTheDocument();
    expect(within(freePlan).getAllByText('1')).toHaveLength(2);
    expect(within(freePlan).getByText('Class')).toBeInTheDocument();

    const premiumPlan = screen.getByRole('region', { name: 'Premium Plan Recommended' });
    expect(within(premiumPlan).getAllByText('Unlimited')).toHaveLength(2);
    expect(within(premiumPlan).getByText('AI-Generated Activities')).toBeInTheDocument();
    expect(within(premiumPlan).getByText('AI Generated Announcements')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Trial unavailable' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Plan details unavailable' })).toHaveAttribute('href', '/');
    expect(screen.getByText(/Trial activation is not available in this demo\./)).toBeInTheDocument();
    expect(screen.getByText(/No credit card required/)).toBeInTheDocument();
  });
});
