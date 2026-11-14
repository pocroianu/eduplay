import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/shared/lib/constants/routes'
import { InteractiveLesson } from '@/features/lessons'

const SAMPLE_STEPS: import('@/features/lessons').LessonStep[] = [
  {
    id: '1',
    type: 'info',
    question: 'Bine ai venit!',
    description: 'Astăzi vom învăța despre numere. Ești gata?',
    icon: 'RocketLaunch',
    points: 0,
  },
  {
    id: '2',
    type: 'multiple-choice',
    question: 'Câte mere sunt?',
    description: 'Numără merele din imagine.',
    icon: 'Question',
    points: 10,
    options: [
      { id: 'a', label: '2', isCorrect: false },
      { id: 'b', label: '3', isCorrect: true },
      { id: 'c', label: '4', isCorrect: false },
      { id: 'd', label: '5', isCorrect: false },
    ],
  },
  {
    id: '3',
    type: 'multiple-choice',
    question: 'Care vine după 5?',
    description: 'Alege numărul corect.',
    icon: 'ListChecks',
    points: 10,
    options: [
      { id: 'a', label: '4', isCorrect: false },
      { id: 'b', label: '6', isCorrect: true },
      { id: 'c', label: '7', isCorrect: false },
      { id: 'd', label: '3', isCorrect: false },
    ],
  },
  {
    id: '4',
    type: 'fill-in-the-blank',
    question: 'Completează: 2 + ___ = 5',
    description: 'Scrie numărul care lipsește.',
    icon: 'Pencil',
    points: 15,
    blanks: [
      { id: 'b1', placeholder: '?', acceptedAnswers: ['3'] },
    ],
  },
  {
    id: '5',
    type: 'info',
    question: 'Felicitări!',
    description: 'Ai terminat lecția cu succes! Ai câștigat 50 XP.',
    icon: 'Confetti',
    points: 0,
  },
]

export default async function LessonPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect(ROUTES.AUTH.LOGIN)

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'student') redirect(ROUTES.AUTH.LOGIN)

  return (
    <InteractiveLesson
      title="Numerele Vesele"
      subject="Matematică"
      steps={SAMPLE_STEPS}
      profile={{ full_name: profile.full_name, avatar_url: profile.avatar_url }}
    />
  )
}
