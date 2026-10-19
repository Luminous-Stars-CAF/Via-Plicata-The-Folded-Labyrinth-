// 无外部音频文件：Web Audio 即时合成纸张感背景旋律和短促交互音。
const PREF_KEY = "folded-path-audio-v1";
const melody = [0, 4, 7, 9, 7, 4, 2, null, 0, 4, 7, 12, 11, 7, 4, null];
const bossMelody = [0, 3, 7, 8, 7, 3, 1, null, 0, 3, 7, 12, 11, 7, 3, null];
const hz = (root, semitones) => root * 2 ** (semitones / 12);

export function createSoundtrack() {
  let context, master, normalBus, bossBus, fxBus, scheduler;
  let mode = "normal";
  let enabled = true;
  let beat = 0;
  let nextAt = 0;
  try { enabled = localStorage.getItem(PREF_KEY) !== "off"; } catch { /* 无存储时使用默认值 */ }

  function voice(frequency, at, length, volume, output, type = "sine") {
    if (!context || !Number.isFinite(frequency)) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), at + .028);
    gain.gain.exponentialRampToValueAtTime(.0001, at + length);
    oscillator.connect(gain).connect(output);
    oscillator.start(at);
    oscillator.stop(at + length + .03);
  }

  function scheduleBeat(index, at) {
    const slot = index % melody.length;
    const note = melody[slot];
    const darkNote = bossMelody[slot];
    if (note !== null) {
      voice(hz(293.66, note), at, .42, .034, normalBus, "sine");
      voice(hz(293.66, note + 12), at + .018, .27, .008, normalBus, "triangle");
      voice(hz(293.66, darkNote), at, .5, .026, bossBus, "triangle");
      voice(hz(293.66, darkNote + 12), at + .025, .2, .004, bossBus, "sine");
    }
    if (index % 4 === 0) {
      [0, 4, 7].forEach((offset) => voice(hz(146.83, offset), at, 2.45, .012, normalBus, "sine"));
      [0, 3, 7].forEach((offset) => voice(hz(146.83, offset), at, 2.48, .010, bossBus, "sine"));
    }
    if (index % 2 === 0) {
      voice(73.42, at, .23, .022, bossBus, "triangle");
      voice(110, at + .08, .18, .004, bossBus, "sine");
    }
  }

  function queue() {
    if (!context || context.state !== "running") return;
    if (nextAt < context.currentTime) nextAt = context.currentTime + .06;
    while (nextAt < context.currentTime + .6) {
      scheduleBeat(beat++, nextAt);
      nextAt += 60 / 84;
    }
  }

  async function unlock() {
    if (!enabled) return false;
    try {
      if (!context) {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioClass) return false;
        context = new AudioClass();
        master = context.createGain(); normalBus = context.createGain(); bossBus = context.createGain(); fxBus = context.createGain();
        master.gain.value = .75;
        normalBus.gain.value = mode === "normal" ? 1 : .0001;
        bossBus.gain.value = mode === "boss" ? 1 : .0001;
        fxBus.gain.value = 1;
        normalBus.connect(master); bossBus.connect(master); fxBus.connect(master); master.connect(context.destination);
        nextAt = context.currentTime + .06;
        scheduler = setInterval(queue, 130);
      }
      if (context.state === "suspended") await context.resume();
      queue();
      return true;
    } catch { return false; }
  }

  function fade(gain, value, duration = .5) {
    if (!context || !gain) return;
    const at = context.currentTime;
    gain.gain.cancelScheduledValues(at);
    gain.gain.setValueAtTime(Math.max(.0001, gain.gain.value), at);
    gain.gain.linearRampToValueAtTime(value, at + duration);
  }

  function setMode(next) {
    mode = next === "boss" ? "boss" : "normal";
    fade(normalBus, mode === "normal" ? 1 : .0001, 1.6);
    fade(bossBus, mode === "boss" ? 1 : .0001, 1.6);
  }

  function setEnabled(value) {
    enabled = !!value;
    try { localStorage.setItem(PREF_KEY, enabled ? "on" : "off"); } catch { /* 忽略 */ }
    if (enabled) {
      void unlock().then(() => fade(master, .75, .5));
    } else fade(master, .0001, .35);
    return enabled;
  }

  function tone(frequency, duration = .08) {
    if (!enabled || !context || context.state !== "running") return;
    voice(frequency, context.currentTime + .005, Math.max(.06, duration), .045, fxBus, "sine");
  }

  function cue(name) {
    if (!enabled || !context || context.state !== "running") return;
    const now = context.currentTime + .005;
    const tap = (f, delay, length, volume = .037) => voice(f, now + delay, length, volume, fxBus, "triangle");
    if (name === "click") tap(520, 0, .045, .025);
    if (name === "rotate") { tap(390, 0, .09); tap(520, .075, .1); }
    if (name === "level") { tap(392, 0, .11); tap(523, .12, .15); }
    if (name === "award") { [523, 659, 784, 1047].forEach((f, i) => tap(f, i * .11, .25, .036)); }
    if (name === "merge") { [392, 349, 293, 220].forEach((f, i) => tap(f, i * .15, .32, .045)); }
    if (name === "fail") { tap(235, 0, .23); tap(175, .16, .32, .025); }
  }

  document.addEventListener("pointerdown", () => { if (enabled) void unlock(); }, { capture: true });
  document.addEventListener("keydown", () => { if (enabled) void unlock(); }, { capture: true });
  document.addEventListener("visibilitychange", () => {
    if (!context) return;
    if (document.hidden) void context.suspend();
    else if (enabled) void context.resume().then(queue);
  });

  return { unlock, setMode, setEnabled, tone, cue, isEnabled: () => enabled, mode: () => mode, status: () => ({ enabled, mode, contextState: context?.state || "not-started", scheduledBeats: beat }) };
}
