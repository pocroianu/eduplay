import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/shared/lib/constants";
import {
  TeacherActivitiesHub,
  type TeacherActivitiesStatusFilter,
  type TeacherActivitiesTab,
} from "@/features/teacher-activities";
import { getTeacherOwnedActivities } from "@/features/teacher-activities/server";
import { getPublishedGames } from "@/features/games/server";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { getServerLanguage, preloadNamespaces } from "@/lib/i18n/server";

function parseTab(tab: string | undefined): TeacherActivitiesTab {
  return tab === "my" ? "my" : "library";
}

function parseStatus(status: string | undefined): TeacherActivitiesStatusFilter {
  if (
    status === "draft" ||
    status === "published" ||
    status === "archived" ||
    status === "in_review"
  ) {
    return status;
  }

  return "all";
}

type OwnedActivitySort = "newest" | "oldest" | "title";

function parseSort(sort: string | undefined): OwnedActivitySort {
  if (sort === "oldest" || sort === "title") return sort;
  return "newest";
}

export default async function TeacherActivitiesPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = (await searchParams) ?? {};
  const activeTab = parseTab(typeof query.tab === "string" ? query.tab : undefined);
  const statusFilter = parseStatus(
    typeof query.status === "string" ? query.status : undefined,
  );
  const sortBy = parseSort(typeof query.sort === "string" ? query.sort : undefined);
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

  const [libraryResult, ownedActivities, lang] = await Promise.all([
    getPublishedGames().catch((error) => {
      console.error("Error fetching activities:", error);
      return [];
    }),
    getTeacherOwnedActivities(supabase, user.id),
    getServerLanguage(),
  ]);
  const resources = await preloadNamespaces(lang, ["teacher"]);

  return (
    <I18nProvider lang={lang} resources={resources}>
      <div className="p-6 lg:p-10">
        <TeacherActivitiesHub
          activeTab={activeTab}
          statusFilter={statusFilter}
          sortBy={sortBy}
          libraryActivities={libraryResult}
          ownedActivities={ownedActivities}
        />
      </div>
    </I18nProvider>
  );
}
