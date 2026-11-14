import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Artifact } from '../types';

vi.mock('../actions/approve-artifact-form', () => ({
  approveArtifactFromForm: vi.fn(),
}));
vi.mock('../actions/archive-artifact-form', () => ({
  archiveArtifactFromForm: vi.fn(),
}));
vi.mock('../actions/publish-artifact-form', () => ({
  publishArtifactFromForm: vi.fn(),
}));

import { TeacherPortfolioCard } from './TeacherPortfolioCard';

const baseArtifact: Artifact = {
  id: '11111111-1111-1111-1111-111111111111',
  studentId: '22222222-2222-2222-2222-222222222222',
  classId: '33333333-3333-3333-3333-333333333333',
  title: 'Desenul meu cu vulpe',
  artifactType: 'drawing',
  storagePath: 'students/22.../drawing.png',
  visibility: 'draft',
  reviewedBy: null,
  reviewedAt: null,
  metadata: {},
  createdAt: '2026-04-15T09:30:00.000Z',
  updatedAt: '2026-04-15T09:30:00.000Z',
};

describe('TeacherPortfolioCard', () => {
  it('renders the artifact title and student username', () => {
    render(
      <TeacherPortfolioCard
        artifact={baseArtifact}
        studentUsername="andrei.vulpe"
        className="Clasa 1A"
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Desenul meu cu vulpe' }),
    ).toBeInTheDocument();
    expect(screen.getByText('andrei.vulpe')).toBeInTheDocument();
    expect(screen.getByText('Clasa 1A')).toBeInTheDocument();
  });

  it('falls back to a placeholder title when the artifact has no title', () => {
    render(
      <TeacherPortfolioCard
        artifact={{ ...baseArtifact, title: null }}
        studentUsername="ana.lup"
        className="Clasa 1B"
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Lucrare fără titlu' }),
    ).toBeInTheDocument();
  });

  it('falls back to a generated student label when the username is unknown', () => {
    render(
      <TeacherPortfolioCard
        artifact={baseArtifact}
        studentUsername={null}
        className="Clasa 1A"
      />,
    );
    expect(
      screen.getByText(`Elev ${baseArtifact.studentId.slice(0, 8)}`),
    ).toBeInTheDocument();
  });

  it('omits the class pill when classId resolves to no class name', () => {
    render(
      <TeacherPortfolioCard
        artifact={{ ...baseArtifact, classId: null }}
        studentUsername="andrei.vulpe"
        className={null}
      />,
    );
    expect(screen.queryByText('Clasa 1A')).not.toBeInTheDocument();
  });

  it('renders approve, publish, and request-revision submit forms with the artifact id hidden', () => {
    const { container } = render(
      <TeacherPortfolioCard
        artifact={baseArtifact}
        studentUsername="andrei.vulpe"
        className="Clasa 1A"
      />,
    );

    const approveBtn = screen.getByRole('button', {
      name: /aprobă/i,
    });
    const publishBtn = screen.getByRole('button', { name: /publică pentru familie/i });
    const revisionBtn = screen.getByRole('button', { name: /cere refacere/i });

    expect(approveBtn).toHaveAttribute('type', 'submit');
    expect(publishBtn).toHaveAttribute('type', 'submit');
    expect(revisionBtn).toHaveAttribute('type', 'submit');

    const hiddenInputs = container.querySelectorAll(
      'input[type="hidden"][name="artifactId"]',
    );
    expect(hiddenInputs).toHaveLength(3);
    hiddenInputs.forEach((input) => {
      expect(input.getAttribute('value')).toBe(baseArtifact.id);
    });
  });

  it('hides review actions for artifacts that already left the review inbox', () => {
    render(
      <TeacherPortfolioCard
        artifact={{ ...baseArtifact, visibility: 'internal_teacher_only' }}
        studentUsername="andrei.vulpe"
        className="Clasa 1A"
        showVisibility
      />,
    );

    expect(screen.queryByRole('button', { name: /aprobă/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /publică pentru familie/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cere refacere/i })).not.toBeInTheDocument();
    expect(screen.getByText('Aprobat')).toBeInTheDocument();
  });

  it('uses the photo type label for photo artifacts', () => {
    render(
      <TeacherPortfolioCard
        artifact={{ ...baseArtifact, artifactType: 'photo' }}
        studentUsername="andrei.vulpe"
        className="Clasa 1A"
      />,
    );
    expect(screen.getByText('Fotografie')).toBeInTheDocument();
  });

  it('hides review forms when readOnly is true', () => {
    render(
      <TeacherPortfolioCard
        artifact={baseArtifact}
        studentUsername="andrei.vulpe"
        className="Clasa 1A"
        readOnly
      />,
    );
    expect(screen.queryByRole('button', { name: /aprobă/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /publică pentru familie/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cere refacere/i })).not.toBeInTheDocument();
  });

  it('renders an audio player when given an audio mediaUrl', () => {
    const { container } = render(
      <TeacherPortfolioCard
        artifact={{ ...baseArtifact, artifactType: 'audio' }}
        studentUsername="andrei.vulpe"
        className="Clasa 1A"
        mediaUrl="https://example.test/audio.webm"
        readOnly
      />,
    );
    const audio = container.querySelector('audio');
    expect(audio).not.toBeNull();
    expect(audio?.getAttribute('src')).toBe('https://example.test/audio.webm');
  });

  it('renders a video player when given a video mediaUrl', () => {
    const { container } = render(
      <TeacherPortfolioCard
        artifact={{ ...baseArtifact, artifactType: 'video' }}
        studentUsername="andrei.vulpe"
        className="Clasa 1A"
        mediaUrl="https://example.test/video.webm"
        readOnly
      />,
    );
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe('https://example.test/video.webm');
  });

  it('shows the visibility pill when showVisibility is true', () => {
    render(
      <TeacherPortfolioCard
        artifact={{ ...baseArtifact, visibility: 'family_visible' }}
        studentUsername="andrei.vulpe"
        className="Clasa 1A"
        showVisibility
      />,
    );
    expect(screen.getByText('Publicat pentru familie')).toBeInTheDocument();
  });

  it('surfaces activity context and score metadata in the review inbox card', () => {
    render(
      <TeacherPortfolioCard
        artifact={{
          ...baseArtifact,
          metadata: {
            activityTypeId: 'voice-recording',
            activityTitle: 'Înregistrare vocală',
            score: 87,
          },
        }}
        studentUsername="andrei.vulpe"
        className="Clasa 1A"
      />,
    );

    expect(screen.getByText('Răspuns activitate')).toBeInTheDocument();
    expect(screen.getByText('Înregistrare vocală')).toBeInTheDocument();
    expect(screen.getByText('Scor 87%')).toBeInTheDocument();
  });
});
