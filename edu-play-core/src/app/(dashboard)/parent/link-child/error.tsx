'use client';

import { Button } from '@mantine/core';
import { Icon } from '@/shared/components/ui/Icon';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ParentLinkChildError({ reset }: ErrorProps) {
  return (
    <div className="flex">
      {/* Sidebar placeholder */}
      <div className="w-[280px] h-screen bg-surface-container" />

      <div className="ml-[280px] flex-1 p-8 bg-background min-h-screen">
        <div className="flex flex-col gap-6 max-w-[500px] mx-auto mt-8">
          <div className="border border-outline-variant bg-surface-container-lowest shadow-soft-sm w-full rounded-xl p-8">
            <div className="flex flex-col gap-4 items-center text-center">
              <div className="text-error">
                <Icon name="Warning" size={48} />
              </div>
              <h3 className="text-lg font-semibold text-error">
                A apărut o eroare
              </h3>
              <p className="text-on-surface-variant text-sm">
                Nu am putut încărca pagina de conectare. Încearcă din nou.
              </p>
              <Button
                color="purple"
                radius="xl"
                classNames={{
                  root: 'px-4 text-on-primary',
                  label: 'text-sm font-medium',
                }}
                onClick={reset}
              >
                Încearcă din nou
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
