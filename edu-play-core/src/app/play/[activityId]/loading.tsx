import { Box, Paper, Skeleton, Stack } from '@mantine/core'
import { getServerLanguage, getServerTranslation } from '@/lib/i18n/server'
import { Icon } from '@/shared/components/ui/Icon'

export default async function PlayLoading() {
  const lang = await getServerLanguage()
  const [iconAlt, preparingAdventure] = await Promise.all([
    getServerTranslation(lang, 'player', 'loading.iconAlt'),
    getServerTranslation(lang, 'player', 'loading.preparingAdventure'),
  ])

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-surface p-6"
    >
      <Paper
        radius="lg"
        shadow="sm"
        p="lg"
        className="w-full max-w-md"
        role="status"
        aria-live="polite"
      >
        <Stack align="center" gap="md">
          <Box
            className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-soft text-primary"
            aria-label={iconAlt}
          >
            <Icon name="GameController" size="lg" />
          </Box>
          <p className="text-center font-headline text-xl font-semibold text-on-surface">
            {preparingAdventure}
          </p>
          <Skeleton className="aspect-video w-full" radius="lg" aria-hidden="true" />
        </Stack>
      </Paper>
    </main>
  )
}
