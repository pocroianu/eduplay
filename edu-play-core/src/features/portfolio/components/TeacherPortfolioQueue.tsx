'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Artifact } from '../types';
import { ChunkyButton } from '@/shared/components/ui/kit';
import { TeacherPortfolioCard } from './TeacherPortfolioCard';

interface ClassSummary {
  id: string;
  name: string;
}

interface StudentSummary {
  id: string;
  username: string;
}

interface PortfolioQueueFilters {
  classId?: string;
  studentId?: string;
  from?: string;
  to?: string;
}

interface PortfolioDraftsResponse {
  data: Artifact[] | null;
  error: { message: string } | null;
  meta?: {
    nextCursor?: string | null;
    mediaUrls?: Record<string, string | null>;
  };
}

const EMPTY_MEDIA_URLS: Record<string, string | null> = {};

export interface TeacherPortfolioQueueProps {
  initialArtifacts: Artifact[];
  initialNextCursor: string | null;
  initialMediaUrls?: Record<string, string | null>;
  filters: PortfolioQueueFilters;
  classes: ClassSummary[];
  students: StudentSummary[];
  pageSize: number;
}

export function TeacherPortfolioQueue({
  initialArtifacts,
  initialNextCursor,
  initialMediaUrls,
  filters,
  classes,
  students,
  pageSize,
}: TeacherPortfolioQueueProps) {
  const stableInitialMediaUrls = initialMediaUrls ?? EMPTY_MEDIA_URLS;
  const [artifacts, setArtifacts] = useState(initialArtifacts);
  const [mediaUrlsById, setMediaUrlsById] = useState(stableInitialMediaUrls);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setArtifacts(initialArtifacts);
    setMediaUrlsById(stableInitialMediaUrls);
    setNextCursor(initialNextCursor);
    setErrorMessage(null);
  }, [initialArtifacts, stableInitialMediaUrls, initialNextCursor]);

  const classNameById = useMemo(
    () => new Map(classes.map((classRow) => [classRow.id, classRow.name])),
    [classes],
  );
  const studentUsernameById = useMemo(
    () =>
      new Map(
        students.map((student) => [student.id, student.username] as const),
      ),
    [students],
  );

  const loadMore = async () => {
    if (!nextCursor || isLoadingMore) return;

    setIsLoadingMore(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams({
        cursor: nextCursor,
        limit: String(pageSize),
      });
      if (filters.classId) params.set('classId', filters.classId);
      if (filters.studentId) params.set('studentId', filters.studentId);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);

      const response = await fetch(
        `/api/v1/teacher/portfolio/drafts?${params.toString()}`,
      );
      const result = (await response.json()) as PortfolioDraftsResponse;
      if (!response.ok) {
        throw new Error(
          result.error?.message ?? 'Nu am putut încărca artefactele.',
        );
      }

      setArtifacts((current) => [...current, ...(result.data ?? [])]);
      setMediaUrlsById((current) => ({
        ...current,
        ...(result.meta?.mediaUrls ?? {}),
      }));
      setNextCursor(result.meta?.nextCursor ?? null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Nu am putut încărca artefactele.',
      );
    } finally {
      setIsLoadingMore(false);
    }
  };

  const showRecentHint = artifacts.length >= pageSize && !nextCursor;

  return (
    <div className="space-y-5">
      <ul
        aria-label="Lista răspunsurilor de revizuit"
        className="grid grid-cols-1 gap-4 lg:grid-cols-2"
      >
        {artifacts.map((artifact) => (
          <li key={artifact.id}>
            <TeacherPortfolioCard
              artifact={artifact}
              studentUsername={
                studentUsernameById.get(artifact.studentId) ?? null
              }
              className={
                artifact.classId
                  ? classNameById.get(artifact.classId) ?? null
                  : null
              }
              mediaUrl={mediaUrlsById[artifact.id] ?? null}
            />
          </li>
        ))}
      </ul>

      <div className="flex flex-col items-start gap-3">
        {nextCursor ? (
          <ChunkyButton
            type="button"
            variant="ghost"
            icon="CaretDown"
            disabled={isLoadingMore}
            onClick={() => {
              void loadMore();
            }}
          >
            {isLoadingMore ? 'Se încarcă...' : 'Încarcă mai multe'}
          </ChunkyButton>
        ) : null}

        {showRecentHint ? (
          <p className="text-sm font-semibold text-on-surface-muted">
            Se afișează cele mai recente artefacte.
          </p>
        ) : null}
        {errorMessage ? (
          <p role="alert" className="text-sm font-semibold text-error">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
