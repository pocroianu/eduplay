import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { ToastProvider } from '@/shared/components/ui/kit';
import { TeacherUploadModal } from './TeacherUploadModal';
import { teacherUploadArtifact } from '../actions/teacher-upload-artifact';
import { MAX_PHOTO_BYTES } from '../schemas';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('../actions/teacher-upload-artifact', () => ({
  teacherUploadArtifact: vi.fn(),
}));

vi.mock('@/features/activities/client', () => ({
  VoiceRecorderCapture: ({
    onTakeReady,
  }: {
    onTakeReady: (take: {
      blob: Uint8Array;
      mime: 'audio/webm';
      durationMs: number;
    }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onTakeReady({
          blob: new Uint8Array([1, 2, 3]),
          mime: 'audio/webm',
          durationMs: 1200,
        })
      }
    >
      Folosește înregistrarea test
    </button>
  ),
}));

const uploadMock = vi.mocked(teacherUploadArtifact);

const classStudents = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    firstName: 'Ana',
    lastName: 'Pop',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    firstName: 'Mihai',
    lastName: 'Stan',
  },
];

function renderModal(
  props?: Partial<React.ComponentProps<typeof TeacherUploadModal>>,
) {
  return render(
    <MantineProvider>
      <ToastProvider defaultDuration={0}>
        <TeacherUploadModal
          classStudents={classStudents}
          onClose={vi.fn()}
          {...props}
        />
      </ToastProvider>
    </MantineProvider>,
  );
}

beforeEach(() => {
  uploadMock.mockReset();
});

describe('<TeacherUploadModal />', () => {
  it('renders photo and voice-note tabs', async () => {
    const user = userEvent.setup();
    renderModal();

    expect(screen.getByRole('button', { name: /fotografie/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByRole('button', { name: /notă vocală/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /notă vocală/i }));

    expect(
      screen.getByRole('button', { name: /folosește înregistrarea test/i }),
    ).toBeInTheDocument();
  });

  it('renders owned form fields as Mantine controls', () => {
    renderModal();

    const closeButtons = screen.getAllByRole('button', { name: 'Închide' });
    expect(closeButtons.some((button) => button.classList.contains('mantine-CloseButton-root'))).toBe(
      true,
    );
    expect(screen.getByRole('button', { name: /trage fotografia aici/i })).toHaveClass(
      'mantine-UnstyledButton-root',
    );
    expect(screen.getByLabelText(/alege fotografia/i)).toHaveAttribute(
      'accept',
      'image/jpeg,image/webp',
    );
    expect(screen.getByLabelText(/alege elevul/i)).toHaveClass(
      'mantine-Select-input',
    );
    expect(screen.getByLabelText(/titlu opțional/i)).toHaveClass(
      'mantine-TextInput-input',
    );
  });

  it('blocks submit until a student is selected when no preset is provided', async () => {
    const user = userEvent.setup();
    renderModal();

    const file = new File([new Uint8Array([255, 216, 255])], 'poza.jpg', {
      type: 'image/jpeg',
    });
    await user.upload(screen.getByLabelText(/alege fotografia/i), file);
    await user.click(screen.getByRole('button', { name: /adaugă dovada/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/alege elevul/i);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('surfaces the server-action error in an alert', async () => {
    const user = userEvent.setup();
    uploadMock.mockResolvedValue({
      success: false,
      error: 'Fotografia este prea mare.',
    });
    renderModal({ presetStudentId: classStudents[0].id });

    const file = new File([new Uint8Array([255, 216, 255])], 'poza.jpg', {
      type: 'image/jpeg',
    });
    await user.upload(screen.getByLabelText(/alege fotografia/i), file);
    await user.click(screen.getByRole('button', { name: /adaugă dovada/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Fotografia este prea mare.',
    );
  });

  it('clears the selected photo when a replacement has an unsupported type', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderModal({ presetStudentId: classStudents[0].id });

    const validPhoto = new File(
      [new Uint8Array([255, 216, 255])],
      'poza.jpg',
      {
        type: 'image/jpeg',
      },
    );
    const invalidPhoto = new File([new Uint8Array([1, 2, 3])], 'poza.png', {
      type: 'image/png',
    });

    const input = screen.getByLabelText(/alege fotografia/i);
    await user.upload(input, validPhoto);
    await user.upload(input, invalidPhoto);
    await user.click(screen.getByRole('button', { name: /adaugă dovada/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /alege o fotografie înainte/i,
    );
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('rejects oversized photos before calling the server action', async () => {
    const user = userEvent.setup();
    renderModal({ presetStudentId: classStudents[0].id });

    const oversizedPhoto = new File(
      [new Uint8Array(MAX_PHOTO_BYTES + 1)],
      'poza-mare.jpg',
      {
        type: 'image/jpeg',
      },
    );

    await user.upload(screen.getByLabelText(/alege fotografia/i), oversizedPhoto);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /fotografia poate avea cel mult 8 mb/i,
    );

    await user.click(screen.getByRole('button', { name: /adaugă dovada/i }));

    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('submits a captured voice note through teacherUploadArtifact', async () => {
    const user = userEvent.setup();
    uploadMock.mockResolvedValue({
      success: true,
      data: { artifactId: '33333333-3333-4333-8333-333333333333' },
    });
    renderModal({ presetStudentId: classStudents[0].id });

    await user.click(screen.getByRole('button', { name: /notă vocală/i }));
    await user.click(
      screen.getByRole('button', { name: /folosește înregistrarea test/i }),
    );
    await user.type(screen.getByLabelText(/titlu opțional/i), 'Povestea Anei');
    await user.click(screen.getByRole('button', { name: /adaugă dovada/i }));

    await waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(1));
    expect(uploadMock).toHaveBeenCalledWith({
      kind: 'audio',
      studentId: classStudents[0].id,
      title: 'Povestea Anei',
      payload: {
        blob: new Uint8Array([1, 2, 3]),
        mime: 'audio/webm',
      },
    });
  });

  it('clears a captured voice note when the audio tab remounts', async () => {
    const user = userEvent.setup();
    renderModal({ presetStudentId: classStudents[0].id });

    await user.click(screen.getByRole('button', { name: /notă vocală/i }));
    await user.click(
      screen.getByRole('button', { name: /folosește înregistrarea test/i }),
    );
    await user.click(screen.getByRole('button', { name: /fotografie/i }));
    await user.click(screen.getByRole('button', { name: /notă vocală/i }));
    await user.click(screen.getByRole('button', { name: /adaugă dovada/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /înregistrează o notă vocală/i,
    );
    expect(uploadMock).not.toHaveBeenCalled();
  });
});
