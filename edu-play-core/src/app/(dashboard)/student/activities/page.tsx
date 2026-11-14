import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/shared/lib/constants";
import { GamesPageContent, type GameWithProgress } from "@/features/games";
import { getGamesWithProgress, getAssignedGames } from "@/features/games/server";
import { DashboardShell } from "@/shared/components/ui/kit";
import { STUDENT_NAV_ITEMS } from "@/features/student-dashboard";

export default async function StudentActivitiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.AUTH.LOGIN);
  }

  // Get profile to verify student role
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "student") {
    redirect(ROUTES.AUTH.LOGIN);
  }

  // Fetch activities with progress
  let gamesWithProgress: GameWithProgress[] = [];
  try {
    gamesWithProgress = await getGamesWithProgress(user.id);
  } catch (error) {
    console.error("Error fetching activities:", error);
  }

  // Fetch assigned activities
  let assignedGames: Awaited<ReturnType<typeof getAssignedGames>> = [];
  try {
    assignedGames = await getAssignedGames(user.id);
  } catch (error) {
    console.error("Error fetching assigned activities:", error);
  }

  return (
    <DashboardShell
      variant="student"
      profile={{
        full_name: profile.full_name ?? "",
        avatar_url: profile.avatar_url,
      }}
      navItems={STUDENT_NAV_ITEMS}
      topBar={{ showLogo: true }}
    >
      <GamesPageContent
        games={gamesWithProgress}
        assignedGames={assignedGames}
        studentName={profile.full_name || undefined}
      />
    </DashboardShell>
  );
}
