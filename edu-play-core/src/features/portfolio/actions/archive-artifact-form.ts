'use server';

import { archiveArtifact } from './archive-artifact';

/**
 * `<form action>` wrapper around `archiveArtifact`. See
 * `publish-artifact-form.ts` for rationale.
 */
export async function archiveArtifactFromForm(formData: FormData): Promise<void> {
  const id = formData.get('artifactId');
  if (typeof id !== 'string' || id.length === 0) return;
  await archiveArtifact({ id });
}
