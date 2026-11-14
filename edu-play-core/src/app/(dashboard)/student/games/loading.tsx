import { Box, Group, Paper, ScrollArea, SimpleGrid, Skeleton, Stack } from '@mantine/core'

const HERO_ACTIONS = [0, 1] as const
const FILTER_CHIPS = [0, 1, 2, 3, 4, 5] as const
const FEATURED_SECTIONS = [
  { id: 'continue', cards: [0, 1, 2] },
  { id: 'assigned', cards: [0, 1] },
] as const
const ALL_GAME_CARDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const

function GameCardSkeleton({ id }: { id: number }) {
  return (
    <Paper key={id} radius="lg" withBorder className="overflow-hidden bg-surface-container-lowest">
      <Skeleton h={96} radius={0} />
      <Stack gap="sm" p="md">
        <Skeleton h={20} radius="md" />
        <Skeleton h={16} w="66%" radius="md" />
      </Stack>
    </Paper>
  )
}

export default function GamesLoading() {
  return (
    <Box
      component="main"
      className="min-h-screen flex-1 bg-surface p-5 md:p-8"
      role="status"
      aria-label="Se încarcă jocurile."
    >
      <Stack className="mx-auto max-w-[1280px]" gap="lg" aria-hidden="true">
        <Paper radius="lg" withBorder p="md" className="bg-surface-container-lowest">
          <Group justify="space-between" gap="md" wrap="wrap">
            <Stack gap="xs">
              <Skeleton h={24} w="min(14rem, 60vw)" radius="md" />
              <Skeleton h={16} w="min(18rem, 72vw)" radius="md" />
            </Stack>
            <Group gap="xs">
              {HERO_ACTIONS.map((item) => (
                <Skeleton key={item} h={44} w={112} radius="md" />
              ))}
            </Group>
          </Group>
        </Paper>

        <ScrollArea type="never" offsetScrollbars>
          <Group gap="sm" wrap="nowrap" className="min-w-max">
            {FILTER_CHIPS.map((item) => (
              <Skeleton key={item} h={44} w={112} radius="md" />
            ))}
          </Group>
        </ScrollArea>

        {FEATURED_SECTIONS.map((section) => (
          <Stack key={section.id} component="section" gap="md">
            <Skeleton h={20} w={192} radius="md" />
            <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
              {section.cards.map((item) => (
                <GameCardSkeleton key={`${section.id}-${item}`} id={item} />
              ))}
            </SimpleGrid>
          </Stack>
        ))}

        <Stack component="section" gap="md">
          <Skeleton h={20} w={160} radius="md" />
          <SimpleGrid cols={{ base: 2, md: 3, lg: 4, xl: 5 }} spacing="md">
            {ALL_GAME_CARDS.map((item) => (
              <GameCardSkeleton key={item} id={item} />
            ))}
          </SimpleGrid>
        </Stack>
      </Stack>
    </Box>
  )
}
