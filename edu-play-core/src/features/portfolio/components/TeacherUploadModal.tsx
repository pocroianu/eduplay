'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  CloseButton,
  FileButton,
  Modal,
  Select,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { Controller, useForm } from 'react-hook-form';
import {
  Button,
  Card,
  MantineBoundary,
  SegmentedTabs,
  useToast,
} from '@/shared/components/ui/kit';
import { Icon } from '@/shared/components/ui/Icon';
import { cn } from '@/shared/lib/utils/cn';
import {
  VoiceRecorderCapture,
  type VoiceTake,
} from '@/features/activities/client';
import { MAX_PHOTO_BYTES } from '../schemas';
import { teacherUploadArtifact } from '../actions/teacher-upload-artifact';

type UploadTab = 'photo' | 'audio';

export interface TeacherUploadStudent {
  id: string;
  firstName: string;
  lastName: string;
}

export interface TeacherUploadModalProps {
  classStudents: TeacherUploadStudent[];
  presetStudentId?: string;
  onClose: () => void;
}

interface UploadFormValues {
  studentId: string;
  title: string;
}

const FIELD_LABEL =
  'mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant';
const MAX_PHOTO_MB = Math.floor(MAX_PHOTO_BYTES / 1024 / 1024);

const uploadFieldStyles = {
  label: {
    color: 'var(--color-on-surface-variant)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  input: {
    backgroundColor: 'var(--color-surface-container-lowest)',
    borderColor: 'var(--color-outline-variant)',
    color: 'var(--color-on-surface)',
    fontSize: 14,
    fontWeight: 600,
    minHeight: 44,
  },
} as const;

function studentLabel(student: TeacherUploadStudent): string {
  return `${student.firstName} ${student.lastName}`.trim();
}

async function fileToBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer());
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
        return;
      }
      reject(new Error('Nu am putut citi fișierul selectat.'));
    });
    reader.addEventListener('error', () => {
      reject(reader.error ?? new Error('Nu am putut citi fișierul selectat.'));
    });
    reader.readAsArrayBuffer(file);
  });
}

