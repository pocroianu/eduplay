export type E2ETemplateId = string;

export interface ActivityLaunchOptions {
  /**
   * Kept so legacy E2E call sites can still label the renderer they cover.
   * Canonical Activity host URLs resolve the renderer from Activity metadata.
   */
  templateId?: E2ETemplateId;
  activityId: string;
  lang?: string;
  params?: Record<string, string | undefined>;
}

export function buildActivityLaunchUrl({ activityId, lang, params }: ActivityLaunchOptions): string {
  const searchParams = new URLSearchParams();

  if (lang) {
    searchParams.set('lang', lang);
  }

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return `/activities/${encodeURIComponent(activityId)}${query ? `?${query}` : ''}`;
}
