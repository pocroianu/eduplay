import { Group, Paper, SimpleGrid, Skeleton, Stack } from '@mantine/core';

const ACTIVITY_CARDS = [0, 1, 2, 3, 4, 5] as const;
const FILTER_CHIPS = [0, 1, 2] as const;
const CARD_TAGS = [0, 1] as const;

function ActivityCardSkeleton({ id }: { id: number }) {
  return (
    <Paper key={id} component="article" radius="lg" withBorder className="overflow-hidden bg-surface-container-lowest">
      <div className="border-b border-outline-variant p-4">
        <Skeleton h={16} w={112} radius="md" />
      </div>
      <Stack gap="md" p="md">
        <Skeleton h={20} w="75%" radius="md" />
        <Skeleton h={12} radius="md" />
        <Skeleton h={12} w="66%" radius="md" />
        <Group gap="xs">
          {CARD_TAGS.map((item) => (
            <Skeleton key={item} h={28} w={item === 0 ? 80 : 96} radius="md" />
          ))}
        </Group>
      </Stack>
    </Paper>
  );
}

export default function StudentActivitiesLoading() {
  return (
    <div
      role="status"
      aria-label="Se încarcă activitățile"
      className="min-h-screen flex-1 bg-surface p-6 lg:p-10"
    >
      <Stack className="mx-auto max-w-7xl" gap="md" aria-hidden="true">
        <Paper component="section" radius="lg" withBorder p="md" className="bg-surface-container-lowest">
          <Group justify="space-between" gap="md" wrap="wrap">
            <Group gap="md" wrap="nowrap">
              <Skeleton h={48} w={48} radius="md" />
              <Stack gap="xs">
                <Skeleton h={24} w={176} radius="md" />
                <Skeleton h={12} w="min(16rem, 62vw)" radius="md" />
              </Stack>
            </Group>
            <Skeleton h={32} w={112} radius="md" />
          </Group>
        </Paper>

        <Paper component="section" radius="lg" withBorder p="md" className="bg-surface-container-lowest">
          <Group gap="xs">
            {FILTER_CHIPS.map((item) => (
              <Skeleton key={item} h={36} w={96} radius="md" />
            ))}
          </Group>
        </Paper>

        <SimpleGrid component="section" cols={{ base: 1, md: 2, xl: 3 }} spacing="sm">
          {ACTIVITY_CARDS.map((item) => (
            <ActivityCardSkeleton key={item} id={item} />
          ))}
        </SimpleGrid>
      </Stack>
    </div>
  );
}
