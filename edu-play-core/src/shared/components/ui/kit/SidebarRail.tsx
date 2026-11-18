'use client';

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Divider,
  Group,
  NavLink,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
  VisuallyHidden,
} from '@mantine/core';
import { Icon } from '@/shared/components/ui/Icon';
import type { IconName } from '@/shared/components/ui/Icon.registry';

export interface SidebarRailProfile {
  name: string;
  subtitle?: string;
  initials: string;
  avatar?: ReactNode;
}

export interface SidebarRailItem {
  href: string;
  label: string;
  icon: IconName;
  active?: boolean;
  badge?: string;
  dot?: boolean;
  initials?: string;
}

export interface SidebarRailProps {
  brandLabel: string;
  collapsed?: boolean;
  profile?: SidebarRailProfile;
  navItems: ReadonlyArray<SidebarRailItem>;
  classItems?: ReadonlyArray<SidebarRailItem>;
  utilityItems?: ReadonlyArray<SidebarRailItem>;
  onToggleCollapsed?: () => void;
  onProfileClick?: () => void;
}
type StyleWithVars = CSSProperties & Record<`--${string}`, string | number>;


const railBaseStyle: CSSProperties = {
  minHeight: '100vh',
  background: 'var(--color-surface-container-lowest)',
  borderRight: '1px solid var(--color-outline)',
  transition: 'var(--sidebar-rail-transition, opacity 160ms ease, transform 160ms ease)',
};

const railExpandedStyle: CSSProperties = {
  ...railBaseStyle,
  width: 'var(--nav-rail-wide)',
};

const railCollapsedStyle: CSSProperties = {
  ...railBaseStyle,
  width: 64,
};

const headingStyle: CSSProperties = {
  color: 'var(--color-purple-deep)',
  fontFamily: 'var(--font-headline)',
  fontSize: 18,
  fontWeight: 800,
  lineHeight: 1.2,
  margin: 0,
};

const controlStyle: CSSProperties = {
  borderColor: 'var(--color-outline-variant)',
  color: 'var(--color-on-surface-variant)',
};

const profileButtonBaseStyle: CSSProperties = {
  width: 'calc(100% - 24px)',
  margin: '0 12px 12px',
  border: '1px solid var(--color-outline)',
  borderRadius: 14,
  color: 'var(--color-on-surface)',
  background: 'var(--color-surface-container-lowest)',
};

const profileButtonExpandedStyle: CSSProperties = {
  ...profileButtonBaseStyle,
  padding: 8,
};

const profileButtonCollapsedStyle: CSSProperties = {
  ...profileButtonBaseStyle,
  alignItems: 'center',
  background: 'transparent',
  border: 'none',
  display: 'flex',
  height: 44,
  justifyContent: 'center',
  padding: 0,
  width: 44,
};

const navLinkBaseStyle: StyleWithVars = {
  minHeight: 44,
  borderRadius: 12,
  color: 'var(--color-on-surface-variant)',
  fontWeight: 650,
  '--nl-hover': 'var(--color-purple-wash)',
};

const navLinkActiveStyle: StyleWithVars = {
  ...navLinkBaseStyle,
  color: 'var(--color-purple-deep)',
  '--nl-bg': 'var(--color-purple-wash)',
  '--nl-color': 'var(--color-purple-deep)',
};

const collapsedIconStyle: CSSProperties = {
  borderRadius: 12,
  color: 'var(--color-on-surface-variant)',
  height: 44,
  padding: 0,
  width: 44,
};

const collapsedIconActiveStyle: CSSProperties = {
  ...collapsedIconStyle,
  background: 'var(--color-purple-wash)',
  color: 'var(--color-purple-deep)',
};

const avatarStyle: CSSProperties = {
  background: 'var(--color-surface-container)',
  color: 'var(--color-on-surface)',
  fontWeight: 800,
};

const classAvatarStyle: CSSProperties = {
  background: 'var(--color-purple-deep)',
  color: 'var(--color-surface-container-lowest)',
  fontWeight: 800,
};

const badgeStyle: CSSProperties = {
  background: 'var(--color-gold)',
  color: 'var(--color-on-gold)',
};

const sectionLabelStyle: CSSProperties = {
  color: 'var(--color-on-surface-variant)',
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.2,
  paddingInline: 4,
};

const dotStyle: CSSProperties = {
  position: 'absolute',
  right: 8,
  top: 8,
  width: 8,
  height: 8,
  borderRadius: 999,
  background: 'var(--color-coral)',
};

const brandHeaderHeight = 72;

function iconWeight(active?: boolean) {
  return active ? 'fill' : 'regular';
}

function ItemIcon({ item }: { item: SidebarRailItem }) {
  return item.initials ? (
    <ThemeIcon size={24} radius="sm" style={classAvatarStyle} aria-hidden>
      <Text component="span" size="xs" fw={800}>
        {item.initials}
      </Text>
    </ThemeIcon>
  ) : (
    <Icon name={item.icon} size="md" weight={iconWeight(item.active)} aria-hidden />
  );
}

function itemStyle(item: SidebarRailItem) {
  return item.active ? navLinkActiveStyle : navLinkBaseStyle;
}

