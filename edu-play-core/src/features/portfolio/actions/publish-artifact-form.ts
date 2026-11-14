'use server';

import { publishArtifact } from './publish-artifact';

/**
 * `<form action>` wrapper around `publishArtifact`. The teacher review queue
 * uses one form per card, so the artifact id arrives via FormData rather
 * than a typed argument. Errors fall through silently — the underlying
 * action returns an `ActionResult` and `runVisibilityChange` already calls
 * `revalidatePath('/teacher/portfolio')` on success.
 *
 * NOTE: this wrapper deliberately swallows the result so it satisfies the
 * `(formData: FormData) => void | Promise<void>` signature React expects on
 * `<form action>` props. Surface action errors via the page once `useFormState`
 * is wired up in Phase 2.
 */
export async function publishArtifactFromForm(formData: FormData): Promise<void> {
  const id = formData.get('artifactId');
  if (typeof id !== 'string' || id.length === 0) return;
  await publishArtifact({ id });
}
