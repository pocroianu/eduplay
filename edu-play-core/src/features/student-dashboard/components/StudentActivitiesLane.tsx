'use client';

import Link from 'next/link';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';
import { Card } from '@/shared/components/ui/kit';
import { ROUTES } from '@/shared/lib/constants/routes';

export interface StudentActivityCard {
  id: string;
  typeId: string;
  title: string;
  description: string;
  icon: IconName;
}

export interface StudentActivitiesLaneProps {
  activities: StudentActivityCard[];
}

export function StudentActivitiesLane({
  activities,
}: StudentActivitiesLaneProps) {
  return (
    <section aria-labelledby="student-activities-heading">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-base font-semibold uppercase tracking-wide text-on-surface-variant">
            Lucru de clasă
          </p>
          <h2
            id="student-activities-heading"
            className="mt-1 text-2xl font-semibold text-on-surface"
          >
            Activități
          </h2>
        </div>
      </div>

      {activities.length === 0 ? (
        <Card className="border border-outline-variant bg-surface-container-lowest text-center">
          <p className="text-[18px] font-medium text-on-surface-variant">
            Nu ai activități creative de făcut acum.
          </p>
        </Card>
      ) : (
        <ul className="divide-y divide-outline-variant rounded-lg border border-outline-variant bg-surface-container-lowest shadow-soft-sm">
          {activities.map((activity) => (
            <li key={activity.id}>
              <Link
                href={ROUTES.STUDENT.ACTIVITY_PLAY(activity.id)}
                className="flex min-h-16 items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-surface-container focus-ring"
              >
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-primary shadow-soft-sm"
                >
                  <Icon name={activity.icon} weight="fill" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[18px] font-semibold text-on-surface">
                    {activity.title}
                  </span>
                  <span className="block truncate text-[18px] font-normal text-on-surface-variant">
                    {activity.description}
                  </span>
                </span>
                <Icon
                  name="ArrowRight"
                  size={18}
                  className="shrink-0 text-on-surface-variant"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
