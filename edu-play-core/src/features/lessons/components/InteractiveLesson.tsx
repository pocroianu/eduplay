'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { TextInput, UnstyledButton } from '@mantine/core'
import { ProgressBar } from '@/shared/components/ui/ProgressBar'
import { Button, MantineBoundary, RewardModal, Vulpita, type RewardItem } from '@/shared/components/ui/kit'
import { Icon } from '@/shared/components/ui/Icon'
import type { IconName } from '@/shared/components/ui/Icon.registry';
import { ROUTES } from '@/shared/lib/constants/routes'
import {
  fadeIn,
  fadeInUp,
  slideIn,
  staggerContainer,
} from '@/config/animations'

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

/** A single answer option for multiple-choice steps. */
export interface AnswerOption {
  id: string
  label: string
  /** Material icon name shown alongside the option (optional). */
  icon?: IconName
  isCorrect: boolean
}

/** Drag-and-drop placeholder token. */
export interface DragToken {
  id: string
  label: string
  /** The zone id this token should be dropped into. */
  targetZoneId: string
}

export interface DropZone {
  id: string
  label: string
}

/** Fill-in-the-blank field. */
export interface BlankField {
  id: string
  /** Placeholder hint shown inside the field. */
  placeholder: string
  /** Accepted answers (case-insensitive comparison). */
  acceptedAnswers: string[]
}

export type LessonStepType = 'multiple-choice' | 'drag-and-drop' | 'fill-in-the-blank' | 'info'

export interface LessonStep {
  id: string
  type: LessonStepType
  /** The main question or instruction shown at the top of the activity area. */
  question: string
  /** Optional longer explanation shown below the question. */
  description?: string
  /** Material icon name representing this step visually. */
  icon?: IconName
  /** Points awarded for a correct answer. */
  points?: number
  // --- type-specific data ---
  options?: AnswerOption[]
  tokens?: DragToken[]
  dropZones?: DropZone[]
  blanks?: BlankField[]
}

export interface LessonProfile {
  full_name: string
  avatar_url?: string | null
}

export interface InteractiveLessonProps {
  title: string
  subject: string
  steps: LessonStep[]
  profile: LessonProfile
  /** Whether to show a running timer. Default false. */
  showTimer?: boolean
  /** Callback fired when the lesson is completed with total score. */
  onComplete?: (score: number, maxScore: number, timeSpent: number) => void
  /** Callback fired when user navigates back. */
  onBack?: () => void
}

/* -------------------------------------------------------------------------- */
/*  Subject helpers                                                           */
/* -------------------------------------------------------------------------- */

const SUBJECT_META: Record<string, { badge: string; color: string; icon: IconName }> = {
  math: { badge: 'Misiune: Matematică', color: 'bg-primary-container text-on-primary-container', icon: 'Calculator' },
  literacy: { badge: 'Misiune: Limba română', color: 'bg-gold-soft text-gold-deep', icon: 'BookOpen' },
  phonics: { badge: 'Misiune: Sunete', color: 'bg-primary-soft text-primary-deep', icon: 'Ear' },
  shapes: { badge: 'Misiune: Forme', color: 'bg-primary-container text-on-primary-container', icon: 'Shapes' },
  colors: { badge: 'Misiune: Culori', color: 'bg-gold-soft text-gold-deep', icon: 'Palette' },
  vocabulary: { badge: 'Misiune: Cuvinte', color: 'bg-primary-soft text-primary-deep', icon: 'TextAa' },
}

function getSubjectMeta(subject: string) {
  return SUBJECT_META[subject] ?? { badge: 'Misiune ghidată', color: 'bg-surface-container text-on-surface', icon: 'GraduationCap' }
}

/* -------------------------------------------------------------------------- */
/*  Mascot encouragement lines                                                */
/* -------------------------------------------------------------------------- */

const ENCOURAGEMENTS = [
  'Bravo! Continuă tot așa!',
  'Ești pe drumul cel bun!',
  'Excelent! Mai încearcă!',
  'Super! Ai grijă la detalii!',
  'Foarte bine! Nu te grăbi!',
]

const CORRECT_MESSAGES = [
  'Răspuns corect! Felicitări!',
  'Exact! Ai nimerit!',
  'Perfect! Ești un campion!',
  'Bravo! Răspuns excelent!',
]

