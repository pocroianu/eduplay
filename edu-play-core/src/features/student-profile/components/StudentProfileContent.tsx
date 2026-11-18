"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Progress, Radio, Switch } from "@mantine/core";
import {
  Button,
  Card,
  ConfirmDialog,
  MantineBoundary,
  ToastProvider,
  useToast,
} from "@/shared/components/ui/kit";
import { Icon } from "@/shared/components/ui/Icon";
import type { IconName } from "@/shared/components/ui/Icon.registry";
import { cn } from "@/shared/lib/utils/cn";
import { logout } from "@/features/auth";
import { formatAgeBand, type AgeBand } from "@/shared/lib/utils/age";
import { AvatarPickerDialog } from "./AvatarPickerDialog";
import { ChangePinDialog } from "./ChangePinDialog";
import { usePreferences } from "./PreferencesProvider";
import { updateAvatarAction } from "../actions/update-avatar";
import { updatePreferencesAction } from "../actions/update-preferences";
import type { ThemeMode } from "../schemas/preferences.schema";

export interface StudentProfileContentProps {
  profile: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    username: string | null;
    ageBand: AgeBand | undefined;
    stats: {
      gamesPlayed: number;
      completedCount: number;
      starsEarned: number;
      bestScore: number;
      streakDays: number;
      level: number;
    };
  };
}

const STARS_PER_LEVEL = 25;
const FALLBACK_AVATAR = "/avatars/preset-01.svg";

export function StudentProfileContent(props: StudentProfileContentProps) {
  return (
    <MantineBoundary>
      <ToastProvider>
        <StudentProfileBody {...props} />
      </ToastProvider>
    </MantineBoundary>
  );
}

