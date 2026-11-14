'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils/cn';
import { Vulpita } from './Vulpita';

type AuthShellMode = 'standard' | 'kid';

interface CommonProps {
  mode?: AuthShellMode;
  /** Right-column heading for `standard` mode. Renders as <h2>. Optional in `kid` mode. */
  title?: string;
  /** Optional sub-copy under the title (`standard` mode only). */
  subtitle?: string;
  heroSlot?: ReactNode;
  footerSlot?: ReactNode;
  children: ReactNode;
  className?: string;
}

export interface AuthShellStandardProps extends CommonProps {
  mode?: 'standard';
  title: string;
  subtitle?: string;
}

export interface AuthShellKidProps extends CommonProps {
  mode: 'kid';
  /** Optional mascot slot — defaults to EduPlay mascot. */
  mascotSlot?: ReactNode;
  /** Optional top-left navigation link (e.g. "Sunt profesor"). */
  backLink?: { href: string; label: string };
}

export type AuthShellProps = AuthShellStandardProps | AuthShellKidProps;

/**
 * Shared auth chrome with two layouts:
 *
 *   • `mode="standard"` (default) — centered adult card on a pale Seesaw-style surface.
 *   • `mode="kid"` — single-column student shell with a calm card and large touch targets.
 *     Used exclusively for the student PIN flow.
 */
export function AuthShell(props: AuthShellProps) {
  if (props.mode === 'kid') {
    return <KidAuthShell {...props} />;
  }
  return <StandardAuthShell {...props} />;
}

function StandardAuthShell({
  title,
  subtitle,
  heroSlot,
  footerSlot,
  children,
  className,
}: AuthShellStandardProps) {

  return (
    <main
      className={cn(
        'relative min-h-screen overflow-x-hidden bg-primary-wash px-6 py-10 md:px-8',
        className,
      )}
    >
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[520px] flex-col justify-center">
        <Link
          href="/"
          className="mb-8 inline-flex min-h-11 w-fit items-center gap-2 rounded-full px-3 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <span className="font-headline text-3xl font-semibold tracking-tight text-primary">EduPlay</span>
        </Link>

        <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-soft-sm md:p-8">
          {heroSlot && <div className="mb-6">{heroSlot}</div>}
          {!heroSlot && <DefaultStandardHero />}

          <header className="mb-8 mt-6">
            <h1 className="font-headline text-3xl font-semibold tracking-tight text-on-surface md:text-4xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 leading-relaxed text-on-surface-variant">{subtitle}</p>
            )}
          </header>

          <div>
            {children}
          </div>
        </div>

        {footerSlot && <div className="mt-8">{footerSlot}</div>}
      </div>
    </main>
  );
}

function DefaultStandardHero() {
  return (
    <div className="rounded-xl bg-primary-soft p-5 text-primary-deep">
      <p className="font-headline text-2xl font-semibold leading-tight tracking-tight">
        Învățăm împreună, prin joacă.
      </p>
      <p className="mt-2 text-lg leading-relaxed">
        Jocuri sigure pentru copii și instrumente clare pentru adulții care îi susțin.
      </p>
    </div>
  );
}

function KidAuthShell({
  children,
  mascotSlot,
  backLink,
  footerSlot,
  className,
}: AuthShellKidProps) {

  return (
    <main
      className={cn(
        'relative min-h-screen overflow-x-hidden bg-primary-wash px-4 pt-14 pb-8 md:pt-16 md:pb-12',
        className,
      )}
    >
      {backLink && (
        <Link
          href={backLink.href}
          className="absolute top-4 left-4 md:top-6 md:left-6 z-10 inline-flex min-h-16 items-center rounded-full px-4 py-1 text-sm font-semibold text-on-surface-variant hover:text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <span>{backLink.label}</span>
        </Link>
      )}

      {/*
       * Centered stacked layout: the mascot is the visual anchor at the top,
       * the form card sits below. Tight padding keeps the whole composition
       * inside one viewport on landscape laptops.
       */}
      <div className="mx-auto flex w-full max-w-[460px] flex-col items-center gap-3">
        <div>
          {mascotSlot ?? <DefaultKidMascot />}
        </div>

        <div className="w-full">
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest px-5 py-6 shadow-soft-sm md:px-6 md:py-7">
            {children}
          </div>
          {footerSlot && <div className="mt-4">{footerSlot}</div>}
        </div>
      </div>
    </main>
  );
}

function DefaultKidMascot() {
  return (
    <Vulpita mood="happy" size={200} />
  );
}
