import { MantineProvider } from '@mantine/core';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@/../tests/test-utils';
import { AdminActivityEditor } from '@/features/admin';
import { ToastProvider } from '@/shared/components/ui/kit';
import type {
  ActivityRow,
  ActivityTypeRow,
  ActivityVersionRow,
} from '@/features/api/schemas/activity.schema';

const mockFetch = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh,
  }),
}));

function createActivity(overrides: Partial<ActivityRow> = {}): ActivityRow {
  return {
    id: 'activity-1',
    template: 'multiple-choice',
    title: 'Fracții distractive',
    description: 'Exerciții cu jumătăți',
    thumbnailUrl: null,
    defaultLang: 'ro',
    defaultTheme: null,
    category: 'math',
    difficulty: 'easy',
    targetAgeMin: 6,
    targetAgeMax: 8,
    estimatedDuration: 10,
    questionCount: 8,
    tags: [],
    subject: 'math',
    skills: [],
    isPublished: false,
    status: 'draft',
    configData: { question: 'Cât este jumătate din 4?', answerIndex: 0 },
    configSchemaVersion: 2,
    createdBy: 'admin-1',
    createdAt: '2026-05-08T00:00:00.000Z',
    updatedAt: '2026-05-08T00:00:00.000Z',
    ...overrides,
  };
}

const activityType: ActivityTypeRow = {
  typeId: 'multiple-choice',
  displayName: 'Alegere multiplă',
  category: 'math',
  configSchema: {},
  rendererKey: 'multiple-choice',
  rendererKind: 'iframe',
  authoringMode: 'admin-only',
  producesSubmission: false,
  supportsReview: false,
  isAutoScored: true,
  version: 2,
  createdAt: '2026-05-08T00:00:00.000Z',
  updatedAt: '2026-05-08T00:00:00.000Z',
};

function createVersion(
  overrides: Partial<ActivityVersionRow> = {},
): ActivityVersionRow {
  return {
    id: 'version-1',
    activityId: 'activity-1',
    versionNumber: 3,
    configData: { question: 'Întrebare publicată', answerIndex: 1 },
    configSchemaVersion: 2,
    activityTypeId: 'multiple-choice',
    publishedByUserId: 'admin-1',
    publishedAt: '2026-05-09T00:00:00.000Z',
    ...overrides,
  };
}

function renderEditor(
  activity: ActivityRow = createActivity(),
  versions: ActivityVersionRow[] = [createVersion()],
) {
  return render(
    <MantineProvider>
      <ToastProvider>
        <AdminActivityEditor
          activity={activity}
          activityType={activityType}
          initialVersions={versions}
        />
      </ToastProvider>
    </MantineProvider>,
  );
}