function StudentProfileBody({ profile }: StudentProfileContentProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { preferences, setPreferences } = usePreferences();

  const [avatarOpen, setAvatarOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const [avatarPending, startAvatarTransition] = useTransition();
  const [prefPending, startPrefTransition] = useTransition();
  const [logoutPending, setLogoutPending] = useState(false);

  const stageLabel = formatAgeBand(profile.ageBand);
  const ageBadgeLabel =
    profile.ageBand === "3-6" ? "Pași mici (3–6 ani)" : "Aventură (7–12 ani)";

  const xpInLevel = profile.stats.starsEarned % STARS_PER_LEVEL;
  const levelProgress = Math.min(1, xpInLevel / STARS_PER_LEVEL);
  const avatarSrc = profile.avatar_url ?? FALLBACK_AVATAR;
  const firstName = useMemo(
    () => profile.full_name.trim().split(/\s+/)[0] || profile.full_name,
    [profile.full_name],
  );

  const handleAvatarSelect = (avatarUrl: string) => {
    startAvatarTransition(async () => {
      const result = await updateAvatarAction({ avatarUrl });
      if (result.success) {
        setAvatarOpen(false);
        toast({
          message: "Avatar nou salvat!",
          variant: "success",
        });
        router.refresh();
      } else {
        toast({
          message: result.error ?? "Nu am putut salva avatarul.",
          variant: "error",
        });
      }
    });
  };

  const handlePreferenceChange = <K extends keyof typeof preferences>(
    key: K,
    nextValue: (typeof preferences)[K],
  ) => {
    const previous = preferences[key];
    setPreferences({ [key]: nextValue } as Partial<typeof preferences>);
    startPrefTransition(async () => {
      const result = await updatePreferencesAction({ [key]: nextValue });
      if (!result.success) {
        setPreferences({ [key]: previous } as Partial<typeof preferences>);
        toast({
          message: result.error ?? "Nu am putut salva setările.",
          variant: "error",
        });
      }
    });
  };

  const handleLogout = async () => {
    setLogoutPending(true);
    try {
      await logout();
    } catch {
      // logout() redirects on success — only the rare error branch lands here.
      setLogoutPending(false);
      toast({
        message: "Nu am putut să te deconectăm. Încearcă din nou.",
        variant: "error",
      });
    }
  };

  return (
    <div className="space-y-8 bg-surface md:space-y-10">
      <Card className="overflow-hidden border border-outline-variant bg-surface-container-lowest p-0">
        <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:p-6">
          <div className="relative shrink-0">
            <div className="h-24 w-24 overflow-hidden rounded-lg border border-outline-variant bg-surface-container md:h-28 md:w-28">
              <Image
                src={avatarSrc}
                alt={`Avatarul lui ${firstName}`}
                width={112}
                height={112}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <span className="absolute -bottom-2 -right-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-1 text-base font-semibold text-on-surface shadow-soft-sm">
              Nivel {profile.stats.level}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold uppercase tracking-wide text-on-surface-variant">
              {stageLabel}
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-on-surface md:text-4xl">
              {firstName}
            </h1>
            <p className="mt-2 text-[18px] text-on-surface-variant">
              {ageBadgeLabel}
            </p>

            <div className="mt-5 max-w-2xl">
              <div className="mb-2 flex items-center justify-between gap-4 text-[18px] font-semibold text-on-surface-variant">
                <span>
                  {xpInLevel} / {STARS_PER_LEVEL} stele până la următorul nivel
                </span>
                <span>{Math.round(levelProgress * 100)}%</span>
              </div>
              <MantineBoundary>
                <Progress.Root
                  unstyled
                  className="h-2 overflow-hidden rounded-sm bg-surface-container"
                  role="progressbar"
                  aria-label="Progres până la următorul nivel"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(levelProgress * 100)}
                >
                  <Progress.Section
                    value={levelProgress * 100}
                    withAria={false}
                    className="h-full rounded-sm bg-primary"
                    style={{ width: `${levelProgress * 100}%` }}
                  />
                </Progress.Root>
              </MantineBoundary>
            </div>
          </div>

          <Button
            variant="secondary"
            mode="kid"
            size="lg"
            onClick={() => setAvatarOpen(true)}
            data-testid="open-avatar-picker"
            className="h-16 shrink-0"
          >
            <Icon name="Camera" size={20} />
            Schimbă avatarul
          </Button>
        </div>
      </Card>

      <section aria-labelledby="profile-rezumat-heading" className="space-y-3">
        <SectionTitle
          id="profile-rezumat-heading"
          eyebrow="Rezumat"
          title="Progresul tău"
          description="Câte progrese ai făcut până acum"
        />
        <Card className="grid grid-cols-1 divide-y divide-outline-variant border border-outline-variant bg-surface-container-lowest p-0 md:grid-cols-4 md:divide-x md:divide-y-0">
          <SummaryCell
            icon="GameController"
            label="Jocuri jucate"
            value={profile.stats.gamesPlayed}
          />
          <SummaryCell
            icon="Fire"
            label="Zile la rând"
            value={profile.stats.streakDays}
          />
          <SummaryCell
            icon="Star"
            label="Stele câștigate"
            value={profile.stats.starsEarned}
          />
          <SummaryCell
            icon="Medal"
            label="Nivel actual"
            value={profile.stats.level}
          />
        </Card>
      </section>

      <section aria-labelledby="profile-setari-heading" className="space-y-3">
        <SectionTitle
          id="profile-setari-heading"
          eyebrow="Setări"
          title="Preferințe"
          description="Personalizează cum arată și sună aplicația"
        />
        <Card className="overflow-hidden border border-outline-variant bg-surface-container-lowest p-0">
          <ToggleRow
            label="Sunete"
            description="Efecte sonore în jocuri și pe ecranul de premii"
            checked={preferences.sound_enabled}
            onCheckedChange={(next) =>
              handlePreferenceChange("sound_enabled", next)
            }
            disabled={prefPending}
            testId="toggle-sound"
          />
          <Divider />
          <ToggleRow
            label="Animații reduse"
            description="Mișcare mai puțină — bun pentru concentrare"
            checked={preferences.reduced_motion}
            onCheckedChange={(next) =>
              handlePreferenceChange("reduced_motion", next)
            }
            disabled={prefPending}
            testId="toggle-reduced-motion"
          />
          <Divider />
          <ThemeRow
            value={preferences.theme}
            onChange={(theme) => handlePreferenceChange("theme", theme)}
            disabled={prefPending}
          />
          <Divider />
          <LanguageRow />
        </Card>
      </section>

      <section
        aria-labelledby="profile-securitate-heading"
        className="space-y-3"
      >
        <SectionTitle
          id="profile-securitate-heading"
          eyebrow="Securitate"
          title="Cont"
          description="PIN-ul tău și ieșirea din cont"
        />
        <Card className="overflow-hidden border border-outline-variant bg-surface-container-lowest p-0">
          <SecurityRow
            icon="Key"
            title="Schimbă PIN-ul"
            description="Patru cifre. Ține-l secret."
            actionLabel="Schimbă PIN-ul"
            onAction={() => setPinOpen(true)}
            testId="open-change-pin"
          />
          <Divider />
          <div className="flex min-h-16 flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-outline-variant bg-surface-container text-error">
                <Icon name="SignOut" size={22} />
              </span>
              <div>
                <p className="text-[18px] font-semibold text-error">
                  Deconectează-mă
                </p>
                <p className="text-base text-on-surface-variant">
                  Vei reveni la ecranul de conectare.
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              mode="kid"
              size="lg"
              onClick={() => setLogoutOpen(true)}
              data-testid="open-logout"
              className="h-16 text-error hover:bg-error-container/20 hover:text-error"
            >
              Deconectează-mă
            </Button>
          </div>
        </Card>
      </section>

      <AvatarPickerDialog
        open={avatarOpen}
        currentAvatarUrl={profile.avatar_url}
        onCancel={() => setAvatarOpen(false)}
        onSelect={handleAvatarSelect}
        busy={avatarPending}
      />

      <ChangePinDialog
        open={pinOpen}
        onCancel={() => setPinOpen(false)}
        onSuccess={() => {
          setPinOpen(false);
          toast({
            message: "PIN-ul a fost schimbat.",
            description: "Folosește noul PIN data viitoare când te conectezi.",
            variant: "success",
          });
        }}
      />

      <ConfirmDialog
        open={logoutOpen}
        title="Te deconectezi?"
        body="Va trebui să introduci numele și PIN-ul ca să te întorci."
        confirmLabel={
          logoutPending ? "Se deconectează…" : "Da, deconectează-mă"
        }
        cancelLabel="Anulează"
        destructive
        icon="SignOut"
        onConfirm={() => {
          void handleLogout();
        }}
        onCancel={() => {
          if (!logoutPending) setLogoutOpen(false);
        }}
      />
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-outline-variant" />;
}

interface SectionTitleProps {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
}

function SectionTitle({ id, eyebrow, title, description }: SectionTitleProps) {
  return (
    <div>
      <p className="text-base font-semibold uppercase tracking-wide text-on-surface-variant">
        {eyebrow}
      </p>
      <h2 id={id} className="mt-1 text-2xl font-semibold text-on-surface">
        {title}
      </h2>
      <p className="mt-1 text-[18px] text-on-surface-variant">{description}</p>
    </div>
  );
}

interface SummaryCellProps {
  icon: IconName;
  label: string;
  value: number;
}

function SummaryCell({ icon, label, value }: SummaryCellProps) {
  return (
    <div className="flex min-h-16 items-center gap-3 p-4">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-outline-variant bg-surface-container text-primary"
        aria-hidden="true"
      >
        <Icon name={icon} size={22} />
      </span>
      <div className="min-w-0">
        <p className="text-base font-medium text-on-surface-variant">{label}</p>
        <p className="text-2xl font-semibold text-on-surface">{value}</p>
      </div>
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  testId?: string;
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  testId,
}: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-5 md:px-6 md:py-6">
      <div className="min-w-0">
        <p className="text-[18px] font-semibold text-on-surface">{label}</p>
        <p className="text-lg text-on-surface-variant mt-0.5">{description}</p>
      </div>
      <Switch
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.currentTarget.checked)}
        data-testid={testId}
        size="xl"
        className="min-h-16 min-w-16 shrink-0"
      />
    </div>
  );
}

