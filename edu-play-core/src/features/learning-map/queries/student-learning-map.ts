import type { ActivePathForStudent, StudentPathStepView } from '@/features/learning-paths/server';
import { getActivityType } from '@/features/activities';
import { ROUTES } from '@/shared/lib/constants/routes';
import type { LearningStage } from '../components/LearningMap';

export interface StudentLearningMapData {
  path: ActivePathForStudent['path'];
  stages: LearningStage[];
  overallProgress: number;
  nextLesson?: {
    id: string;
    title: string;
    description: string;
    href: string;
  };
}

const STEP_COLORS: Array<NonNullable<LearningStage['color']>> = [
  'gold',
  'primary',
  'blue',
];

const STEP_DECOR_ICONS = ['Tree', 'MagnifyingGlass', 'Atom', 'Leaf'] as const;

function getStepHref(step: StudentPathStepView): string | null {
  if (!isLaunchableActivityTemplate(step)) return null;
  return ROUTES.STUDENT.MAP_STEP_LAUNCH(step.id);
}

function isLaunchableActivityTemplate(step: StudentPathStepView): boolean {
  if (!step.targetActivityType) return false;

  const definition = getActivityType(step.targetActivityType);
  if (!definition) return false;

  return definition.configSchema.safeParse(step.targetActivityConfig).success;
}

export function mapActivePathToLearningMap(
  activePath: ActivePathForStudent,
): StudentLearningMapData {
  const stages: LearningStage[] = activePath.steps.map((step, index) => {
    const href = getStepHref(step);

    return {
      id: step.id,
      name: step.title,
      status: step.studentStatus,
      icon: 'Pencil',
      stageNumber: index + 1,
      stars: step.studentStatus === 'completed' ? 3 : 0,
      maxStars: 3,
      color: STEP_COLORS[index % STEP_COLORS.length],
      decorIcon: STEP_DECOR_ICONS[index % STEP_DECOR_ICONS.length],
      lessons: [
        {
          id: step.id,
          title: step.title,
          description: step.description ?? activePath.path.description ?? undefined,
          href: href ?? undefined,
        },
      ],
    };
  });

  const completedCount = stages.filter((stage) => stage.status === 'completed').length;
  const overallProgress =
    stages.length === 0 ? 0 : Math.round((completedCount / stages.length) * 100);
  const currentStage = stages.find((stage) => stage.status === 'current');
  const currentLesson = currentStage?.lessons[0];
  const currentHref = currentLesson?.href;

  return {
    path: activePath.path,
    stages,
    overallProgress,
    nextLesson:
      currentStage && currentLesson && currentHref
        ? {
            id: currentLesson.id,
            title: currentLesson.title,
            description:
              currentLesson.description ?? 'Continuă următorul pas din aventura ta.',
            href: currentHref,
          }
        : undefined,
  };
}
