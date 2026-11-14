'use client';

import Link from 'next/link';
import { Box, Button, Card, Text } from '@mantine/core';
import { Icon } from '@/shared/components/ui/Icon';
import { cn } from '@/shared/lib/utils/cn';
import classes from './LibraryActivityCard.module.css';

export type LibraryActivityCardTone = 'purple' | 'green' | 'blue' | 'gold' | 'pink';
export type LibraryActivityCardVariant = 'activity' | 'create' | 'ideas';

export interface LibraryActivityCardProps {
  href: string;
  title: string;
  creator?: string;
  meta?: string;
  actionHref?: string;
  actionLabel?: string;
  thumbnailTone?: LibraryActivityCardTone;
  variant?: LibraryActivityCardVariant;
  className?: string;
  actionClassName?: string;
}

const THUMBNAIL_TONE_CLASS: Record<LibraryActivityCardTone, string> = {
  purple: classes.thumbnailPurple,
  green: classes.thumbnailGreen,
  blue: classes.thumbnailBlue,
  gold: classes.thumbnailGold,
  pink: classes.thumbnailPink,
};

const ROOT_INTERACTIVE_CLASS =
  'teacher-library-interactive teacher-library-surface-interactive';
const ACTION_INTERACTIVE_CLASS =
  'teacher-library-interactive teacher-library-action-interactive';

export function LibraryActivityCard({
  href,
  title,
  creator,
  meta,
  actionHref,
  actionLabel,
  thumbnailTone = 'purple',
  variant = 'activity',
  className,
  actionClassName,
}: LibraryActivityCardProps) {
  const isCreate = variant === 'create';
  const isIdeas = variant === 'ideas';
  const action = actionHref && actionLabel ? { href: actionHref, label: actionLabel } : null;

  return (
    <Card
      component="article"
      aria-label={title}
      padding={0}
      withBorder={false}
      className={cn(
        classes.card,
        classes.cardInteractive,
        ROOT_INTERACTIVE_CLASS,
        isCreate && classes.createCard,
        isIdeas && classes.ideasCard,
        className,
      )}
    >
      <Box component={Link} href={href} className={classes.main}>
        <Box
          component="span"
          className={cn(classes.thumbnail, THUMBNAIL_TONE_CLASS[thumbnailTone])}
          aria-hidden="true"
        >
          {isCreate ? (
            <Box component="span" className={classes.createMark}>
              <Icon name="Lightbulb" size={44} weight="regular" aria-hidden />
            </Box>
          ) : isIdeas ? (
            <Box component="span" className={classes.ideasMark}>
              <Icon name="MagnifyingGlass" size={54} weight="regular" aria-hidden />
            </Box>
          ) : (
            <>
              <Box component="span" className={cn(classes.bubble, classes.bubbleOne)} />
              <Box component="span" className={cn(classes.bubble, classes.bubbleTwo)} />
              <Box component="span" className={cn(classes.bubble, classes.bubbleThree)} />
              <Box component="span" className={classes.badge}>
                E
              </Box>
            </>
          )}
        </Box>
        <Box component="span" className={classes.body}>
          {creator ? (
            <Text component="span" className={classes.creator}>
              {creator}
            </Text>
          ) : null}
          <Text component="span" className={classes.title}>
            {title}
          </Text>
          {meta ? (
            <Text component="span" className={classes.meta}>
              {meta}
            </Text>
          ) : null}
        </Box>
      </Box>
      {action ? (
        <Button
          component={Link}
          href={action.href}
          variant="transparent"
          className={cn(classes.action, classes.actionInteractive, ACTION_INTERACTIVE_CLASS, actionClassName)}
        >
          {action.label}
        </Button>
      ) : null}
    </Card>
  );
}
