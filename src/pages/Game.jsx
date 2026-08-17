import React, { useEffect, useRef, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import sfx, { unlockAudio } from "@/lib/sfx";
import TouchControls from "@/components/game/TouchControls";

// ---------------------------------------------------------------------------
// Sonic-style platformer — single complex level
// Pure canvas + requestAnimationFrame, no external assets.
// ---------------------------------------------------------------------------

const VIEW_W = 960;
const VIEW_H = 540;
const WORLD_W = 5200;
const GRAVITY = 0.66;
const MAX_FALL = 14;

// ---- Level layout ----------------------------------------------------------
// Each platform: {x, y, w, h, type}  type: ground|platform|spike|spring|goal
const PLATFORMS = [
  // ground segments (gaps in between = pits)
  { x: 0, y: 480, w: 940, h: 60, type: "ground" },
  { x: 1010, y: 480, w: 740, h: 60, type: "ground" },
  { x: 1790, y: 480, w: 640, h: 60, type: "ground" },
  { x: 2470, y: 480, w: 720, h: 60, type: "ground" },
  { x: 3240, y: 480, w: 600, h: 60, type: "ground" },
  { x: 3870, y: 480, w: 1330, h: 60, type: "ground" },

  // floating platforms
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

  // spikes (hazard) placed on ground
  { x: 940, y: 460, w: 40, h: 20, type: "spike" },
  { x: 1680, y: 460, w: 40, h: 20, type: "spike" },
  { x: 2360, y: 460, w: 50, h: 20, type: "spike" },
  { x: 3760, y: 460, w: 60, h: 20, type: "spike" },

  // springs (launch the player up)
  { x: 660, y: 462, w: 60, h: 18, type: "spring" },
  { x: 2480, y: 462, w: 60, h: 18, type: "spring" },
  { x: 3880, y: 462, w: 60, h: 18, type: "spring" },

  // goal ring at the end
  { x: 5050, y: 360, w: 30, h: 120, type: "goal" },
];

// rings — placed along the level (arcs over pits, on platforms)
const RING_DEFS = (() => {
  const r = [];
  const arc = (cx, cy, n, spread = 28) => {
    for (let i = 0; i < n; i++) r.push({ x: cx + i * spread, y: cy });
  };
  arc(360, 340, 5);
  arc(560, 260, 5);
  arc(950, 360, 6, 30); // over spike
  arc(1140, 320, 4);
  arc(1340, 240, 4);
  arc(1740, 340, 6, 30); // over spike
  arc(2000, 320, 4);
  arc(2220, 240, 4);
  arc(2420, 340, 6, 30); // over spike
  arc(2720, 320, 4);
  arc(2920, 240, 4);
  arc(3440, 330, 4);
  arc(3660, 250, 4);
  arc(3820, 340, 5, 30); // over spike
  arc(4100, 330, 4);
  arc(4320, 250, 4);
  arc(4560, 330, 4);
  arc(4800, 440, 8, 26);
  return r;
})();

// stars — rare, high value
const STAR_DEFS = [
  { x: 580, y: 260 },
  { x: 1360, y: 240 },
  { x: 2240, y: 240 },
  { x: 2940, y: 240 },
  { x: 3680, y: 250 },
  { x: 4340, y: 250 },
  { x: 4900, y: 420 },
];

// Eggman boss — flies in a sine pattern, drops bombs
const EGGMAN = {
  activeFrom: 700, // appears soon after the level starts
  startX: 1150,
  baseY: 320,
  amp: 60,
  speed: 0.0022,
  bombCooldown: 1700,
  hp: 6,
};

// ---------------------------------------------------------------------------
// Game component
// ---------------------------------------------------------------------------
export default function Game() {
  const canvasRef = useRef(null);
  const keysRef = useRef({});
  const rafRef = useRef(0);
  const [hud, setHud] = useState({ rings: 0, stars: 0, lives: 3, score: 0 });
  const [status, setStatus] = useState("playing"); // playing | won | lost
  const statusRef = useRef("playing");
  const [bestScore, setBestScore] = useState(() => {
    try { return Number(localStorage.getItem("sonic_best") || 0); } catch { return 0; }
  });

  // game state in a ref (avoid re-renders each frame)
  const stateRef = useRef({
    player: {
      x: 80, y: 420, w: 34, h: 40,
      vx: 0, vy: 0, onGround: false, facing: 1,
      rolling: false, invuln: 0, // ms of invulnerability after hit
      spin: 0, // visual spin while rolling
    },
    rings: RING_DEFS.map((r) => ({ ...r, taken: false })),
    stars: STAR_DEFS.map((s) => ({ ...s, taken: false })),
    eggman: {
      x: EGGMAN.startX, y: EGGMAN.baseY, w: 64, h: 56,
      hp: EGGMAN.hp, alive: true, t: 0, lastBomb: 0, bombs: [], hitFlash: 0,
    },
    cam: 0,
    particles: [],
    explosions: [],
    time: 0,
    lastFrame: 0,
    score: 0,
  });

  // ---------------------------------------------------------------- input ---
  useEffect(() => {
    const down = (e) => {
      unlockAudio();
      const k = e.key.toLowerCase();
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
    stateRef.current = {
      player: {
        x: 80, y: 420, w: 34, h: 40,
        vx: 0, vy: 0, onGround: false, facing: 1,
        rolling: false, invuln: 0, spin: 0,
      },
      rings: RING_DEFS.map((r) => ({ ...r, taken: false })),
      stars: STAR_DEFS.map((s) => ({ ...s, taken: false })),
      eggman: {
        x: EGGMAN.startX, y: EGGMAN.baseY, w: 64, h: 56,
        hp: EGGMAN.hp, alive: true, t: 0, lastBomb: 0, bombs: [], hitFlash: 0,
      },
      cam: 0,
      particles: [],
      explosions: [],
      time: 0,
      lastFrame: 0,
      score: 0,
    };
    setHud({ rings: 0, stars: 0, lives: 3, score: 0 });
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
      s.time += dt;
      const p = s.player;
      const keys = keysRef.current;

      const ACC = 0.65, MAX_RUN = 8.5, FRICTION = 0.85, JUMP = 16.5;

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
      if (p.vy < 0 && !jumpHeld) p.vy *= 0.86;

      // move + collide axis-separated
      p.x += p.vx;
      for (const pl of PLATFORMS) {
        if (pl.type === "goal") continue;
        if (aabb(p, pl)) {
          if (p.vx > 0) p.x = pl.x - p.w;
          else if (p.vx < 0) p.x = pl.x + pl.w;
          p.vx = 0;
        }
      }
      if (p.x < 0) p.x = 0;
      if (p.x + p.w > WORLD_W) p.x = WORLD_W - p.w;

      p.y += p.vy;
      p.onGround = false;
      for (const pl of PLATFORMS) {
        if (pl.type === "goal") continue;
        if (aabb(p, pl)) {
          if (p.vy > 0) {
            // landing
            p.y = pl.y - p.h;
            p.vy = 0;
            p.onGround = true;
            if (pl.type === "spike") { sfx.spike(); hurtPlayer(s, 1, pl); }
            if (pl.type === "spring") {
              p.vy = -24;
              p.onGround = false;
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
      const targetCam = Math.max(0, Math.min(WORLD_W - VIEW_W, p.x - VIEW_W / 2 + p.w / 2));
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
      const goalPl = PLATFORMS.find((pl) => pl.type === "goal");
      if (goalPl && aabb(p, goalPl)) {
        if (s.eggman.alive) {
          // must defeat Eggman to finish — bounce player back
          p.vx = -6;
        } else {
          winGame(s);
        }
      }

      // Eggman
      const e = s.eggman;
      if (e.alive && p.x > EGGMAN.activeFrom) {
        e.t += dt;
        e.x = EGGMAN.startX + Math.sin(e.t * 0.0006) * 200 + (p.x - EGGMAN.activeFrom) * 0.3;
        e.x = Math.max(EGGMAN.startX - 100, Math.min(WORLD_W - 80, e.x));
        e.y = EGGMAN.baseY + Math.sin(e.t * EGGMAN.speed) * EGGMAN.amp;
        if (e.hitFlash > 0) e.hitFlash -= dt;

        // drop bombs
        if (s.time - e.lastBomb > EGGMAN.bombCooldown) {
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
          for (const pl of PLATFORMS) {
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
              spawnParticles(e.x + e.w / 2, e.y + e.h / 2, "#f87171", 30);
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
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);

      // sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      sky.addColorStop(0, "#1e3a8a");
      sky.addColorStop(0.5, "#3b82f6");
      sky.addColorStop(1, "#93c5fd");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      // parallax clouds
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      for (let i = 0; i < 6; i++) {
        const cx = ((i * 300 - s.cam * 0.3) % (WORLD_W + 400) + WORLD_W + 400) % (WORLD_W + 400) - 200;
        const cy = 60 + (i % 3) * 40;
        ctx.beginPath();
        ctx.arc(cx, cy, 26, 0, Math.PI * 2);
        ctx.arc(cx + 28, cy + 6, 22, 0, Math.PI * 2);
        ctx.arc(cx - 26, cy + 8, 20, 0, Math.PI * 2);
        ctx.fill();
      }

      // parallax hills
      ctx.fillStyle = "rgba(30,64,175,0.45)";
      for (let i = 0; i < 12; i++) {
        const hx = i * 480 - (s.cam * 0.5) % 480;
        ctx.beginPath();
        ctx.ellipse(hx, 480, 220, 120, 0, Math.PI, 0);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(-Math.round(s.cam), 0);

      // platforms
      for (const pl of PLATFORMS) {
        if (pl.type === "ground") {
          ctx.fillStyle = "#15803d";
          ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
          ctx.fillStyle = "#22c55e";
          ctx.fillRect(pl.x, pl.y, pl.w, 10);
          ctx.fillStyle = "#166534";
          for (let gx = pl.x; gx < pl.x + pl.w; gx += 24) {
            ctx.fillRect(gx, pl.y + 10, 2, pl.h - 10);
          }
        } else if (pl.type === "platform") {
          ctx.fillStyle = "#a16207";
          ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
          ctx.fillStyle = "#facc15";
          ctx.fillRect(pl.x, pl.y, pl.w, 5);
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
        drawEggman(ctx, e.x, e.y, e.w, e.h, e.hitFlash > 0);
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
    if (status !== "playing") {
      try { base44.analytics.track({ eventName: "sonic_level_end", properties: { result: status } }); } catch {}
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
        <div className="flex flex-wrap items-center gap-4 mb-3 text-white">
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
          <TouchControls
            setKey={(k, v) => { if (v) unlockAudio(); keysRef.current[k] = v; }}
          />

          {/* Start / End overlay */}
          {status !== "playing" && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white text-center">
              <h2 className={`text-4xl font-extrabold mb-2 ${status === "won" ? "text-emerald-400" : "text-red-500"}`}>
                {status === "won" ? "Level Complete!" : "Game Over"}
              </h2>
              <p className="text-slate-300 mb-1">Score: {hud.score}</p>
              <p className="text-slate-300 mb-4">
                Rings: {hud.rings} · Stars: {hud.stars}
              </p>
              <button
                onClick={resetGame}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-colors"
              >
                Play Again
              </button>
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

function drawEggman(ctx, x, y, w, h, flash) {
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