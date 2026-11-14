import { notFound, redirect } from 'next/navigation';
import { launchLearningMapStep } from '@/features/learning-map/server';

interface LaunchStepPageProps {
  params: Promise<{
    stepId: string;
  }>;
}

export default async function LaunchStepPage({ params }: LaunchStepPageProps) {
  const { stepId } = await params;
  const result = await launchLearningMapStep(stepId);

  if (!result) notFound();

  redirect(result.href);
}
