'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Anchor, NavLink, Select, TextInput } from '@mantine/core';
import { Button, Card } from '@/shared/components/ui/kit';
import { Icon } from '@/shared/components/ui/Icon';
import { ROUTES } from '@/shared/lib/constants/routes';
import type { TeacherPortfolioFilterSet } from '../queries/parse-teacher-portfolio-filters';

export interface TeacherPortfolioFiltersProps {
  classes: ReadonlyArray<{ id: string; name: string }>;
  students: ReadonlyArray<{ id: string; username: string; classId?: string }>;
  filters: TeacherPortfolioFilterSet;
}

const filterFieldStyles = {
  label: {
    color: 'var(--color-on-surface-variant)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  input: {
    backgroundColor: 'var(--color-surface-container-lowest)',
    borderColor: 'var(--color-outline-variant)',
    color: 'var(--color-on-surface)',
    fontSize: 14,
    fontWeight: 600,
    minHeight: 40,
  },
} as const;

const studentNavLinkStyles = (active: boolean) => ({
  root: {
    backgroundColor: active ? 'var(--color-surface-container)' : 'transparent',
    borderRadius: 6,
    color: active ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)',
    minHeight: 56,
    padding: '8px 12px',
    '--nl-hover': 'var(--color-surface-container-lowest)',
  },
  label: {
    fontSize: 14,
    fontWeight: active ? 700 : 600,
  },
  section: { color: 'inherit' },
} as const);

function portfolioHref(next: Partial<TeacherPortfolioFilterSet>): string {
  const params = new URLSearchParams();
  const add = (key: keyof TeacherPortfolioFilterSet, value: string | null) => {
    if (value) params.set(key, value);
  };

  add('classId', next.classId ?? null);
  add('studentId', next.studentId ?? null);
  add('from', next.from ?? null);
  add('to', next.to ?? null);

  const query = params.toString();
  return query ? `${ROUTES.TEACHER.PORTFOLIO}?${query}` : ROUTES.TEACHER.PORTFOLIO;
}

