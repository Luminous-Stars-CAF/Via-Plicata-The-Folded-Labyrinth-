// 隐藏关不是一亿个 DOM 节点：一万个 100×100 纸片按固定种子生成。
// 同类纸片仅缓存少量路线变体；每次查询只计算当前格及当前纸片。
export const BOSS_TILES = 100;
export const BOSS_CELLS = 100;
export const BOSS_COUNT = BOSS_TILES * BOSS_TILES;
export const BOSS_START = { index: 0, x: 1, y: 29, direction: 1 };
export const BOSS_TURN = (BOSS_TILES - 1) * BOSS_TILES;
export const BOSS_END = BOSS_START.index; // 折返后从起点纸片的另一条路离开

export const BOSS_WALL = 0;
export const BOSS_ROAD = 1;
export const BOSS_DANGER = 2;
export const BOSS_START_CELL = 3;
export const BOSS_EXIT = 4;
export const BOSS_ARROW_BASE = 5; // 5,6,7,8 对应 ↑→↓←
export const BOSS_KEY = 9;
export const BOSS_LOCK = 10;

// 两条互不相交的长回廊。正程穿上/下半区，返程从另一组端口回来。
// 它们在旋转 180° 后恰好可以伪装成对方，形成能跨越数十张纸片的假解。
const UPPER = [[0, 29], [8, 29], [8, 8], [18, 8], [18, 43], [28, 43], [28, 8], [38, 8], [38, 43], [48, 43], [48, 8], [58, 8], [58, 43], [68, 43], [68, 8], [78, 8], [78, 43], [88, 43], [88, 29], [99, 29]];
const LOWER = UPPER.map(([x, y]) => [99 - x, 99 - y]);
const WS_FORWARD = [[0, 29], [8, 29], [8, 9], [20, 9], [20, 43], [32, 43], [32, 9], [44, 9], [44, 43], [56, 43], [56, 9], [68, 9], [68, 43], [80, 43], [80, 9], [87, 9], [87, 94], [70, 94], [70, 99]];
const WS_RETURN = [[30, 99], [30, 93], [8, 93], [8, 82], [44, 82], [44, 70], [0, 70]];
const NW_FORWARD = [[70, 0], [70, 10], [88, 10], [88, 52], [75, 52], [75, 87], [12, 87], [12, 70], [0, 70]];
const NW_RETURN = [[0, 29], [12, 29], [12, 13], [30, 13], [30, 0]];
const ES_FORWARD = [[99, 70], [88, 70], [88, 90], [70, 90], [70, 99]];
const ES_RETURN = [[30, 99], [30, 55], [10, 55], [10, 29], [99, 29]];
const NE_FORWARD = [[70, 0], [70, 10], [90, 10], [90, 29], [99, 29]];
const NE_RETURN = [[99, 70], [85, 70], [85, 90], [30, 90], [30, 0]];
const TERMINAL = [[99, 70], [88, 70], [88, 90], [70, 90], [70, 98], [30, 98], [30, 55], [10, 55], [10, 29], [99, 29]];
const PATHS = {
  east: [UPPER, LOWER], west: [LOWER, UPPER],
  ws: [WS_FORWARD, WS_RETURN], nw: [NW_FORWARD, NW_RETURN],
  es: [ES_FORWARD, ES_RETURN], ne: [NE_FORWARD, NE_RETURN]
};
const cache = new Map();

