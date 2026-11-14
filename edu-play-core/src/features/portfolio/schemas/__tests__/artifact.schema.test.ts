import { describe, expect, it } from 'vitest';
import {
  createArtifactSchema,
  recordChildArtifactSchema,
  recordActivityArtifactSchema,
  recordGameArtifactSchema,
  setArtifactVisibilitySchema,
  teacherUploadArtifactSchema,
  updateArtifactSchema,
  MAX_AUDIO_BYTES,
  MAX_PHOTO_BYTES,
  MAX_SCREENSHOT_BYTES,
} from '../artifact.schema';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';

describe('createArtifactSchema', () => {
  it('accepts a minimal valid payload', () => {
    const parsed = createArtifactSchema.parse({
      studentId: VALID_UUID,
      artifactType: 'photo',
      storagePath: 'students/x/photo.png',
    });
    expect(parsed.artifactType).toBe('photo');
    expect(parsed.storagePath).toBe('students/x/photo.png');
  });

  it('rejects an unknown artifact type', () => {
    const result = createArtifactSchema.safeParse({
      studentId: VALID_UUID,
      artifactType: 'pdf',
      storagePath: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-uuid studentId', () => {
    const result = createArtifactSchema.safeParse({
      studentId: 'not-a-uuid',
      artifactType: 'photo',
      storagePath: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty storagePath', () => {
    const result = createArtifactSchema.safeParse({
      studentId: VALID_UUID,
      artifactType: 'photo',
      storagePath: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-draft initial visibility', () => {
    const result = createArtifactSchema.safeParse({
      studentId: VALID_UUID,
      artifactType: 'photo',
      storagePath: 'x',
      visibility: 'family_visible',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateArtifactSchema', () => {
  it('accepts an id-only payload (all other fields optional)', () => {
    const parsed = updateArtifactSchema.parse({ id: VALID_UUID });
    expect(parsed.id).toBe(VALID_UUID);
  });

  it('trims overly long titles', () => {
    const result = updateArtifactSchema.safeParse({
      id: VALID_UUID,
      title: 'a'.repeat(150),
    });
    expect(result.success).toBe(false);
  });
});

describe('recordActivityArtifactSchema', () => {
  it('accepts a minimal valid payload', () => {
    const parsed = recordActivityArtifactSchema.parse({
      studentId: VALID_UUID,
      activityId: '22222222-2222-4222-8222-222222222222',
      screenshotDataUrl: TINY_PNG_DATA_URL,
    });
    expect(parsed.studentId).toBe(VALID_UUID);
    expect(parsed.activityId).toBe('22222222-2222-4222-8222-222222222222');
    expect(parsed.screenshotDataUrl).toBe(TINY_PNG_DATA_URL);
  });

  it('accepts an optional score', () => {
    const parsed = recordActivityArtifactSchema.parse({
      studentId: VALID_UUID,
      activityId: '22222222-2222-4222-8222-222222222222',
      screenshotDataUrl: TINY_PNG_DATA_URL,
      score: 80,
    });
    expect(parsed.score).toBe(80);
  });

  it('rejects a non-uuid studentId', () => {
    const result = recordActivityArtifactSchema.safeParse({
      studentId: 'not-a-uuid',
      activityId: '22222222-2222-4222-8222-222222222222',
      screenshotDataUrl: TINY_PNG_DATA_URL,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid activityId', () => {
    const result = recordActivityArtifactSchema.safeParse({
      studentId: VALID_UUID,
      activityId: 'not-a-uuid',
      screenshotDataUrl: TINY_PNG_DATA_URL,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-PNG dataURL prefix', () => {
    const result = recordActivityArtifactSchema.safeParse({
      studentId: VALID_UUID,
      activityId: '22222222-2222-4222-8222-222222222222',
      screenshotDataUrl: 'data:image/jpeg;base64,abc',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a plain string with no dataURL prefix', () => {
    const result = recordActivityArtifactSchema.safeParse({
      studentId: VALID_UUID,
      activityId: '22222222-2222-4222-8222-222222222222',
      screenshotDataUrl: 'not-a-data-url',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an oversize screenshot (>5 MB decoded)', () => {
    const oversized =
      'data:image/png;base64,' + 'A'.repeat(MAX_SCREENSHOT_BYTES * 2);
    const result = recordActivityArtifactSchema.safeParse({
      studentId: VALID_UUID,
      activityId: '22222222-2222-4222-8222-222222222222',
      screenshotDataUrl: oversized,
    });
    expect(result.success).toBe(false);
  });

  it('rejects scores outside 0..100', () => {
    expect(
      recordActivityArtifactSchema.safeParse({
        studentId: VALID_UUID,
        activityId: '22222222-2222-4222-8222-222222222222',
        screenshotDataUrl: TINY_PNG_DATA_URL,
        score: 150,
      }).success,
    ).toBe(false);
    expect(
      recordActivityArtifactSchema.safeParse({
        studentId: VALID_UUID,
        activityId: '22222222-2222-4222-8222-222222222222',
        screenshotDataUrl: TINY_PNG_DATA_URL,
        score: -1,
      }).success,
    ).toBe(false);
  });
});

describe('recordGameArtifactSchema', () => {
  it('accepts legacy slug game ids as source references', () => {
    const parsed = recordGameArtifactSchema.parse({
      studentId: VALID_UUID,
      gameId: 'fruits-01',
      screenshotDataUrl: TINY_PNG_DATA_URL,
    });
    expect(parsed.gameId).toBe('fruits-01');
  });

  it('rejects an empty game id', () => {
    const result = recordGameArtifactSchema.safeParse({
      studentId: VALID_UUID,
      gameId: '',
      screenshotDataUrl: TINY_PNG_DATA_URL,
    });
    expect(result.success).toBe(false);
  });
});

describe('recordChildArtifactSchema', () => {
  describe('drawing kind', () => {
    it('accepts a valid PNG dataURL', () => {
      const parsed = recordChildArtifactSchema.parse({
        kind: 'drawing',
        studentId: VALID_UUID,
        payload: { dataUrl: TINY_PNG_DATA_URL },
      });
      expect(parsed.kind).toBe('drawing');
      if (parsed.kind === 'drawing') {
        expect(parsed.payload.dataUrl).toBe(TINY_PNG_DATA_URL);
      }
    });

    it('accepts an optional sourceRef', () => {
      const parsed = recordChildArtifactSchema.parse({
        kind: 'drawing',
        studentId: VALID_UUID,
        payload: { dataUrl: TINY_PNG_DATA_URL },
        sourceRef: 'fruits-01',
      });
      expect(parsed.sourceRef).toBe('fruits-01');
    });

    it('rejects a non-PNG dataURL', () => {
      const result = recordChildArtifactSchema.safeParse({
        kind: 'drawing',
        studentId: VALID_UUID,
        payload: { dataUrl: 'data:image/jpeg;base64,abc' },
      });
      expect(result.success).toBe(false);
    });

    it('rejects an oversize dataURL (>5 MB decoded)', () => {
      const oversized =
        'data:image/png;base64,' + 'A'.repeat(MAX_SCREENSHOT_BYTES * 2);
      const result = recordChildArtifactSchema.safeParse({
        kind: 'drawing',
        studentId: VALID_UUID,
        payload: { dataUrl: oversized },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('audio kind', () => {
    const validAudioBlob = (): Uint8Array =>
      new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]);

    it('accepts a webm audio blob', () => {
      const parsed = recordChildArtifactSchema.parse({
        kind: 'audio',
        studentId: VALID_UUID,
        payload: { blob: validAudioBlob(), mime: 'audio/webm' },
      });
      expect(parsed.kind).toBe('audio');
      if (parsed.kind === 'audio') {
        expect(parsed.payload.mime).toBe('audio/webm');
        expect(parsed.payload.blob).toBeInstanceOf(Uint8Array);
      }
    });

    it('accepts an ogg audio blob', () => {
      const parsed = recordChildArtifactSchema.parse({
        kind: 'audio',
        studentId: VALID_UUID,
        payload: { blob: validAudioBlob(), mime: 'audio/ogg' },
      });
      if (parsed.kind === 'audio') {
        expect(parsed.payload.mime).toBe('audio/ogg');
      }
    });

    it('rejects an unsupported audio MIME', () => {
      const result = recordChildArtifactSchema.safeParse({
        kind: 'audio',
        studentId: VALID_UUID,
        payload: { blob: validAudioBlob(), mime: 'audio/mp4' },
      });
      expect(result.success).toBe(false);
    });

    it('rejects an empty audio blob', () => {
      const result = recordChildArtifactSchema.safeParse({
        kind: 'audio',
        studentId: VALID_UUID,
        payload: { blob: new Uint8Array(0), mime: 'audio/webm' },
      });
      expect(result.success).toBe(false);
    });

    it('rejects an oversize audio blob (>10 MB)', () => {
      const result = recordChildArtifactSchema.safeParse({
        kind: 'audio',
        studentId: VALID_UUID,
        payload: {
          blob: new Uint8Array(MAX_AUDIO_BYTES + 1),
          mime: 'audio/webm',
        },
      });
      expect(result.success).toBe(false);
    });

    it('rejects a non-Uint8Array blob', () => {
      const result = recordChildArtifactSchema.safeParse({
        kind: 'audio',
        studentId: VALID_UUID,
        payload: { blob: 'not-bytes', mime: 'audio/webm' },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('top-level shape', () => {
    it('rejects photo because teacher uploads use teacherUploadArtifactSchema', () => {
      const result = recordChildArtifactSchema.safeParse({
        kind: 'photo',
        studentId: VALID_UUID,
        payload: {
          blob: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
          mime: 'image/jpeg',
        },
      });
      expect(result.success).toBe(false);
    });

    it('rejects an unknown kind', () => {
      const result = recordChildArtifactSchema.safeParse({
        kind: 'video',
        studentId: VALID_UUID,
        payload: { dataUrl: TINY_PNG_DATA_URL },
      });
      expect(result.success).toBe(false);
    });

    it('rejects a non-uuid studentId', () => {
      const result = recordChildArtifactSchema.safeParse({
        kind: 'drawing',
        studentId: 'not-a-uuid',
        payload: { dataUrl: TINY_PNG_DATA_URL },
      });
      expect(result.success).toBe(false);
    });

    it('rejects an over-long sourceRef', () => {
      const result = recordChildArtifactSchema.safeParse({
        kind: 'drawing',
        studentId: VALID_UUID,
        payload: { dataUrl: TINY_PNG_DATA_URL },
        sourceRef: 'a'.repeat(121),
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('teacherUploadArtifactSchema', () => {
  const validPhotoBlob = (): Uint8Array =>
    new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const validAudioBlob = (): Uint8Array =>
    new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]);

  it('accepts a photo upload with optional title', () => {
    const parsed = teacherUploadArtifactSchema.parse({
      kind: 'photo',
      studentId: VALID_UUID,
      payload: { blob: validPhotoBlob(), mime: 'image/jpeg' },
      title: '  Drawing class — Maria  ',
    });
    expect(parsed.kind).toBe('photo');
    expect(parsed.title).toBe('Drawing class — Maria');
  });

  it('accepts an audio upload without title', () => {
    const parsed = teacherUploadArtifactSchema.parse({
      kind: 'audio',
      studentId: VALID_UUID,
      payload: { blob: validAudioBlob(), mime: 'audio/webm' },
    });
    expect(parsed.kind).toBe('audio');
    expect(parsed.title).toBeUndefined();
  });

  it('rejects the drawing kind (drawings come from student game canvas)', () => {
    const result = teacherUploadArtifactSchema.safeParse({
      kind: 'drawing',
      studentId: VALID_UUID,
      payload: { dataUrl: TINY_PNG_DATA_URL },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an oversize photo (>8 MB)', () => {
    const result = teacherUploadArtifactSchema.safeParse({
      kind: 'photo',
      studentId: VALID_UUID,
      payload: {
        blob: new Uint8Array(MAX_PHOTO_BYTES + 1),
        mime: 'image/jpeg',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unsupported photo MIME', () => {
    const result = teacherUploadArtifactSchema.safeParse({
      kind: 'photo',
      studentId: VALID_UUID,
      payload: { blob: validPhotoBlob(), mime: 'image/gif' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty photo blob', () => {
    const result = teacherUploadArtifactSchema.safeParse({
      kind: 'photo',
      studentId: VALID_UUID,
      payload: { blob: new Uint8Array(0), mime: 'image/jpeg' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-uuid studentId', () => {
    const result = teacherUploadArtifactSchema.safeParse({
      kind: 'photo',
      studentId: 'not-a-uuid',
      payload: { blob: validPhotoBlob(), mime: 'image/jpeg' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an over-long title', () => {
    const result = teacherUploadArtifactSchema.safeParse({
      kind: 'photo',
      studentId: VALID_UUID,
      payload: { blob: validPhotoBlob(), mime: 'image/jpeg' },
      title: 'a'.repeat(121),
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty (whitespace-only) title', () => {
    const result = teacherUploadArtifactSchema.safeParse({
      kind: 'photo',
      studentId: VALID_UUID,
      payload: { blob: validPhotoBlob(), mime: 'image/jpeg' },
      title: '   ',
    });
    expect(result.success).toBe(false);
  });
});

describe('setArtifactVisibilitySchema', () => {
  it('accepts every visibility lifecycle value', () => {
    for (const v of [
      'draft',
      'internal_teacher_only',
      'family_visible',
      'archived',
    ] as const) {
      const parsed = setArtifactVisibilitySchema.parse({
        id: VALID_UUID,
        visibility: v,
      });
      expect(parsed.visibility).toBe(v);
    }
  });

  it('rejects an unknown visibility', () => {
    const result = setArtifactVisibilitySchema.safeParse({
      id: VALID_UUID,
      visibility: 'unpublished',
    });
    expect(result.success).toBe(false);
  });
});