export function TeacherPortfolioFilters({
  classes,
  students,
  filters,
}: TeacherPortfolioFiltersProps) {
  const [selectedClassId, setSelectedClassId] = useState(filters.classId ?? '');
  const [selectedStudentId, setSelectedStudentId] = useState(
    filters.studentId ?? '',
  );
  const [fromDate, setFromDate] = useState(filters.from ?? '');
  const [toDate, setToDate] = useState(filters.to ?? '');
  const hasAnyFilter =
    selectedClassId.length > 0 ||
    selectedStudentId.length > 0 ||
    fromDate.length > 0 ||
    toDate.length > 0;
  const activeClassId = filters.classId;
  const selectedClassFilter = selectedClassId || null;
  const canFilterStudentsByClass =
    selectedClassFilter !== null &&
    students.some((student) => student.classId !== undefined);
  const formVisibleStudents = canFilterStudentsByClass
    ? students.filter((student) => student.classId === selectedClassFilter)
    : students;
  const visibleStudents = activeClassId !== null &&
    students.some((student) => student.classId !== undefined)
    ? students.filter((student) => student.classId === activeClassId)
    : students;
  const activeStudentHrefBase = {
    classId: activeClassId,
    from: filters.from,
    to: filters.to,
  };
  const allStudentsLabel =
    activeClassId === null ? 'Toți elevii' : 'Toată clasa';

  return (
    <aside className="space-y-3 lg:sticky lg:top-5" aria-label="Filtre portofoliu">
      <Card padding="none" shadow={false} className="overflow-hidden border border-outline-variant">
        <div className="border-b border-outline-variant bg-surface-container-lowest px-4 py-3">
          <div className="flex items-center gap-2 text-on-surface">
            <Icon name="Users" size={20} weight="bold" />
            <h2 className="text-sm font-bold">Elevi</h2>
          </div>
        </div>
        <div className="flex max-h-[320px] flex-col gap-1 overflow-y-auto p-2">
          <NavLink
            component={Link}
            href={portfolioHref({ ...activeStudentHrefBase, studentId: null })}
            aria-current={filters.studentId === null ? 'page' : undefined}
            active={filters.studentId === null}
            label={<span className="min-w-0 flex-1 truncate">{allStudentsLabel}</span>}
            leftSection={
              <span className="flex size-8 items-center justify-center rounded-sm bg-primary text-xs font-bold text-on-primary">
                JR
              </span>
            }
            rightSection={<Icon name="Archive" size={18} weight="bold" />}
            styles={studentNavLinkStyles(filters.studentId === null)}
          />
          {visibleStudents.map((student) => (
            <NavLink
              component={Link}
              key={student.id}
              href={portfolioHref({
                ...activeStudentHrefBase,
                classId: student.classId ?? null,
                studentId: student.id,
              })}
              aria-current={filters.studentId === student.id ? 'page' : undefined}
              active={filters.studentId === student.id}
              label={<span className="min-w-0 flex-1 truncate">{student.username}</span>}
              leftSection={
                <span className="flex size-8 items-center justify-center rounded-sm bg-primary-soft text-xs font-bold text-primary-deep">
                  {student.username.slice(0, 2).toUpperCase()}
                </span>
              }
              styles={studentNavLinkStyles(filters.studentId === student.id)}
            />
          ))}
        </div>
      </Card>

      <Card padding="md" shadow={false} className="border border-outline-variant">
        <form
          method="GET"
          action={ROUTES.TEACHER.PORTFOLIO}
          className="flex flex-col gap-4"
        >
          <div className="flex items-center gap-2 text-on-surface">
            <Icon name="FunnelSimple" size={20} weight="bold" />
            <h2 className="text-sm font-bold">Filtrează jurnalul</h2>
          </div>

          <Select
            name="classId"
            label="Clasă"
            aria-label="Filtrează după clasă"
            value={selectedClassId}
            onChange={(value) => setSelectedClassId(value ?? '')}
            data={[
              { value: '', label: 'Toate clasele' },
              ...classes.map((cls) => ({
                value: cls.id,
                label: cls.name,
              })),
            ]}
            allowDeselect={false}
            checkIconPosition="right"
            styles={filterFieldStyles}
          />

          <Select
            name="studentId"
            label="Elev"
            aria-label="Filtrează după elev"
            value={selectedStudentId}
            onChange={(value) => setSelectedStudentId(value ?? '')}
            data={[
              { value: '', label: 'Toți elevii' },
              ...formVisibleStudents.map((stu) => ({
                value: stu.id,
                label: stu.username,
              })),
            ]}
            allowDeselect={false}
            checkIconPosition="right"
            styles={filterFieldStyles}
          />

          <div className="grid grid-cols-2 gap-3">
            <TextInput
              type="date"
              name="from"
              label="De la"
              value={fromDate}
              onChange={(event) => setFromDate(event.currentTarget.value)}
              aria-label="Data de început"
              styles={filterFieldStyles}
            />

            <TextInput
              type="date"
              name="to"
              label="Până la"
              value={toDate}
              onChange={(event) => setToDate(event.currentTarget.value)}
              aria-label="Data de sfârșit"
              styles={filterFieldStyles}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" size="md">
              <Icon name="MagnifyingGlass" size={18} weight="bold" />
              Aplică
            </Button>
            {hasAnyFilter ? (
              <Anchor
                component={Link}
                href={ROUTES.TEACHER.PORTFOLIO}
                className="inline-flex items-center gap-1 text-sm font-bold text-on-surface-variant hover:text-on-surface"
                styles={{
                  root: {
                    color: 'var(--color-on-surface-variant)',
                    textDecoration: 'none',
                  },
                }}
              >
                <Icon name="X" size={16} weight="bold" />
                Șterge filtrele
              </Anchor>
            ) : null}
          </div>
        </form>
      </Card>
    </aside>
  );
}