export function TeacherUploadModal({
  classStudents,
  presetStudentId,
  onClose,
}: TeacherUploadModalProps) {
  const titleId = useId();
  const router = useRouter();
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<UploadTab>('photo');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [voiceTake, setVoiceTake] = useState<VoiceTake | null>(null);

  const form = useForm<UploadFormValues>({
    defaultValues: {
      studentId: presetStudentId ?? '',
      title: '',
    },
  });
  const {
    formState: { errors, isSubmitting },
    control,
    register,
    setError,
    clearErrors,
    handleSubmit,
  } = form;

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const selectedStudent = useMemo(
    () => classStudents.find((student) => student.id === presetStudentId),
    [classStudents, presetStudentId],
  );

  const clearPhotoSelection = () => {
    setPhotoFile(null);
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(null);
  };

  const acceptPhoto = (file: File | null | undefined) => {
    if (!file) return;
    if (file.type !== 'image/jpeg' && file.type !== 'image/webp') {
      clearPhotoSelection();
      setError('root', {
        type: 'validate',
        message: 'Alege o fotografie JPEG sau WebP.',
      });
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      clearPhotoSelection();
      setError('root', {
        type: 'validate',
        message: `Fotografia poate avea cel mult ${MAX_PHOTO_MB} MB.`,
      });
      return;
    }
    clearErrors('root');
    setPhotoFile(file);
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  };

  const onSubmit = handleSubmit(async (values) => {
    const studentId = presetStudentId ?? values.studentId;
    if (!studentId) {
      setError('root', {
        type: 'required',
        message: 'Alege elevul pentru această dovadă.',
      });
      return;
    }

    const title = values.title.trim() || undefined;
    const result =
      activeTab === 'photo'
        ? await submitPhoto({ studentId, title })
        : await submitAudio({ studentId, title });

    if (!result.success) {
      setError('root', {
        type: 'server',
        message: result.error ?? 'Nu am putut adăuga dovada.',
      });
      return;
    }

    toast({
      variant: 'success',
      message: 'Dovada a fost adăugată.',
      description: 'O găsești în coada de revizuit.',
    });
    router.refresh();
    onClose();
  });

  async function submitPhoto({
    studentId,
    title,
  }: {
    studentId: string;
    title?: string;
  }) {
    if (!photoFile) {
      return {
        success: false as const,
        error: 'Alege o fotografie înainte să trimiți.',
      };
    }

    return teacherUploadArtifact({
      kind: 'photo',
      studentId,
      title,
      payload: {
        blob: await fileToBytes(photoFile),
        mime: photoFile.type,
      },
    });
  }

  async function submitAudio({
    studentId,
    title,
  }: {
    studentId: string;
    title?: string;
  }) {
    if (!voiceTake) {
      return {
        success: false as const,
        error: 'Înregistrează o notă vocală înainte să trimiți.',
      };
    }

    return teacherUploadArtifact({
      kind: 'audio',
      studentId,
      title,
      payload: {
        blob: voiceTake.blob,
        mime: voiceTake.mime,
      },
    });
  }

  const rootError = errors.root?.message;

  return (
    <MantineBoundary>
    <Modal.Root opened onClose={onClose} size="72rem">
    <Modal.Overlay />
    <Modal.Content aria-label="Dovada">
    <Modal.Body p={0}>
    <AnimatePresence>
      <motion.div
          className="relative flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-md border border-outline-variant bg-surface-container-lowest shadow-soft-sm md:rounded-md"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
          }
        >
          <header className="flex shrink-0 items-center gap-3 bg-primary px-5 py-4 text-on-primary md:px-6">
            <CloseButton
              aria-label="Închide"
              onClick={onClose}
              radius="md"
              size={40}
              styles={{
                root: {
                  color: 'var(--color-on-primary)',
                  flexShrink: 0,
                  minHeight: 44,
                  minWidth: 44,
                  opacity: 0.86,
                  '--cb-hover': 'color-mix(in srgb, var(--color-on-primary) 12%, transparent)',
                },
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-on-primary/70">
                Jurnal
              </p>
              <h2
                id={titleId}
                className="mt-1 font-headline text-[22px] font-bold leading-tight text-on-primary"
              >
                Adaugă dovadă
              </h2>
            </div>
          </header>

          <form
            onSubmit={(event) => void onSubmit(event)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="grid min-h-0 flex-1 bg-surface-container lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-h-0 space-y-5 overflow-y-auto p-5 md:p-6">
                <SegmentedTabs
                  ariaLabel="Tip dovadă"
                  value={activeTab}
                  onChange={(value) => {
                    const nextTab = value as UploadTab;
                    clearErrors('root');
                    if (
                      nextTab !== activeTab &&
                      (activeTab === 'audio' || nextTab === 'audio')
                    ) {
                      setVoiceTake(null);
                    }
                    setActiveTab(nextTab);
                  }}
                  tabs={[
                    { value: 'photo', label: 'Fotografie', icon: 'Camera' },
                    { value: 'audio', label: 'Notă vocală', icon: 'Microphone' },
                  ]}
                />

                <Card padding="none" shadow={false} className="overflow-hidden border border-outline-variant bg-surface-container-lowest">
                  <div className="border-b border-outline-variant px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                      Conținut postare
                    </p>
                  </div>
                  <div className="space-y-4 p-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {presetStudentId ? (
                        <div className="rounded-md border border-outline-variant bg-primary-wash p-4">
                          <p className={FIELD_LABEL}>Elev</p>
                          <p className="text-base font-bold text-on-surface">
                            {selectedStudent
                              ? studentLabel(selectedStudent)
                              : 'Elev selectat'}
                          </p>
                        </div>
                      ) : (
                        <Controller
                          control={control}
                          name="studentId"
                          render={({ field }) => (
                            <Select
                              ref={field.ref}
                              name={field.name}
                              label="Elev"
                              aria-label="Alege elevul"
                              value={field.value}
                              onBlur={field.onBlur}
                              onChange={(value) => field.onChange(value ?? '')}
                              data={[
                                { value: '', label: 'Alege elevul' },
                                ...classStudents.map((student) => ({
                                  value: student.id,
                                  label: studentLabel(student),
                                })),
                              ]}
                              allowDeselect={false}
                              checkIconPosition="right"
                              styles={uploadFieldStyles}
                            />
                          )}
                        />
                      )}

                      <TextInput
                        label="Titlu opțional"
                        maxLength={120}
                        placeholder="Ex. Povestea Anei"
                        aria-label="Titlu opțional"
                        styles={uploadFieldStyles}
                        {...register('title', {
                          maxLength: {
                            value: 120,
                            message: 'Titlul poate avea cel mult 120 de caractere.',
                          },
                        })}
                      />
                    </div>

                    {activeTab === 'photo' ? (
                      <PhotoDropzone
                        previewUrl={photoPreviewUrl}
                        fileName={photoFile?.name}
                        onFile={acceptPhoto}
                      />
                    ) : (
                      <div className="rounded-md border border-outline-variant bg-surface-container p-4">
                        <VoiceRecorderCapture
                          onTakeReady={(take) => {
                            clearErrors('root');
                            setVoiceTake(take);
                          }}
                          onTakeCleared={() => setVoiceTake(null)}
                        />
                      </div>
                    )}

                    {rootError || errors.title?.message ? (
                      <p role="alert" className="text-sm font-bold text-error">
                        {rootError ?? errors.title?.message}
                      </p>
                    ) : null}
                  </div>
                </Card>
              </div>

              <aside className="hidden border-l border-outline-variant bg-surface-container-lowest p-5 lg:block">
                <div className="sticky top-5 space-y-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                      Publicare
                    </p>
                    <h3 className="mt-1 text-lg font-bold text-on-surface">
                      Dovadă în portofoliu
                    </h3>
                    <p className="mt-2 text-sm font-semibold leading-6 text-on-surface-variant">
                      Postarea rămâne în coada de revizuit. Poți aproba, publica pentru familie sau cere refacere după trimitere.
                    </p>
                  </div>
                  <div className="rounded-md border border-outline-variant bg-surface-container p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-md bg-primary-soft text-primary-deep">
                        <Icon name="BookOpen" size={20} weight="bold" />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-on-surface">Jurnal</p>
                        <p className="text-xs font-semibold text-on-surface-muted">Ciornă profesor</p>
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-outline-variant bg-surface-container-lowest px-5 py-4 sm:flex-row sm:justify-end md:px-6">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Renunță
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isPending={isSubmitting}
              >
                <Icon name="PlusCircle" size={20} />
                Adaugă dovada
              </Button>
            </footer>
          </form>
      </motion.div>
    </AnimatePresence>
    </Modal.Body>
    </Modal.Content>
    </Modal.Root>
    </MantineBoundary>
  );
}

