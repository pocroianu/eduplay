export interface AssignmentActivityLaunchRow {
  id: string
  activity_id?: string | null
  version_id?: string | null
  version?:
    | {
        activity_id?: string | null
      }
    | Array<{
        activity_id?: string | null
      }>
    | null
}

export function getAssignmentActivityPlayHref(
  assignment: AssignmentActivityLaunchRow,
): string | null {
  const version = Array.isArray(assignment.version)
    ? assignment.version[0]
    : assignment.version
  const activityId = assignment.activity_id ?? version?.activity_id
  if (!assignment.version_id || !activityId) return null

  const params = new URLSearchParams({ assignmentId: assignment.id })
  return `/play/${activityId}?${params.toString()}`
}
