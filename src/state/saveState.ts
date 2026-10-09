import { DEFAULT_CONFIG, SHIP_SKINS, upgradeCost } from '../constants';
import {
  createDefaultSave,
  isValidChallengeId,
  LEGACY_DAILY_RECORDS_KEY,
  retainDailyDays,
  SAVE_KEY,
  SaveV7,
  validateSaveV7,
} from './saveSchema';
import { HighScore } from './saveSchema';

const LEGACY_KEYS = {
  CORES: 'gravity_pivot_cores_v6',
  SHIELD: 'gravity_pivot_shieldLvl_v6',
  MAGNET: 'gravity_pivot_magnetLvl_v6',
  TETHER: 'gravity_pivot_tetherLvl_v6',
  HIGH_SCORES: 'gravity_pivot_highScores_v6',
  UNLOCKED_SKINS: 'gravity_pivot_unlockedSkins_v6',
  ACTIVE_SKIN: 'gravity_pivot_activeSkinId_v6',
};

export type UpgradeType = 'shield' | 'magnet' | 'tether';
export type SkinPurchaseResult = 'purchased' | 'cycled' | 'insufficient';

export class GameSaveState {
  private data: SaveV7 = createDefaultSave();
  private futureVersionReadOnly = false;
  private persistenceBlocked = false;

  constructor() {
    this.load();
  }

  public get totalCores(): number {
    return this.data.totalCores;
  }

  public get upgrades(): Readonly<{
    shield: number;
    magnet: number;
    tether: number;
  }> {
    return { ...this.data.upgrades };
  }

  public get shieldLvl(): number {
    return this.data.upgrades.shield;
  }

  public get magnetLvl(): number {
    return this.data.upgrades.magnet;
  }

  public get tetherLvl(): number {
    return this.data.upgrades.tether;
  }

  public get highScores(): readonly HighScore[] {
    return this.data.highScores.map((score) => ({ ...score }));
  }

  public get unlockedSkins(): readonly number[] {
    return [...this.data.skins.unlockedIds];
  }

  public get activeSkinId(): number {
    return this.data.skins.activeId;
  }

  public get preferences(): Readonly<SaveV7['preferences']> {
    return { ...this.data.preferences };
  }

  public get dailyRecords(): Readonly<Record<string, number>> {
    return { ...this.data.dailyRecords };
  }

