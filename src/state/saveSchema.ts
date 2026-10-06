import { DEFAULT_CONFIG, SHIP_SKINS } from '../constants';

export interface HighScore {
  score: number;
  sector: number;
  date: string;
}

export interface SaveV7 {
  version: 7;
  totalCores: number;
  upgrades: { shield: number; magnet: number; tether: number };
  highScores: HighScore[];
  skins: { unlockedIds: number[]; activeId: number };
  preferences: { muted: boolean; reducedMotion: boolean | null };
  dailyRecords: Record<string, number>;
}

export const SAVE_KEY = 'gravity_pivot_save';
export const LEGACY_DAILY_RECORDS_KEY =
  'gravity_pivot_dailyChallengeRecords_v1';

export function isValidChallengeId(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function createDefaultSave(): SaveV7 {
  return {
    version: 7,
    totalCores: 0,
    upgrades: { shield: 1, magnet: 1, tether: 1 },
    highScores: [],
    skins: { unlockedIds: [0], activeId: 0 },
    preferences: { muted: false, reducedMotion: null },
    dailyRecords: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validInteger(
  value: unknown,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): number | null {
  return Number.isSafeInteger(value) &&
    (value as number) >= min &&
    (value as number) <= max
    ? (value as number)
    : null;
}

function parseDailyRecords(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const records: Record<string, number> = {};
  for (const [key, score] of Object.entries(value)) {
    const match = key.match(/^(\d{4}-\d{2}-\d{2})@(\d+)$/);
    if (
      !match ||
      !isValidChallengeId(match[1]) ||
      !Number.isSafeInteger(Number(match[2])) ||
      Number(match[2]) < 1
    )
      continue;
    const cleanScore = validInteger(score, 0);
    if (cleanScore !== null) records[key] = cleanScore;
  }
  return retainDailyDays(records);
}

export function retainDailyDays(
  records: Record<string, number>,
  keepChallengeId?: string,
): Record<string, number> {
  const days = [
    ...new Set(Object.keys(records).map((key) => key.split('@')[0])),
  ];
  if (days.length <= 30) return { ...records };
  days.sort((a, b) => b.localeCompare(a));
  const keep = new Set(days.slice(0, 30));
  if (keepChallengeId) keep.add(keepChallengeId);
  const retainedDays = [...keep]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 30);
  if (keepChallengeId && !retainedDays.includes(keepChallengeId)) {
    retainedDays[retainedDays.length - 1] = keepChallengeId;
  }
  const retained = new Set(retainedDays);
  return Object.fromEntries(
    Object.entries(records).filter(([key]) => retained.has(key.split('@')[0])),
  );
}

export interface ValidationResult {
  value: SaveV7;
  repaired: boolean;
}

export function validateSaveV7(input: unknown): ValidationResult {
  const fallback = createDefaultSave();
  if (!isRecord(input) || input.version !== 7) {
    return { value: fallback, repaired: true };
  }
  let repaired = false;
  const cores = validInteger(input.totalCores, 0);
  if (cores === null) repaired = true;

  const rawUpgrades = isRecord(input.upgrades) ? input.upgrades : {};
  const upgrades = { shield: 1, magnet: 1, tether: 1 };
  for (const key of ['shield', 'magnet', 'tether'] as const) {
    const level = validInteger(rawUpgrades[key], 1);
    if (level === null) repaired = true;
    else {
      upgrades[key] = Math.min(level, DEFAULT_CONFIG.maxUpgradeLevel);
      if (level > DEFAULT_CONFIG.maxUpgradeLevel) repaired = true;
    }
  }

  const highScores: HighScore[] = [];
  if (!Array.isArray(input.highScores)) repaired = true;
  else {
    for (const entry of input.highScores) {
      if (!isRecord(entry)) {
        repaired = true;
        continue;
      }
      const score = validInteger(entry.score, 0);
      const sector = validInteger(entry.sector, 1);
      if (
        score === null ||
        sector === null ||
        typeof entry.date !== 'string' ||
        entry.date.length === 0 ||
        entry.date.length > 80
      ) {
        repaired = true;
        continue;
      }
      highScores.push({ score, sector, date: entry.date });
    }
  }
  highScores.sort((a, b) => b.score - a.score);
  if (highScores.length > 5) repaired = true;

  const rawSkins = isRecord(input.skins) ? input.skins : {};
  const knownSkinIds = new Set<number>(SHIP_SKINS.map((skin) => skin.id));
  const unlockedIds: number[] = [];
  const rawUnlocked = Array.isArray(rawSkins.unlockedIds)
    ? rawSkins.unlockedIds
    : [];
  if (!Array.isArray(rawSkins.unlockedIds)) repaired = true;
  for (const id of rawUnlocked) {
    if (
      validInteger(id, 0) !== null &&
      knownSkinIds.has(id as number) &&
      !unlockedIds.includes(id as number)
    ) {
      unlockedIds.push(id as number);
    } else {
      repaired = true;
    }
  }
  if (!unlockedIds.includes(0)) {
    unlockedIds.unshift(0);
    repaired = true;
  }
  const activeId = validInteger(rawSkins.activeId, 0);
  const activeSkinId =
    activeId !== null && unlockedIds.includes(activeId) ? activeId : 0;
  if (activeId === null || activeSkinId !== activeId) repaired = true;

  const rawPreferences = isRecord(input.preferences) ? input.preferences : {};
  const muted =
    typeof rawPreferences.muted === 'boolean' ? rawPreferences.muted : false;
  const reducedMotion =
    typeof rawPreferences.reducedMotion === 'boolean' ||
    rawPreferences.reducedMotion === null
      ? rawPreferences.reducedMotion
      : null;
  if (
    typeof rawPreferences.muted !== 'boolean' ||
    !(
      typeof rawPreferences.reducedMotion === 'boolean' ||
      rawPreferences.reducedMotion === null
    )
  ) {
    repaired = true;
  }

  const dailyRecords = parseDailyRecords(input.dailyRecords);
  if (!isRecord(input.dailyRecords)) repaired = true;
  if (
    isRecord(input.dailyRecords) &&
    Object.keys(dailyRecords).length !== Object.keys(input.dailyRecords).length
  ) {
    repaired = true;
  }

  return {
    value: {
      version: 7,
      totalCores: cores ?? 0,
      upgrades,
      highScores: highScores.slice(0, 5),
      skins: { unlockedIds, activeId: activeSkinId },
      preferences: { muted, reducedMotion },
      dailyRecords,
    },
    repaired,
  };
}
