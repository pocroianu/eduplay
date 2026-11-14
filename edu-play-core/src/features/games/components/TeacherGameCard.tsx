"use client";

import { Badge, Box, Button, Card, Group, SimpleGrid, Stack, Text, ThemeIcon } from "@mantine/core";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Icon } from '@/shared/components/ui/Icon';
import { ROUTES } from "@/shared/lib/constants";
import { getCategoryConfig, type Game } from "../types";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const THUMBNAIL_TONES = [
  { background: 'var(--color-primary-soft)', color: 'var(--color-primary-deep)' },
  { background: 'var(--color-blue-soft)', color: 'var(--color-blue-deep)' },
  { background: 'var(--color-gold-soft)', color: 'var(--color-gold-deep)' },
  { background: 'var(--color-coral-soft)', color: 'var(--color-coral-deep)' },
] as const

function isRecentlyCreated(createdAt: string | null): boolean {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() < ONE_WEEK_MS;
}

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Ușor',
  2: 'Mediu',
  3: 'Mediu-avansat',
  4: 'Avansat',
  5: 'Provocator',
};

interface TeacherGameCardProps {
  game: Game;
  onAssign?: (activityId: string) => void;
  featured?: boolean;
}

export function TeacherGameCard({
  game,
  onAssign,
  featured = false,
}: TeacherGameCardProps) {
  const { t } = useTranslation('teacher');
  const categoryConfig = getCategoryConfig(game.category);

  const isNew = isRecentlyCreated(game.created_at);
  const thumbnailTone = THUMBNAIL_TONES[game.id.length % THUMBNAIL_TONES.length]

  const isPopular =
    !isNew && game.difficulty_level != null && game.difficulty_level >= 4;

  return (
    <Card
      component="article"
      radius="lg"
      withBorder
      shadow="sm"
      padding={0}
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100%',
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
      }}
    >
      <Box pos="relative" h={featured ? 176 : 160} style={{ overflow: 'hidden' }}>
        {game.thumbnail_url ? (
          <Image
            src={game.thumbnail_url}
            alt={game.title}
            fill
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <Box
            h="100%"
            w="100%"
            style={{
              alignItems: 'center',
              backgroundColor: thumbnailTone.background,
              color: thumbnailTone.color,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <ThemeIcon radius="md" size={64} variant="white" style={{ boxShadow: 'var(--shadow-soft-sm)' }}>
              <Icon name={categoryConfig.icon} size={36} weight="fill" aria-hidden />
            </ThemeIcon>
          </Box>
        )}

        <Group pos="absolute" left={12} top={12} gap={6}>
          {isNew && (
            <Badge color="lime" variant="filled">{t('activities.card.new')}</Badge>
          )}
          {isPopular && (
            <Badge color="yellow" variant="filled">{t('activities.card.popular')}</Badge>
          )}
        </Group>
        <Badge
          pos="absolute"
          left={12}
          bottom={12}
          variant="white"
          c="var(--color-on-surface)"
          styles={{ root: { boxShadow: 'var(--shadow-soft-sm)' } }}
        >
          {categoryConfig.label}
        </Badge>
      </Box>

      <Stack gap="sm" p="md" style={{ flex: 1 }}>
        <Group align="flex-start" justify="space-between" gap="sm" wrap="nowrap">
          <Text component="h3" fw={800} lh={1.25} c="var(--color-on-surface)" lineClamp={2} style={{ margin: 0 }}>
            {game.title}
          </Text>
          {game.difficulty_level != null ? (
            <Badge
              color="yellow"
              variant="light"
              leftSection={<Icon name="Star" weight="fill" size={12} aria-hidden />}
              style={{ flexShrink: 0 }}
            >
              {DIFFICULTY_LABELS[game.difficulty_level] ?? `Nv. ${game.difficulty_level}`}
            </Badge>
          ) : null}
        </Group>

        {game.description && (
          <Text size="sm" fw={500} lh={1.5} c="var(--color-on-surface-variant)" lineClamp={2}>
            {game.description}
          </Text>
        )}

        <Group gap="md" c="var(--color-on-surface-variant)">
          {game.target_age_min != null && game.target_age_max != null && (
            <Group component="span" gap={4}>
              <Icon name="Baby" size={14} aria-hidden />
              <Text component="span" size="xs" fw={800}>
                {t('activities.card.ageRange', {
                  min: game.target_age_min,
                  max: game.target_age_max,
                })}
              </Text>
            </Group>
          )}
          {game.estimated_duration != null && (
            <Group component="span" gap={4}>
              <Icon name="Clock" size={14} aria-hidden />
              <Text component="span" size="xs" fw={800}>
                {t('activities.card.duration', { minutes: game.estimated_duration })}
              </Text>
            </Group>
          )}
        </Group>

        <SimpleGrid cols={2} spacing="xs" mt="auto" pt="sm">
          <Button
            type="button"
            aria-label={t('activities.card.assignActivityAria', { title: game.title })}
            color="purple"
            onClick={() => onAssign?.(game.id)}
          >
            {t('activities.card.assign')}
          </Button>
          <Button
            component={Link}
            href={ROUTES.PLAY.ACTIVITY(game.id)}
            aria-label={t('activities.card.previewActivityAria', { title: game.title })}
            variant="outline"
            color="purple"
          >
            {t('activities.card.preview')}
          </Button>
        </SimpleGrid>
      </Stack>
    </Card>
  );
}
