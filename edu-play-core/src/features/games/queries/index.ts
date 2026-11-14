// Wrapped with React cache() to deduplicate calls within the same
// server render pass (e.g., student/games and student/rewards calling
// getGamesWithProgress with the same studentId).

import { cache } from 'react';
import {
  getPublishedGames as _getPublishedGames,
  getStudentVisibleGames as _getStudentVisibleGames,
  getGamesByCategory as _getGamesByCategory,
  getGameById as _getGameById,
  getStudentProgress as _getStudentProgress,
  getStudentGameProgress as _getStudentGameProgress,
  getGamesWithProgress as _getGamesWithProgress,
  getInProgressGames as _getInProgressGames,
  getAssignedGames as _getAssignedGames,
  getAllGames as _getAllGames,
  getChildrenGamesProgress as _getChildrenGamesProgress,
} from './getGames';

export const getPublishedGames = cache(_getPublishedGames);
export const getStudentVisibleGames = cache(_getStudentVisibleGames);
export const getGamesByCategory = cache(_getGamesByCategory);
export const getGameById = cache(_getGameById);
export const getStudentProgress = cache(_getStudentProgress);
export const getStudentGameProgress = cache(_getStudentGameProgress);
export const getGamesWithProgress = cache(_getGamesWithProgress);
export const getInProgressGames = cache(_getInProgressGames);
export const getAssignedGames = cache(_getAssignedGames);
export const getAllGames = cache(_getAllGames);
export const getChildrenGamesProgress = cache(_getChildrenGamesProgress);
