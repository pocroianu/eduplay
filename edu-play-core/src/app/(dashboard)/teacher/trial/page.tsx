import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerLanguage, getServerTranslation } from '@/lib/i18n/server';
import type { Language } from '@/lib/i18n/config';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/shared/lib/constants/routes';
import { Badge, Button, Card } from '@/shared/components/ui/kit';
import { Icon } from '@/shared/components/ui/Icon';

async function t(lang: Language, key: string) {
  return getServerTranslation(lang, 'teacher', key);
}

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLanguage();
  return {
    title: await t(lang, 'utility.trial.metadataTitle'),
  };
}

async function requireTeacher() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(ROUTES.AUTH.LOGIN);

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'teacher') {
    redirect(ROUTES.AUTH.LOGIN);
  }
}

function PlanMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-outline-variant py-3 last:border-b-0">
      <strong className="w-20 shrink-0 font-headline text-2xl font-bold text-on-surface">{value}</strong>
      <span className="text-sm leading-5 text-on-surface-variant">{label}</span>
    </div>
  );
}

function PremiumFeature({ children }: { children: string }) {
  return (
    <li className="flex items-center gap-2 text-sm text-on-surface">
      <Icon name="CheckCircle" size="sm" className="shrink-0 text-success" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

export default async function TeacherTrialPage() {
  await requireTeacher();

  const lang = await getServerLanguage();
  const [
    heading,
    subtitle,
    freePlan,
    premiumPlan,
    recommended,
    activities,
    classes,
    classSingular,
    students,
    teachers,
    unlimited,
    aiActivities,
    multipage,
    drafts,
    scheduled,
    aiAnnouncements,
    noCard,
    close,
    unavailableNote,
    startUnavailable,
    learnMoreUnavailable,
  ] = await Promise.all([
    t(lang, 'utility.trial.heading'),
    t(lang, 'utility.trial.subtitle'),
    t(lang, 'utility.trial.freePlan'),
    t(lang, 'utility.trial.premiumPlan'),
    t(lang, 'utility.trial.recommended'),
    t(lang, 'utility.trial.activities'),
    t(lang, 'utility.trial.classes'),
    t(lang, 'utility.trial.classSingular'),
    t(lang, 'utility.trial.students'),
    t(lang, 'utility.trial.teachers'),
    t(lang, 'utility.trial.unlimited'),
    t(lang, 'utility.trial.aiActivities'),
    t(lang, 'utility.trial.multipage'),
    t(lang, 'utility.trial.drafts'),
    t(lang, 'utility.trial.scheduled'),
    t(lang, 'utility.trial.aiAnnouncements'),
    t(lang, 'utility.trial.noCard'),
    t(lang, 'utility.trial.close'),
    t(lang, 'utility.trial.unavailableNote'),
    t(lang, 'utility.trial.startUnavailable'),
    t(lang, 'utility.trial.learnMoreUnavailable'),
  ]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-container px-4 py-8 text-on-surface sm:px-6 lg:px-10">
      <Card className="w-full max-w-4xl overflow-hidden border border-outline-variant bg-surface-container-lowest" padding="none">
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant px-6 py-6">
          <div className="text-left">
            <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface">{heading}</h1>
            <p className="mt-2 text-sm text-on-surface-variant">{subtitle}</p>
          </div>
          <Button href={ROUTES.TEACHER.DASHBOARD} variant="icon" size="sm" aria-label={close}>
            <Icon name="X" size="sm" aria-hidden />
          </Button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2 md:p-6">
          <section aria-label={freePlan} className="rounded-lg border border-outline-variant bg-surface p-5">
            <h2 className="font-headline text-xl font-bold text-on-surface">{freePlan}</h2>
            <div className="mt-4">
              <PlanMetric value="35" label={activities} />
              <PlanMetric value="1" label={classSingular} />
              <PlanMetric value="35" label={students} />
              <PlanMetric value="1" label={teachers} />
            </div>
          </section>

          <section aria-label={`${premiumPlan} ${recommended}`} className="rounded-lg border border-primary bg-primary-soft p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-headline text-xl font-bold text-on-surface">{premiumPlan}</h2>
              <Badge tone="primary">{recommended}</Badge>
            </div>
            <div className="mt-4 rounded-lg bg-surface-container-lowest px-4">
              <PlanMetric value={unlimited} label={activities} />
              <PlanMetric value={unlimited} label={classes} />
              <PlanMetric value="150" label={students} />
              <PlanMetric value="30" label={teachers} />
            </div>
            <ul className="mt-5 grid gap-2">
              <PremiumFeature>{aiActivities}</PremiumFeature>
              <PremiumFeature>{multipage}</PremiumFeature>
              <PremiumFeature>{drafts}</PremiumFeature>
              <PremiumFeature>{scheduled}</PremiumFeature>
              <PremiumFeature>{aiAnnouncements}</PremiumFeature>
            </ul>
          </section>
        </div>

        <div className="flex flex-col items-center gap-3 border-t border-outline-variant bg-surface px-5 py-5 text-center sm:flex-row sm:justify-center">
          <p className="text-sm font-semibold text-on-surface-variant">{startUnavailable}</p>
          <Button href={ROUTES.HOME} variant="secondary">
            {learnMoreUnavailable}
          </Button>
          <p id="premium-trial-unavailable" className="max-w-md text-xs font-semibold leading-5 text-on-surface-variant sm:ml-2">
            {unavailableNote} {noCard}
          </p>
        </div>
      </Card>
    </div>
  );
}
