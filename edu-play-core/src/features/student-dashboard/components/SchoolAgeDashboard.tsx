'use client'

import { QuestMap } from './quest-map'
import type { QuestLesson, QuestUnit } from './quest-map'
import type { StudentActivityCard } from './StudentActivitiesLane'

export interface SchoolAgeDashboardProps {
  profile: {
    full_name: string
    avatar_url?: string | null
  }
  className: string | null
  primarySubject: string | null
  stats: {
    lives: number
    weeklyXp: number
    streak: number
  }
  units: QuestUnit[]
  lessons: QuestLesson[]
  activities?: StudentActivityCard[]
}

function getFirstName(fullName: string): string {
  return fullName.split(' ')[0] || fullName
}

export function SchoolAgeDashboard({
  profile,
  className,
  primarySubject,
  stats,
  units,
  lessons,
  activities = [],
}: SchoolAgeDashboardProps) {
  return (
    <div className="[&_[data-mode='kid']]:bg-surface [&_[data-mode='kid']]:text-on-surface [&_[data-mode='kid']_aside]:border-l [&_[data-mode='kid']_aside]:border-outline-variant [&_[data-mode='kid']_aside]:bg-surface-container-lowest [&_[data-mode='kid']_aside]:shadow-soft-sm [&_[data-mode='kid']_header]:rounded-xl [&_[data-mode='kid']_header]:border [&_[data-mode='kid']_header]:border-outline-variant [&_[data-mode='kid']_header]:bg-surface-container-lowest [&_[data-mode='kid']_header]:p-4 [&_[data-mode='kid']_header]:shadow-soft-sm [&_[data-mode='kid']_ol>li>div>div]:rounded-xl [&_[data-mode='kid']_ol>li>div>div]:border [&_[data-mode='kid']_ol>li>div>div]:border-outline-variant [&_[data-mode='kid']_ol>li>div>div]:shadow-soft-sm [&_[data-mode='kid']_ol>li>div>div]:text-lg">
      <QuestMap
      profile={{
        fullName: profile.full_name,
        firstName: getFirstName(profile.full_name),
        avatarUrl: profile.avatar_url ?? null,
        className,
        primarySubject,
      }}
      stats={stats}
      units={units}
      lessons={lessons}
      activities={activities}
      />
    </div>
  )
}