const INCORRECT_MESSAGES = [
  'Mai încearcă o dată!',
  'Nu-i nimic, încearcă din nou!',
  'Aproape! Gândește-te bine!',
  'Ai curaj, poți reuși!',
]

function pickRandom(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)]
}

/* -------------------------------------------------------------------------- */
/*  Timer hook                                                                */
/* -------------------------------------------------------------------------- */

function useTimer(running: boolean) {
  const [seconds, setSeconds] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running])

  const formatted = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  return { seconds, formatted }
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function InteractiveLesson({
  title,
  subject,
  steps,
  profile,
  showTimer = false,
  onComplete,
  onBack,
}: InteractiveLessonProps) {
  const router = useRouter()
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState(false)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [blankValues, setBlankValues] = useState<Record<string, string>>({})
  const [dragPlacements, setDragPlacements] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [isPaused, setIsPaused] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  const totalSteps = steps.length
  const currentStep = steps[currentStepIndex]
  const progressPercent = totalSteps > 0 ? Math.round(((currentStepIndex) / totalSteps) * 100) : 0
  const maxScore = steps.reduce((sum, s) => sum + (s.points ?? 10), 0)
  const subjectMeta = getSubjectMeta(subject)
  const { seconds, formatted: timerFormatted } = useTimer(showTimer && !isPaused && !isComplete)

  /* --- Feedback toast --- */
  const showFeedbackToast = useCallback((message: string) => {
    setToastMessage(message)
    setShowToast(true)
    const timeout = setTimeout(() => setShowToast(false), 2200)
    return () => clearTimeout(timeout)
  }, [])

  /* --- Answer validation --- */
  const checkAnswer = useCallback(() => {
    if (!currentStep || answered) return

    let isCorrect = false
    const stepPoints = currentStep.points ?? 10

    switch (currentStep.type) {
      case 'multiple-choice': {
        const chosen = currentStep.options?.find((o) => o.id === selectedOptionId)
        isCorrect = !!chosen?.isCorrect
        break
      }
      case 'fill-in-the-blank': {
        isCorrect = (currentStep.blanks ?? []).every((blank) => {
          const value = (blankValues[blank.id] ?? '').trim().toLowerCase()
          return blank.acceptedAnswers.some((a) => a.toLowerCase() === value)
        })
        break
      }
      case 'drag-and-drop': {
        isCorrect = (currentStep.tokens ?? []).every(
          (token) => dragPlacements[token.id] === token.targetZoneId
        )
        break
      }
      case 'info':
        isCorrect = true
        break
    }

    setFeedback(isCorrect ? 'correct' : 'incorrect')
    setAnswered(true)

    if (isCorrect) {
      setScore((prev) => prev + stepPoints)
      showFeedbackToast(`${pickRandom(CORRECT_MESSAGES)} +${stepPoints} Puncte`)
    } else {
      showFeedbackToast(pickRandom(INCORRECT_MESSAGES))
    }
  }, [currentStep, answered, selectedOptionId, blankValues, dragPlacements, showFeedbackToast])

  /* --- Navigation --- */
  const goNext = useCallback(() => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((i) => i + 1)
      setAnswered(false)
      setSelectedOptionId(null)
      setBlankValues({})
      setDragPlacements({})
      setFeedback(null)
    } else {
      setIsComplete(true)
      onComplete?.(score, maxScore, seconds)
    }
  }, [currentStepIndex, totalSteps, score, maxScore, seconds, onComplete])

  const goPrev = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((i) => i - 1)
      setAnswered(false)
      setSelectedOptionId(null)
      setBlankValues({})
      setDragPlacements({})
      setFeedback(null)
    }
  }, [currentStepIndex])

  /* --- Can submit check --- */
  const canSubmit = (() => {
    if (!currentStep || answered) return false
    switch (currentStep.type) {
      case 'multiple-choice':
        return selectedOptionId !== null
      case 'fill-in-the-blank':
        return (currentStep.blanks ?? []).every((b) => (blankValues[b.id] ?? '').trim().length > 0)
      case 'drag-and-drop':
        return (currentStep.tokens ?? []).every((t) => !!dragPlacements[t.id])
      case 'info':
        return true
    }
  })()

  /* -------------------------------------------------------------------------- */
  /*  Completion screen                                                         */
  /* -------------------------------------------------------------------------- */

  if (isComplete) {
    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
    const starCount = percentage >= 90 ? 3 : percentage >= 60 ? 2 : percentage >= 30 ? 1 : 0
    const firstName = profile.full_name.split(' ')[0]
    const rewards: RewardItem[] = [
      { id: 'xp', tone: 'gold', glyph: 'xp', value: `+${score}`, label: 'XP' },
      { id: 'stars', tone: 'coral', glyph: 'trophy', value: `${starCount}/3`, label: 'Stele' },
    ]

    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--color-surface)' }}
      >
        <RewardModal
          open
          onDismiss={() => router.push(ROUTES.STUDENT.DASHBOARD)}
          eyebrow="Lecție terminată!"
          title={<>Felicitări, {firstName}!</>}
          subtitle={`Ai terminat ${title} cu ${percentage}%. ${score} din ${maxScore} puncte${showTimer ? ` în ${timerFormatted}` : ''}.`}
          rewards={rewards}
          ariaLabel={`Felicitări, ${firstName}! Lecție terminată.`}
          actions={(dismiss) => (
            <div className="flex flex-col gap-3 w-full sm:flex-row sm:justify-center">
              <Button
                mode="kid"
                variant="primary"
                size="lg"
                onClick={dismiss}
              >
                <Icon name="House" size={20} />
                Înapoi la tablou
              </Button>
              <Button
                mode="kid"
                variant="ghost"
                tone="cream"
                size="lg"
                onClick={() => router.push(ROUTES.STUDENT.ACTIVITIES)}
              >
                <Icon name="Play" size={20} />
                Alt joc
              </Button>
            </div>
          )}
        />
      </div>
    )
  }

  /* -------------------------------------------------------------------------- */
  /*  Main lesson UI                                                            */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col overflow-hidden">
      {/* ---- Header ---- */}
      <header className="bg-surface-container-lowest flex justify-between items-center w-full px-4 md:px-6 py-4 z-30 flex-wrap gap-3 border-b border-outline-variant">
        {/* Left: back + logo */}
        <div className="flex min-w-0 items-center gap-3 shrink-0">
          <Button
            mode="kid"
            onClick={onBack}
            variant="ghost"
            tone="cream"
            size="lg"
          >
            <Icon name="ArrowLeft" size={20} />
            <span className="hidden sm:inline">Înapoi</span>
          </Button>
          <div className="h-8 w-px bg-outline-variant hidden sm:block" />
          <span className="text-2xl font-bold text-primary font-headline tracking-tight hidden sm:inline">
            EduPlay
          </span>
        </div>

        {/* Center: progress */}
        <div className="min-w-0 flex-1 max-w-md mx-0 sm:mx-8 order-last sm:order-none w-full sm:w-auto">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="min-w-[8rem] flex-1">
              <ProgressBar
                value={currentStepIndex + (answered ? 1 : 0)}
                max={totalSteps}
                color="bg-primary"
                height="h-3"
              />
            </div>
            {/* Step dots */}
            <div className="flex min-w-0 max-w-full flex-wrap gap-1">
              {steps.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                    idx < currentStepIndex
                      ? 'bg-primary'
                      : idx === currentStepIndex
                        ? 'bg-primary-soft animate-pulse motion-reduce:animate-none'
                        : 'bg-surface-container'
                  }`}
                />
              ))}
            </div>
            <span className="shrink-0 text-base font-bold text-on-surface-variant">
              {progressPercent}% Gata!
            </span>
          </div>
        </div>

        {/* Right: help + score + timer */}
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {showTimer && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container rounded-full text-base font-bold text-on-surface-variant">
              <Icon name="Timer" size={18} />
              {timerFormatted}
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-lowest rounded-full shadow-soft">
            <Icon name="Trophy" weight="fill" size={18} className="text-gold" />
            <span className="font-bold text-base">{score}</span>
          </div>
        </div>
      </header>

      {/* ---- Main content ---- */}
      <div className="flex-1 relative flex items-stretch p-4 md:p-6 overflow-hidden">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 z-10">
          {/* ---- Left Panel: Instructions ---- */}
          <div className="lg:col-span-4 bg-surface-container-lowest rounded-2xl p-6 md:p-8 shadow-soft flex flex-col">
            <div className="mb-6">
              <span className={`inline-block text-base font-bold uppercase tracking-wide px-3 py-1 rounded-full ${subjectMeta.color}`}>
                {subjectMeta.badge}
              </span>
              <h1 className="text-2xl md:text-3xl font-headline font-bold text-on-surface mt-4 leading-tight">
                {title}
              </h1>
            </div>

            <div className="space-y-5 flex-1 overflow-y-auto pr-2">
              <p className="text-on-surface-variant text-lg leading-relaxed">
                {currentStep?.description ?? currentStep?.question}
              </p>

              {currentStep?.type !== 'info' && (
                <div className="rounded-xl bg-primary-soft p-4">
                  <p className="text-lg font-medium italic text-on-surface">
                    &ldquo;{ENCOURAGEMENTS[currentStepIndex % ENCOURAGEMENTS.length]}&rdquo;
                  </p>
                </div>
              )}

              {/* Step indicators */}
              <motion.div className="flex flex-col gap-2.5" variants={staggerContainer} initial="initial" animate="animate">
                {steps.map((step, idx) => (
                  <motion.div
                    key={step.id}
                            className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      idx === currentStepIndex
                        ? 'bg-primary-soft ring-1 ring-primary/30'
                        : idx < currentStepIndex
                          ? 'bg-primary/5'
                          : 'bg-surface-container'
                    }`}
                  >
                    <span
                      className={`w-8 h-8 flex items-center justify-center font-bold text-base rounded-full shrink-0 ${
                        idx < currentStepIndex
                          ? 'bg-primary text-on-primary'
                          : idx === currentStepIndex
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {idx < currentStepIndex ? (
                        <Icon name="Check" size={16} />
                      ) : (
                        idx + 1
                      )}
                    </span>
                    <span className="text-lg font-medium truncate">
                      {step.question.length > 40 ? step.question.slice(0, 40) + '...' : step.question}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Mascot area */}
            <div className="mt-6 pt-5">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 shrink-0">
                  <Vulpita mood="think" size={56} />
                </div>
                <div>
                  <p className="text-base font-bold text-on-surface-variant uppercase">Sfat de la Vulpița:</p>
                  <p className="text-lg font-medium">
                    Pasul {currentStepIndex + 1} din {totalSteps}. {ENCOURAGEMENTS[currentStepIndex % ENCOURAGEMENTS.length]}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ---- Right Panel: Activity + Controls ---- */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Activity area */}
            <div className="flex-1 bg-surface-container-lowest rounded-2xl shadow-soft relative overflow-hidden min-h-[400px] md:min-h-[500px]">
              {/* Subtle background wash */}
              <div className="absolute inset-0 bg-primary-wash pointer-events-none" />

              {/* HUD buttons */}
              <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
                <Button
                  variant="icon"
                  size="xl"
                  onClick={() => setIsPaused((p) => !p)}
                  className="h-16 w-16 rounded-full"
                  aria-label={isPaused ? 'Continuă' : 'Pauză'}
                >
                  <Icon name={isPaused ? 'Play' : 'Pause'} weight="fill" className="text-error" />
                </Button>
              </div>

              {/* Pause overlay */}
              <AnimatePresence>
                {isPaused && (
                  <motion.div
                    className="absolute inset-0 bg-surface/95 z-10 flex flex-col items-center justify-center gap-4"
                    variants={fadeIn}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    <Icon name="PauseCircle" weight="fill" size={64} className="text-primary" />
                    <h2 className="font-headline text-2xl font-bold">Pauză</h2>
                    <Button mode="kid" size="lg" variant="primary" onClick={() => setIsPaused(false)}>
                      Continuă
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Step content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep?.id}
                  className="absolute inset-0 flex flex-col items-center justify-center p-6 md:p-12"
                  variants={slideIn}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  {/* Question zone */}
                  <div className="bg-surface-container-lowest px-6 md:px-8 py-4 rounded-2xl shadow-soft-sm text-center mb-8 max-w-lg">
                    {currentStep?.icon && (
                      <Icon name={currentStep.icon} size={32} className="text-primary mb-2 block mx-auto" />
                    )}
                    <h2 className="text-lg md:text-xl font-bold text-on-surface">{currentStep?.question}</h2>
                  </div>

                  {/* Interactive elements based on step type */}
                  <div className="w-full max-w-xl">
                    {currentStep?.type === 'multiple-choice' && currentStep.options && (
                      <MultipleChoice
                        options={currentStep.options}
                        selectedId={selectedOptionId}
                        onSelect={setSelectedOptionId}
                        answered={answered}
                      />
                    )}

                    {currentStep?.type === 'fill-in-the-blank' && currentStep.blanks && (
                      <FillInTheBlank
                        blanks={currentStep.blanks}
                        values={blankValues}
                        onChange={setBlankValues}
                        answered={answered}
                      />
                    )}

                    {currentStep?.type === 'drag-and-drop' && currentStep.tokens && currentStep.dropZones && (
                      <DragAndDrop
                        tokens={currentStep.tokens}
                        dropZones={currentStep.dropZones}
                        placements={dragPlacements}
                        onPlace={setDragPlacements}
                        answered={answered}
                      />
                    )}

                    {currentStep?.type === 'info' && (
                      <motion.div
                        className="text-center text-on-surface-variant text-lg"
                        variants={fadeInUp}
                        initial="initial"
                        animate="animate"
                      >
                        <Icon name="Info" size={48} className="text-primary mb-4 block mx-auto" />
                        <p>{currentStep.description ?? 'Citește cu atenție și apasă Următorul.'}</p>
                      </motion.div>
                    )}
                  </div>

                  {/* Feedback indicator */}
                  <AnimatePresence>
                    {feedback && (
                      <motion.div
                        className={`mt-6 px-6 py-3 rounded-full font-bold text-lg flex items-center gap-2 shadow-soft ${
                          feedback === 'correct'
                            ? 'bg-primary text-on-primary'
                            : 'bg-gold-soft text-gold-deep'
                        }`}
                        role="status" aria-live="polite" variants={fadeInUp}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                      >
                        <Icon
                          name={feedback === 'correct' ? 'CheckCircle' : 'ArrowCounterClockwise'}
                          weight="fill"
                          size={24}
                        />
                        {feedback === 'correct' ? 'Corect!' : 'Aproape!'}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Bottom controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <Button
                mode="kid"
                onClick={goPrev}
                disabled={currentStepIndex === 0}
                variant="ghost"
                tone="cream"
                size="lg"
              >
                <Icon name="ArrowLeft" size={20} />
                Înapoi
              </Button>

              <div className="flex items-center gap-4 flex-1 justify-end">
                <div className="flex flex-col items-end mr-2">
                  <span className="text-base font-bold text-primary uppercase tracking-normal">
                    Pas {currentStepIndex + 1}/{totalSteps}
                  </span>
                  <div className="flex gap-1 mt-1">
                    {steps.map((_, idx) => (
                      <div
                        key={idx}
                        className={`w-3 h-1 rounded-full ${idx <= currentStepIndex ? 'bg-primary' : 'bg-surface-container'}`}
                      />
                    ))}
                  </div>
                </div>

                {!answered && currentStep?.type !== 'info' ? (
                  <Button
                    mode="kid"
                    onClick={checkAnswer}
                    disabled={!canSubmit}
                    variant="primary"
                    size="lg"
                  >
                    Verifică
                    <Icon name="Check" size={20} />
                  </Button>
                ) : (
                  <Button
                    mode="kid"
                    onClick={goNext}
                    variant="primary"
                    size="lg"
                  >
                    {currentStepIndex < totalSteps - 1 ? 'Următorul' : 'Termină'}
                    <Icon name="ArrowRight" size={20} />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Floating toast ---- */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            className="fixed bottom-10 left-1/2 z-50 pointer-events-none"
            initial={{ opacity: 0, y: 40, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 40, x: '-50%' }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className={`px-8 py-4 rounded-full shadow-soft flex items-center gap-3 font-bold text-lg ${
              feedback === 'correct'
                ? 'bg-primary text-on-primary'
                : 'bg-gold-soft text-gold-deep'
            }`}>
              <Icon
                name={feedback === 'correct' ? 'CheckCircle' : 'Info'}
                weight="fill"
                size={24}
              />
              {toastMessage}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background decorative icons */}
      <div className="fixed top-20 right-[15%] pointer-events-none opacity-[0.08]">
        <Icon name="Star" size={96} className="text-gold rotate-12" />
      </div>
      <div className="fixed bottom-20 left-[10%] pointer-events-none opacity-[0.08]">
        <Icon name="GraduationCap" size={112} className="text-primary -rotate-12" />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Sub-components: Multiple Choice                                           */
/* -------------------------------------------------------------------------- */

interface MultipleChoiceProps {
  options: AnswerOption[]
  selectedId: string | null
  onSelect: (id: string) => void
  answered: boolean
}

function MultipleChoice({ options, selectedId, onSelect, answered }: MultipleChoiceProps) {
  return (
    <MantineBoundary>
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {options.map((option) => {
        const isSelected = selectedId === option.id
        const showCorrect = answered && option.isCorrect
        const showIncorrect = answered && isSelected && !option.isCorrect

        let borderColor = 'border-outline-variant'
        let bgColor = 'bg-surface-container-lowest'
        if (isSelected && !answered) {
          borderColor = 'border-primary'
          bgColor = 'bg-primary/5'
        }
        if (showCorrect) {
          borderColor = 'border-success'
          bgColor = 'bg-primary/10'
        }
        if (showIncorrect) {
          borderColor = 'border-gold'
          bgColor = 'bg-gold-soft'
        }

        return (
          <UnstyledButton
            key={option.id}
            onClick={() => !answered && onSelect(option.id)}
            disabled={answered}
            className={`min-h-[64px] p-5 rounded-xl border ${borderColor} ${bgColor} text-left font-medium text-lg transition-colors flex items-center gap-3 disabled:cursor-default`}
          >
            {option.icon && (
              <Icon name={option.icon} size={28} className="text-primary shrink-0" />
            )}
            <span className="flex-1">{option.label}</span>
            {showCorrect && <Icon name="CheckCircle" weight="fill" size={24} className="text-primary shrink-0" />}
            {showIncorrect && <Icon name="ArrowCounterClockwise" weight="bold" size={24} className="text-gold-deep shrink-0" />}
          </UnstyledButton>
        )
      })}
    </motion.div>
    </MantineBoundary>
  )
}

/* -------------------------------------------------------------------------- */
/*  Sub-components: Fill in the Blank                                         */
/* -------------------------------------------------------------------------- */

interface FillInTheBlankProps {
  blanks: BlankField[]
  values: Record<string, string>
  onChange: (values: Record<string, string>) => void
  answered: boolean
}

function FillInTheBlank({ blanks, values, onChange, answered }: FillInTheBlankProps) {
  return (
    <MantineBoundary>
    <motion.div className="flex flex-col gap-5" variants={fadeInUp} initial="initial" animate="animate">
      {blanks.map((blank) => {
        const value = values[blank.id] ?? ''
        const isFieldCorrect = answered && blank.acceptedAnswers.some((a) => a.toLowerCase() === value.trim().toLowerCase())
        const isFieldIncorrect = answered && !isFieldCorrect

        let ringClass = 'ring-outline-variant focus-within:ring-primary'
        if (isFieldCorrect) ringClass = 'ring-success'
        if (isFieldIncorrect) ringClass = 'ring-gold'

        return (
          <div key={blank.id} className="flex flex-col gap-2">
            <div
              className={`flex items-center gap-3 rounded-2xl bg-surface-container-lowest px-5 py-4 ring-1 ${ringClass} transition-all`}
            >
              <Icon name="Pencil" size={20} className="text-on-surface-variant shrink-0" />
              <TextInput
                aria-label={blank.placeholder}
                type="text"
                value={value}
                onChange={(e) => onChange({ ...values, [blank.id]: e.target.value })}
                placeholder={blank.placeholder}
                disabled={answered}
                className="flex-1"
                styles={{ input: { minHeight: 64, fontSize: "var(--text-lg)", backgroundColor: "transparent" } }}
              />
              {isFieldCorrect && <Icon name="CheckCircle" weight="fill" size={24} className="text-primary" />}
              {isFieldIncorrect && <Icon name="ArrowCounterClockwise" weight="bold" size={24} className="text-gold-deep" />}
            </div>
            {isFieldIncorrect && (
              <motion.p
                className="text-lg font-medium text-on-surface bg-gold-wash rounded-xl px-4 py-2"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                Răspuns corect: {blank.acceptedAnswers[0]}
              </motion.p>
            )}
          </div>
        )
      })}
    </motion.div>
    </MantineBoundary>
  )
}

/* -------------------------------------------------------------------------- */
/*  Sub-components: Drag and Drop (simplified click-to-place)                 */
/* -------------------------------------------------------------------------- */

interface DragAndDropProps {
  tokens: DragToken[]
  dropZones: DropZone[]
  placements: Record<string, string>
  onPlace: (placements: Record<string, string>) => void
  answered: boolean
}

function DragAndDrop({ tokens, dropZones, placements, onPlace, answered }: DragAndDropProps) {
  const [activeTokenId, setActiveTokenId] = useState<string | null>(null)

  const handleTokenClick = (tokenId: string) => {
    if (answered) return
    setActiveTokenId((prev) => (prev === tokenId ? null : tokenId))
  }

  const handleZoneClick = (zoneId: string) => {
    if (answered || !activeTokenId) return
    onPlace({ ...placements, [activeTokenId]: zoneId })
    setActiveTokenId(null)
  }

  const getTokenInZone = (zoneId: string) => {
    return tokens.find((t) => placements[t.id] === zoneId)
  }

  const isTokenPlaced = (tokenId: string) => !!placements[tokenId]

  return (
    <MantineBoundary>
    <motion.div className="flex flex-col gap-6" variants={fadeInUp} initial="initial" animate="animate">
      <p className="text-lg font-medium text-on-surface-variant text-center">
        Selectează un element, apoi apasă pe zona potrivită.
      </p>

      {/* Tokens */}
      <div className="flex flex-wrap gap-3 justify-center">
        {tokens.map((token) => {
          const placed = isTokenPlaced(token.id)
          const isActive = activeTokenId === token.id
          const isCorrectlyPlaced = answered && placements[token.id] === token.targetZoneId
          const isIncorrectlyPlaced = answered && placements[token.id] && placements[token.id] !== token.targetZoneId

          return (
            <UnstyledButton
              key={token.id}
              onClick={() => handleTokenClick(token.id)}
              disabled={answered}
                  className={`min-h-[64px] min-w-[80px] px-5 py-3 rounded-2xl font-bold text-lg shadow-soft transition-all disabled:cursor-default ${
                isCorrectlyPlaced
                  ? 'bg-primary/20 border border-success text-on-surface'
                  : isIncorrectlyPlaced
                    ? 'bg-gold-soft border border-gold text-on-surface'
                    : isActive
                      ? 'bg-primary text-on-primary ring-2 ring-primary/30'
                      : placed
                        ? 'bg-surface-container text-on-surface-variant opacity-60'
                        : 'bg-gold-soft text-gold-deep'
              }`}
            >
              {token.label}
            </UnstyledButton>
          )
        })}
      </div>

      {/* Drop zones */}
      <div className="flex flex-wrap gap-4 justify-center">
        {dropZones.map((zone) => {
          const tokenInZone = getTokenInZone(zone.id)
          const isCorrect = answered && tokenInZone && tokenInZone.targetZoneId === zone.id
          const isIncorrect = answered && tokenInZone && tokenInZone.targetZoneId !== zone.id

          return (
            <UnstyledButton
              key={zone.id}
              onClick={() => handleZoneClick(zone.id)}
              disabled={answered}
                className={`min-h-[80px] min-w-[120px] px-6 py-4 rounded-2xl border border-dashed flex flex-col items-center justify-center gap-1 transition-all disabled:cursor-default ${
                isCorrect
                  ? 'border-success bg-primary/10'
                  : isIncorrect
                    ? 'border-gold bg-gold-soft'
                    : tokenInZone
                      ? 'border-primary/40 bg-primary/5'
                      : activeTokenId
                        ? 'border-primary/30 bg-surface-container/50 hover:bg-primary/5'
                        : 'border-outline-variant/30 bg-surface-container/30'
              }`}
            >
              <span className="text-base font-semibold text-on-surface-variant uppercase">{zone.label}</span>
              {tokenInZone && (
                <span className="font-bold text-lg text-on-surface">{tokenInZone.label}</span>
              )}
              {!tokenInZone && (
                <span className="text-on-surface-variant/50 text-base">Atinge aici ca să pui cuvântul</span>
              )}
            </UnstyledButton>
          )
        })}
      </div>
    </motion.div>
    </MantineBoundary>
  )
}
