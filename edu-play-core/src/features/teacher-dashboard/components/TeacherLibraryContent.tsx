'use client';

import Link from 'next/link';
import { Anchor, Badge, Box, Button, Group, Input, Text, TextInput, UnstyledButton } from '@mantine/core';
import type {
  TeacherActivitiesStatusFilter,
  TeacherOwnedActivity,
  TeacherOwnedActivityStatus,
} from '@/features/teacher-activities';
import { LibraryActivityCard } from '@/shared/components/ui/kit';
import type { LibraryActivityCardTone } from '@/shared/components/ui/kit';
import { ROUTES } from '@/shared/lib/constants';
import classes from './TeacherDashboardContent.module.css';

type OwnedActivitySort = 'newest' | 'oldest' | 'title';

export interface TeacherLibraryContentProps {
  recentActivities: TeacherOwnedActivity[];
  collectionCount: number;
  statusFilter: TeacherActivitiesStatusFilter;
  sortBy: OwnedActivitySort;
  searchQuery: string;
}

const STATUS_LABELS: Record<TeacherOwnedActivityStatus, string> = {
  draft: 'Ciornă',
  published: 'Gata de atribuit',
  archived: 'Arhivată',
  in_review: 'În revizuire',
};

const ACTIVITY_TONES: readonly LibraryActivityCardTone[] = ['green', 'blue', 'pink', 'gold', 'purple'];

const pageStyle = {
  height: 'calc(100vh - 68px)',
  minHeight: 0,
  overflowX: 'hidden',
  overflowY: 'auto',
  backgroundColor: 'var(--color-surface)',
  color: 'var(--color-on-surface)',
} as const;

const surfaceInteractiveClassName = `${classes.interactive} ${classes.surfaceInteractive} teacher-library-interactive teacher-library-surface-interactive`;
const actionInteractiveClassName = `${classes.interactive} ${classes.actionInteractive} teacher-library-interactive teacher-library-action-interactive`;
const searchSurfaceInteractiveClassName = `${surfaceInteractiveClassName} ${classes.librarySearchSurface}`;
const searchActionInteractiveClassName = `${actionInteractiveClassName} ${classes.librarySearchButton}`;
const collectionRowInteractiveClassName = `${surfaceInteractiveClassName} ${classes.libraryCollectionRow}`;
const createInputInteractiveClassName = `${surfaceInteractiveClassName} ${classes.libraryCreateCollectionInput}`;
const createButtonInteractiveClassName = `${actionInteractiveClassName} ${classes.libraryCreateCollectionButton}`;

function buildHref(status: TeacherActivitiesStatusFilter, sort: OwnedActivitySort, query: string) {
  const params = new URLSearchParams();
  const trimmedQuery = query.trim();

  if (status !== 'all') params.set('status', status);
  if (sort !== 'newest') params.set('sort', sort);
  if (trimmedQuery) params.set('q', trimmedQuery);

  const serialized = params.toString();
  return serialized ? `${ROUTES.TEACHER.LIBRARY}?${serialized}` : ROUTES.TEACHER.LIBRARY;
}

function activityMeta(activity: TeacherOwnedActivity) {
  if (activity.template === 'free-response') return STATUS_LABELS[activity.status];
  return `${STATUS_LABELS[activity.status]} · ${activity.template}`;
}

function activityAction(activity: TeacherOwnedActivity) {
  if (activity.status === 'published') {
    return {
      href: `${ROUTES.TEACHER.ASSIGNMENT_NEW}?activityId=${activity.id}`,
      label: 'Atribuie',
    };
  }

  if (activity.status === 'draft') {
    return {
      href: ROUTES.TEACHER.ACTIVITY_EDIT(activity.id),
      label: 'Continuă',
    };
  }

  return null;
}

function activitiesWithoutCollectionLabel(count: number) {
  if (count === 1) return '1 activitate fără colecție';
  return `${count} activități fără colecție`;
}

function StaticFilterBadge({ label }: { label: string }) {
  return (
    <Badge
      component="span"
      variant="outline"
      radius="sm"
      className={`${classes.libraryControlSurface} ${classes.libraryStaticFilter}`}
    >
      {label}
    </Badge>
  );
}

