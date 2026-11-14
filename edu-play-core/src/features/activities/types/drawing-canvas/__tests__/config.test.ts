import { describe, expect, it } from 'vitest';
import {
  BRUSH_SIZES,
  PALETTE,
  PALETTE_COLOR_IDS,
  drawingCanvasConfigSchema,
  getPaletteSwatch,
} from '../config';

describe('drawingCanvasConfigSchema', () => {
  it('parses an empty config and applies defaults', () => {
    const result = drawingCanvasConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mode).toBe('freeform');
      expect(result.data.backgroundColor).toBe('white');
    }
  });

  it('accepts a guided-mode config with prompt and templateImageUrl', () => {
    const result = drawingCanvasConfigSchema.safeParse({
      mode: 'guided',
      prompt: 'Desenează o casă cu o ușă verde.',
      templateImageUrl: 'https://example.com/template.png',
      backgroundColor: 'cream',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.prompt).toBe('Desenează o casă cu o ușă verde.');
      expect(result.data.templateImageUrl).toBe('https://example.com/template.png');
      expect(result.data.backgroundColor).toBe('cream');
    }
  });

  it('rejects unknown modes', () => {
    const result = drawingCanvasConfigSchema.safeParse({ mode: 'doodle' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown backgroundColor tokens (no raw hex sneak-through)', () => {
    const result = drawingCanvasConfigSchema.safeParse({
      backgroundColor: '#ff00ff',
    });
    expect(result.success).toBe(false);
  });

  it('rejects oversized prompts', () => {
    const result = drawingCanvasConfigSchema.safeParse({
      mode: 'guided',
      prompt: 'a'.repeat(281),
    });
    expect(result.success).toBe(false);
  });

  it('rejects malformed templateImageUrl values', () => {
    const result = drawingCanvasConfigSchema.safeParse({
      templateImageUrl: 'not a url',
    });
    expect(result.success).toBe(false);
  });
});

describe('palette + brush metadata', () => {
  it('exposes exactly six palette swatches with stable ids', () => {
    expect(PALETTE).toHaveLength(6);
    expect(PALETTE_COLOR_IDS).toHaveLength(6);
    const ids = PALETTE.map((p) => p.id);
    expect(new Set(ids).size).toBe(6);
  });

  it('all swatches resolve to a CSS variable token (no raw hex)', () => {
    for (const swatch of PALETTE) {
      expect(swatch.cssVar.startsWith('--color-')).toBe(true);
      expect(swatch.label.length).toBeGreaterThan(0);
    }
  });

  it('palette excludes pink in the kid-mode default (per EDU-293 § 1.3)', () => {
    expect(PALETTE_COLOR_IDS).not.toContain('pink');
  });

  it('exposes exactly three brush sizes (small / medium / large)', () => {
    expect(BRUSH_SIZES).toEqual(['small', 'medium', 'large']);
  });

  it('getPaletteSwatch returns the swatch matching a given id', () => {
    const swatch = getPaletteSwatch('coral');
    expect(swatch.cssVar).toBe('--color-coral');
    expect(swatch.label).toBe('Coral');
  });
});
