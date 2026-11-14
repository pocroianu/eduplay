import { Pill } from '@/shared/components/ui/kit';
import type { ActivityRow } from '@/features/api';

type ActivityStatus = 'draft' | 'in_review' | 'published' | 'archived';

const STATUS_LABEL: Record<ActivityStatus, string> = {
  draft: 'Ciornă',
  in_review: 'În revizuire',
  published: 'Publicat',
  archived: 'Arhivat',
};

const STATUS_TONE: Record<ActivityStatus, 'cream' | 'sky' | 'lime' | 'neutral'> = {
  draft: 'cream',
  in_review: 'sky',
  published: 'lime',
  archived: 'neutral',
};

export function getActivityStatus(activity: ActivityRow): ActivityStatus {
  if (activity.status === 'in_review') return 'in_review';
  if (activity.status === 'archived') return 'archived';
  if (activity.status === 'published' || activity.isPublished) return 'published';
  return 'draft';
}

export interface ActivityStatusBadgeProps {
  activity: ActivityRow;
}

export function ActivityStatusBadge({ activity }: ActivityStatusBadgeProps) {
  const status = getActivityStatus(activity);
  return <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>;
}
