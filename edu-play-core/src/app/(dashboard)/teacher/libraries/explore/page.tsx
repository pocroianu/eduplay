import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/shared/lib/constants";
import { TeacherLibrariesExploreContent } from "@/features/teacher-dashboard";
import { getPublishedGames } from "@/features/games/server";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { getServerLanguage, preloadNamespaces } from "@/lib/i18n/server";

export default async function ExploreLibrariesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.AUTH.LOGIN);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "teacher") {
    redirect(ROUTES.AUTH.LOGIN);
  }

  const [libraryActivities, lang] = await Promise.all([
    getPublishedGames().catch((error) => {
      console.error("Error fetching library activities:", error);
      return [];
    }),
    getServerLanguage(),
  ]);
  const resources = await preloadNamespaces(lang, ["teacher"]);
  return (
    <I18nProvider lang={lang} resources={resources}>
      <TeacherLibrariesExploreContent games={libraryActivities} />
    </I18nProvider>
  );
}
