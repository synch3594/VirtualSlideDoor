import { useEffect, useState } from 'react';
import { Footprints, Lock, Unlock } from 'lucide-react';
import { liveSim, useDoorStore } from '../store/useDoorStore';

export function SlideDoorIcon({ className = 'w-12 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 36" className={className} fill="none">
      {/* Minivan silhouette */}
      <path
        d="M8 25V15.5C8 13 9.8 10 13 9L21 7H48C51.5 7 54 9.5 54 13V25H50"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M18 25H40" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="14" cy="26" r="4" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="45" cy="26" r="4" stroke="currentColor" strokeWidth="2.4" />
      {/* Sliding door panel highlight */}
      <rect
        x="25"
        y="10"
        width="14"
        height="12"
        rx="2"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Open/Close arrows */}
      <path
        d="M17 16H22M20 13.5L22.5 16L20 18.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface SmartKeyFobProps {
  layout?: 'horizontal' | 'side';
}

/**
 * Nissan Serena Intelligent Key inspired smartphone tactile remote fob.
 * Supports both bottom horizontal layout (portrait/tablet) and compact right-rail layout (phone landscape).
 */
export function SmartKeyFob({ layout = 'horizontal' }: SmartKeyFobProps) {
  const phase = useDoorStore((s) => s.phase);
  const locked = useDoorStore((s) => s.locked);
  const powerMainOn = useDoorStore((s) => s.powerMainOn);
  const triggerDoorToggle = useDoorStore((s) => s.triggerDoorToggle);
  const setLocked = useDoorStore((s) => s.setLocked);

  const [ledLit, setLedLit] = useState(false);

  // Brief realistic red LED flash on the key fob whenever pressed
  useEffect(() => {
    const id = window.setInterval(() => {
      setLedLit(liveSim.keyLedTimer > 0.02);
    }, 60);
    return () => window.clearInterval(id);
  }, []);

  const isMoving =
    phase === 'OPENING_POPOUT' ||
    phase === 'OPENING_SLIDE' ||
    phase === 'CLOSING_SLIDE' ||
    phase === 'CLOSING_PULLIN' ||
    phase === 'UNLATCHING' ||
    phase === 'REVERSING';

  const isClosing =
    phase === 'CLOSING_SLIDE' ||
    phase === 'CLOSING_PULLIN' ||
    phase === 'HALF_LATCH_PAUSE' ||
    phase === 'EASY_CLOSER';

  const primaryLabel = !powerMainOn
    ? '手動モード'
    : isMoving
      ? 'とめる'
      : phase === 'OPEN'
        ? 'しめる'
        : phase === 'CLOSED'
          ? 'あける'
          : 'うごかす';

  const primaryBtnTone = !powerMainOn
    ? 'bg-slate-800 border-slate-600 text-slate-400'
    : isClosing
      ? 'bg-gradient-to-b from-amber-500/35 to-amber-700/45 border-amber-400 text-amber-100 shadow-amber-500/20'
      : isMoving
        ? 'bg-gradient-to-b from-sky-500/35 to-blue-700/45 border-sky-400 text-sky-100 shadow-sky-500/25'
        : phase === 'OPEN'
          ? 'bg-gradient-to-b from-sky-500 to-blue-600 border-sky-300 text-white shadow-sky-500/35'
          : 'bg-gradient-to-b from-emerald-500 to-teal-600 border-emerald-300 text-white shadow-emerald-500/30';

  if (layout === 'side') {
    return (
      <div className="flex flex-col gap-1.5 w-full h-full">
        {/* Sculpted Intelligent Key Shell: Big Slide-Door Button */}
        <button
          type="button"
          onClick={() => triggerDoorToggle('smart_key')}
          className={`relative flex-1 min-h-[82px] flex flex-col items-center justify-center rounded-2xl border-2 px-2 py-1.5 transition-all active:scale-95 shadow-lg ${primaryBtnTone}`}
        >
          {/* Key Fob Red LED Indicator */}
          <span
            className={`absolute top-2 right-2 w-2 h-2 rounded-full transition-all ${
              ledLit ? 'bg-red-400 shadow-[0_0_8px_#f87171] scale-125' : 'bg-slate-700'
            }`}
          />

          <SlideDoorIcon className="w-11 h-6 mb-0.5" />
          <span className="text-sm font-extrabold tracking-wide leading-none">{primaryLabel}</span>
          <span className="text-[9px] opacity-80 mt-0.5 font-medium">パワースライドドア</span>
        </button>

        {/* Compact Lock / Unlock / Kick Sensor Action Row */}
        <div className="grid grid-cols-3 gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setLocked(true)}
            aria-label="ロック（施錠）"
            className={`flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-xl text-[10px] font-bold transition active:scale-95 border ${
              locked
                ? 'bg-amber-500/25 border-amber-400/70 text-amber-200 shadow-inner'
                : 'bg-slate-800/90 border-slate-700 text-slate-300 active:bg-slate-700'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>ロック</span>
          </button>

          <button
            type="button"
            onClick={() => setLocked(false)}
            aria-label="アンロック（解錠）"
            className={`flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-xl text-[10px] font-bold transition active:scale-95 border ${
              !locked
                ? 'bg-slate-700/75 border-slate-500/70 text-white'
                : 'bg-slate-800/90 border-slate-700 text-slate-300 active:bg-slate-700'
            }`}
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>解除</span>
          </button>

          <button
            type="button"
            onClick={() => triggerDoorToggle('kick_sensor')}
            aria-label="足キックセンサー"
            className="flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-xl text-[10px] font-bold transition active:scale-95 bg-slate-800/95 border border-sky-400/45 text-sky-200 active:bg-sky-500/20"
          >
            <Footprints className="w-3.5 h-3.5 text-sky-400" />
            <span>足キック</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2.5 w-full max-w-md mx-auto">
      {/* Sculpted Nissan Intelligent Key Fob Shell */}
      <div className="flex-1 flex items-center gap-2 bg-gradient-to-b from-slate-800 via-slate-900 to-black border border-slate-600/70 rounded-3xl p-2 shadow-[0_10px_28px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.18)]">
        {/* Lock / Unlock Vertical Stack */}
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setLocked(true)}
            aria-label="ロック（施錠）"
            className={`flex items-center justify-center gap-1 px-3 py-2.5 rounded-2xl text-xs font-bold transition active:scale-95 border ${
              locked
                ? 'bg-amber-500/25 border-amber-400/70 text-amber-200 shadow-inner'
                : 'bg-slate-800/90 border-slate-700 text-slate-300 active:bg-slate-700'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>ロック</span>
          </button>
          <button
            type="button"
            onClick={() => setLocked(false)}
            aria-label="アンロック（解錠）"
            className={`flex items-center justify-center gap-1 px-3 py-2.5 rounded-2xl text-xs font-bold transition active:scale-95 border ${
              !locked
                ? 'bg-slate-700/70 border-slate-500/70 text-white'
                : 'bg-slate-800/90 border-slate-700 text-slate-300 active:bg-slate-700'
            }`}
          >
            <Unlock className="w-4 h-4" />
            <span>解除</span>
          </button>
        </div>

        {/* BIG Primary Power Slide Door Button */}
        <button
          type="button"
          onClick={() => triggerDoorToggle('smart_key')}
          className={`relative flex-1 flex flex-col items-center justify-center min-h-[82px] rounded-2xl border-2 transition-all active:scale-95 shadow-lg ${primaryBtnTone}`}
        >
          {/* Key Fob Red LED Indicator */}
          <span
            className={`absolute top-2 right-2.5 w-2 h-2 rounded-full transition-all ${
              ledLit ? 'bg-red-400 shadow-[0_0_8px_#f87171] scale-125' : 'bg-slate-700'
            }`}
          />

          <SlideDoorIcon className="w-12 h-7 mb-0.5" />
          <span className="text-base font-extrabold tracking-wide leading-none">
            {primaryLabel}
          </span>
          <span className="text-[10px] opacity-80 mt-0.5 font-medium">
            パワースライドドア
          </span>
        </button>
      </div>

      {/* Dedicated Hands-Free Kick Sensor Trigger Button */}
      <button
        type="button"
        onClick={() => triggerDoorToggle('kick_sensor')}
        className="flex flex-col items-center justify-center w-[74px] h-[98px] rounded-3xl bg-slate-900/95 border border-sky-400/40 text-sky-200 active:scale-95 active:bg-sky-500/20 shadow-lg transition"
      >
        <Footprints className="w-7 h-7 mb-1 text-sky-400" />
        <span className="text-[11px] font-bold leading-tight text-center">
          足キック
          <br />
          センサー
        </span>
      </button>
    </div>
  );
}
