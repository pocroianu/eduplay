'use client'

import type { CSSProperties } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Avatar, Box, Divider, FocusTrap, Modal, Stack, Text, UnstyledButton } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { createClient } from '@/lib/supabase/client'
import { ROUTES } from '@/shared/lib/constants'
import { getInitials } from '@/shared/lib/utils/initials'
import { Icon } from '@/shared/components/ui/Icon'
import type { IconName } from '@/shared/components/ui/Icon.registry'
import styles from './AccountMenuModal.module.css'

export interface AccountMenuProfile {
  full_name: string
  avatar_url?: string | null
  subtitle?: string
}

interface AccountMenuModalProps {
  opened: boolean
  onClose: () => void
  profile: AccountMenuProfile
  roleLabel?: string
  placement?: 'desktop' | 'mobile'
}

interface AccountMenuRowProps {
  icon: IconName
  label: string
  onClick: () => void | Promise<void>
  tone?: 'default' | 'danger'
}

const imageAvatarStyle: CSSProperties = {
  borderRadius: 999,
  objectFit: 'cover',
}

const hiddenTitleStyle: CSSProperties = {
  border: 0,
  clip: 'rect(0, 0, 0, 0)',
  height: 1,
  margin: -1,
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: 1,
}

const avatarStyle: CSSProperties = {
  background: 'var(--color-surface-container)',
  border: '1px solid var(--color-outline-variant)',
  color: 'var(--color-primary-deep)',
  fontWeight: 800,
}

function AccountMenuRow({ icon, label, onClick, tone = 'default' }: AccountMenuRowProps) {
  return (
    <UnstyledButton
      type="button"
      className={`${styles.row} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
      onClick={onClick}
      data-account-menu-row
      data-tone={tone}
    >
      <span className={styles.rowContent}>
        <Icon name={icon} size="lg" aria-hidden className={styles.icon} />
        <Text component="span" size="sm" fw={500} className={styles.label}>
          {label}
        </Text>
      </span>
    </UnstyledButton>
  )
}

export function AccountMenuModal({
  opened,
  onClose,
  profile,
  roleLabel,
  placement = 'desktop',
}: AccountMenuModalProps) {
  const router = useRouter()
  const { t } = useTranslation('common')
  const title = t('shell.sidebar.accountMenuTitle', { defaultValue: 'Meniu cont' })
  const displayName = profile.full_name || t('shell.accountFallback', { defaultValue: 'Utilizator' })
  const displayRole = roleLabel ?? profile.subtitle
  const modalSize = placement === 'desktop' ? 200 : 248

  const closeAndNavigate = (href: string) => {
    onClose()
    router.push(href)
  }

  const signOutToLogin = async () => {
    onClose()
    await createClient().auth.signOut()
    router.push(ROUTES.AUTH.LOGIN)
    router.refresh()
  }

  return (
    <Modal.Root
      opened={opened}
      onClose={onClose}
      size={modalSize}
      padding={0}
      radius="md"
      shadow="none"
      yOffset={placement === 'desktop' ? 54 : 64}
      xOffset={placement === 'desktop' ? 62 : 16}
      styles={{
        inner: {
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
        },
      }}
    >
      <Modal.Overlay backgroundOpacity={0} />
      <Modal.Content className={styles.content}>
        <Modal.Title style={hiddenTitleStyle}>{title}</Modal.Title>
        <Modal.Body className={styles.body}>
          <FocusTrap.InitialFocus />
          <Stack align="center" gap={2} className={styles.header}>
            <Avatar radius="xl" size={48} style={avatarStyle}>
              {profile.avatar_url ? (
                <Image src={profile.avatar_url} alt={displayName} width={48} height={48} style={imageAvatarStyle} />
              ) : (
                getInitials(displayName)
              )}
            </Avatar>
            <Text mt={5} ta="center" size="sm" fw={700} style={{ color: 'var(--color-on-surface)' }}>
              {displayName}
            </Text>
            {displayRole ? (
              <Text ta="center" size="xs" fw={500} style={{ color: 'var(--color-on-surface-variant)' }}>
                {displayRole}
              </Text>
            ) : null}
          </Stack>

          <Box component="nav" aria-label={title}>
            <AccountMenuRow
              icon="Wrench"
              label={t('shell.sidebar.accountSettings', { defaultValue: 'Setări cont' })}
              onClick={() => closeAndNavigate(ROUTES.TEACHER.ACCOUNT_SETTINGS)}
            />
            <AccountMenuRow
              icon="House"
              label={t('shell.sidebar.mySchool', { defaultValue: 'Școala mea' })}
              onClick={() => closeAndNavigate(ROUTES.TEACHER.ACCOUNT_SCHOOL)}
            />
            <AccountMenuRow
              icon="IdentificationBadge"
              label={t('shell.sidebar.deviceInformation', { defaultValue: 'Informații dispozitiv' })}
              onClick={() => closeAndNavigate(ROUTES.TEACHER.ACCOUNT_DEVICE)}
            />
            <AccountMenuRow
              icon="TextAa"
              label={t('shell.sidebar.languageSettings', { defaultValue: 'Selectează limba' })}
              onClick={() => closeAndNavigate(ROUTES.TEACHER.LANGUAGE)}
            />
            <AccountMenuRow
              icon="SignOut"
              label={t('shell.sidebar.signOut', { defaultValue: 'Deconectare' })}
              tone="danger"
              onClick={signOutToLogin}
            />
          </Box>

          <Divider color="var(--color-outline-variant)" />

          <AccountMenuRow
            icon="Plus"
            label={t('shell.sidebar.addAccount', { defaultValue: 'Adaugă cont' })}
            onClick={signOutToLogin}
          />
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  )
}
