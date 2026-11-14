import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps keyboard focus within the referenced container while `active` is true.
 * On mount, moves focus to the first focusable child (or `initialFocusId` if provided).
 * On unmount, restores focus to the previously-focused element.
 */
export function useFocusTrap(active: boolean, initialFocusId?: string): RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Focus initial element
    const container = containerRef.current;
    if (!container) return;

    const initial = initialFocusId
      ? container.querySelector<HTMLElement>(`#${CSS.escape(initialFocusId)}`)
      : container.querySelector<HTMLElement>(FOCUSABLE);
    initial?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !container) return;

      const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [active, initialFocusId]);

  return containerRef;
}
