import { BOSS_TILES, BOSS_CELLS, BOSS_COUNT, BOSS_DANGER, BOSS_EXIT, BOSS_KEY, BOSS_LOCK, BOSS_START, BOSS_TURN, BOSS_WALL, BOSS_ARROW_BASE, bossCell, bossPar, createBossRotations } from "./boss-level.js";

const rotations = createBossRotations();
if (rotations.length !== BOSS_COUNT) throw Error("Boss 纸片数量不对");
const par = bossPar();
if (par < 1000 || par >= BOSS_COUNT * 2) throw Error("Boss 旋转基准异常");
for (const index of [1, 99, 100, 101, 9900]) for (const [x, y] of [[0, 50], [10, 14], [50, 50], [50, 98]]) {
  const base = bossCell(index, x, y, 0);
  const rotated = bossCell(index, BOSS_CELLS - 1 - y, x, 1);
  const expected = base >= BOSS_ARROW_BASE && base < BOSS_ARROW_BASE + 4 ? BOSS_ARROW_BASE + (base - BOSS_ARROW_BASE + 1) % 4 : base;
  if (rotated !== expected) throw Error(`Boss 纸片 ${index} 的格子或单向箭头未正确旋转`);
}
if (bossCell(50, 5, 29, 0) !== BOSS_KEY || bossCell(50, 94, 70, 2) !== BOSS_KEY ||
  bossCell(99, 5, 29, 0) !== BOSS_LOCK || bossCell(99, 94, 70, 2) !== BOSS_LOCK) {
  throw Error("Boss 钥匙或锁门没有随纸片正确旋转");
}

const direction = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const player = { ...BOSS_START };
const visited = new Set([player.index]);
const entries = new Uint8Array(BOSS_COUNT);
entries[player.index] = 1;
let bends = 0;
let crossings = 0;
let reached = false;
let steps = 0;
let spinCount = 0;
let hasKey = false;
for (; steps < 10_000_000; steps++) {
  let x = player.x + direction[player.direction][0];
  let y = player.y + direction[player.direction][1];
  let col = player.index % BOSS_TILES;
  let row = Math.floor(player.index / BOSS_TILES);
  if (x < 0) { col--; x = BOSS_CELLS - 1; }
  else if (x >= BOSS_CELLS) { col++; x = 0; }
  if (y < 0) { row--; y = BOSS_CELLS - 1; }
  else if (y >= BOSS_CELLS) { row++; y = 0; }
  if (col < 0 || col >= BOSS_TILES || row < 0 || row >= BOSS_TILES) throw Error(`第 ${steps} 步走出 Boss 地图`);
  const nextIndex = row * BOSS_TILES + col;
  const target = bossCell(nextIndex, x, y, 0);
  if (target === BOSS_WALL || (target === BOSS_LOCK && !hasKey) || (target >= BOSS_ARROW_BASE && target < BOSS_ARROW_BASE + 4 && target - BOSS_ARROW_BASE !== player.direction)) { player.direction = (player.direction + 1) % 4; bends++; spinCount++; if (spinCount >= 4) throw Error(`第 ${steps} 步原地旋转四次`); continue; }
  if (target === BOSS_DANGER) throw Error(`第 ${steps} 步误入 Boss 危险格：${nextIndex}, ${x}, ${y}`);
  if (target === BOSS_KEY) hasKey = true;
  if (nextIndex !== player.index) { crossings++; visited.add(nextIndex); entries[nextIndex]++; }
  player.index = nextIndex;
  player.x = x;
  player.y = y;
  spinCount = 0;
  if (target === BOSS_EXIT) { reached = true; break; }
}
if (!reached || !hasKey) throw Error("Boss 解法超出一千万步、缺钥匙或循环");
if (visited.size !== BOSS_COUNT) throw Error(`Boss 只走过 ${visited.size} / ${BOSS_COUNT} 张纸片`);
if (crossings !== 2 * (BOSS_COUNT - 1)) throw Error(`Boss 往返次数异常：${crossings}`);
const revisitedTiles = entries.reduce((sum, count) => sum + (count >= 2), 0);
if (revisitedTiles !== BOSS_COUNT - 1 || entries[BOSS_TURN] !== 1) throw Error(`Boss 重复使用纸片不足：${revisitedTiles}`);
console.log({ tiles: BOSS_COUNT, cellsPerTile: BOSS_CELLS ** 2, par, steps: steps + 1, bends, crossings, revisitedTiles, visited: visited.size });

// 反例：把前 98 张直行纸片旋转 180°，返程回廊会伪装成正程。
// 它能走过许多张纸片，却无法通过行末转角，故不是一眼可见的短死路。
const falseRotations = new Uint8Array(BOSS_COUNT);
for (let index = 1; index < 99; index++) falseRotations[index] = 2;
const falsePlayer = { ...BOSS_START };
const falseVisited = new Set([0]);
let falseOutcome = "timeout", falseSteps = 0, falseSpin = 0, falseKey = false;
for (; falseSteps < 10_000_000; falseSteps++) {
  let x = falsePlayer.x + direction[falsePlayer.direction][0];
  let y = falsePlayer.y + direction[falsePlayer.direction][1];
  let col = falsePlayer.index % BOSS_TILES, row = Math.floor(falsePlayer.index / BOSS_TILES);
  if (x < 0) { col--; x = BOSS_CELLS - 1; } else if (x >= BOSS_CELLS) { col++; x = 0; }
  if (y < 0) { row--; y = BOSS_CELLS - 1; } else if (y >= BOSS_CELLS) { row++; y = 0; }
  if (col < 0 || col >= BOSS_TILES || row < 0 || row >= BOSS_TILES) { falseOutcome = "boundary"; break; }
  const index = row * BOSS_TILES + col;
  const cell = bossCell(index, x, y, falseRotations[index]);
  if (cell === BOSS_WALL || (cell === BOSS_LOCK && !falseKey) || (cell >= BOSS_ARROW_BASE && cell < BOSS_ARROW_BASE + 4 && cell - BOSS_ARROW_BASE !== falsePlayer.direction)) {
    falsePlayer.direction = (falsePlayer.direction + 1) % 4;
    if (++falseSpin >= 4) { falseOutcome = "blocked"; break; }
    continue;
  }
  if (cell === BOSS_DANGER) { falseOutcome = "danger"; break; }
  if (cell === BOSS_EXIT) { falseOutcome = "won"; break; }
  if (cell === BOSS_KEY) falseKey = true;
  falsePlayer.index = index; falsePlayer.x = x; falsePlayer.y = y;
  falseVisited.add(index); falseSpin = 0;
}
if (falseOutcome === "won" || falseOutcome === "timeout" || falseVisited.size < 20 || falseKey) throw Error(`Boss 假解太短或误通关：${falseOutcome}, ${falseVisited.size} 张`);
console.log({ falseRoute: falseOutcome, progressedTiles: falseVisited.size, stepsBeforeFailure: falseSteps + 1, missedKey: !falseKey });
