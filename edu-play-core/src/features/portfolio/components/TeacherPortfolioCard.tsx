import Image from 'next/image';
import { Button, Card, Pill } from '@/shared/components/ui/kit';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';
import { formatDate } from '@/lib/i18n/formatters';
import type { Artifact, ArtifactType } from '../types';
import { approveArtifactFromForm } from '../actions/approve-artifact-form';
import { archiveArtifactFromForm } from '../actions/archive-artifact-form';
import { publishArtifactFromForm } from '../actions/publish-artifact-form';

const ARTIFACT_TYPE_LABEL: Record<ArtifactType, string> = {
  drawing: 'Desen',
  photo: 'Fotografie',
  audio: 'Audio',
  video: 'Video',
  other: 'Alt artefact',
};

const ARTIFACT_TYPE_ICON: Record<ArtifactType, IconName> = {
  drawing: 'Palette',
  photo: 'Camera',
  audio: 'MusicNote',
  video: 'PlayCircle',
  other: 'Sparkle',
};

const CREATIVE_ACTIVITY_LABEL: Record<string, string> = {
  'drawing-canvas': 'Desen liber',
  'voice-recording': 'Înregistrare vocală',
};

const VISIBILITY_PILL: Record<
  Artifact['visibility'],
  { label: string; tone: 'lime' | 'cream' | 'sun' | 'coral'; icon: IconName }
> = {
  draft: { label: 'De revizuit', tone: 'sun', icon: 'PencilSimple' },
  internal_teacher_only: {
    label: 'Aprobat',
    tone: 'lime',
    icon: 'CheckCircle',
  },
  family_visible: { label: 'Publicat pentru familie', tone: 'lime', icon: 'Heart' },
  archived: { label: 'De refăcut', tone: 'coral', icon: 'ArrowCounterClockwise' },
};

export interface TeacherPortfolioCardProps {
  artifact: Artifact;
  /** Pre-resolved student username — falls back to id-suffix when unavailable. */
  studentUsername: string | null;
  /** Pre-resolved class name — omitted when the artifact has no class link. */
  className: string | null;
  /**
   * When true, hides review action forms. Used by read-only timelines where
   * teacher decisions are not available.
   */
  readOnly?: boolean;
  /**
   * Optional pre-signed media URL for the underlying storage object. When
   * provided, the card renders an inline preview (image / audio / video)
   * suited to the artifact type. Only the parent portfolio surface mints
   * URLs server-side today; the teacher review queue keeps the lightweight
   * card without media.
   */
  mediaUrl?: string | null;
  /**
   * When true, also surface the visibility status (e.g. "De revizuit",
   * "Aprobat"). Defaults to false to preserve the original compact
   * review-card layout.
   */
  showVisibility?: boolean;
}