function SidebarItem({ item, collapsed }: { item: SidebarRailItem; collapsed?: boolean }) {
  const accessibleLabel = `${item.label}${item.badge ? ` ${item.badge}` : ''}${item.dot ? ' notificare nouă' : ''}`;
  // Expanded rows already expose their visible text; an aria-label that drops it breaks WCAG 2.5.3.
  const expandedLabel = item.badge || item.dot ? accessibleLabel : undefined;
  const content = collapsed ? (
    <ActionIcon
      component={Link}
      href={item.href}
      aria-current={item.active ? 'page' : undefined}
      aria-label={accessibleLabel}
      variant="subtle"
      size={44}
      radius="md"
      style={item.active ? collapsedIconActiveStyle : collapsedIconStyle}
    >
      <ItemIcon item={item} />
    </ActionIcon>
  ) : (
    <NavLink
      component={Link}
      href={item.href}
      aria-current={item.active ? 'page' : undefined}
      aria-label={expandedLabel}
      active={item.active}
      noWrap
      label={item.label}
      leftSection={<ItemIcon item={item} />}
      rightSection={
        item.badge ? (
          <Badge radius="xl" size="sm" style={badgeStyle}>
            {item.badge}
          </Badge>
        ) : undefined
      }
      style={itemStyle(item)}
    />
  );

  return (
    <Box pos="relative">
      {collapsed ? (
        <Tooltip label={accessibleLabel} position="right" openDelay={300}>
          {content}
        </Tooltip>
      ) : (
        content
      )}
      {item.dot ? <Box component="span" aria-hidden data-testid={`sidebar-dot-${item.label}`} style={dotStyle} /> : null}
    </Box>
  );
}

function ProfileContent({ profile, collapsed }: { profile: SidebarRailProfile; collapsed?: boolean }) {
  return (
    <Group gap="sm" wrap="nowrap" justify={collapsed ? 'center' : 'flex-start'}>
      {profile.avatar ? (
        <Avatar component="div" radius="xl" size={36}>
          {profile.avatar}
        </Avatar>
      ) : (
        <Avatar radius="xl" size={36} style={avatarStyle}>
          {profile.initials}
        </Avatar>
      )}
      {!collapsed ? (
        <Box miw={0}>
          <Text size="sm" fw={800} truncate style={{ color: 'var(--color-on-surface)' }}>
            {profile.name}
          </Text>
          {profile.subtitle ? (
            <Text size="xs" truncate style={{ color: 'var(--color-on-surface-variant)' }}>
              {profile.subtitle}
            </Text>
          ) : null}
        </Box>
      ) : null}
    </Group>
  );
}

export function SidebarRail({
  brandLabel,
  collapsed,
  profile,
  navItems,
  classItems = [],
  utilityItems = [],
  onToggleCollapsed,
  onProfileClick,
}: SidebarRailProps) {
  const railStyle = collapsed ? railCollapsedStyle : railExpandedStyle;
  const profileStyle = collapsed ? profileButtonCollapsedStyle : profileButtonExpandedStyle;

  return (
    <Box
      component="aside"
      className="motion-safe:[--sidebar-rail-transition:opacity_160ms_ease,transform_160ms_ease] motion-reduce:[--sidebar-rail-transition:none]"
      display="flex"
      style={railStyle}
    >
      <Stack h="100%" gap={0}>
        <Group h={brandHeaderHeight} px="md" justify={collapsed ? 'center' : 'space-between'} wrap="nowrap">
          {collapsed ? (
            <VisuallyHidden>
              <Text component="h2" style={headingStyle}>
                {brandLabel}
              </Text>
            </VisuallyHidden>
          ) : (
            <Text component="h2" style={headingStyle}>
              {brandLabel}
            </Text>
          )}
          {onToggleCollapsed ? (
            <ActionIcon
              type="button"
              variant="default"
              radius="md"
              size={44}
              onClick={onToggleCollapsed}
              aria-label={collapsed ? 'Extinde navigarea' : 'Restrânge navigarea'}
              style={controlStyle}
            >
              <Icon name={collapsed ? 'CaretRight' : 'ArrowLeft'} size="sm" aria-hidden />
            </ActionIcon>
          ) : null}
        </Group>

        {profile ? (
          onProfileClick ? (
            <UnstyledButton type="button" onClick={onProfileClick} aria-label={collapsed ? `${profile.initials} ${profile.name}: Deschide meniul contului` : undefined} style={profileStyle}>
              <ProfileContent profile={profile} collapsed={collapsed} />
            </UnstyledButton>
          ) : (
            <Box style={profileStyle}>
              <ProfileContent profile={profile} collapsed={collapsed} />
            </Box>
          )
        ) : null}

        <Box component="nav" aria-label="Navigare principală" px="sm">
          <Stack gap={4}>
            {navItems.map((item) => (
              <SidebarItem key={item.href} item={item} collapsed={collapsed} />
            ))}
          </Stack>
        </Box>

        {classItems.length > 0 ? (
          <Box component="section" mt="md" px="sm">
            {!collapsed ? (
              <Text mb={6} style={sectionLabelStyle}>
                Clasele mele
              </Text>
            ) : null}
            <Stack gap={4}>
              {classItems.map((item) => (
                <SidebarItem key={item.href} item={item} collapsed={collapsed} />
              ))}
            </Stack>
          </Box>
        ) : null}

        {utilityItems.length > 0 ? (
          <Box mt="auto" px="sm" py="md">
            <Divider mb="sm" color="var(--color-outline-variant)" />
            <Stack component="nav" aria-label="Navigare rapidă" gap={4}>
              {utilityItems.map((item) => (
                <SidebarItem key={item.href} item={item} collapsed={collapsed} />
              ))}
            </Stack>
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
}
