import { cache } from 'react';
import {
  getActiveUsers7d as _getActiveUsers7d,
  getGdprOpenCount as _getGdprOpenCount,
  getAuditIncidents24h as _getAuditIncidents24h,
  getRecentFlagChanges as _getRecentFlagChanges,
  getPublishedGamesStats as _getPublishedGamesStats,
  getRecentAuditEntries as _getRecentAuditEntries,
  getAdminOverviewSnapshot as _getAdminOverviewSnapshot,
} from './overview';

export type {
  ActiveUsersStat,
  AdminOverviewSnapshot,
  AuditIncidentsStat,
  FlagEventAction,
  GdprOpenStat,
  PublishedGamesStat,
  RecentAuditEntry,
  RecentFlagChange,
} from './overview';

const getActiveUsers7d = cache(_getActiveUsers7d);
const getGdprOpenCount = cache(_getGdprOpenCount);
const getAuditIncidents24h = cache(_getAuditIncidents24h);
const getRecentFlagChanges = cache(_getRecentFlagChanges);
const getPublishedGamesStats = cache(_getPublishedGamesStats);
const getRecentAuditEntries = cache(_getRecentAuditEntries);
export const getAdminOverviewSnapshot = cache(_getAdminOverviewSnapshot);