interface ThemeRowProps {
  value: ThemeMode;
  onChange: (next: ThemeMode) => void;
  disabled?: boolean;
}

const THEME_OPTIONS: Array<{
  value: ThemeMode;
  label: string;
  icon: IconName;
}> = [
  { value: "light", label: "Luminos", icon: "Sun" },
  { value: "dark", label: "Întunecat", icon: "Moon" },
  { value: "auto", label: "Automat", icon: "Sparkle" },
];

function ThemeRow({ value, onChange, disabled }: ThemeRowProps) {
  return (
    <div className="px-5 py-5 md:px-6 md:py-6">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <p className="text-[18px] font-semibold text-on-surface">Temă</p>
          <p className="text-lg text-on-surface-variant mt-0.5">
            Cum arată culorile aplicației
          </p>
        </div>
      </div>
      <Radio.Group
        name="student-theme"
        value={value}
        onChange={(next) => onChange(next as ThemeMode)}
        aria-label="Temă"
        className="grid grid-cols-3 gap-2"
      >
        {THEME_OPTIONS.map((option) => {
          const isActive = option.value === value;
          return (
            <Radio
              key={option.value}
              value={option.value}
              disabled={disabled}
              data-testid={option.value}
              label={
                <span className="flex min-h-16 flex-col items-center justify-center gap-2 text-base font-bold">
                  <Icon name={option.icon} size={24} />
                  {option.label}
                </span>
              }
              className={cn(
                "w-full rounded-lg border px-3 py-3 transition-colors duration-150",
                "focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2",
                isActive
                  ? "border-primary bg-primary-container/40 text-on-primary-container"
                  : "border-outline-variant bg-surface-container text-on-surface hover:border-primary",
                disabled && "opacity-60",
              )}
              classNames={{
                body: "flex items-center gap-2",
                label: "flex-1 p-0",
              }}
            />
          );
        })}
      </Radio.Group>
    </div>
  );
}

function LanguageRow() {
  return (
    <div className="px-5 py-5 md:px-6 md:py-6 flex items-center justify-between gap-4">
      <div>
        <p className="text-[18px] font-semibold text-on-surface">Limbă</p>
        <p className="text-lg text-on-surface-variant mt-0.5">
          Curând: vei putea alege limba aplicației
        </p>
      </div>
      <span className="rounded-md border border-outline-variant bg-surface-container px-3 py-1 text-base font-semibold text-on-surface">
        Română
      </span>
    </div>
  );
}

interface SecurityRowProps {
  icon: IconName;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  testId?: string;
}

function SecurityRow({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  testId,
}: SecurityRowProps) {
  return (
    <div className="flex min-h-16 flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-outline-variant bg-surface-container text-primary">
          <Icon name={icon} size={24} />
        </span>
        <div>
          <p className="text-[18px] font-semibold text-on-surface">{title}</p>
          <p className="text-lg text-on-surface-variant">{description}</p>
        </div>
      </div>
      <Button
        variant="secondary"
        mode="kid"
        size="lg"
        onClick={onAction}
        data-testid={testId}
        className="h-16"
      >
        {actionLabel}
      </Button>
    </div>
  );
}
