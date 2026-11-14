'use client'

import { Box, Button, Card, Group, SimpleGrid, Stack, Text, TextInput, ThemeIcon, Title } from '@mantine/core'
import Link from 'next/link'
import { useState } from 'react'
import { ActivityCard, FilterChipGroup, PageHeader } from '@/shared/components/ui/kit'
import { Icon } from '@/shared/components/ui/Icon'
import { ROUTES } from '@/shared/lib/constants'

const tabs = ['Toate', 'Colecții', 'Activități', 'Standarde'] as const
const gradeFilters = ['Clasa I', 'Clasa a II-a', 'Clasa a III-a'] as const
const languageFilters = ['Română', 'Engleză', 'Matematică'] as const

const featuredCollections = [
  {
    title: 'Citire și exprimare',
    description: 'Activități scurte pentru fluență, vocabular și răspunsuri audio.',
    meta: '12 activități',
  },
  {
    title: 'Matematică vizuală',
    description: 'Numărare, adunări și sortări cu suport vizual pentru clasele primare.',
    meta: '18 activități',
  },
  {
    title: 'Științe în jurul nostru',
    description: 'Observare, clasificare și explicații multimodale pentru jurnal.',
    meta: '9 activități',
  },
]

const popularActivities = [
  {
    href: ROUTES.TEACHER.LIBRARIES_EXPLORE,
    title: 'Activitate de citire: Sunetul inițial',
    creator: 'Biblioteca EduPlay',
    meta: 'Limba română',
    imageAlt: 'Card de activitate pentru sunete inițiale',
  },
  {
    href: ROUTES.TEACHER.LIBRARIES_EXPLORE,
    title: 'Activitate matematică: Numărăm până la 20',
    creator: 'Comunitate',
    meta: 'Matematică',
    imageAlt: 'Materiale de numărare până la douăzeci',
  },
  {
    href: ROUTES.TEACHER.LIBRARIES_EXPLORE,
    title: 'Activitate de științe: Habitate',
    creator: 'Biblioteca EduPlay',
    meta: 'Științe',
    imageAlt: 'Animale grupate după habitat',
  },
]

export function TeacherLibraryDiscoveryContent() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Toate')
  const [activeGrade, setActiveGrade] = useState<(typeof gradeFilters)[number]>('Clasa I')
  const [activeLanguage, setActiveLanguage] = useState<(typeof languageFilters)[number]>('Română')

  return (
    <Box
      component="main"
      aria-label="Explorează biblioteci"
      mih="100vh"
      bg="var(--color-surface)"
      c="var(--color-on-surface)"
    >
      <Stack maw="var(--breakpoint-2xl)" mx="auto" gap={24} px={{ base: 16, md: 24, lg: 32 }} py={16}>
        <PageHeader
          eyebrow="Biblioteca EduPlay"
          title="Explorează biblioteci"
          subtitle="Găsește activități gata de predat, colecții și idei pentru jurnalul clasei."
          action={
            <Button component={Link} href={ROUTES.TEACHER.ACTIVITY_CREATE} color="purple" size="md" leftSection={<Icon name="Plus" size="sm" weight="bold" aria-hidden />}>
              Creează activitate
            </Button>
          }
        />

        <Card radius="lg" p={{ base: 16, md: 20 }} withBorder shadow="sm">
          <Stack gap={20}>
            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md" style={{ alignItems: 'end' }}>
              <TextInput
                id="library-search"
                type="search"
                role="searchbox"
                label="Caută activități"
                placeholder="Caută după subiect, clasă sau standard"
                leftSection={<Icon name="MagnifyingGlass" size="sm" className="text-on-surface-muted" aria-hidden />}
              />

              <Group justify="flex-end">
                <FilterChipGroup
                  ariaLabel="Filtre bibliotecă"
                  items={tabs.map((tab) => ({ value: tab, label: tab }))}
                  value={activeTab}
                  onChange={(value) => setActiveTab(value as (typeof tabs)[number])}
                />
              </Group>
            </SimpleGrid>

            <Group aria-label="Filtre clasă și limbă" gap="xs" align="center">
              <FilterChipGroup
                ariaLabel="Filtre clasă"
                items={gradeFilters.map((grade) => ({ value: grade, label: grade }))}
                value={activeGrade}
                onChange={(value) => setActiveGrade(value as (typeof gradeFilters)[number])}
              />
              <FilterChipGroup
                ariaLabel="Filtre limbă"
                items={languageFilters.map((language) => ({ value: language, label: language }))}
                value={activeLanguage}
                onChange={(value) => setActiveLanguage(value as (typeof languageFilters)[number])}
              />
            </Group>
          </Stack>
        </Card>

        <Stack component="section" aria-label="Colecții recomandate" gap={12}>
          <Group justify="space-between" gap="sm">
            <Title order={2} size="h3" c="var(--color-on-surface)">Colecții recomandate</Title>
            <Button component={Link} href={ROUTES.TEACHER.LIBRARY} variant="subtle" color="purple" size="sm">
              Biblioteca mea
            </Button>
          </Group>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            {featuredCollections.map((collection) => (
              <Card key={collection.title} radius="lg" p="lg" withBorder shadow="sm">
                <Stack gap={8}>
                  <ThemeIcon aria-hidden="true" size={48} radius="md" color="purple" variant="light">
                    <Icon name="BookOpen" size="lg" weight="fill" />
                  </ThemeIcon>
                  <Title order={3} size="h4" c="var(--color-on-surface)">{collection.title}</Title>
                  <Text size="sm" fw={500} c="var(--color-on-surface-variant)">{collection.description}</Text>
                  <Text size="xs" fw={800} tt="uppercase" c="var(--color-primary-deep)" style={{ letterSpacing: '0.04em' }}>
                    {collection.meta}
                  </Text>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        </Stack>

        <Stack component="section" aria-label="Activități populare" gap={12}>
          <Group justify="space-between" gap="sm">
            <Title order={2} size="h3" c="var(--color-on-surface)">Activități populare</Title>
            <Button component={Link} href={ROUTES.TEACHER.LIBRARIES_EXPLORE} variant="light" color="purple" size="sm">
              Vezi toate
            </Button>
          </Group>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            {popularActivities.map((activity) => (
              <ActivityCard key={activity.title} {...activity} />
            ))}
          </SimpleGrid>
        </Stack>
      </Stack>
    </Box>
  )
}
