'use client';

import { useState } from 'react';
import { ChunkyButton, ToastProvider } from '@/shared/components/ui/kit';
import {
  TeacherUploadModal,
  type TeacherUploadStudent,
} from './TeacherUploadModal';

export interface TeacherPortfolioUploadLauncherProps {
  classStudents: TeacherUploadStudent[];
}

export function TeacherPortfolioUploadLauncher({
  classStudents,
}: TeacherPortfolioUploadLauncherProps) {
  const [open, setOpen] = useState(false);

  return (
    <ToastProvider>
      <ChunkyButton
        type="button"
        variant="green"
        icon="PlusCircle"
        onClick={() => setOpen(true)}
      >
        Adaugă dovadă
      </ChunkyButton>
      {open ? (
        <TeacherUploadModal
          classStudents={classStudents}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </ToastProvider>
  );
}
