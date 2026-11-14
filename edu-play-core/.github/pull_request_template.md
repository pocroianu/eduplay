# Pull Request

## Summary

<!-- Briefly describe what changed and why. -->

## Related Work

**GitHub issue:** <!-- Closes #123 / Fixes #456 -->

**Related docs/specs:** <!-- AGENTS.md, ARCHITECTURE.md, docs/api.md, etc. -->

## Change Type

- [ ] New feature
- [ ] Bug fix
- [ ] Enhancement
- [ ] Refactor
- [ ] Documentation
- [ ] Tests
- [ ] CI/CD
- [ ] Other:

## Implementation Notes

**Key files changed:**
- `path/to/file` - short reason

**Database changes:**
- [ ] Migration included
- [ ] No database changes
- [ ] Types regenerated with `npm run generate:types`
- [ ] Type drift checked with `npm run check:types-drift`

## Verification

Paste command output or a concise summary with exit codes.

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run check:agent-guardrails
npm run verify:agent
```

**Browser/E2E verification:**
- [ ] `npm run test:e2e:smoke`
- [ ] `npm run test:e2e`
- [ ] Manual browser check
- [ ] Not needed because:

## EduPlay Checklist

- [ ] Followed `AGENTS.md` and linked source-of-truth docs
- [ ] Used Server Components by default
- [ ] Avoided deep imports across feature boundaries
- [ ] Used `ROUTES` constants for internal app routes
- [ ] API v1 handlers use `handleRoute`, `ApiError`, `parseBody` / `parseQuery`
- [ ] Student UI keeps 64px touch targets, 18px+ body text, and reduced-motion support
- [ ] UI uses Duo tokens/primitives instead of raw hex, arbitrary shadows, or arbitrary radii
- [ ] User-facing copy is Romanian with correct diacritics
- [ ] No child-route third-party analytics
- [ ] New or changed route pages have appropriate `loading.tsx` and `error.tsx`
- [ ] Tests added or updated for behavior changes

## Security And Privacy

For changes touching auth, API routes, RLS, migrations, student data, or child
routes:

- [ ] Input is validated at system boundaries
- [ ] No raw framework/Supabase errors are exposed to users
- [ ] RLS policies are scoped and do not grant blanket `IS NULL` visibility
- [ ] `postMessage` handlers validate origins and target trusted origins
- [ ] Rate limits remain in place for auth-sensitive flows
- [ ] Privacy docs updated if data processing or subprocessors changed

## Rollout / Follow-Up

<!-- Note deployment coordination, migration order, monitoring, or follow-up issue links. -->
