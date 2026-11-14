// Activity-type registry.
//
// F9 activity types (drawing canvas, voice recording, ...) plug in by calling
// `registerActivityType(def)` at module-load time. The shell then resolves
// the right renderer + result collector at runtime via `getActivityType`.
//
// Decision (ARCHITECTURE.md): the registry is intentionally code-side only.
// F11 (CMS) will surface a form-driven editor over each type's `configSchema`
// later, but does not need to ship before F9 can land.

import type { ActivityTypeDefinition } from '../types';

const registry = new Map<string, ActivityTypeDefinition<unknown, unknown>>();

export function registerActivityType<TConfig, TResult>(
  def: ActivityTypeDefinition<TConfig, TResult>,
): void {
  if (!def.typeId || typeof def.typeId !== 'string') {
    throw new Error(
      'registerActivityType: typeId must be a non-empty string',
    );
  }
  if (registry.has(def.typeId)) {
    const existing = registry.get(def.typeId);
    if (existing === (def as unknown as ActivityTypeDefinition<unknown, unknown>)) {
      // Re-registration of the same definition (HMR / double-import) is a
      // no-op so dev reloads don't throw.
      return;
    }
    throw new Error(
      `registerActivityType: duplicate typeId "${def.typeId}"`,
    );
  }
  registry.set(
    def.typeId,
    def as unknown as ActivityTypeDefinition<unknown, unknown>,
  );
}

export function getActivityType(
  typeId: string,
): ActivityTypeDefinition<unknown, unknown> | undefined {
  return registry.get(typeId);
}

export function listActivityTypes(): ReadonlyArray<
  ActivityTypeDefinition<unknown, unknown>
> {
  return Array.from(registry.values());
}

/**
 * Test-only escape hatch. Production code MUST NOT call this — it exists so
 * unit tests can isolate the registry without leaking state across cases.
 */
export function __resetActivityTypeRegistryForTests(): void {
  registry.clear();
}
