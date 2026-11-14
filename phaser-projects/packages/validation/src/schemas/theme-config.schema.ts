/**
 * Theme Configuration Schemas
 * Zod validation for Phaser game themes
 */

import { z } from 'zod';

// ============================================
// Background Style Schema
// ============================================

/**
 * Built-in background styles
 */
export const backgroundStyleEnum = z.enum([
  'hills',
  'ocean',
  'space',
  'candy',
  'forest',
  'sunset',
  'default'
]);

/**
 * Background style (extensible - can be custom string)
 */
export const backgroundStyleSchema = z.string();

// ============================================
// Theme Name Schema
// ============================================

/**
 * Built-in theme names
 */
export const themeNameEnum = z.enum([
  'nature',
  'ocean',
  'space',
  'candy',
  'forest',
  'sunset',
  'default'
]);

/**
 * Theme name (extensible - can be custom string)
 */
export const themeNameSchema = z.string();

// ============================================
// Color Schemas
// ============================================

/**
 * Hex color number (0x000000 to 0xFFFFFF)
 */
export const hexColorSchema = z.number()
  .int()
  .min(0x000000)
  .max(0xFFFFFF);

/**
 * CSS color string (e.g., '#FFFFFF', 'rgb(255,255,255)')
 */
export const cssColorSchema = z.string()
  .regex(/^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$|^rgb\(|^rgba\(/);

// ============================================
// Theme Config Schema
// ============================================

/**
 * Core theme configuration
 */
export const themeConfigSchema = z.object({
  // Core colors (hex numbers)
  primary: hexColorSchema,
  secondary: hexColorSchema,
  background: hexColorSchema,
  cardBg: hexColorSchema,
  textColor: cssColorSchema,

  // Container colors (optional)
  containerBg: hexColorSchema.optional(),
  containerText: cssColorSchema.optional(),
  containerBorder: hexColorSchema.optional(),

  // Background style
  backgroundStyle: backgroundStyleSchema.optional(),

  // Feedback colors (optional)
  correctColor: hexColorSchema.optional(),
  incorrectColor: hexColorSchema.optional(),
  starColor: hexColorSchema.optional()
});

/**
 * Theme definition with metadata
 */
export const themeDefinitionSchema = themeConfigSchema.extend({
  name: themeNameSchema,
  displayName: z.string().min(1),
  description: z.string()
});

// ============================================
// Type Exports
// ============================================

export type ThemeConfig = z.infer<typeof themeConfigSchema>;
export type ThemeDefinition = z.infer<typeof themeDefinitionSchema>;
export type ThemeName = z.infer<typeof themeNameEnum>;
export type BackgroundStyle = z.infer<typeof backgroundStyleEnum>;