function PhotoDropzone({
  previewUrl,
  fileName,
  onFile,
}: {
  previewUrl: string | null;
  fileName?: string;
  onFile: (file: File | null | undefined) => void;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className={cn(
        'rounded-md border border-outline-variant bg-surface-container p-4',
        dragging && 'outline outline-2 outline-primary outline-offset-2',
      )}
    >
      <FileButton
        onChange={onFile}
        accept="image/jpeg,image/webp"
        capture="environment"
        inputProps={{ 'aria-label': 'Alege fotografia' }}
      >
        {({ onClick }) => (
          <UnstyledButton
            type="button"
            onClick={onClick}
            className="flex min-h-56 w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-md border border-dashed border-outline bg-surface-container-lowest p-5 text-center transition-colors ease-press hover:bg-primary-wash"
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              onFile(event.dataTransfer.files.item(0));
            }}
            styles={{
              root: {
                '&:focus-visible': {
                  outline: '2px solid var(--color-primary)',
                  outlineOffset: 2,
                },
              },
            }}
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview cannot be optimized by next/image.
              <img
                src={previewUrl}
                alt=""
                className="max-h-48 rounded-md border border-outline-variant object-contain"
              />
            ) : (
              <span className="inline-flex size-12 items-center justify-center rounded-md bg-primary-wash text-primary">
                <Icon name="Camera" size={24} weight="bold" />
              </span>
            )}
            <span className="text-base font-bold text-on-surface">
              {fileName ?? 'Trage fotografia aici sau fă una cu camera'}
            </span>
            <span className="text-sm font-semibold text-on-surface-variant">
              JPEG sau WebP
            </span>
          </UnstyledButton>
        )}
      </FileButton>
    </div>
  );
}
