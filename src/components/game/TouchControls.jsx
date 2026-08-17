import React from "react";

// On-screen touch controls for mobile play. Hidden on large (non-touch) screens.
// Wires into the keyboard key-state used by the game loop via setKey(name, pressed).
function Pad({ children, onDown, onUp, label, className = "" }) {
  return (
    <button
      aria-label={label}
      onPointerDown={(e) => { e.preventDefault(); onDown(); }}
      onPointerUp={(e) => { e.preventDefault(); onUp(); }}
      onPointerLeave={() => onUp()}
      onPointerCancel={() => onUp()}
      onContextMenu={(e) => e.preventDefault()}
      className={`select-none touch-none flex items-center justify-center rounded-full bg-slate-900/70 border-2 border-slate-600/80 text-white font-bold active:bg-blue-600/80 active:scale-95 transition-transform shadow-lg backdrop-blur ${className}`}
    >
      {children}
    </button>
  );
}

export default function TouchControls({ setKey }) {
  const press = (k) => () => setKey(k, true);
  const release = (k) => () => setKey(k, false);

  return (
    <div className="md:hidden absolute inset-x-0 bottom-0 h-28 pointer-events-none p-2">
      {/* Left: movement */}
      <div className="absolute left-3 bottom-3 flex gap-2 pointer-events-auto">
        <Pad onDown={press("arrowleft")} onUp={release("arrowleft")} label="Move left" className="w-16 h-16 text-2xl">
          ‹
        </Pad>
        <Pad onDown={press("arrowright")} onUp={release("arrowright")} label="Move right" className="w-16 h-16 text-2xl">
          ›
        </Pad>
      </div>

      {/* Right: roll + jump */}
      <div className="absolute right-3 bottom-3 flex items-end gap-2 pointer-events-auto">
        <Pad onDown={press("arrowdown")} onUp={release("arrowdown")} label="Roll" className="w-16 h-16 text-sm">
          ROLL
        </Pad>
        <Pad onDown={press(" ")} onUp={release(" ")} label="Jump" className="w-20 h-20 text-sm">
          JUMP
        </Pad>
      </div>
    </div>
  );
}