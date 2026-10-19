// SVG 小名牌与关卡数据分离：纯本地矢量图，可随游戏继续扩展。
const BADGES = [
  { name: "第一道折痕", hue: "#a7cbb8", ink: "#4e826c", art: '<path d="M27 66h25V41h27"/><path d="M69 22h21v21" class="fold"/><path d="M69 22v21h21"/><circle cx="27" cy="66" r="5"/><circle cx="79" cy="41" r="5"/>' },
  { name: "拐角的约定", hue: "#eec3a9", ink: "#a96f5f", art: '<path d="M22 66h28V38q0-12 13-12h31"/><path d="M73 26l-9-8m9 8-9 8"/><circle cx="22" cy="66" r="5"/><circle cx="50" cy="66" r="4"/>' },
  { name: "只许向前", hue: "#c6d6bc", ink: "#628467", art: '<path d="M24 51h64"/><path d="m76 39 13 12-13 12"/><path d="M40 30v-8m0 56v-8M60 30v-8m0 56v-8"/><circle cx="29" cy="51" r="5"/>' },
  { name: "借来的钥匙", hue: "#f1d49b", ink: "#9a7945", art: '<circle cx="43" cy="38" r="12"/><circle cx="43" cy="38" r="4"/><path d="M52 47 77 72h10v-10H77v-9H67"/><path d="M28 68h18" class="fine"/>' },
  { name: "纸桥升起", hue: "#bad7cf", ink: "#578d83", art: '<path d="M18 66h20m40 0h20"/><path d="M37 66q19-36 42 0"/><path d="M37 66q20 12 42 0" class="fine"/><circle cx="57" cy="29" r="6"/><path d="M57 35v7"/>' },
  { name: "回声折页", hue: "#d9c7e2", ink: "#8d719e", art: '<circle cx="39" cy="51" r="15"/><circle cx="39" cy="51" r="7"/><circle cx="79" cy="51" r="15"/><circle cx="79" cy="51" r="7"/><path d="M54 40q10-10 21-4m-21 25q11 9 21 4" class="fine"/>' },
  { name: "双层回廊", hue: "#b6cedd", ink: "#617f9a", art: '<path d="M22 75V30h30v30h43"/><path d="M32 75V40h10v30h53" class="fine"/><path d="M83 54 95 60 83 66"/><circle cx="25" cy="74" r="4"/>' },
  { name: "岔路回声", hue: "#e7c4c6", ink: "#a46f77", art: '<path d="M22 68h35V35h38M57 52l24 24h16"/><circle cx="22" cy="68" r="5"/><circle cx="95" cy="35" r="5"/><path d="M89 70v12m-6-6h12" class="fine"/>' },
  { name: "三层错页", hue: "#c3d5a7", ink: "#748e58", art: '<path d="M26 26h52v40H26z"/><path d="M34 19h52v40" class="fine"/><path d="M42 12h52v40" class="fine"/><path d="M36 44h32m-17-9 10 9-10 9"/>' },
  { name: "暗线绕行", hue: "#c8c2dc", ink: "#756e9c", art: '<path d="M20 65h25V30h49"/><path d="M20 75h56V50h18" class="fine dashed"/><circle cx="20" cy="65" r="5"/><path d="m84 42 10 8-10 8"/>' },
  { name: "五岔纸林", hue: "#b8d6c1", ink: "#56806a", art: '<path d="M58 78V42M58 57 30 30m28 19 25-28m-25 38 34-7m-34 10-28 12m28-29-4-29"/><path d="M25 31h11m45-9 8 6m-1 18 10 10M27 72l8 8m17-64 7 2" class="fine"/>' },
  { name: "终稿迷途", hue: "#f0d3a6", ink: "#a57e4e", art: '<path d="M23 22h70v54H23z"/><path d="M32 32h51v34H32z" class="fine"/><path d="M34 55h18V41h21v15h11"/><path d="m74 49 10 7-10 7"/><circle cx="35" cy="55" r="4"/>' },
  { name: "万页迷宫", hue: "#c5b9a7", ink: "#655b68", art: '<path d="M18 17h80v64H18zM28 26h58v46H28zM36 35h42v27H36zM44 43h26v11H44z"/><path d="M58 54v22" class="fine"/><path d="m52 68 6 8 6-8"/>' }
];

export function badgeMarkup(id, unlocked = false, extraClass = "") {
  const badge = BADGES[id - 1];
  if (!badge) return "";
  return `<div class="achievement-badge ${unlocked ? "earned" : "locked"} ${extraClass}" data-badge="${id}" title="第 ${id} 关 · ${badge.name}${unlocked ? " · 已获得" : " · 三星解锁"}">
    <svg viewBox="0 0 116 94" role="img" aria-label="${badge.name}卡通名牌" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="110" height="88" rx="16" fill="${badge.hue}"/>
      <rect x="9" y="9" width="98" height="76" rx="12" fill="#fffaf0" stroke="${badge.ink}" stroke-opacity=".32" stroke-dasharray="3 5"/>
      <g fill="none" stroke="${badge.ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${badge.art}</g>
      <path d="M91 3h6c8 0 16 8 16 16v6L91 3Z" fill="#fff4d9" opacity=".8"/>
      <circle cx="98" cy="75" r="9" fill="#fff6e5"/><path d="m98 69 1.7 4.5 4.8 1.5-4.8 1.4-1.7 4.6-1.6-4.6-4.9-1.4 4.9-1.5Z" fill="${badge.ink}" stroke="none"/>
    </svg>
    <span class="badge-title">${badge.name}</span><span class="badge-stars" aria-hidden="true">${unlocked ? "✦ ✦ ✦" : "○ ○ ○"}</span>
  </div>`;
}

export function renderBadges(records) {
  const earned = (id) => records[id]?.stars === 3;
  const count = Array.from({ length: 12 }, (_, i) => earned(i + 1)).filter(Boolean).length;
  document.querySelector("#badge-shelf").innerHTML = Array.from({ length: 12 }, (_, i) => badgeMarkup(i + 1, earned(i + 1))).join("");
  document.querySelector("#badge-count").textContent = `${count} / 12`;
  const bossSlot = document.querySelector("#boss-badge-slot");
  bossSlot.hidden = count !== 12;
  bossSlot.innerHTML = count === 12 ? `<span>隐藏勋章</span>${badgeMarkup(13, earned(13), "boss-badge")}` : "";
  document.querySelector("#finale-replay").hidden = count !== 12;
  return count;
}
