import { getFlag, type FeatureFlag } from './flags';

/**
 * Catalog gate convention.
 *
 * Listen-tap Activities are identified by their renderer template. The URL
 * fallback keeps older fixtures safe while the presentation layer is renamed
 * away from Game-shaped types.
 */
type GameGateInput = { game_url: string; template?: string | null };

function getRequiredFlag(game: GameGateInput): FeatureFlag | null {
  if (game.template === 'listen-tap' || game.game_url.includes('/listen-tap/')) return 'listen_tap_audio';
  return null;
}

export function isGameVisibleToStudents(game: GameGateInput): boolean {
  const required = getRequiredFlag(game);
  if (!required) return true;
  return getFlag(required);
}

export function filterStudentVisibleGames<T extends GameGateInput>(games: T[]): T[] {
  return games.filter(isGameVisibleToStudents);
}
