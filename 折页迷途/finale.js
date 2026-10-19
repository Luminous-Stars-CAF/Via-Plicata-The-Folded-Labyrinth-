import { badgeMarkup } from "./badges.js";

const SEEN_KEY = "folded-path-finale-seen-v1";

export function createFinale({ onEnterBoss, onCredits, onMerge }) {
  const screen = document.querySelector("#finale-screen");
  const credits = document.querySelector("#finale-credits");
  const merge = document.querySelector("#finale-merge");
  const grid = document.querySelector("#merge-grid");
  let running = false;
  let timers = [];
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); };

  function positionBadges() {
    const center = { x: innerWidth / 2, y: innerHeight / 2 };
    grid.querySelectorAll(".achievement-badge").forEach((badge, index) => {
      const rect = badge.getBoundingClientRect();
      badge.style.setProperty("--tx", `${center.x - rect.left - rect.width / 2}px`);
      badge.style.setProperty("--ty", `${center.y - rect.top - rect.height / 2}px`);
      badge.style.setProperty("--spin", `${(index % 2 ? -1 : 1) * (90 + index * 23)}deg`);
      badge.style.setProperty("--delay", `${(index % 4) * 0.08}s`);
    });
  }

  function showMerge() {
    if (!running) return;
    credits.hidden = true;
    merge.hidden = false;
    onMerge?.();
    requestAnimationFrame(() => {
      if (!running) return;
      positionBadges();
      grid.classList.add("merging");
    });
    later(() => merge.classList.add("sigil-visible"), reduced() ? 180 : 2900);
    later(finish, reduced() ? 650 : 4450);
  }

  function finish() {
    if (!running) return;
    running = false;
    timers.forEach(clearTimeout);
    timers = [];
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* 私密窗口可能禁用存储 */ }
    screen.classList.add("exiting");
    later(() => {
      screen.hidden = true;
      screen.classList.remove("exiting");
      onEnterBoss();
    }, reduced() ? 30 : 600);
  }

  function start() {
    if (running) return;
    running = true;
    timers.forEach(clearTimeout);
    timers = [];
    screen.hidden = false;
    screen.classList.remove("exiting");
    credits.hidden = false;
    credits.classList.remove("leaving");
    merge.hidden = true;
    merge.classList.remove("sigil-visible");
    grid.classList.remove("merging");
    grid.innerHTML = Array.from({ length: 12 }, (_, i) => badgeMarkup(i + 1, true)).join("");
    onCredits?.();
    later(() => credits.classList.add("leaving"), reduced() ? 250 : 6650);
    later(showMerge, reduced() ? 350 : 7220);
  }

  document.querySelector("#finale-skip").addEventListener("click", finish);
  return { start, finish, isRunning: () => running, wasSeen: () => { try { return localStorage.getItem(SEEN_KEY) === "1"; } catch { return false; } } };
}
