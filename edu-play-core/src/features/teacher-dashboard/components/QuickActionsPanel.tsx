'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/shared/components/ui/Icon';
import { Card } from '@/shared/components/ui/kit';
import type { IconName } from '@/shared/components/ui/Icon.registry';
import { ROUTES } from '@/shared/lib/constants';

interface QuickActionsPanelProps {
  classId: string;
}

interface ActionConfig {
  icon: IconName;
  titleKey: string;
  subtitleKey: string;
  iconBg: string;
  hoverBg: string;
  href: string;
}

export function QuickActionsPanel({ classId }: QuickActionsPanelProps) {
  const { t } = useTranslation('teacher');


  const actions: ActionConfig[] = [
    {
      icon: 'PaperPlaneTilt',
      titleKey: 'classes.detail.quickActions.assignActivity',
      subtitleKey: 'classes.detail.quickActions.assignActivitySub',
      iconBg: 'bg-primary text-on-primary',
      hoverBg: 'hover:bg-primary/10',
      href: `${ROUTES.TEACHER.ACTIVITIES}?classId=${classId}`,
    },
    {
      icon: 'MapTrifold',
      titleKey: 'classes.detail.quickActions.assignPath',
      subtitleKey: 'classes.detail.quickActions.assignPathSub',
      iconBg: 'bg-gold text-on-gold',
      hoverBg: 'hover:bg-gold/10',
      href: ROUTES.TEACHER.PATHS,
    },
    {
      icon: 'UserPlus',
      titleKey: 'classes.detail.quickActions.addStudent',
      subtitleKey: 'classes.detail.quickActions.addStudentSub',
      iconBg: 'bg-blue text-white',
      hoverBg: 'hover:bg-blue/10',
      href: `${ROUTES.TEACHER.STUDENT_NEW}?classId=${classId}`,
    },
  ];

  return (
    <Card className="rounded-2xl p-6 lg:p-8">

      <h2 className="font-headline text-xl font-bold tracking-tight mb-6">
        {t('classes.detail.quickActions.heading')}
      </h2>

      <div className="flex flex-col gap-3">
        {actions.map((action) => (
          <Link
            key={action.icon}
            href={action.href}
            className={`group flex w-full items-center gap-4 rounded-xl p-4 text-left transition-colors hover:shadow-soft-sm ${action.hoverBg} focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30`}
          >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${action.iconBg} shadow-soft-sm`}
              >
                <Icon name={action.icon} size="lg" weight="bold" />
              </div>
              <div className="text-left min-w-0 flex-1">
                <p className="font-bold text-[15px] text-on-surface">{t(action.titleKey)}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {t(action.subtitleKey)}
                </p>
              </div>
              <Icon
                name="CaretRight"
                size="md"
                weight="bold"
                className="text-on-surface-variant transition-colors group-hover:text-primary shrink-0"
              />
            </Link>
        ))}
      </div>
    </Card>
  );
}
