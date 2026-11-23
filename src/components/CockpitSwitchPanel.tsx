import { ArrowLeftToLine, ArrowRightFromLine, Power } from 'lucide-react';
import { useDoorStore } from '../store/useDoorStore';

/**
 * Overhead / Cockpit Power Slide Door Switch Panel:
 * Dedicated OPEN / CLOSE push buttons + authentic POWER MAIN ON/OFF switch
 * (turning MAIN OFF lets the child drag the sliding door manually by hand!).
 */
export function CockpitSwitchPanel() {
  const phase = useDoorStore((s) => s.phase);
  const powerMainOn = useDoorStore((s) => s.powerMainOn);
  const commandOpen = useDoorStore((s) => s.commandOpen);
  const commandClose = useDoorStore((s) => s.commandClose);
  const togglePowerMain = useDoorStore((s) => s.togglePowerMain);

  const isClosing =
    phase === 'CLOSING_SLIDE' ||
    phase === 'CLOSING_PULLIN' ||
    phase === 'HALF_LATCH_PAUSE' ||
    phase === 'EASY_CLOSER';
  const isOpening =
    phase === 'UNLATCHING' ||
    phase === 'OPENING_POPOUT' ||
    phase === 'OPENING_SLIDE' ||
    phase === 'REVERSING';

  return (
    <div className="w-full max-w-md mx-auto bg-gradient-to-b from-slate-800/95 to-slate-950 border border-slate-600/60 rounded-3xl p-2.5 shadow-xl flex items-center gap-2">
      {/* MAIN POWER ON/OFF Rocker Switch */}
      <button
        type="button"
        onClick={togglePowerMain}
        className={`flex flex-col items-center justify-center w-[92px] h-[78px] rounded-2xl border-2 transition active:scale-95 ${
          powerMainOn
            ? 'bg-emerald-950/80 border-emerald-400/80 text-emerald-200 shadow-[inset_0_0_12px_rgba(16,185,129,0.28)]'
            : 'bg-amber-950/70 border-amber-400/80 text-amber-200'
        }`}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              powerMainOn
                ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                : 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
            }`}
          />
          <Power className="w-4 h-4" />
        </div>
        <span className="text-xs font-extrabold leading-tight">
          {powerMainOn ? 'パワー ON' : '手動 OFF'}
        </span>
        <span className="text-[10px] opacity-80 mt-0.5">
          {powerMainOn ? '電動アシスト' : '指でスライド'}
        </span>
      </button>

      {/* Dedicated CLOSE button (featured prominently!) */}
      <button
        type="button"
        disabled={!powerMainOn}
        onClick={() => commandClose('cockpit_switch')}
        className={`flex-1 flex flex-col items-center justify-center h-[78px] rounded-2xl border-2 transition active:scale-95 ${
          !powerMainOn
            ? 'bg-slate-900/60 border-slate-700 text-slate-500 opacity-55'
            : isClosing
              ? 'bg-amber-500/35 border-amber-400 text-amber-100'
              : 'bg-gradient-to-b from-sky-600 to-blue-700 border-sky-300/80 text-white shadow-md'
        }`}
      >
        <ArrowLeftToLine className="w-6 h-6 mb-1" />
        <span className="text-sm font-extrabold">しめる</span>
        <span className="text-[10px] opacity-80">CLOSE</span>
      </button>

      {/* Dedicated OPEN button */}
      <button
        type="button"
        disabled={!powerMainOn}
        onClick={() => commandOpen('cockpit_switch')}
        className={`flex-1 flex flex-col items-center justify-center h-[78px] rounded-2xl border-2 transition active:scale-95 ${
          !powerMainOn
            ? 'bg-slate-900/60 border-slate-700 text-slate-500 opacity-55'
            : isOpening
              ? 'bg-emerald-500/35 border-emerald-400 text-emerald-100'
              : 'bg-gradient-to-b from-slate-700 to-slate-800 border-slate-500 text-white shadow-md'
        }`}
      >
        <ArrowRightFromLine className="w-6 h-6 mb-1" />
        <span className="text-sm font-extrabold">あける</span>
        <span className="text-[10px] opacity-80">OPEN</span>
      </button>
    </div>
  );
}
