'use client';

import { useMemo } from 'react';
import { createActivityPlaySession } from './activity-play-session';

export function useActivityPlaySession(context: {
  studentId?: string; activityId?: string; versionId?: string; assignmentId?: string;
}, run = 0) {
  const { studentId, activityId, versionId, assignmentId } = context;
  return useMemo(() => {
    // A new run deliberately gets an independent lifecycle and save cursor.
    void run;
    return createActivityPlaySession({
      save: studentId && activityId ? async (write) => {
        const response = await fetch('/api/v1/progress', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(15_000),
          body: JSON.stringify({ ...write, studentId, activityId, versionId, assignmentId }),
        });
        if (!response.ok) throw new Error('Progress save failed');
      } : undefined,
    });
  }, [studentId, activityId, versionId, assignmentId, run]);
}
