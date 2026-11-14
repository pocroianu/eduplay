import { Box, Group, Paper, SimpleGrid, Skeleton, Stack } from '@mantine/core';

const SUMMARY_PLACEHOLDERS = [0, 1, 2] as const;
const FEED_PLACEHOLDERS = [0, 1, 2, 3, 4] as const;
const ASIDE_PLACEHOLDERS = [0, 1] as const;

export default function StudentDashboardLoading() {
  return (
    <Box
      className="min-h-screen flex-1 bg-surface-container p-5 md:p-8"
      role="status"
      aria-label="Se încarcă pagina elevului."
    >
      <Stack className="mx-auto max-w-[1280px]" gap="lg" aria-hidden="true">
        <Paper radius="lg" withBorder p="md" className="bg-surface-container-lowest">
          <Group gap="lg" justify="space-between" wrap="wrap">
            <Group gap="md" wrap="nowrap">
              <Skeleton circle h={48} w={48} />
              <Stack gap="xs">
                <Skeleton h={20} w="min(12rem, 52vw)" radius="md" />
                <Skeleton h={16} w="min(16rem, 64vw)" radius="md" />
              </Stack>
            </Group>
            <SimpleGrid cols={3} spacing="xs">
              {SUMMARY_PLACEHOLDERS.map((item) => (
                <Skeleton key={item} h={48} w={80} radius="md" />
              ))}
            </SimpleGrid>
          </Group>
        </Paper>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Stack gap="md">
            {FEED_PLACEHOLDERS.map((item) => (
              <Paper key={item} radius="lg" withBorder p="md" className="bg-surface-container-lowest">
                <Skeleton h={20} radius="md" />
                <Skeleton h={16} mt="sm" w="66%" radius="md" />
              </Paper>
            ))}
          </Stack>
          <Paper component="aside" radius="lg" withBorder p="md" className="bg-surface-container-lowest">
            <Stack gap="md">
              <Skeleton h={128} radius="md" />
              {ASIDE_PLACEHOLDERS.map((item) => (
                <Stack key={item} className="border-t border-outline-variant pt-4" gap="sm">
                  <Skeleton h={16} w={128} radius="md" />
                  <Skeleton h={48} radius="md" />
                </Stack>
              ))}
            </Stack>
          </Paper>
        </div>
      </Stack>
    </Box>
  );
}
