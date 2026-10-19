import { ADVANCED_LEVELS } from "./advanced-levels.js";

// 每张纸片固定为 5×5。空格是悬崖，# 是墙，. 是道路。
// S 起点 / X 出口 / K 钥匙 / D 锁门 / T 开关 / B 桥 / C 一次性道路 / 0 传送门。
// ^ > v < 为单向道路；rotation 是开局相对设计路线的顺时针四分之一圈数。
const H = (middle) => ["#####", "#####", middle, "#####", "#####"];
const WEST_SOUTH = ["#####", "#####", "...##", "##.##", "##.##"];
const NORTH_WEST = ["##.##", "##.##", "...##", "#####", "#####"];

export const LEVELS = [
  {
    id: 1, name: "第一道折痕", goal: "让两张纸上的道路接在一起。", tag: "道路连接", cols: 2, rows: 1,
    limit: 2, par: 1, start: { tile: "a", x: 1, y: 2, direction: 1 },
    tiles: [
      { id: "a", col: 0, row: 0, color: "mint", rotation: 0, cells: H(".S...") },
      { id: "b", col: 1, row: 0, color: "peach", rotation: 1, cells: H(".X...") }
    ]
  },
  {
    id: 2, name: "拐角的约定", goal: "转好两处拐角，让道路绕回左侧。", tag: "旋转地图块", cols: 2, rows: 2,
    limit: 3, par: 2, start: { tile: "a", x: 1, y: 2, direction: 1 },
    tiles: [
      { id: "a", col: 0, row: 0, color: "mint", rotation: 0, cells: H(".S...") },
      { id: "b", col: 1, row: 0, color: "peach", rotation: 1, cells: WEST_SOUTH },
      { id: "c", col: 1, row: 1, color: "lavender", rotation: 3, cells: NORTH_WEST },
      { id: "d", col: 0, row: 1, color: "blue", rotation: 0, cells: H(".X...") }
    ]
  },
  {
    id: 3, name: "只许向前", goal: "接通绕行路线，顺着单向箭头走。", tag: "单向道路", cols: 2, rows: 2,
    limit: 4, par: 3, start: { tile: "a", x: 1, y: 2, direction: 1 },
    tiles: [
      { id: "a", col: 0, row: 0, color: "mint", rotation: 0, cells: H(".S...") },
      { id: "b", col: 1, row: 0, color: "peach", rotation: 1, cells: WEST_SOUTH },
      { id: "c", col: 1, row: 1, color: "lavender", rotation: 3, cells: NORTH_WEST },
      { id: "d", col: 0, row: 1, color: "blue", rotation: 1, cells: H(".X.<.") }
    ]
  },
  {
    id: 4, name: "借来的钥匙", goal: "先取钥匙，再穿过锁门。", tag: "钥匙与锁门", cols: 2, rows: 2,
    limit: 3, par: 2, start: { tile: "a", x: 1, y: 2, direction: 1 },
    tiles: [
      { id: "a", col: 0, row: 0, color: "mint", rotation: 0, cells: H(".S.K.") },
      { id: "b", col: 1, row: 0, color: "peach", rotation: 3, cells: WEST_SOUTH },
      { id: "c", col: 1, row: 1, color: "lavender", rotation: 1, cells: NORTH_WEST },
      { id: "d", col: 0, row: 1, color: "blue", rotation: 0, cells: H(".X.D.") }
    ]
  },
  {
    id: 5, name: "纸桥升起", goal: "踩下开关，让虚线桥变成通路。", tag: "开关与桥", cols: 2, rows: 2,
    limit: 4, par: 3, start: { tile: "a", x: 1, y: 2, direction: 1 },
    tiles: [
      { id: "a", col: 0, row: 0, color: "mint", rotation: 0, cells: H(".S.T.") },
      { id: "b", col: 1, row: 0, color: "peach", rotation: 1, cells: WEST_SOUTH },
      { id: "c", col: 1, row: 1, color: "lavender", rotation: 1, cells: NORTH_WEST },
      { id: "d", col: 0, row: 1, color: "blue", rotation: 3, cells: H(".X.B.") }
    ]
  },
  {
    id: 6, name: "回声折页", goal: "踏过会消失的路，借传送门抵达出口。", tag: "一次性道路 · 传送门", cols: 2, rows: 3,
    limit: 5, par: 4, start: { tile: "a", x: 1, y: 2, direction: 1 },
    tiles: [
      { id: "a", col: 0, row: 0, color: "mint", rotation: 0, cells: H(".S...") },
      { id: "b", col: 1, row: 0, color: "peach", rotation: 3, cells: WEST_SOUTH },
      { id: "c", col: 1, row: 1, color: "lavender", rotation: 1, cells: ["##.##", "##.##", ".C.##", "#####", "#####"] },
      { id: "d", col: 0, row: 1, color: "yellow", rotation: 1, cells: H("...0.") },
      { id: "e", col: 0, row: 2, color: "blue", rotation: 0, cells: H(".X...") },
      { id: "f", col: 1, row: 2, color: "rose", rotation: 3, cells: H("...0.") }
    ]
  },
  ...ADVANCED_LEVELS
];

export const CELL_SIZE = 5;