describe('AdminActivityEditor', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    refresh.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  it('requests a preview token for the current draft config and mounts the student preview iframe', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          previewId: 'preview-session-123',
          expiresAt: '2026-05-09T00:15:00.000Z',
        },
      }),
    });

    renderEditor();

    await user.click(screen.getByRole('button', { name: /previzualizează ca elev/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/activities/activity-1/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typeId: 'multiple-choice',
          configData: { question: 'Cât este jumătate din 4?', answerIndex: 0 },
        }),
      });
    });

    const frame = screen.getByTitle('Previzualizare elev') as HTMLIFrameElement;
    expect(frame).toHaveAttribute(
      'src',
      '/play/activity-1?previewId=preview-session-123',
    );
    expect(await screen.findByText(/previzualizarea expiră/i)).toBeInTheDocument();
  });

  it('renders the JSON draft editor as a Mantine textarea', () => {
    renderEditor();

    expect(screen.getByLabelText(/configurație json ciornă/i)).toHaveClass(
      'mantine-Textarea-input',
    );
  });

  it('publishes the draft through the publish endpoint and updates the status badge', async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: createActivity({
            configData: { question: 'Cât este jumătate din 4?', answerIndex: 0 },
          }),
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            activity: createActivity({ status: 'published', isPublished: true }),
            version: createVersion({ versionNumber: 4 }),
          },
        }),
      });

    renderEditor();
    expect(screen.getByText('Ciornă')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^publică$/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/v1/activities/activity-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configData: { question: 'Cât este jumătate din 4?', answerIndex: 0 },
        }),
      });
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/activities/activity-1/publish', {
        method: 'POST',
      });
    });
    expect(await screen.findByText('Activitate publicată')).toBeInTheDocument();
    const status = screen.getByText(/publicarea este gata/i).closest('[role="status"]');
    expect(status).not.toBeNull();
    expect(
      within(status as HTMLElement).queryByRole('img', { name: /Vulpița, vulpea EduPlay/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Publicat')).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it('persists edited JSON before publishing so the published snapshot matches the textarea', async () => {
    const user = userEvent.setup();
    const editedConfig = { question: 'Întrebare editată', answerIndex: 2 };
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: createActivity({ configData: editedConfig }),
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            activity: createActivity({
              status: 'published',
              isPublished: true,
              configData: editedConfig,
            }),
            version: createVersion({ versionNumber: 4, configData: editedConfig }),
          },
        }),
    });

    renderEditor();
    fireEvent.change(screen.getByLabelText(/configurație json ciornă/i), {
      target: { value: JSON.stringify(editedConfig) },
    });
    await user.click(screen.getByRole('button', { name: /^publică$/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/v1/activities/activity-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configData: editedConfig }),
      });
      expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/v1/activities/activity-1/publish', {
        method: 'POST',
      });
    });
  });

  it('keeps the textarea JSON from the edited draft when publish fails after save', async () => {
    const user = userEvent.setup();
    const editedConfig = {
      question: 'Întrebare editată',
      audio_url: '/audio/draft.mp3',
    };
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: createActivity({
            configData: {
              question: 'Întrebare editată',
              audioUrl: '/audio/draft.mp3',
            },
          }),
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: 'Nu am putut publica activitatea' },
        }),
      });

    renderEditor();
    fireEvent.change(screen.getByLabelText(/configurație json ciornă/i), {
      target: { value: JSON.stringify(editedConfig) },
    });
    await user.click(screen.getByRole('button', { name: /^publică$/i }));

    expect(await screen.findAllByText('Nu am putut publica activitatea')).toHaveLength(2);
    expect(screen.getByLabelText(/configurație json ciornă/i)).toHaveValue(
      JSON.stringify(editedConfig, null, 2),
    );
  });

  it('disables publish outside the draft lifecycle state', () => {
    renderEditor(createActivity({ status: 'archived', isPublished: false }));

    expect(screen.getByRole('button', { name: /^publică$/i })).toBeDisabled();
  });

  it('shows a plain validation alert without Vulpița when the JSON draft is invalid', async () => {
    const user = userEvent.setup();

    renderEditor();
    fireEvent.change(screen.getByLabelText(/configurație json ciornă/i), {
      target: { value: '{ invalid json' },
    });
    await user.click(screen.getByRole('button', { name: /previzualizează ca elev/i }));

    const alert = screen.getByText('Verifică configurația').closest('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(
      within(alert as HTMLElement).queryByRole('img', { name: /Vulpița, vulpea EduPlay/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Verifică configurația')).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('shows version history JSON and reverts a historical snapshot into a new draft', async () => {
    const user = userEvent.setup();
    const version = createVersion();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: createActivity({
          status: 'draft',
          isPublished: false,
          configData: version.configData,
        }),
      }),
    });

    renderEditor(
      createActivity({
        status: 'published',
        isPublished: true,
        configData: { question: 'Ciornă curentă', answerIndex: 0 },
      }),
      [version],
    );

    const history = screen.getByRole('region', { name: /istoric versiuni/i });
    expect(
      within(history).getByRole('heading', { name: /versiunea 3/i }),
    ).toBeInTheDocument();
    expect(within(history).getByText(/întrebare publicată/i)).toBeInTheDocument();

    await user.click(within(history).getByRole('button', { name: /revino la versiunea 3/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/activities/activity-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'draft',
          isPublished: false,
          revertVersionId: version.id,
          typeId: version.activityTypeId,
          configSchemaVersion: version.configSchemaVersion,
          configData: version.configData,
        }),
      });
    });
    expect(await screen.findByText('Versiune readusă ca ciornă')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Întrebare publicată/)).toBeInTheDocument();
    expect(screen.getByText('Ciornă')).toBeInTheDocument();
  });
});