  public load(): void {
    this.data = createDefaultSave();
    let rawCurrent: string | null;
    try {
      rawCurrent = localStorage.getItem(SAVE_KEY);
    } catch {
      this.persistenceBlocked = true;
      return;
    }

    if (rawCurrent !== null) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawCurrent);
      } catch {
        this.repairCorruptCurrent(rawCurrent, createDefaultSave());
        return;
      }

      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'version' in parsed &&
        typeof parsed.version === 'number' &&
        parsed.version > 7
      ) {
        this.futureVersionReadOnly = true;
        return;
      }

      const validation = validateSaveV7(parsed);
      this.data = validation.value;
      if (validation.repaired) {
        this.repairCorruptCurrent(rawCurrent, validation.value);
      }
      return;
    }

    try {
      this.data = validateSaveV7(this.readLegacySave()).value;
      this.persist();
    } catch {
      // Storage denial leaves a usable in-memory default save.
      this.persistenceBlocked = true;
    }
  }

  private repairCorruptCurrent(raw: string, repaired: SaveV7): void {
    this.data = repaired;
    if (!this.backupCorruptValue(raw)) {
      this.persistenceBlocked = true;
      return;
    }
    this.persist();
  }

  private backupCorruptValue(raw: string): boolean {
    try {
      let key = 'gravity_pivot_save_corrupt_backup';
      let suffix = 1;
      while (localStorage.getItem(key) !== null) {
        key = `gravity_pivot_save_corrupt_backup_${suffix++}`;
      }
      localStorage.setItem(key, raw);
      return true;
    } catch {
      return false;
    }
  }

  private readLegacySave(): unknown {
    const read = (key: string): string | null => localStorage.getItem(key);
    const parseJson = (value: string | null): unknown => {
      if (value === null) return undefined;
      try {
        return JSON.parse(value);
      } catch {
        return undefined;
      }
    };
    const number = (value: string | null, fallback: number): number => {
      if (value === null) return fallback;
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) ? parsed : fallback;
    };

    const dailyRecords: Record<string, number> = {};
    const oldDailyRecords = parseJson(read(LEGACY_DAILY_RECORDS_KEY));
    if (
      oldDailyRecords &&
      typeof oldDailyRecords === 'object' &&
      !Array.isArray(oldDailyRecords)
    ) {
      for (const [oldKey, score] of Object.entries(oldDailyRecords)) {
        const match = oldKey.match(/^v(\d+):(\d{4}-\d{2}-\d{2})$/);
        if (
          match &&
          Number.isSafeInteger(Number(match[1])) &&
          Number(match[1]) >= 1 &&
          isValidChallengeId(match[2]) &&
          Number.isSafeInteger(score) &&
          (score as number) >= 0
        ) {
          dailyRecords[`${match[2]}@${match[1]}`] = score as number;
        }
      }
    }

    return {
      version: 7,
      totalCores: number(read(LEGACY_KEYS.CORES), 0),
      upgrades: {
        shield: number(read(LEGACY_KEYS.SHIELD), 1),
        magnet: number(read(LEGACY_KEYS.MAGNET), 1),
        tether: number(read(LEGACY_KEYS.TETHER), 1),
      },
      highScores: parseJson(read(LEGACY_KEYS.HIGH_SCORES)) ?? [],
      skins: {
        unlockedIds: parseJson(read(LEGACY_KEYS.UNLOCKED_SKINS)) ?? [0],
        activeId: number(read(LEGACY_KEYS.ACTIVE_SKIN), 0),
      },
      preferences: { muted: false, reducedMotion: null },
      dailyRecords,
    };
  }

  public getSnapshot(): SaveV7 {
    return {
      ...this.data,
      upgrades: { ...this.data.upgrades },
      highScores: this.data.highScores.map((score) => ({ ...score })),
      skins: {
        unlockedIds: [...this.data.skins.unlockedIds],
        activeId: this.data.skins.activeId,
      },
      preferences: { ...this.data.preferences },
      dailyRecords: { ...this.data.dailyRecords },
    };
  }

  public save(): boolean {
    return this.persist();
  }

  private persist(): boolean {
    if (this.persistenceBlocked || this.futureVersionReadOnly) return false;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
      return true;
    } catch {
      return false;
    }
  }

  public awardCores(amount: number): number {
    if (!Number.isSafeInteger(amount) || amount <= 0) return this.totalCores;
    this.data.totalCores = Math.min(
      Number.MAX_SAFE_INTEGER,
      this.data.totalCores + amount,
    );
    this.persist();
    return this.totalCores;
  }

  public setPreference<K extends keyof SaveV7['preferences']>(
    key: K,
    value: SaveV7['preferences'][K],
  ): void {
    this.data.preferences[key] = value;
    this.persist();
  }

  public purchaseUpgrade(type: UpgradeType): boolean {
    const level = this.data.upgrades[type];
    if (level >= DEFAULT_CONFIG.maxUpgradeLevel) return false;
    const baseCost = { shield: 10, magnet: 15, tether: 20 }[type];
    const cost = upgradeCost(baseCost, level);
    if (this.data.totalCores < cost) return false;
    this.data.totalCores -= cost;
    this.data.upgrades[type]++;
    this.persist();
    return true;
  }

  public purchaseNextSkin(): SkinPurchaseResult {
    const nextSkin = SHIP_SKINS.find(
      (skin) => !this.data.skins.unlockedIds.includes(skin.id),
    );
    if (!nextSkin) {
      const currentIndex = this.data.skins.unlockedIds.indexOf(
        this.data.skins.activeId,
      );
      const nextIndex = (currentIndex + 1) % this.data.skins.unlockedIds.length;
      this.data.skins.activeId = this.data.skins.unlockedIds[nextIndex];
      this.persist();
      return 'cycled';
    }
    if (this.data.totalCores < nextSkin.cost) return 'insufficient';
    this.data.totalCores -= nextSkin.cost;
    this.data.skins.unlockedIds.push(nextSkin.id);
    this.data.skins.activeId = nextSkin.id;
    this.persist();
    return 'purchased';
  }

  public equipSkin(skinId: number): boolean {
    if (
      !Number.isSafeInteger(skinId) ||
      !this.data.skins.unlockedIds.includes(skinId)
    ) {
      return false;
    }
    this.data.skins.activeId = skinId;
    this.persist();
    return true;
  }

  public addHighScore(score: number, sector: number): void {
    if (
      !Number.isFinite(score) ||
      score < 0 ||
      !Number.isSafeInteger(sector) ||
      sector < 1
    ) {
      return;
    }
    const date = new Date().toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    this.data.highScores.push({ score: Math.floor(score), sector, date });
    this.data.highScores.sort((a, b) => b.score - a.score);
    this.data.highScores = this.data.highScores.slice(0, 5);
    this.persist();
  }

  public getDailyChallengeBest(
    challengeId: string,
    rulesVersion: number,
  ): number {
    const key = this.dailyRecordKey(challengeId, rulesVersion);
    return key ? (this.data.dailyRecords[key] ?? 0) : 0;
  }

  public updateDailyChallengeBest(
    challengeId: string,
    rulesVersion: number,
    score: number,
  ): boolean {
    const key = this.dailyRecordKey(challengeId, rulesVersion);
    if (!key || !Number.isFinite(score) || score < 0) return false;
    const cleanScore = Math.floor(score);
    if (cleanScore <= (this.data.dailyRecords[key] ?? 0)) return false;
    this.data.dailyRecords[key] = cleanScore;
    this.data.dailyRecords = retainDailyDays(
      this.data.dailyRecords,
      challengeId,
    );
    this.persist();
    return true;
  }

  private dailyRecordKey(
    challengeId: string,
    rulesVersion: number,
  ): string | null {
    if (
      !isValidChallengeId(challengeId) ||
      !Number.isSafeInteger(rulesVersion) ||
      rulesVersion < 1
    ) {
      return null;
    }
    return `${challengeId}@${rulesVersion}`;
  }
}
