import type { Metadata } from 'next';
import { StudentLoginShell } from '@/features/auth';
import { getServerLanguage, getServerTranslation } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLanguage();
  const [title, description] = await Promise.all([
    getServerTranslation(lang, 'auth', 'login.studentPad.metadataTitle'),
    getServerTranslation(lang, 'auth', 'login.studentPad.metadataDescription'),
  ]);
  return { title, description };
}

export default function StudentLoginPage() {
  return <StudentLoginShell />;
}
