// 本地游玩记录：只保存每关最佳星级、对应用时和旋转次数。
// 旧版本仅保存解锁进度；旧通关不会被误算为三星。
const KEY = "folded-path-records-v1";
const BOSS_SKIP_KEY = "folded-path-boss-skipped-v1";

export function bossWasSkipped(storage = localStorage) {
  try { return storage.getItem(BOSS_SKIP_KEY) === "1"; }
  catch { return false; }
}

export function markBossSkipped(storage = localStorage) {
  try { storage.setItem(BOSS_SKIP_KEY, "1"); return true; }
  catch { return false; }
}

export function loadRecords(storage = localStorage) {
  try {
    const data = JSON.parse(storage.getItem(KEY) || "{}");
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return Object.fromEntries(Object.entries(data).filter(([id, record]) =>
      Number(id) >= 1 && Number(id) <= 13 &&
      Number.isInteger(record?.stars) && record.stars >= 1 && record.stars <= 3 &&
      Number.isFinite(record.timeMs) && record.timeMs >= 0 &&
      Number.isInteger(record.rotations) && record.rotations >= 0));
  } catch { return {}; }
}

export function saveRecord(records, id, result, storage = localStorage) {
  const old = records[id];
  const better = !old || result.stars > old.stars ||
    (result.stars === old.stars && result.rotations < old.rotations) ||
    (result.stars === old.stars && result.rotations === old.rotations && result.timeMs < old.timeMs);
  if (better) {
    records[id] = { stars: result.stars, timeMs: Math.max(0, Math.floor(result.timeMs)), rotations: result.rotations };
    storage.setItem(KEY, JSON.stringify(records));
  }
  return better;
}

export function allPerfect(records) {
  return Array.from({ length: 12 }, (_, i) => records[i + 1]?.stars === 3).every(Boolean);
}

export function clearedCount(records) {
  return Array.from({ length: 12 }, (_, i) => records[i + 1]?.stars >= 1).filter(Boolean).length;
}

export function allCleared(records) {
  return clearedCount(records) === 12;
}

export function perfectCount(records) {
  return Array.from({ length: 12 }, (_, i) => records[i + 1]?.stars === 3).filter(Boolean).length;
}