export function TeacherPortfolioCard({
  artifact,
  studentUsername,
  className: classNameLabel,
  readOnly = false,
  mediaUrl = null,
  showVisibility = false,
}: TeacherPortfolioCardProps) {
  const typeLabel = ARTIFACT_TYPE_LABEL[artifact.artifactType];
  const typeIcon = ARTIFACT_TYPE_ICON[artifact.artifactType];
  const studentLabel =
    studentUsername ?? `Elev ${artifact.studentId.slice(0, 8)}`;
  const title = artifact.title?.trim() || 'Lucrare fără titlu';
  const visibilityPill = showVisibility
    ? VISIBILITY_PILL[artifact.visibility]
    : null;
  const headerStatusPill =
    visibilityPill ?? (artifact.visibility === 'draft' ? VISIBILITY_PILL.draft : null);
  const canApprove = artifact.visibility === 'draft';
  const activityContext = getActivityContext(artifact);

  return (
    <Card
      padding="none"
      shadow={false}
      className="overflow-hidden border border-outline-variant bg-surface-container-lowest"
    >
      <div className="flex flex-col gap-4 p-4 md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-deep">
              <Icon name={typeIcon} size={20} weight="bold" />
            </span>
            <div className="min-w-0">
              <h3 className="font-headline text-lg font-bold leading-tight text-on-surface">
                {title}
              </h3>
              <p className="mt-1 text-sm font-semibold text-on-surface-variant">
                {studentLabel}
              </p>
            </div>
          </div>
          {headerStatusPill ? (
            <Pill
              tone={headerStatusPill.tone}
              leading={<Icon name={headerStatusPill.icon} size="sm" weight="bold" />}
            >
              {headerStatusPill.label}
            </Pill>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Pill leading={<Icon name={typeIcon} size="sm" weight="bold" />}>
            {typeLabel}
          </Pill>
          {classNameLabel ? (
            <Pill
              tone="lime"
              leading={<Icon name="GraduationCap" size="sm" weight="bold" />}
            >
              {classNameLabel}
            </Pill>
          ) : null}
          <Pill
            tone="cream"
            leading={<Icon name="Calendar" size="sm" weight="bold" />}
          >
            {formatDate(artifact.createdAt)}
          </Pill>
        </div>

        {mediaUrl ? (
          <ArtifactMedia
            artifactType={artifact.artifactType}
            mediaUrl={mediaUrl}
            alt={title}
          />
        ) : null}

        {activityContext ? (
          <div className="rounded-md border border-outline-variant bg-surface-container p-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary-deep">
              Răspuns activitate
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Pill leading={<Icon name="ClipboardText" size="sm" weight="bold" />}>
                {activityContext.label}
              </Pill>
              {activityContext.scoreLabel ? (
                <Pill tone="lime" leading={<Icon name="CheckCircle" size="sm" weight="bold" />}>
                  {activityContext.scoreLabel}
                </Pill>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {readOnly ? null : (
        <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant bg-surface px-4 py-3 md:px-5">
          {canApprove ? (
            <form action={approveArtifactFromForm}>
              <input type="hidden" name="artifactId" value={artifact.id} />
              <Button
                type="submit"
                variant="primary"
                size="md"
                aria-label={`Aprobă lucrarea ${title}`}
              >
                <Icon name="CheckCircle" size={18} weight="bold" />
                Aprobă
              </Button>
            </form>
          ) : null}
          {artifact.visibility === 'draft' ? (
            <form action={publishArtifactFromForm}>
              <input type="hidden" name="artifactId" value={artifact.id} />
              <Button
                type="submit"
                variant="secondary"
                size="md"
                aria-label={`Publică pentru familie lucrarea ${title}`}
              >
                <Icon name="Heart" size={18} weight="bold" />
                Publică pentru familie
              </Button>
            </form>
          ) : null}
          {artifact.visibility === 'draft' ? (
            <form action={archiveArtifactFromForm}>
              <input type="hidden" name="artifactId" value={artifact.id} />
              <Button
                type="submit"
                variant="ghost"
                size="md"
                aria-label={`Cere refacere pentru lucrarea ${title}`}
              >
                <Icon name="ArrowCounterClockwise" size={18} weight="bold" />
                Cere refacere
              </Button>
            </form>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function getActivityContext(
  artifact: Artifact,
): { label: string; scoreLabel: string | null } | null {
  const metadata = artifact.metadata;
  const activityTypeId = readString(metadata.activityTypeId);
  const activityTitle = readString(metadata.activityTitle);
  const activityId = readString(metadata.activityId);
  const activityInstanceId = readString(metadata.activityInstanceId) ?? readString(metadata.sourceRef);
  const score = typeof metadata.score === 'number' ? metadata.score : null;

  const label = activityTitle
    ?? (activityTypeId ? CREATIVE_ACTIVITY_LABEL[activityTypeId] ?? activityTypeId : null)
    ?? (activityId ? 'Șablon interactiv' : null)
    ?? (activityInstanceId ? 'Activitate creativă' : null);

  if (!label) return null;

  return {
    label,
    scoreLabel: score === null ? null : `Scor ${score}%`,
  };
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function ArtifactMedia({
  artifactType,
  mediaUrl,
  alt,
}: {
  artifactType: ArtifactType;
  mediaUrl: string;
  alt: string;
}) {
  if (artifactType === 'photo' || artifactType === 'drawing') {
    return (
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-surface-container">
        <Image
          src={mediaUrl}
          alt={alt}
          fill
          unoptimized
          sizes="(min-width: 1024px) 480px, 100vw"
          className="object-cover"
        />
      </div>
    );
  }
  if (artifactType === 'audio') {
    return (
      <audio
        controls
        preload="metadata"
        src={mediaUrl}
        className="w-full"
        aria-label={alt}
      >
        Browserul tău nu acceptă redarea audio.
      </audio>
    );
  }
  if (artifactType === 'video') {
    return (
      <video
        controls
        preload="metadata"
        src={mediaUrl}
        className="aspect-video w-full rounded-md bg-on-surface"
        aria-label={alt}
      >
        Browserul tău nu acceptă redarea video.
      </video>
    );
  }
  return null;
}