export function TeacherLibraryContent({
  recentActivities,
  collectionCount,
  statusFilter,
  sortBy,
  searchQuery,
}: TeacherLibraryContentProps) {
  const listHref = buildHref(statusFilter, sortBy, searchQuery);

  return (
    <Box component="main" aria-label="Biblioteca mea" style={pageStyle}>
      <Box component="section" aria-label="Conținut Biblioteca mea" className={classes.libraryColumn}>
        <Box component="form" action={ROUTES.TEACHER.LIBRARY} role="search" className={classes.libraryToolbar}>
          <StaticFilterBadge label="Toate clasele" />
          <StaticFilterBadge label="Toate subiectele" />
          <StaticFilterBadge label="Toate limbile" />
          <Box component="span" className={searchSurfaceInteractiveClassName}>
            <Input
              aria-label="Caută"
              name="q"
              type="search"
              defaultValue={searchQuery}
              placeholder="Caută"
              variant="unstyled"
              classNames={{ input: classes.librarySearchInput }}
            />
            <input type="hidden" name="status" value={statusFilter === 'all' ? '' : statusFilter} />
            <input type="hidden" name="sort" value={sortBy === 'newest' ? '' : sortBy} />
            <Button type="submit" variant="transparent" className={searchActionInteractiveClassName}>
              Caută
            </Button>
          </Box>
        </Box>

        <Box component="section" aria-label="Activitățile mele recente">
          <Group className={classes.librarySectionHeader} justify="space-between" wrap="nowrap">
            <Text component="h2" className={classes.librarySectionHeading}>
              Activitățile mele recente
            </Text>
            <Anchor component={Link} href={listHref} className={classes.libraryViewAll}>
              Vezi toate activitățile recente ({collectionCount})
            </Anchor>
          </Group>
          <Box className={classes.libraryActivityGrid}>
            <LibraryActivityCard
              href={ROUTES.TEACHER.ACTIVITY_CREATE}
              title="Creează o activitate sau evaluare automată"
              variant="create"
            />
            {recentActivities.map((activity, index) => {
              const action = activityAction(activity);

              return (
                <LibraryActivityCard
                  key={activity.id}
                  href={ROUTES.TEACHER.ACTIVITY_EDIT(activity.id)}
                  title={activity.title}
                  creator="Creată de tine"
                  meta={activityMeta(activity)}
                  actionHref={action?.href}
                  actionLabel={action?.label}
                  actionClassName={actionInteractiveClassName}
                  thumbnailTone={ACTIVITY_TONES[index % ACTIVITY_TONES.length]}
                />
              );
            })}
            <LibraryActivityCard
              href={ROUTES.TEACHER.LIBRARIES_EXPLORE}
              title="Răsfoiește biblioteca comunității"
              creator="Ai nevoie de idei?"
              variant="ideas"
              thumbnailTone="purple"
            />
          </Box>
        </Box>

        <Box component="section" aria-label="Colecțiile mele" className={classes.libraryCollections}>
          <Text component="h2" className={classes.librarySectionHeading}>
            Colecțiile mele (0)
          </Text>
          <UnstyledButton component={Link} href={listHref} className={collectionRowInteractiveClassName}>
            <Box component="span" className={classes.libraryCollectionCount}>
              {collectionCount}
            </Box>
            <Text component="span">{activitiesWithoutCollectionLabel(collectionCount)}</Text>
          </UnstyledButton>
          <Group className={classes.libraryCreateCollection} gap={8} wrap="nowrap">
            <TextInput
              aria-label="Creează o colecție nouă pentru a-ți organiza activitățile"
              placeholder="Creează o colecție nouă pentru a-ți organiza activitățile"
              variant="unstyled"
              className={classes.libraryCreateCollectionField}
              classNames={{ input: createInputInteractiveClassName }}
            />
            <Button type="button" disabled variant="default" className={createButtonInteractiveClassName}>
              Creează
            </Button>
          </Group>
        </Box>
      </Box>
    </Box>
  );
}
