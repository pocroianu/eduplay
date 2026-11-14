'use server';

import { approveArtifact } from './approve-artifact';

/**
 * `<form action>` wrapper around `approveArtifact`. The activity review inbox
 * uses one form per card, so the artifact id arrives via FormData rather than
 * a typed argument.
 */
export async function approveArtifactFromForm(formData: FormData): Promise<void> {
  const id = formData.get('artifactId');
  if (typeof id !== 'string' || id.length === 0) return;
  await approveArtifact({ id });
}
