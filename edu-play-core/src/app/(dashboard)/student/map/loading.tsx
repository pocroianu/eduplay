import { Box, Group, Paper, Skeleton, Stack } from '@mantine/core'

export default function StudentMapLoading() {
  return (
    <Box component="div" className="min-h-screen flex-1 bg-surface px-4 py-8 md:py-12">
      <Stack className="mx-auto w-full max-w-4xl items-center" gap={0}>
        <Paper
          radius="lg"
          shadow="sm"
          p={{ base: 'md', md: 'lg' }}
          className="mb-12 w-full bg-surface-container-lowest"
          role="status"
          aria-label="Se încarcă harta elevului"
        >
          <Group justify="space-between" gap="lg" wrap="wrap">
            <Group gap="md" wrap="nowrap">
              <Skeleton circle h={56} w={56} />
              <Stack gap="xs">
                <Skeleton h={28} w="min(14rem, 56vw)" radius="md" />
                <Skeleton h={20} w="min(10rem, 44vw)" radius="md" />
              </Stack>
            </Group>
            <Skeleton h={16} w="min(100%, 28rem)" radius="xl" />
          </Group>
        </Paper>

        <Stack className="relative w-full items-center py-10" gap="6rem">
          {[1, 2, 3].map((item) => (
            <Stack key={item} align="center" gap="md">
              <Skeleton h={24} w={128} radius="xl" />
              <Skeleton circle h="clamp(6rem, 22vw, 7rem)" w="clamp(6rem, 22vw, 7rem)" />
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Box>
  )
}
