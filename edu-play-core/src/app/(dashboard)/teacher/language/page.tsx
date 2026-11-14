import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerLanguage, getServerTranslation } from '@/lib/i18n/server';
import { LANGUAGE_LABELS, type Language } from '@/lib/i18n/config';
import { createClient } from '@/lib/supabase/server';
import { switchLanguage } from '@/features/i18n';
import { ROUTES } from '@/shared/lib/constants/routes';
import { Button, Card } from '@/shared/components/ui/kit';
import { Icon } from '@/shared/components/ui/Icon';

type LanguageOption = {
  id: string;
  label: string;
  sublabel: string;
  code?: string;
  tileClass: string;
  selected: boolean;
};

type LanguageSeed = Omit<LanguageOption, 'sublabel' | 'selected'> & {
  sublabelKey: string;
};

const LANGUAGE_SEEDS: LanguageSeed[] = [
  { id: 'ro', label: 'Română', sublabelKey: 'romanian', code: 'RO', tileClass: 'bg-blue-soft text-blue-deep' },
  { id: 'en', label: 'English', sublabelKey: 'english', code: 'EN', tileClass: 'bg-primary-soft text-primary-deep' },
];


async function t(lang: Language, key: string) {
  return getServerTranslation(lang, 'teacher', key);
}

async function updateLanguage(formData: FormData) {
  'use server';

  const value = formData.get('teacher-language');
  if (typeof value === 'string') {
    await switchLanguage(value);
  }

  redirect(ROUTES.TEACHER.LANGUAGE);
}

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLanguage();
  return {
    title: await t(lang, 'utility.language.metadataTitle'),
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

async function getLanguages(lang: Language, currentLabel: string): Promise<LanguageOption[]> {
  const sublabels = await Promise.all(
    LANGUAGE_SEEDS.map((language) => t(lang, `utility.language.options.${language.sublabelKey}`)),
  );
  const selectedId = lang;

  return LANGUAGE_SEEDS.map((language, index) => {
    const selected = language.id === selectedId;
    return {
      id: language.id,
      label: language.label,
      sublabel: selected ? `${currentLabel}: ${LANGUAGE_LABELS[lang]}` : sublabels[index],
      code: language.code,
      tileClass: language.tileClass,
      selected,
    };
  });
}

export default async function TeacherLanguagePage() {
  await requireTeacher();

  const lang = await getServerLanguage();
  const [close, eyebrow, heading, description, available, current, cancel, setLanguage] = await Promise.all([
    t(lang, 'utility.language.close'),
    t(lang, 'utility.language.eyebrow'),
    t(lang, 'utility.language.heading'),
    t(lang, 'utility.language.description'),
    t(lang, 'utility.language.available'),
    t(lang, 'utility.language.current'),
    t(lang, 'utility.language.cancel'),
    t(lang, 'utility.language.setLanguage'),
  ]);
  const languages = await getLanguages(lang, current);

  return (
    <main className="min-h-screen bg-surface-container px-4 py-8 text-on-surface sm:px-6 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl items-center justify-center">
        <Card className="w-full overflow-hidden border border-outline-variant bg-surface-container-lowest" padding="none">
          <form action={updateLanguage}>
            <div className="flex items-center gap-4 border-b border-outline-variant px-5 py-4">
              <Button
                href={ROUTES.TEACHER.DASHBOARD}
                variant="icon"
                size="sm"
                aria-label={close}
                className="shrink-0 rounded-full bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              >
                <Icon name="X" size="sm" aria-hidden />
                <span className="sr-only">{close}</span>
              </Button>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">{eyebrow}</p>
                <h1 className="mt-1 font-headline text-2xl font-bold text-on-surface">{heading}</h1>
              </div>
            </div>

            <div className="px-6 py-5">
              <p className="text-sm leading-6 text-on-surface-variant">{description}</p>
            </div>

            <fieldset className="mx-4 mb-4 max-h-[54vh] overflow-y-auto rounded-xl border border-outline-variant p-2">
              <legend className="sr-only">{available}</legend>
              <div className="flex flex-col gap-1" role="radiogroup" aria-label={available}>
                {languages.map((language) => {
                  const descriptionId = `language-${language.id}-description`;

                  return (
                    <label
                      key={language.id}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-on-surface transition-colors hover:bg-surface-container has-[:checked]:bg-primary-soft has-[:checked]:text-primary-deep"
                    >
                      <input
                        type="radio"
                        name="teacher-language"
                        value={language.id}
                        defaultChecked={language.selected}
                        aria-describedby={descriptionId}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-outline bg-surface-container-lowest peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary"
                      >
                        <span className="hidden h-2 w-2 rounded-full bg-on-primary peer-checked:block" />
                      </span>
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${language.tileClass}`}>
                        {language.code ?? <Icon name="TextAa" size="sm" aria-hidden />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{language.label}</span>
                        <span id={descriptionId} className="block text-xs text-on-surface-variant">{language.sublabel}</span>
                      </span>
                      {language.selected ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary-deep">
                          <Icon name="Check" size="sm" weight="bold" aria-hidden />
                          {current}
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex flex-col gap-2 border-t border-outline-variant bg-surface-container px-5 py-4 sm:flex-row sm:justify-end">
              <Button href={ROUTES.TEACHER.DASHBOARD} variant="ghost" size="sm">{cancel}</Button>
              <Button type="submit" size="sm">{setLanguage}</Button>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