function hash(value) {
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

export function bossType(index) {
  const row = Math.floor(index / BOSS_TILES);
  const col = index % BOSS_TILES;
  if (row % 2 === 0) return col === BOSS_TILES - 1 ? "ws" : col === 0 && row > 0 ? "ne" : "east";
  return col === BOSS_TILES - 1 ? "nw" : col === 0 ? "es" : "west";
}

export function initialBossRotation(index) {
  if (index === BOSS_START.index) return 0;
  const roll = hash(index + 137) % 20;
  return roll < 7 ? 1 + hash(index + 319) % 3 : 0;
}

export function bossPar() {
  let count = 0;
  for (let i = 0; i < BOSS_COUNT; i++) {
    const angle = initialBossRotation(i);
    count += Math.min(angle, 4 - angle);
  }
  return count;
}

function pattern(type, variant) {
  const cacheKey = `${type}:${variant}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const data = new Uint8Array(BOSS_CELLS * BOSS_CELLS);
  const put = (x, y, value) => { data[y * BOSS_CELLS + x] = value; };
  const at = (x, y) => data[y * BOSS_CELLS + x];
  const paths = variant === -1 ? [TERMINAL] : PATHS[type];
  for (const path of paths) {
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = path[i - 1], [bx, by] = path[i];
      const dx = Math.sign(bx - ax), dy = Math.sign(by - ay);
      const heading = dx === 1 ? 1 : dx === -1 ? 3 : dy === 1 ? 2 : 0;
      for (let x = ax + dx, y = ay + dy; ; x += dx, y += dy) {
        if (at(x, y) && !(i > 1 && x === ax && y === ay)) throw Error(`Boss 回廊交叉：${type} ${x},${y}`);
        put(x, y, BOSS_ARROW_BASE + heading);
        if (x === bx && y === by) break;
      }
    }
    const [sx, sy] = path[0], [nx, ny] = path[1];
    const entryHeading = nx > sx ? 1 : nx < sx ? 3 : ny > sy ? 2 : 0;
    if (at(sx, sy)) throw Error(`Boss 回廊入口交叉：${type} ${sx},${sy}`);
    put(sx, sy, BOSS_ARROW_BASE + entryHeading);
  }

  // 在主路的直段伸出许多互不相交的枝杈。它们有死端和危险端，
  // 但不会暗中切断预设路线；转错纸片后可能把纸片人带进这些路。
  for (const [lane, path] of paths.entries()) for (let segment = 1; segment < path.length; segment++) {
    const [ax, ay] = path[segment - 1], [bx, by] = path[segment];
    const length = Math.abs(bx - ax) + Math.abs(by - ay);
    if (length < 28) continue;
    const alongX = ay === by;
    for (const fraction of [0.27, 0.63]) {
      const rootX = Math.round(ax + (bx - ax) * fraction);
      const rootY = Math.round(ay + (by - ay) * fraction);
      const seed = hash((variant + 19) * 1009 + lane * 541 + segment * 97 + Math.round(fraction * 100));
      const sign = seed & 1 ? 1 : -1;
      const dx = alongX ? 0 : sign;
      const dy = alongX ? sign : 0;
      let endX = rootX, endY = rootY, carved = 0;
      for (let distance = 1; distance <= 5 + seed % 9; distance++) {
        const x = rootX + dx * distance, y = rootY + dy * distance;
        if (x < 2 || y < 2 || x > 97 || y > 97 || at(x, y)) break;
        const touching = [[1, 0], [-1, 0], [0, 1], [0, -1]].reduce((sum, [ox, oy]) => sum + (at(x + ox, y + oy) ? 1 : 0), 0);
        if (touching !== 1) break;
        put(x, y, BOSS_ROAD);
        endX = x; endY = y; carved++;
      }
      if (carved >= 4 && (seed & 4)) put(endX, endY, BOSS_DANGER);
    }
  }
  cache.set(cacheKey, data);
  return data;
}

export function bossCell(index, x, y, rotation = 0) {
  if (index < 0 || index >= BOSS_COUNT || x < 0 || x >= BOSS_CELLS || y < 0 || y >= BOSS_CELLS) return BOSS_WALL;
  for (let turn = 0; turn < rotation; turn++) [x, y] = [y, BOSS_CELLS - 1 - x];
  if (index === BOSS_START.index && x === BOSS_START.x && y === BOSS_START.y) return BOSS_START_CELL;
  if (index === BOSS_END && x === 1 && y === 70) return BOSS_EXIT;
  if (index === 50 && x === 5 && y === 29) return BOSS_KEY;
  if (index === 99 && x === 5 && y === 29) return BOSS_LOCK;
  const cell = pattern(bossType(index), index === BOSS_TURN ? -1 : hash(index + 817) % 16)[y * BOSS_CELLS + x];
  return cell >= BOSS_ARROW_BASE && cell < BOSS_ARROW_BASE + 4 ? BOSS_ARROW_BASE + (cell - BOSS_ARROW_BASE + rotation) % 4 : cell;
}

export function createBossRotations() {
  return Uint8Array.from({ length: BOSS_COUNT }, (_, index) => initialBossRotation(index));
}
