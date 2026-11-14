import { getAdminClient, logSection, logSuccess, logSkip } from '../config';
import type { SeedActivity } from '../phaser-catalog';

export interface ActivityInfo {
  id: string;
  versionId: string;
  title: string;
  typeId: string;
}

export async function seedActivities(activities: readonly SeedActivity[]): Promise<ActivityInfo[]> {
  const client = getAdminClient();
  if (!activities.length) return [];

  logSection(`Creating ${activities.length} published Activities...`);

  const activityTypes = new Map<string, SeedActivity>();
  for (const activity of activities) {
    if (!activityTypes.has(activity.typeId)) activityTypes.set(activity.typeId, activity);
  }

  for (const activity of activityTypes.values()) {
    const { error } = await client.from('activity_types').upsert(
      {
        type_id: activity.typeId,
        display_name: activity.templateLabel,
        category: activity.category,
        config_schema: {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          type: 'object',
        },
        renderer_key: activity.rendererKey,
        version: activity.schemaVersion,
      },
      { onConflict: 'type_id' },
    );
    if (error) throw new Error(`Failed to upsert Activity Type ${activity.typeId}: ${error.message}`);
  }

  for (const activity of activities) {
    const { error: activityError } = await client.from('activities').upsert(
      toActivityRow(activity),
      { onConflict: 'id' },
    );
    if (activityError) throw new Error(`Failed to upsert Activity ${activity.title}: ${activityError.message}`);

    const { data: existingVersion, error: versionSelectError } = await client
      .from('activity_versions')
      .select('id, config_data')
      .eq('id', activity.versionId)
      .maybeSingle();

    if (versionSelectError) {
      throw new Error(`Failed to inspect Activity Version for ${activity.title}: ${versionSelectError.message}`);
    }

    if (existingVersion) {
      if (stableJson(existingVersion.config_data) !== stableJson(activity.configData)) {
        throw new Error(
          `Baseline Activity Version already exists with different config_data for ${activity.title}. ` +
          'Run npm run seed:clean or npm run db:reset before reseeding changed Phaser configs.',
        );
      }
      logSkip(`Activity Version exists: ${activity.title}`);
    } else {
      const { error: versionError } = await client.from('activity_versions').insert({
        id: activity.versionId,
        activity_id: activity.id,
        activity_type_id: activity.typeId,
        version_number: 1,
        config_data: activity.configData,
        config_schema_version: activity.schemaVersion,
      });
      if (versionError) throw new Error(`Failed to insert Activity Version for ${activity.title}: ${versionError.message}`);
    }

    logSuccess(`Activity: ${activity.title} (${activity.typeId}/${activity.sourceActivityId})`);
  }

  return activities.map((activity) => ({
    id: activity.id,
    versionId: activity.versionId,
    title: activity.title,
    typeId: activity.typeId,
  }));
}

export function toActivityRow(activity: SeedActivity) {
  return {
    id: activity.id,
    template: activity.typeId,
    title: activity.title,
    description: activity.description,
    thumbnail_url: activity.thumbnailUrl,
    default_lang: 'ro',
    default_theme: null,
    category: activity.category,
    difficulty: activity.difficulty,
    target_age_min: activity.targetAgeMin,
    target_age_max: activity.targetAgeMax,
    estimated_duration: activity.estimatedDuration,
    question_count: activity.questionCount,
    tags: activity.tags,
    subject: activity.subject,
    skills: activity.skills,
    visibility_scope: 'public',
    created_by: null,
    is_published: true,
    status: 'published',
    config_data: activity.configData,
    config_schema_version: activity.schemaVersion,
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
