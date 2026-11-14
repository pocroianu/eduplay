import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/shared/lib/constants/routes';
import {
  ActivityPlayer,
  getActivityType,
  resolveConsentGate,
  type GateResult,
} from '@/features/activities';
import { getActivityInstance } from '@/features/activities/server';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import { getServerLanguage, preloadNamespaces } from '@/lib/i18n/server';
import { getChildConsents } from '@/features/parent-portal/server';

interface ActivityPlayerPageProps {
  params: Promise<{ instanceId: string }>;
}

/**
 * F9 universal player route. Phase 1A renders the shell against any
 * registered activity type; if no type is registered for the instance's
 * `typeId`, the shell shows a friendly placeholder so the route can be
 * exercised end-to-end before concrete types ship in 1B/1C.
 *
 * Route gating: the parent `/student` prefix is already covered by
 * `ROLE_ROUTE_MAP` in `src/lib/supabase/middleware.ts`, so any path under
 * `/student/activities/...` inherits the student-only role gate without
 * needing a redundant entry.
 */
export default async function ActivityPlayerPage({
  params,
}: ActivityPlayerPageProps) {
  const { instanceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.AUTH.LOGIN);
  }

  const instance = await getActivityInstance(supabase, instanceId);

  if (!instance) {
    notFound();
  }

  // EDU-301 + EDU-302: resolve the type's gate decision server-side so the
  // client shell only renders the resolved result. Priority:
  //   1. Custom `gate` hook (full control) — EDU-301
  //   2. Declarative `requiredConsent` shortcut — EDU-302 translates the
  //      child's consent map into a `consent_required` GateResult
  //   3. No gate declared → undefined, treated as "allow"
  const definition = getActivityType(instance.typeId);
  let gateResult: GateResult | undefined;
  if (definition?.gate) {
    gateResult = await definition.gate({
      studentId: instance.assignedTo,
      classId: instance.classId,
      supabase,
      instance,
    });
  } else if (definition?.requiredConsent) {
    const consents = await getChildConsents(supabase, instance.assignedTo);
    gateResult = resolveConsentGate(definition.requiredConsent, consents);
  }

  const lang = await getServerLanguage();
  const resources = await preloadNamespaces(lang, ['activities']);

  return (
    <I18nProvider lang={lang} resources={resources}>
      <ActivityPlayer instance={instance} gateResult={gateResult} />
    </I18nProvider>
  );
}
