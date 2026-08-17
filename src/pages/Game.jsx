import React, { useEffect, useRef, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import sfx, { unlockAudio } from "@/lib/sfx";
import TouchControls from "@/components/game/TouchControls";

// ---------------------------------------------------------------------------
// Sonic-style platformer — three levels
// Pure canvas + requestAnimationFrame, no external assets.
// ---------------------------------------------------------------------------

const VIEW_W = 960;
const VIEW_H = 540;
const GRAVITY = 0.66;
const MAX_FALL = 14;

function makeRings(arcs) {
  const r = [];
  for (const [cx, cy, n, spread = 28] of arcs) {
    for (let i = 0; i < n; i++) r.push({ x: cx + i * spread, y: cy });
  }
  return r;
}

const LEVELS = [
  {
    name: "Green Hill",
    worldW: 5200,
    theme: {
      sky: ["#1e3a8a", "#3b82f6", "#93c5fd"],
      cloud: "rgba(255,255,255,0.6)",
      hill: "rgba(30,64,175,0.45)",
      ground: "#15803d",
      grass: "#22c55e",
      dirt: "#166534",
      platform: "#a16207",
      platformTop: "#facc15",
      platformStyle: "dirt",
    },
    eggman: {
      startX: 520,
      baseY: 320,
      amp: 60,
      speed: 0.0022,
      bombCooldown: 1700,
      hp: 3,
      patrolLeft: 400,
      patrolOmega: 0.00007,
      weave: 180,
    },
    platforms: [
      { x: 0, y: 480, w: 940, h: 60, type: "ground" },
      { x: 1010, y: 480, w: 740, h: 60, type: "ground" },
      { x: 1790, y: 480, w: 640, h: 60, type: "ground" },
      { x: 2470, y: 480, w: 720, h: 60, type: "ground" },
      { x: 3240, y: 480, w: 600, h: 60, type: "ground" },
      { x: 3870, y: 480, w: 1330, h: 60, type: "ground" },
      { x: 320, y: 380, w: 120, h: 18, type: "platform" },
      { x: 520, y: 300, w: 120, h: 18, type: "platform" },
      { x: 760, y: 360, w: 120, h: 18, type: "platform" },
      { x: 1100, y: 360, w: 170, h: 18, type: "platform" },
      { x: 1320, y: 280, w: 140, h: 18, type: "platform" },
      { x: 1560, y: 360, w: 120, h: 18, type: "platform" },
      { x: 1980, y: 360, w: 160, h: 18, type: "platform" },
      { x: 2200, y: 280, w: 120, h: 18, type: "platform" },
      { x: 2680, y: 360, w: 170, h: 18, type: "platform" },
      { x: 2900, y: 280, w: 140, h: 18, type: "platform" },
      { x: 3420, y: 370, w: 170, h: 18, type: "platform" },
      { x: 3640, y: 290, w: 140, h: 18, type: "platform" },
      { x: 4080, y: 370, w: 170, h: 18, type: "platform" },
      { x: 4300, y: 290, w: 140, h: 18, type: "platform" },
      { x: 4540, y: 370, w: 140, h: 18, type: "platform" },
      { x: 880, y: 460, w: 40, h: 20, type: "spike" },
      { x: 1680, y: 460, w: 40, h: 20, type: "spike" },
      { x: 2360, y: 460, w: 50, h: 20, type: "spike" },
      { x: 3760, y: 460, w: 60, h: 20, type: "spike" },
      { x: 660, y: 462, w: 60, h: 18, type: "spring" },
      { x: 2480, y: 462, w: 60, h: 18, type: "spring" },
      { x: 3880, y: 462, w: 60, h: 18, type: "spring" },
      { x: 5050, y: 360, w: 30, h: 120, type: "goal" },
    ],
    rings: makeRings([
      [360, 340, 5],
      [560, 260, 5],
      [950, 360, 6, 30],
      [1140, 320, 4],
      [1340, 240, 4],
      [1740, 340, 6, 30],
      [2000, 320, 4],
      [2220, 240, 4],
      [2420, 340, 6, 30],
      [2720, 320, 4],
      [2920, 240, 4],
      [3440, 330, 4],
      [3660, 250, 4],
      [3820, 340, 5, 30],
      [4100, 330, 4],
      [4320, 250, 4],
      [4560, 330, 4],
      [4800, 440, 8, 26],
    ]),
    stars: [
      { x: 580, y: 260 },
      { x: 1360, y: 240 },
      { x: 2240, y: 240 },
      { x: 2940, y: 240 },
      { x: 3680, y: 250 },
      { x: 4340, y: 250 },
      { x: 4900, y: 420 },
    ],
  },
  {
    name: "Sunset Hill",
    worldW: 5600,
    theme: {
      sky: ["#2e1065", "#7c3aed", "#fb923c"],
      cloud: "rgba(254,215,170,0.5)",
      hill: "rgba(88,28,135,0.5)",
      ground: "#0f766e",
      grass: "#2dd4bf",
      dirt: "#115e59",
      platform: "#3f6212",
      platformTop: "#a3e635",
      platformStyle: "flat",
    },
    eggman: {
      startX: 500,
      baseY: 300,
      amp: 70,
      speed: 0.0026,
      bombCooldown: 1300,
      hp: 3,
      patrolLeft: 380,
      patrolOmega: 0.000075,
      weave: 160,
    },
    platforms: [
      { x: 0, y: 480, w: 720, h: 60, type: "ground" },
      { x: 820, y: 480, w: 580, h: 60, type: "ground" },
      { x: 1540, y: 480, w: 560, h: 60, type: "ground" },
      { x: 2220, y: 480, w: 580, h: 60, type: "ground" },
      { x: 2960, y: 480, w: 640, h: 60, type: "ground" },
      { x: 3720, y: 480, w: 580, h: 60, type: "ground" },
      { x: 4420, y: 480, w: 1180, h: 60, type: "ground" },
      { x: 280, y: 380, w: 120, h: 18, type: "platform" },
      { x: 500, y: 300, w: 120, h: 18, type: "platform" },
      { x: 640, y: 220, w: 110, h: 18, type: "platform" },
      { x: 900, y: 340, w: 140, h: 18, type: "platform" },
      { x: 1180, y: 260, w: 130, h: 18, type: "platform" },
      { x: 1480, y: 300, w: 140, h: 18, type: "platform" },
      { x: 1760, y: 220, w: 120, h: 18, type: "platform" },
      { x: 2040, y: 360, w: 130, h: 18, type: "platform" },
      { x: 2180, y: 260, w: 130, h: 18, type: "platform" },
      { x: 2480, y: 200, w: 120, h: 18, type: "platform" },
      { x: 2760, y: 340, w: 140, h: 18, type: "platform" },
      { x: 2900, y: 240, w: 130, h: 18, type: "platform" },
      { x: 3180, y: 180, w: 120, h: 18, type: "platform" },
      { x: 3460, y: 300, w: 140, h: 18, type: "platform" },
      { x: 3660, y: 220, w: 130, h: 18, type: "platform" },
      { x: 3980, y: 360, w: 140, h: 18, type: "platform" },
      { x: 4180, y: 260, w: 130, h: 18, type: "platform" },
      { x: 4360, y: 320, w: 140, h: 18, type: "platform" },
      { x: 4680, y: 280, w: 130, h: 18, type: "platform" },
      { x: 4980, y: 360, w: 140, h: 18, type: "platform" },
      { x: 660, y: 460, w: 40, h: 20, type: "spike" },
      { x: 1320, y: 460, w: 50, h: 20, type: "spike" },
      { x: 2020, y: 460, w: 50, h: 20, type: "spike" },
      { x: 2720, y: 460, w: 50, h: 20, type: "spike" },
      { x: 3520, y: 460, w: 50, h: 20, type: "spike" },
      { x: 4220, y: 460, w: 50, h: 20, type: "spike" },
      { x: 5080, y: 460, w: 60, h: 20, type: "spike" },
      { x: 420, y: 462, w: 60, h: 18, type: "spring" },
      { x: 1680, y: 462, w: 60, h: 18, type: "spring" },
      { x: 2380, y: 462, w: 60, h: 18, type: "spring" },
      { x: 3110, y: 462, w: 60, h: 18, type: "spring" },
      { x: 4580, y: 462, w: 60, h: 18, type: "spring" },
      { x: 5480, y: 360, w: 30, h: 120, type: "goal" },
    ],
    rings: makeRings([
      [300, 340, 5],
      [520, 260, 5],
      [740, 340, 5, 30],
      [1000, 300, 4],
      [1200, 220, 4],
      [1460, 300, 5, 30],
      [1780, 180, 4],
      [2140, 300, 5, 30],
      [2500, 160, 4],
      [2840, 280, 5, 30],
      [3200, 140, 4],
      [3640, 260, 5, 30],
      [4000, 320, 4],
      [4340, 280, 5, 30],
      [4700, 240, 4],
      [5200, 430, 8, 26],
    ]),
    stars: [
      { x: 660, y: 180 },
      { x: 1220, y: 220 },
      { x: 1780, y: 180 },
      { x: 2520, y: 160 },
      { x: 3220, y: 140 },
      { x: 3680, y: 180 },
      { x: 5400, y: 400 },
    ],
  },
  {
    name: "Ice Cap",
    worldW: 6000,
    theme: {
      sky: ["#0c4a6e", "#38bdf8", "#e0f2fe"],
      cloud: "rgba(255,255,255,0.85)",
      hill: "rgba(186,230,253,0.5)",
      ground: "#64748b",
      grass: "#f8fafc",
      dirt: "#475569",
      platform: "#7dd3fc",
      platformTop: "#f8fafc",
      ice: "#bae6fd",
      platformStyle: "snow",
      weather: "snow",
    },
    eggman: {
      startX: 480,
      baseY: 290,
      amp: 80,
      speed: 0.0028,
      bombCooldown: 1100,
      hp: 3,
      patrolLeft: 360,
      patrolOmega: 0.00008,
      weave: 150,
      hat: "winter",
    },
    platforms: [
      { x: 0, y: 480, w: 640, h: 60, type: "ground" },
      { x: 780, y: 480, w: 500, h: 60, type: "ground" },
      { x: 1460, y: 480, w: 520, h: 60, type: "ground" },
      { x: 2140, y: 480, w: 540, h: 60, type: "ground" },
      { x: 2880, y: 480, w: 600, h: 60, type: "ground" },
      { x: 3660, y: 480, w: 580, h: 60, type: "ground" },
      { x: 4420, y: 480, w: 1580, h: 60, type: "ground" },
      { x: 220, y: 380, w: 110, h: 18, type: "platform" },
      { x: 420, y: 290, w: 110, h: 18, type: "platform" },
      { x: 580, y: 200, w: 100, h: 18, type: "platform" },
      { x: 700, y: 330, w: 130, h: 18, type: "platform" },
      { x: 980, y: 250, w: 120, h: 18, type: "platform" },
      { x: 1220, y: 200, w: 110, h: 18, type: "platform" },
      { x: 1360, y: 310, w: 130, h: 18, type: "platform" },
      { x: 1680, y: 230, w: 120, h: 18, type: "platform" },
      { x: 1920, y: 350, w: 120, h: 18, type: "platform" },
      { x: 2060, y: 250, w: 120, h: 18, type: "platform" },
      { x: 2360, y: 180, w: 110, h: 18, type: "platform" },
      { x: 2600, y: 320, w: 130, h: 18, type: "platform" },
      { x: 2760, y: 220, w: 120, h: 18, type: "platform" },
      { x: 3040, y: 160, w: 110, h: 18, type: "platform" },
      { x: 3320, y: 280, w: 130, h: 18, type: "platform" },
      { x: 3540, y: 200, w: 120, h: 18, type: "platform" },
      { x: 3880, y: 340, w: 130, h: 18, type: "platform" },
      { x: 4100, y: 240, w: 120, h: 18, type: "platform" },
      { x: 4300, y: 300, w: 130, h: 18, type: "platform" },
      { x: 4600, y: 260, w: 120, h: 18, type: "platform" },
      { x: 4900, y: 340, w: 130, h: 18, type: "platform" },
      { x: 5200, y: 280, w: 120, h: 18, type: "platform" },
      { x: 5500, y: 360, w: 130, h: 18, type: "platform" },
      { x: 580, y: 460, w: 40, h: 20, type: "spike" },
      { x: 1210, y: 460, w: 50, h: 20, type: "spike" },
      { x: 1910, y: 460, w: 50, h: 20, type: "spike" },
      { x: 2610, y: 460, w: 50, h: 20, type: "spike" },
      { x: 3410, y: 460, w: 50, h: 20, type: "spike" },
      { x: 4170, y: 460, w: 50, h: 20, type: "spike" },
      { x: 5300, y: 460, w: 60, h: 20, type: "spike" },
      { x: 350, y: 462, w: 60, h: 18, type: "spring" },
      { x: 1580, y: 462, w: 60, h: 18, type: "spring" },
      { x: 2280, y: 462, w: 60, h: 18, type: "spring" },
      { x: 2970, y: 462, w: 60, h: 18, type: "spring" },
      { x: 3780, y: 462, w: 60, h: 18, type: "spring" },
      { x: 4520, y: 462, w: 60, h: 18, type: "spring" },
      { x: 5880, y: 360, w: 30, h: 120, type: "goal" },
    ],
    rings: makeRings([
      [240, 340, 5],
      [440, 250, 5],
      [680, 300, 5, 30],
      [1000, 210, 4],
      [1340, 270, 5, 30],
      [1700, 190, 4],
      [2040, 220, 5, 30],
      [2380, 140, 4],
      [2740, 190, 5, 30],
      [3060, 120, 4],
      [3520, 170, 5, 30],
      [3900, 300, 4],
      [4280, 260, 5, 30],
      [4620, 220, 4],
      [5520, 430, 8, 26],
    ]),
    stars: [
      { x: 600, y: 160 },
      { x: 1240, y: 160 },
      { x: 2380, y: 140 },
      { x: 3060, y: 120 },
      { x: 3560, y: 160 },
      { x: 5220, y: 240 },
      { x: 5750, y: 400 },
    ],
  },
];

function makeLevelState(levelIndex, extras = {}) {
  const L = LEVELS[levelIndex];
  return {
    player: {
      x: 80, y: 420, w: 34, h: 40,
      vx: 0, vy: 0, onGround: false, facing: 1,
      rolling: false, invuln: 0, spin: 0, springing: false,
    },
    rings: L.rings.map((r) => ({ ...r, taken: false })),
    stars: L.stars.map((st) => ({ ...st, taken: false })),
    eggman: {
      x: L.eggman.startX, y: L.eggman.baseY, w: 64, h: 56,
      hp: L.eggman.hp, alive: true, t: 0, lastBomb: 0, bombs: [], hitFlash: 0,
    },
    cam: 0,
    particles: [],
    explosions: [],
    time: 0,
    lastFrame: 0,
    score: extras.score ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Game component
// ---------------------------------------------------------------------------
export default function Game() {
  const canvasRef = useRef(null);
  const keysRef = useRef({});
  const rafRef = useRef(0);
  const [hud, setHud] = useState({ rings: 0, stars: 0, lives: 3, score: 0, level: 1 });
  const [status, setStatus] = useState("menu"); // menu | playing | won | lost
  const statusRef = useRef("menu");
  const levelRef = useRef(0);
  const [bestScore, setBestScore] = useState(() => {
    try { return Number(localStorage.getItem("sonic_best") || 0); } catch { return 0; }
  });

  // game state in a ref (avoid re-renders each frame)
  const stateRef = useRef(makeLevelState(0));

  const startLevel = useCallback((levelIndex) => {
    const idx = Math.max(0, Math.min(LEVELS.length - 1, levelIndex));
    keysRef.current = {};
    levelRef.current = idx;
    stateRef.current = makeLevelState(idx);
    setHud({ rings: 0, stars: 0, lives: 3, score: 0, level: idx + 1 });
    statusRef.current = "playing";
    setStatus("playing");
  }, []);
  const startLevelRef = useRef(startLevel);
  startLevelRef.current = startLevel;

  // ---------------------------------------------------------------- input ---
  useEffect(() => {
    const down = (e) => {
      unlockAudio();
      const k = e.key.toLowerCase();
      if (statusRef.current === "menu") {
        if (k === "1" || k === "2" || k === "3") {
          startLevelRef.current(Number(k) - 1);
        }
        return;
      }
      keysRef.current[k] = true;
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    };
    const up = (e) => { keysRef.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const resetGame = useCallback(() => {
    startLevel(levelRef.current);
  }, [startLevel]);

  const goToMenu = useCallback(() => {
    keysRef.current = {};
    levelRef.current = 0;
    stateRef.current = makeLevelState(0);
    setHud({ rings: 0, stars: 0, lives: 3, score: 0, level: 1 });
    statusRef.current = "menu";
    setStatus("menu");
  }, []);

  const startNextLevel = useCallback(() => {
    const next = levelRef.current + 1;
    if (next >= LEVELS.length) return;
    const score = stateRef.current.score;
    levelRef.current = next;
    stateRef.current = makeLevelState(next, { score });
    setHud((h) => ({ ...h, level: next + 1, score }));
    statusRef.current = "playing";
    setStatus("playing");
  }, []);

  // ------------------------------------------------------------- game loop --
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const spawnParticles = (x, y, color, n = 8) => {
      const s = stateRef.current;
      for (let i = 0; i < n; i++) {
        s.particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6 - 2,
          life: 30, max: 30, color,
        });
      }
    };

    // big explosion: expanding shockwave + fireball debris + smoke, with a boom
    const spawnExplosion = (x, y) => {
      const s = stateRef.current;
      s.explosions.push({ x, y, r: 6, maxR: 84, life: 320, max: 320 });
      const colors = ["#f97316", "#fbbf24", "#ef4444", "#fde047", "#fb923c"];
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 2 + Math.random() * 7;
        s.particles.push({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 1,
          life: 42, max: 42,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
      for (let i = 0; i < 10; i++) {
        s.particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 2,
          vy: -1 - Math.random() * 2,
          life: 64, max: 64,
          color: "#6b7280",
        });
      }
      sfx.explosion();
    };

    const aabb = (a, b) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

    let prevRoll = false;

    const update = (dt) => {
      const s = stateRef.current;
      if (statusRef.current !== "playing") return;
      const L = LEVELS[levelRef.current];
      const platforms = L.platforms;
      const worldW = L.worldW;
      const eggCfg = L.eggman;
      s.time += dt;
      const p = s.player;
      const keys = keysRef.current;

      const ACC = 0.65, MAX_RUN = 8.5, FRICTION = 0.85, JUMP = 16.5;
      const SPRING = 26.3; // ~1.2x the old spring height (v 24 → height scales with v²)
      const SPRING_JUMP = 29.5;

      // horizontal
      if (keys["arrowleft"] || keys["a"]) { p.vx -= ACC; p.facing = -1; }
      if (keys["arrowright"] || keys["d"]) { p.vx += ACC; p.facing = 1; }
      if (!keys["arrowleft"] && !keys["arrowright"] && !keys["a"] && !keys["d"]) {
        p.vx *= FRICTION;
        if (Math.abs(p.vx) < 0.05) p.vx = 0;
      }
      p.vx = Math.max(-MAX_RUN, Math.min(MAX_RUN, p.vx));

      // rolling (down + moving) — like Sonic spin dash-ish
      p.rolling = (keys["arrowdown"] || keys["s"]) && p.onGround && Math.abs(p.vx) > 1;

      // jump
      if ((keys["arrowup"] || keys["w"] || keys[" "]) && p.onGround) {
        p.vy = -JUMP;
        p.onGround = false;
        sfx.jump();
        spawnParticles(p.x + p.w / 2, p.y + p.h, "#7dd3fc", 6);
      }

      // gravity
      p.vy += GRAVITY;
      if (p.vy > MAX_FALL) p.vy = MAX_FALL;
      // variable jump height — release early for a short hop (easier control)
      const jumpHeld = keys["arrowup"] || keys["w"] || keys[" "];
      if (p.vy < 0 && !jumpHeld && !p.springing) p.vy *= 0.86;
      if (p.vy >= 0) p.springing = false;

      // move + collide axis-separated
      p.x += p.vx;
      for (const pl of platforms) {
        if (pl.type === "goal") continue;
        if (aabb(p, pl)) {
          if (p.vx > 0) p.x = pl.x - p.w;
          else if (p.vx < 0) p.x = pl.x + pl.w;
          p.vx = 0;
        }
      }
      if (p.x < 0) p.x = 0;
      if (p.x + p.w > worldW) p.x = worldW - p.w;

      p.y += p.vy;
      p.onGround = false;
      for (const pl of platforms) {
        if (pl.type === "goal") continue;
        if (aabb(p, pl)) {
          if (p.vy > 0) {
            // landing
            p.y = pl.y - p.h;
            p.vy = 0;
            p.onGround = true;
            if (pl.type === "spike") { sfx.spike(); hurtPlayer(s, 1, pl); }
            if (pl.type === "spring") {
              p.vy = jumpHeld ? -SPRING_JUMP : -SPRING;
              p.onGround = false;
              p.springing = true;
              sfx.spring();
              spawnParticles(pl.x + pl.w / 2, pl.y, "#fde047", 10);
            }
          } else if (p.vy < 0) {
            p.y = pl.y + pl.h;
            p.vy = 0;
          }
        }
      }

      // fell in a pit
      if (p.y > VIEW_H + 80) { sfx.hole(); hurtPlayer(s, 99, null); }

      if (p.invuln > 0) p.invuln -= dt;
      if (p.rolling) p.spin += Math.abs(p.vx) * 0.06 + 0.1;
      if (p.rolling && !prevRoll) sfx.roll();
      prevRoll = p.rolling;

      // camera follows player
      const targetCam = Math.max(0, Math.min(worldW - VIEW_W, p.x - VIEW_W / 2 + p.w / 2));
      s.cam += (targetCam - s.cam) * 0.12;

      // rings
      for (const r of s.rings) {
        if (r.taken) continue;
        const rb = { x: r.x - 10, y: r.y - 10, w: 20, h: 20 };
        if (aabb(p, rb)) {
          r.taken = true;
          s.score += 10;
          sfx.coin();
          spawnParticles(r.x, r.y, "#fde047", 8);
          setHud((h) => ({ ...h, rings: h.rings + 1, score: s.score }));
        }
      }

      // stars
      for (const st of s.stars) {
        if (st.taken) continue;
        const sb = { x: st.x - 14, y: st.y - 14, w: 28, h: 28 };
        if (aabb(p, sb)) {
          st.taken = true;
          s.score += 100;
          sfx.star();
          spawnParticles(st.x, st.y, "#fb923c", 14);
          setHud((h) => ({ ...h, stars: h.stars + 1, score: s.score }));
        }
      }

      // goal
      const goalPl = platforms.find((pl) => pl.type === "goal");
      if (goalPl && aabb(p, goalPl)) {
        if (s.eggman.alive) {
          // must defeat Eggman to finish — bounce player back
          p.vx = -6;
        } else {
          winGame(s);
        }
      }

      // Eggman — always update while alive so hits still work if the player goes back
      const e = s.eggman;
      if (e.alive) {
        e.t += dt;
        const left = eggCfg.patrolLeft;
        const right = worldW - e.w - 20;
        const mid = (left + right) / 2;
        const range = (right - left) / 2;
        const startPhase = Math.asin(Math.max(-1, Math.min(1, (eggCfg.startX - mid) / range)));
        e.x = mid
          + Math.sin(e.t * eggCfg.patrolOmega + startPhase) * range
          + Math.sin(e.t * 0.0006) * eggCfg.weave;
        e.x = Math.max(left, Math.min(right, e.x));
        e.y = eggCfg.baseY + Math.sin(e.t * eggCfg.speed) * eggCfg.amp;
        if (e.hitFlash > 0) e.hitFlash -= dt;

        // drop bombs
        if (s.time - e.lastBomb > eggCfg.bombCooldown) {
          e.lastBomb = s.time;
          e.bombs.push({ x: e.x + e.w / 2 - 8, y: e.y + e.h, vy: 2, life: 4000 });
        }
        // update bombs
        for (const b of e.bombs) {
          b.vy += 0.25;
          b.y += b.vy;
          b.life -= dt;
          const bb = { x: b.x, y: b.y, w: 16, h: 16 };
          if (aabb(p, bb)) {
            b.life = 0;
            hurtPlayer(s, 1, null);
            spawnExplosion(b.x + 8, b.y + 8);
          }
          // bomb hits ground -> big explosion
          for (const pl of platforms) {
            if (pl.type === "ground" && aabb(bb, pl)) {
              b.life = 0;
              spawnExplosion(b.x + 8, pl.y);
              break;
            }
          }
        }
        e.bombs = e.bombs.filter((b) => b.life > 0 && b.y < VIEW_H + 100);

        // player rolls/jumps into Eggman -> damage
        const eb = { x: e.x, y: e.y, w: e.w, h: e.h };
        if (aabb(p, eb)) {
          // stomp = falling onto his head this frame, or rolling into him
          const playerBottom = p.y + p.h;
          const stomp = p.vy > 0 && (playerBottom - p.vy) < (e.y + e.h * 0.6);
          if (stomp || p.rolling) {
            e.hp -= 1;
            e.hitFlash = 200;
            p.vy = -14; // bounce off
            // nudge back out of his hitbox so it doesn't chain counters
            p.x -= p.facing * 6;
            sfx.hitEggman();
            spawnParticles(e.x + e.w / 2, e.y + e.h / 2, "#fbbf24", 16);
            if (e.hp <= 0) {
              e.alive = false;
              s.score += 500;
              setHud((h) => ({ ...h, score: s.score }));
              sfx.defeatEggman();
              spawnParticles(e.x + e.w / 2, e.y + e.h / 2, "#f87171", 30);
              spawnParticles(e.x + e.w / 2, e.y + e.h / 2, "#fde047", 22);
              spawnParticles(e.x + e.w / 2, e.y + e.h / 2, "#38bdf8", 16);
            }
          } else {
            // touched him from the side / on the ground -> take damage
            hurtPlayer(s, 1, null);
            p.vx = -8 * Math.sign(e.x - p.x || 1);
          }
        }
      }

      // explosions (shockwave rings expand + fade)
      for (const ex of s.explosions) {
        ex.r = ex.r + (ex.maxR - ex.r) * 0.18;
        ex.life -= dt;
      }
      s.explosions = s.explosions.filter((ex) => ex.life > 0);

      // particles
      for (const pt of s.particles) {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += 0.3;
        pt.life -= dt;
      }
      s.particles = s.particles.filter((pt) => pt.life > 0);
    };

    const hurtPlayer = (s, dmg) => {
      const p = s.player;
      if (p.invuln > 0) return;
      sfx.die();
      setHud((h) => {
        const lives = Math.max(0, h.lives - (dmg >= 99 ? h.lives : 1));
        if (lives <= 0) {
          statusRef.current = "lost";
          setStatus("lost");
          sfx.gameover();
        }
        return { ...h, lives };
      });
      p.invuln = 1500;
      p.vy = -10;
      p.vx = -6 * (p.facing);
      // scatter some rings (sonic-style)
      const lost = Math.min(10, stateRef.current.rings.filter((r) => !r.taken).length);
      // just visual; we don't reclaim them
      spawnParticles(p.x + p.w / 2, p.y + p.h / 2, "#fde047", lost + 4);
    };

    const winGame = (s) => {
      statusRef.current = "won";
      setStatus("won");
      sfx.levelComplete();
      s.score += 1000;
      setHud((h) => {
        const finalScore = h.score + 1000;
        try {
          setBestScore((prev) => {
            const next = Math.max(prev, finalScore);
            localStorage.setItem("sonic_best", String(next));
            return next;
          });
        } catch {}
        return { ...h, score: finalScore };
      });
    };

    // ------------------------------------------------------------- render --
    const draw = () => {
      const s = stateRef.current;
      const p = s.player;
      const L = LEVELS[levelRef.current];
      const worldW = L.worldW;
      const theme = L.theme;
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);

      // sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      sky.addColorStop(0, theme.sky[0]);
      sky.addColorStop(0.5, theme.sky[1]);
      sky.addColorStop(1, theme.sky[2]);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      // parallax clouds
      ctx.fillStyle = theme.cloud;
      for (let i = 0; i < 6; i++) {
        const cx = ((i * 300 - s.cam * 0.3) % (worldW + 400) + worldW + 400) % (worldW + 400) - 200;
        const cy = 60 + (i % 3) * 40;
        ctx.beginPath();
        ctx.arc(cx, cy, 26, 0, Math.PI * 2);
        ctx.arc(cx + 28, cy + 6, 22, 0, Math.PI * 2);
        ctx.arc(cx - 26, cy + 8, 20, 0, Math.PI * 2);
        ctx.fill();
      }

      // parallax hills
      ctx.fillStyle = theme.hill;
      for (let i = 0; i < 12; i++) {
        const hx = i * 480 - (s.cam * 0.5) % 480;
        ctx.beginPath();
        ctx.ellipse(hx, 480, 220, 120, 0, Math.PI, 0);
        ctx.fill();
      }

      if (theme.weather === "snow") {
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        for (let i = 0; i < 42; i++) {
          const sx = ((i * 97 + s.time * 0.05 + s.cam * 0.15) % (VIEW_W + 40)) - 20;
          const sy = ((i * 53 + s.time * 0.09) % (VIEW_H + 20)) - 10;
          ctx.beginPath();
          ctx.arc(sx, sy, 1.4 + (i % 3) * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.save();
      ctx.translate(-Math.round(s.cam), 0);

      // platforms
      for (const pl of L.platforms) {
        if (pl.type === "ground") {
          ctx.fillStyle = theme.ground;
          ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
          ctx.fillStyle = theme.grass;
          ctx.fillRect(pl.x, pl.y, pl.w, 10);
          ctx.fillStyle = theme.dirt;
          for (let gx = pl.x; gx < pl.x + pl.w; gx += 24) {
            ctx.fillRect(gx, pl.y + 10, 2, pl.h - 10);
          }
        } else if (pl.type === "platform") {
          drawFloatingPlatform(ctx, pl, theme);
        } else if (pl.type === "spike") {
          ctx.fillStyle = "#475569";
          const spikes = Math.floor(pl.w / 16);
          for (let i = 0; i < spikes; i++) {
            const sx = pl.x + i * 16;
            ctx.beginPath();
            ctx.moveTo(sx, pl.y + pl.h);
            ctx.lineTo(sx + 8, pl.y);
            ctx.lineTo(sx + 16, pl.y + pl.h);
            ctx.closePath();
            ctx.fill();
          }
        } else if (pl.type === "spring") {
          ctx.fillStyle = "#ef4444";
          ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
          ctx.fillStyle = "#fca5a5";
          ctx.fillRect(pl.x, pl.y, pl.w, 5);
        } else if (pl.type === "goal") {
          // goal post
          ctx.fillStyle = "#e5e7eb";
          ctx.fillRect(pl.x, pl.y, 6, pl.h);
          ctx.fillStyle = "#1d4ed8";
          ctx.beginPath();
          ctx.arc(pl.x + 3, pl.y, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.font = "bold 10px sans-serif";
          ctx.fillText("GOAL", pl.x - 6, pl.y + 4);
        }
      }

      // rings
      for (const r of s.rings) {
        if (r.taken) continue;
        const bob = Math.sin(s.time * 0.005 + r.x * 0.01) * 3;
        ctx.save();
        ctx.translate(r.x, r.y + bob);
        const sx = Math.abs(Math.cos(s.time * 0.006 + r.x));
        ctx.scale(sx * 0.9 + 0.1, 1);
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = "#fde68a";
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // stars
      for (const st of s.stars) {
        if (st.taken) continue;
        const bob = Math.sin(s.time * 0.004 + st.x) * 4;
        drawStar(ctx, st.x, st.y + bob, 5, 12, 6, "#fb923c", "#fed7aa");
      }

      // Eggman + bombs
      const e = s.eggman;
      if (e.alive) {
        drawEggman(ctx, e.x, e.y, e.w, e.h, e.hitFlash > 0, L.eggman.hat);
        for (const b of e.bombs) {
          ctx.fillStyle = "#1f2937";
          ctx.beginPath();
          ctx.arc(b.x + 8, b.y + 8, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#f97316";
          ctx.fillRect(b.x + 6, b.y, 4, 4);
        }
      }

      // particles
      for (const pt of s.particles) {
        ctx.globalAlpha = Math.max(0, pt.life / pt.max);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
      }

      // explosions (expanding yellow shockwave + red core + white ring)
      for (const ex of s.explosions) {
        const a = Math.max(0, ex.life / ex.max);
        const r = ex.r;
        ctx.globalAlpha = a;
        ctx.fillStyle = "rgba(251,191,36,0.85)";
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = a * 0.55;
        ctx.fillStyle = "rgba(239,68,68,0.75)";
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = Math.min(1, a * 1.1);
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // player (Sonic-like)
      const flicker = p.invuln > 0 && Math.floor(s.time / 80) % 2 === 0;
      if (!flicker) drawPlayer(ctx, p, s.time);

      ctx.restore();

      // HUD handled by React overlay
    };

    const loop = (t) => {
      const s = stateRef.current;
      if (!s.lastFrame) s.lastFrame = t;
      const dt = Math.min(40, t - s.lastFrame);
      s.lastFrame = t;
      update(dt);
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // track analytics on win/lose
  useEffect(() => {
    if (status === "won" || status === "lost") {
      try { base44.analytics.track({ eventName: "sonic_level_end", properties: { result: status, level: levelRef.current + 1 } }); } catch {}
    }
  }, [status]);

  return (
    <div className="h-[100dvh] bg-slate-950 flex flex-col items-center justify-center p-2 sm:p-4 select-none overflow-hidden">
      <div className="w-full max-w-[960px] h-full flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            <span className="text-blue-400">Sonic</span>-style Runner
          </h1>
          <div className="text-sm text-slate-400">Best: <span className="text-amber-400 font-bold">{bestScore}</span></div>
        </div>

        {/* HUD */}
        <div className={`flex flex-wrap items-center gap-4 mb-3 text-white ${status === "menu" ? "invisible" : ""}`}>
          <Badge label="Level" value={hud.level} color="text-sky-400" />
          <Badge label="Rings" value={hud.rings} color="text-amber-400" icon="ring" />
          <Badge label="Stars" value={hud.stars} color="text-orange-400" icon="star" />
          <Badge label="Lives" value={hud.lives} color="text-red-400" icon="heart" />
          <Badge label="Score" value={hud.score} color="text-white" />
        </div>

        <div className="flex-1 min-h-0 w-full relative rounded-xl overflow-hidden shadow-2xl border-4 border-slate-800 bg-blue-900 flex items-center justify-center touch-none">
          <canvas
            ref={canvasRef}
            width={VIEW_W}
            height={VIEW_H}
            className="block max-w-full max-h-full w-auto h-auto"
            style={{ imageRendering: "pixelated" }}
          />
          {status === "playing" && (
            <TouchControls
              setKey={(k, v) => { if (v) unlockAudio(); keysRef.current[k] = v; }}
            />
          )}

          {status === "menu" && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white text-center px-4">
              <h2 className="text-4xl font-extrabold mb-1 tracking-tight">
                <span className="text-blue-400">Velocity</span> Dash
              </h2>
              <p className="text-slate-300 mb-6">Choose a level</p>
              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xl">
                {LEVELS.map((L, i) => (
                  <button
                    key={L.name}
                    onClick={() => { unlockAudio(); startLevel(i); }}
                    className="flex-1 px-4 py-4 rounded-xl font-bold border-2 border-white/20 hover:border-white/70 hover:scale-[1.03] transition-all shadow-lg"
                    style={{
                      background: `linear-gradient(160deg, ${L.theme.sky[0]}, ${L.theme.sky[1]})`,
                    }}
                  >
                    <div className="text-xs uppercase tracking-wide text-white/80">Level {i + 1}</div>
                    <div className="text-lg mt-1">{L.name}</div>
                  </button>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-400 hidden md:block">Press 1, 2, or 3</p>
            </div>
          )}

          {/* End overlay */}
          {(status === "won" || status === "lost") && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white text-center">
              <h2 className={`text-4xl font-extrabold mb-2 ${status === "won" ? "text-emerald-400" : "text-red-500"}`}>
                {status === "won"
                  ? (hud.level < LEVELS.length ? `${LEVELS[hud.level - 1].name} Complete!` : "You Win!")
                  : "Game Over"}
              </h2>
              <p className="text-slate-300 mb-1">Level {hud.level} · Score: {hud.score}</p>
              <p className="text-slate-300 mb-4">
                Rings: {hud.rings} · Stars: {hud.stars}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {status === "won" && hud.level < LEVELS.length && (
                  <button
                    onClick={startNextLevel}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold transition-colors"
                  >
                    Continue to Level {hud.level + 1}
                  </button>
                )}
                <button
                  onClick={resetGame}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-colors"
                >
                  Play Again
                </button>
                <button
                  onClick={goToMenu}
                  className="px-6 py-2.5 bg-slate-600 hover:bg-slate-500 rounded-lg font-bold transition-colors"
                >
                  Level Select
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="hidden md:flex flex-wrap gap-4 mt-2 text-sm text-slate-400 justify-center">
          <span><Key>←</Key> <Key>→</Key> Move</span>
          <span><Key>↑</Key> / <Key>Space</Key> Jump</span>
          <span><Key>↓</Key> Roll (attack)</span>
          <span className="text-amber-400">Beat Eggman to reach the goal!</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small UI helpers
// ---------------------------------------------------------------------------
function Badge({ label, value, color, icon }) {
  return (
    <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg">
      <span className={`font-bold ${color}`}>{value}</span>
      <span className="text-slate-400 text-xs uppercase tracking-wide">{label}</span>
    </div>
  );
}

function Key({ children }) {
  return (
    <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-white text-xs border border-slate-600">
      {children}
    </kbd>
  );
}

// ---------------------------------------------------------------------------
// Canvas drawing helpers
// ---------------------------------------------------------------------------
function drawLeaf(ctx, x, y, dir, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(10, -7, 16, 2);
  ctx.quadraticCurveTo(8, 6, 0, 0);
  ctx.fill();
  ctx.restore();
}

function drawFloatingPlatform(ctx, pl, theme) {
  const { x, y, w, h } = pl;
  if (theme.platformStyle === "dirt") {
    ctx.fillStyle = theme.platform;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = theme.platformTop;
    ctx.fillRect(x, y, w, 5);
    return;
  }
  if (theme.platformStyle === "snow") {
    ctx.fillStyle = theme.platform;
    ctx.beginPath();
    ctx.moveTo(x + 4, y);
    ctx.lineTo(x + w - 4, y);
    ctx.quadraticCurveTo(x + w + 2, y + h / 2, x + w - 4, y + h);
    ctx.lineTo(x + 4, y + h);
    ctx.quadraticCurveTo(x - 2, y + h / 2, x + 4, y);
    ctx.fill();
    ctx.fillStyle = theme.platformTop;
    ctx.fillRect(x + 2, y, w - 4, 6);
    ctx.fillStyle = theme.ice || "#bae6fd";
    for (let i = 8; i < w - 6; i += 16) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + h);
      ctx.lineTo(x + i + 3, y + h + 10);
      ctx.lineTo(x + i + 6, y + h);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }

  ctx.fillStyle = theme.platform;
  ctx.fillRect(x, y + 2, w, h - 2);
  ctx.fillStyle = theme.platformTop;
  ctx.fillRect(x, y, w, 6);
  ctx.strokeStyle = theme.vineDark || "#14532d";
  ctx.lineWidth = 2;
  for (let i = 0; i < w; i += 16) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + h);
    ctx.quadraticCurveTo(x + i + 8, y + 4, x + i + 16, y + h);
    ctx.stroke();
  }
  if (theme.platformStyle !== "vine") return;
  ctx.strokeStyle = theme.platform;
  ctx.lineWidth = 2.5;
  for (let i = 12; i < w; i += 30) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + h);
    ctx.quadraticCurveTo(x + i + 7, y + h + 12, x + i - 3, y + h + 18);
    ctx.stroke();
  }
  const leaf = theme.leaf || "#86efac";
  for (let i = 8; i < w; i += 34) {
    drawLeaf(ctx, x + i, y + h + 6, 1, leaf);
    drawLeaf(ctx, x + i + 14, y - 1, -1, leaf);
  }
}

function drawStar(ctx, cx, cy, spikes, outer, inner, fill, stroke) {
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outer);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner);
    rot += step;
  }
  ctx.lineTo(cx, cy - outer);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
}

function drawPlayer(ctx, p, time) {
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(p.facing, 1);

  if (p.rolling) {
    // spin ball
    ctx.rotate(p.spin);
    ctx.fillStyle = "#1d4ed8";
    ctx.beginPath();
    ctx.arc(0, 0, p.h / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1e3a8a";
    ctx.lineWidth = 3;
    // spokes
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(i * Math.PI / 3) * p.h / 2, Math.sin(i * Math.PI / 3) * p.h / 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#f5f5f5";
    ctx.beginPath();
    ctx.arc(p.h * 0.15, -p.h * 0.1, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // body
    ctx.fillStyle = "#2563eb";
    ctx.beginPath();
    ctx.ellipse(0, 2, p.w / 2, p.h / 2 - 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // belly
    ctx.fillStyle = "#fde68a";
    ctx.beginPath();
    ctx.ellipse(2, 6, 9, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // head spikes
    ctx.fillStyle = "#1d4ed8";
    ctx.beginPath();
    ctx.moveTo(-6, -10);
    ctx.lineTo(-16, -6);
    ctx.lineTo(-6, -2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-4, -14);
    ctx.lineTo(-12, -12);
    ctx.lineTo(-4, -8);
    ctx.closePath();
    ctx.fill();
    // eye
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(6, -4, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.ellipse(8, -3, 1.8, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // shoe
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(-8, p.h / 2 - 4, 14, 6);
    ctx.fillStyle = "#fff";
    ctx.fillRect(-8, p.h / 2 - 2, 14, 2);
  }
  ctx.restore();
}

function drawEggman(ctx, x, y, w, h, flash, hat) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  if (flash) ctx.globalAlpha = 0.5;

  // body (egg)
  ctx.fillStyle = "#f1f5f9";
  ctx.beginPath();
  ctx.ellipse(0, 4, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // jacket
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.ellipse(0, 8, w / 2 - 2, h / 2 - 8, 0, 0, Math.PI);
  ctx.fill();
  // yellow buttons
  ctx.fillStyle = "#facc15";
  ctx.beginPath(); ctx.arc(-6, 10, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 12, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(6, 10, 2, 0, Math.PI * 2); ctx.fill();

  // head
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(0, -h / 2 + 6, 12, 0, Math.PI * 2);
  ctx.fill();
  // bald top shine
  ctx.fillStyle = "#fef3c7";
  ctx.beginPath();
  ctx.arc(-3, -h / 2 + 3, 4, 0, Math.PI * 2);
  ctx.fill();
  // goggles
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(-10, -h / 2 + 4, 20, 4);
  ctx.fillStyle = "#60a5fa";
  ctx.fillRect(-8, -h / 2 + 5, 6, 2);
  ctx.fillRect(2, -h / 2 + 5, 6, 2);
  // mustache
  ctx.fillStyle = "#92400e";
  ctx.fillRect(-8, -h / 2 + 10, 16, 3);

  if (hat === "winter") {
    const top = -h / 2 + 6;
    ctx.fillStyle = "#1d4ed8";
    ctx.beginPath();
    ctx.moveTo(-13, top - 3);
    ctx.quadraticCurveTo(-2, top - 24, 13, top - 4);
    ctx.lineTo(12, top - 2);
    ctx.quadraticCurveTo(0, top - 8, -12, top - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.ellipse(0, top - 3, 14, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8, top - 20, 4.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // propeller underneath
  ctx.fillStyle = "#64748b";
  ctx.fillRect(-2, h / 2 - 2, 4, 6);
  ctx.save();
  ctx.translate(0, h / 2 + 4);
  ctx.rotate(performance.now() * 0.04);
  ctx.fillRect(-18, -2, 36, 4);
  ctx.restore();

  ctx.restore();
}