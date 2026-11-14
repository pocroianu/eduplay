// Games Feature - Server-Only Exports
// Only import from this file in Server Components, Server Actions, and Route Handlers
// NEVER import from this file in Client Components

// All query functions are server-only
export {
  getPublishedGames,
  getStudentVisibleGames,
  getGamesByCategory,
  getGameById,
  getStudentProgress,
  getStudentGameProgress,
  getGamesWithProgress,
  getInProgressGames,
  getAssignedGames,
  getAllGames,
  getChildrenGamesProgress,
} from './queries';

// Re-export types (safe as they're compile-time only)
export type {
  Game,
  GameProgress,
  GameWithProgress,
  GameCategory,
  GameStatus,
} from './types';
