'use client'

import { ActionIcon } from '@mantine/core'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Icon } from '@/shared/components/ui/Icon'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  FilterChipGroup,
  StatCard,
} from '@/shared/components/ui/kit'
import { ROUTES } from '@/shared/lib/constants'
import { formatDate } from '@/lib/i18n/formatters'

import { deleteAssignment } from '../actions/assignment-actions'
import type { AssignmentRow } from '../queries'
import { TeacherActivityPicker } from './TeacherActivityPicker'

const staggerGrid: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06 } },
}

const staggerTile: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.24, ease: 'easeOut' } },
}

const reducedStaggerGrid: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0 } },
}

const reducedStaggerTile: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.18 } },
}

export interface AssignmentsPageContentProps {
  profile: {
    id: string
    full_name: string
    email: string
    role: string
    avatar_url?: string | null
  }
  assignments: AssignmentRow[]
  totalCount: number
  classes: Array<{ id: string; name: string }>
}

type FilterStatus = 'all' | 'active' | 'overdue' | 'mandatory'

const FILTER_STATUSES: FilterStatus[] = ['all', 'active', 'overdue', 'mandatory']

export function AssignmentsPageContent({
  assignments,
  totalCount,
  classes,
}: AssignmentsPageContentProps) {
  const reduceMotion = useReducedMotion()
  const { t } = useTranslation('teacher')
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState(false)

  const now = useMemo(() => new Date(), [])

  const stats = useMemo(() => {
    let active = 0
    let overdue = 0
    let mandatory = 0

    for (const assignment of assignments) {
      if (assignment.is_mandatory) mandatory += 1
      if (!assignment.due_date) {
        active += 1
        continue
      }

      const due = new Date(assignment.due_date)
      if (due < now) overdue += 1
      else active += 1
    }

    return { total: totalCount, active, overdue, mandatory }
  }, [assignments, totalCount, now])

  const filteredAssignments = useMemo(() => {
    if (filter === 'all') return assignments

    return assignments.filter((assignment) => {
      if (filter === 'mandatory') return Boolean(assignment.is_mandatory)
      if (filter === 'overdue') {
        return Boolean(assignment.due_date && new Date(assignment.due_date) < now)
      }
      if (filter === 'active') {
        return !assignment.due_date || new Date(assignment.due_date) >= now
      }

      return true
    })
  }, [assignments, filter, now])

  async function handleDelete() {
    if (!deleteTarget) return

    setDeleteError(false)
    try {
      const result = await deleteAssignment(deleteTarget)
      if (!result.success) {
        setDeleteError(true)
        return
      }
      setDeleteTarget(null)
    } catch {
      setDeleteError(true)
    }
  }

  const gridVariants = reduceMotion ? reducedStaggerGrid : staggerGrid
  const tileVariants = reduceMotion ? reducedStaggerTile : staggerTile

  return (
    <div className="p-6 lg:p-10">
      <div className="mx-auto max-w-[1440px] space-y-10">
        <motion.div
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4"
          variants={gridVariants}
          initial="initial"
          animate="animate"
        >
          <motion.div variants={tileVariants}>
            <StatCard
              label={t('assignments.stats.total')}
              value={stats.total}
              icon="ClipboardText"
              tone="primary"
            />
          </motion.div>
          <motion.div variants={tileVariants}>
            <StatCard
              label={t('assignments.stats.active')}
              value={stats.active}
              icon="Clock"
              tone="tertiary"
            />
          </motion.div>
          <motion.div variants={tileVariants}>
            <StatCard
              label={t('assignments.stats.overdue')}
              value={stats.overdue}
              icon="Warning"
              tone="warning"
            />
          </motion.div>
          <motion.div variants={tileVariants}>
            <Card tone="sky" className="flex flex-col items-center justify-center gap-3 py-6">
              <Icon name="PlusCircle" size={32} className="text-primary" aria-hidden />
              <Button size="sm" href={ROUTES.TEACHER.ASSIGNMENT_NEW}>
                {t('assignments.createNew')}
              </Button>
            </Card>
          </motion.div>
        </motion.div>

        <TeacherActivityPicker classes={classes} />

        <FilterChipGroup
          ariaLabel="Filtrează teme"
          items={FILTER_STATUSES.map((status) => ({
            value: status,
            label: t(`assignments.filter.${status}`),
          }))}
          value={filter}
          onChange={(value) => setFilter(value as FilterStatus)}
          radius="md"
        />

        {filteredAssignments.length === 0 ? (
          <EmptyState
            icon="ClipboardText"
            title={
              assignments.length === 0
                ? t('assignments.empty.title')
                : t('assignments.empty.filtered')
            }
            description={
              assignments.length === 0
                ? t('assignments.empty.description')
                : t('assignments.empty.filteredDescription')
            }
            action={
              assignments.length === 0 ? (
                <Button href={ROUTES.TEACHER.ASSIGNMENT_NEW}>
                  {t('assignments.createFirst')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <motion.div
            className="grid gap-4"
            variants={gridVariants}
            initial="initial"
            animate="animate"
          >
            {filteredAssignments.map((assignment) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                now={now}
                onDelete={() => { setDeleteError(false); setDeleteTarget(assignment.id) }}
                tileVariants={tileVariants}
                labels={{
                  delete: t('assignments.delete'),
                  edit: t('assignments.edit'),
                  mandatory: t('assignments.mandatory'),
                  unknownActivity: t('assignments.unknownActivity'),
                }}
              />
            ))}
          </motion.div>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t('assignments.deleteConfirm.title')}
        body={<>{t('assignments.deleteConfirm.message')}{deleteError && <span role="alert" className="mt-2 block text-error">Nu am putut șterge. Încearcă din nou.</span>}</>}
        confirmLabel={t('assignments.deleteConfirm.confirm')}
        cancelLabel={t('assignments.deleteConfirm.cancel')}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        destructive
        icon="Trash"
      />
    </div>
  )
}

interface AssignmentCardProps {
  assignment: AssignmentRow
  labels: {
    delete: string
    edit: string
    mandatory: string
    unknownActivity: string
  }
  now: Date
  onDelete: () => void
  tileVariants: Variants
}

function assignmentTargetLabel(assignment: AssignmentRow) {
  return assignment.class?.name
    ? assignment.class.name
    : assignment.student?.display_name ?? assignment.student?.username ?? '—'
}

function assignmentIsOverdue(assignment: AssignmentRow, now: Date) {
  return Boolean(assignment.due_date && new Date(assignment.due_date) < now)
}

function AssignmentCard({
  assignment,
  labels,
  now,
  onDelete,
  tileVariants,
}: AssignmentCardProps) {
  const isOverdue = assignmentIsOverdue(assignment, now)

  return (
    <motion.div variants={tileVariants}>
      <Card
        data-testid="assignment-card"
        className="flex flex-col gap-4 p-5 md:flex-row md:items-center"
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-container">
            <Icon
              name="GameController"
              size={24}
              className="text-on-primary-container"
              aria-hidden
            />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-on-surface">
              {assignment.activity?.title ?? labels.unknownActivity}
            </h3>
            <p className="flex items-center gap-1.5 text-sm text-on-surface-variant">
              <Icon name={assignment.class_id ? 'Users' : 'User'} size={16} aria-hidden />
              {assignmentTargetLabel(assignment)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {assignment.is_mandatory ? (
            <Badge tone="warning">{labels.mandatory}</Badge>
          ) : null}
          {assignment.due_date ? (
            <Badge tone={isOverdue ? 'danger' : 'primary'}>
              <Icon name="Calendar" size={14} aria-hidden />
              {formatDate(new Date(assignment.due_date))}
            </Badge>
          ) : null}
          {assignment.activity?.category ? (
            <Badge tone="info">{assignment.activity.category}</Badge>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ActionIcon
            component={Link}
            href={ROUTES.TEACHER.ASSIGNMENT(assignment.id)}
            variant="subtle"
            size={44}
            aria-label={labels.edit}
            styles={{
              root: {
                color: 'var(--color-on-surface-variant)',
                '--ai-hover': 'var(--color-surface-container-high)',
              },
            }}
          >
            <Icon name="Pencil" size={20} aria-hidden />
          </ActionIcon>
          <ActionIcon
            type="button"
            variant="subtle"
            color="red"
            size={44}
            onClick={onDelete}
            aria-label={labels.delete}
            styles={{
              root: {
                color: 'var(--color-on-surface-variant)',
                '--ai-hover': 'var(--color-error-soft)',
                '&:hover': {
                  color: 'var(--color-error)',
                },
              },
            }}
          >
            <Icon name="Trash" size={20} aria-hidden />
          </ActionIcon>
        </div>
      </Card>
    </motion.div>
  )
}
