import { beforeEach, describe, expect, it, vi } from 'vitest';

const runVisibilityChangeMock = vi.fn();

vi.mock('../internal/run-visibility-change', () => ({
  runVisibilityChange: (...args: unknown[]) =>
    runVisibilityChangeMock(...args),
}));

import { approveArtifact } from '../approve-artifact';
import { archiveArtifact } from '../archive-artifact';
import { publishArtifact } from '../publish-artifact';
import { setArtifactVisibility } from '../set-artifact-visibility';

const ARTIFACT_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  runVisibilityChangeMock.mockReset();
  runVisibilityChangeMock.mockResolvedValue({
    success: true,
    data: { artifact: { id: ARTIFACT_ID } },
  });
});

describe('approveArtifact', () => {
  it('rejects an invalid id payload before touching the DB', async () => {
    const result = await approveArtifact({ id: 'not-a-uuid' });
    expect(result.success).toBe(false);
    expect(runVisibilityChangeMock).not.toHaveBeenCalled();
  });

  it('forwards a teacher/student-only approval transition for valid input', async () => {
    const result = await approveArtifact({ id: ARTIFACT_ID });
    expect(result.success).toBe(true);
    expect(runVisibilityChangeMock).toHaveBeenCalledWith({
      id: ARTIFACT_ID,
      visibility: 'internal_teacher_only',
    });
  });
});

describe('publishArtifact', () => {
  it('rejects an invalid id payload before touching the DB', async () => {
    const result = await publishArtifact({ id: 'not-a-uuid' });
    expect(result.success).toBe(false);
    expect(runVisibilityChangeMock).not.toHaveBeenCalled();
  });

  it('forwards a family_visible transition for valid input', async () => {
    const result = await publishArtifact({ id: ARTIFACT_ID });
    expect(result.success).toBe(true);
    expect(runVisibilityChangeMock).toHaveBeenCalledWith({
      id: ARTIFACT_ID,
      visibility: 'family_visible',
    });
  });
});

describe('archiveArtifact', () => {
  it('rejects an invalid id payload', async () => {
    const result = await archiveArtifact({ id: 'oops' });
    expect(result.success).toBe(false);
    expect(runVisibilityChangeMock).not.toHaveBeenCalled();
  });

  it('forwards an archived transition for valid input', async () => {
    const result = await archiveArtifact({ id: ARTIFACT_ID });
    expect(result.success).toBe(true);
    expect(runVisibilityChangeMock).toHaveBeenCalledWith({
      id: ARTIFACT_ID,
      visibility: 'archived',
    });
  });
});

describe('setArtifactVisibility', () => {
  it('rejects an invalid visibility value', async () => {
    const result = await setArtifactVisibility({
      id: ARTIFACT_ID,
      visibility: 'unpublished',
    });
    expect(result.success).toBe(false);
    expect(runVisibilityChangeMock).not.toHaveBeenCalled();
  });

  it('forwards the requested visibility for valid input', async () => {
    const result = await setArtifactVisibility({
      id: ARTIFACT_ID,
      visibility: 'internal_teacher_only',
    });
    expect(result.success).toBe(true);
    expect(runVisibilityChangeMock).toHaveBeenCalledWith({
      id: ARTIFACT_ID,
      visibility: 'internal_teacher_only',
    });
  });
});
