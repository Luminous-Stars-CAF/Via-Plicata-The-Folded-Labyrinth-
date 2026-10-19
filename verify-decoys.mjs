// 故意把第 9–12 关第一张双路纸片转 180°：纸片人仍能穿过数张纸片，
// 却错过钥匙，直到回廊尽头的锁门才发现这条路线无法完成。
import { LEVELS } from "./levels.js";

const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const arrows = ["^", ">", "v", "<"];

function test(level) {
  const tiles = level.tiles.map((tile) => ({ ...tile, rotation: tile.solutionRotation }));
  tiles.find((tile) => tile.id === "b").rotation = (tiles.find((tile) => tile.id === "b").rotation + 2) % 4;
  const byId = new Map(tiles.map((tile) => [tile.id, tile]));
  const byPlace = new Map(tiles.map((tile) => [`${tile.col}:${tile.row}`, tile]));
  const player = { ...level.start };
  const reached = new Set([player.tile]);
  const crumbled = new Set();
  let hasKey = false, bridgeOn = false;
  const seen = new Set();
  function cellAt(tile, x, y) {
    for (let i = 0; i < tile.rotation; i++) [x, y] = [y, 4 - x];
    const key = `${tile.id}:${x}:${y}`;
    const raw = crumbled.has(key) ? " " : tile.cells[y][x];
    return { key, type: arrows.includes(raw) ? arrows[(arrows.indexOf(raw) + tile.rotation) % 4] : raw };
  }
  for (let step = 0; step < 2000; step++) {
    const fingerprint = `${player.tile}:${player.x}:${player.y}:${player.direction}:${hasKey}:${bridgeOn}:${crumbled.size}`;
    if (seen.has(fingerprint)) return { level: level.id, result: "blocked", steps: step, reached: reached.size, hasKey };
    seen.add(fingerprint);
    const from = byId.get(player.tile);
    const origin = cellAt(from, player.x, player.y);
    let x = player.x + directions[player.direction][0];
    let y = player.y + directions[player.direction][1];
    let col = from.col, row = from.row;
    if (x < 0) { col--; x = 4; } else if (x > 4) { col++; x = 0; }
    if (y < 0) { row--; y = 4; } else if (y > 4) { row++; y = 0; }
    const tile = byPlace.get(`${col}:${row}`);
    if (!tile) return { level: level.id, result: "boundary", steps: step, reached: reached.size, hasKey };
    const target = cellAt(tile, x, y);
    if (target.type === "#" || (target.type === "D" && !hasKey) || (arrows.includes(target.type) && arrows.indexOf(target.type) !== player.direction)) {
      player.direction = (player.direction + 1) % 4;
      continue;
    }
    if (target.type === " " || target.type === "!" || (target.type === "B" && !bridgeOn)) return { level: level.id, result: "hazard", steps: step, reached: reached.size, hasKey };
    if (origin.type === "C") crumbled.add(origin.key);
    player.tile = tile.id; player.x = x; player.y = y;
    reached.add(tile.id);
    if (target.type === "K") hasKey = true;
    if (target.type === "T") bridgeOn = true;
    if (/^[0-9]$/.test(target.type)) {
      for (const candidate of tiles) for (let py = 0; py < 5; py++) for (let px = 0; px < 5; px++) {
        const cell = cellAt(candidate, px, py);
        if (cell.type === target.type && cell.key !== target.key) {
          player.tile = candidate.id; player.x = px; player.y = py;
          reached.add(candidate.id);
        }
      }
    }
    if (target.type === "X") return { level: level.id, result: "won", steps: step, reached: reached.size, hasKey };
  }
  return { level: level.id, result: "timeout", steps: 2000, reached: reached.size, hasKey };
}

for (const level of LEVELS.filter((item) => item.id >= 9)) {
  const result = test(level);
  if (result.result === "won" || result.result === "timeout" || result.reached < 5 || result.hasKey) throw Error(`第 ${level.id} 关假路无效：${JSON.stringify(result)}`);
  console.log(result);
}
