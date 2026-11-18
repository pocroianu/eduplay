import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const redirectError = (path: string) => {
  const err = new Error(`NEXT_REDIRECT:${path}`)
  ;(err as Error & { __redirect__: string }).__redirect__ = path
  return err
}

const redirectMock = vi.fn((path: string) => {
  throw redirectError(path)
})
const createClientMock = vi.fn()

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createClientMock(),
}))
vi.mock('@/lib/i18n/server', () => ({
  getServerLanguage: () => Promise.resolve('en'),
  getServerTranslation: (_lang: string, _namespace: string, key: string) => Promise.resolve({
    'generateActivity.metadataTitle': 'Generate Activity · EduPlay',
    'generateActivity.back': 'Back to create activity',
    'generateActivity.heading': 'Generate Activity',
    'generateActivity.aiBadge': 'AI',
    'generateActivity.trialNotice': "You're getting a sneak peek at these features. Start a free trial to get full access.",
    'generateActivity.startTrial': 'Start Free Trial',
    'generateActivity.convert.title': 'Convert Resource',
    'generateActivity.convert.description': 'Upload any teaching resource',
    'generateActivity.topic.title': 'Topic or Prompt',
    'generateActivity.topic.description': 'Enter a topic, learning goal or standard',
    'generateActivity.youtube.title': 'YouTube Video',
    'generateActivity.youtube.description': 'Embed a video and generate questions',
    'generateActivity.fluency.title': 'Reading Fluency',
    'generateActivity.fluency.description': 'Students read and AI grades reading fluency',
    'generateActivity.instructions': 'Turn an existing resource into an interactive EduPlay activity with auto-graded assessments and multimedia tools.',
    'generateActivity.worksheet': 'Worksheet',
    'generateActivity.quiz': 'Quiz',
    'generateActivity.studyGuide': 'Study Guide',
    'generateActivity.activity': 'Activity',
    'generateActivity.uploadHint': '5 PDFs or 10 Images. Supported formats: pdf, jpg, png, heic.',
    'generateActivity.upload': 'Upload',
    'generateActivity.googleDrive': 'Google Drive',
    'generateActivity.next': 'Next',
  }[key] ?? key),
}));

function makeSupabase({ role = 'teacher', user = { id: 'teacher-1' } }: { role?: string | null; user?: { id: string } | null } = {}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: role ? { role } : null }),
    })),
  }
}

import GenerateActivityPage from './page'

beforeEach(() => {
  vi.clearAllMocks()
  createClientMock.mockReturnValue(makeSupabase())
})

describe('/teacher/activities/generate page', () => {
  it('renders the protected EduPlay generate activity reference surface', async () => {
    const ui = await GenerateActivityPage()
    render(ui)

    expect(screen.getByRole('heading', { level: 1, name: 'Generate Activity' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to create activity/i })).toHaveAttribute(
      'href',
      '/teacher/activities/create',
    )
    expect(screen.getByText("You're getting a sneak peek at these features. Start a free trial to get full access.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start Free Trial' })).toHaveAttribute('href', '/teacher/trial')

    expect(screen.getByText('Convert Resource')).toBeInTheDocument()
    expect(screen.getByText('Topic or Prompt')).toBeInTheDocument()
    expect(screen.getByText('YouTube Video')).toBeInTheDocument()
    expect(screen.getByText('Reading Fluency')).toBeInTheDocument()
    expect(screen.getByText('Turn an existing resource into an interactive EduPlay activity with auto-graded assessments and multimedia tools.')).toBeInTheDocument()

    expect(screen.getByText('Worksheet')).toBeInTheDocument()
    expect(screen.getByText('Quiz')).toBeInTheDocument()
    expect(screen.getByText('Study Guide')).toBeInTheDocument()
    expect(screen.getByText('Activity')).toBeInTheDocument()
    expect(screen.getByText('5 PDFs or 10 Images. Supported formats: pdf, jpg, png, heic.')).toBeInTheDocument()
    expect(screen.getByText('Încărcarea nu este disponibilă încă.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Next$/ })).not.toBeInTheDocument()
  })

  it('redirects signed-out visitors to login', async () => {
    createClientMock.mockReturnValue(makeSupabase({ user: null }))

    await expect(GenerateActivityPage()).rejects.toMatchObject({ __redirect__: '/login' })
  })

  it('redirects non-teacher visitors to login', async () => {
    createClientMock.mockReturnValue(makeSupabase({ role: 'student' }))

    await expect(GenerateActivityPage()).rejects.toMatchObject({ __redirect__: '/login' })
  })
})
