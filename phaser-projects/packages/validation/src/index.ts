/**
 * @edu-play/validation
 * Shared validation schemas and contracts for edu-play Phaser projects
 */

// Export all schemas
export * from './schemas/game-config.schema';
export * from './schemas/theme-config.schema';
export * from './schemas/activity.schema';

// Re-export zod for consumers
export { z } from 'zod';
