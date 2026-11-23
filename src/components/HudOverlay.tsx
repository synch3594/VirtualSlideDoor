import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Eye,
  Hand,
  KeyRound,
  Moon,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Sunset,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { BODY_COLORS, type CameraPreset } from '../simulation/types';
import { liveSim, useDoorStore } from '../store/useDoorStore';
import { SmartKeyFob } from './SmartKeyFob';
import { CockpitSwitchPanel } from './CockpitSwitchPanel';
import { ParentSettingsModal } from './ParentSettingsModal';

type DockTab = 'key' | 'cockpit' | 'gimmicks';

const CAMERA_TABS: { id: CameraPreset; label: string }[] = [
  { id: 'exterior_front34', label: '斜め前' },
  { id: 'exterior_side', label: '真横' },
  { id: 'rail_closeup', label: 'レール' },
  { id: 'interior_row2', label: '車内' },
];

export function HudOverlay() {
  const [dockTab, setDockTab] = useState<DockTab>('key');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const phase = useDoorStore((s) => s.phase);
  const lastEventLabel = useDoorStore((s) => s.lastEventLabel);
  const cameraPreset = useDoorStore((s) => s.cameraPreset);
  const timeOfDay = useDoorStore((s) => s.timeOfDay);
  const muted = useDoorStore((s) => s.muted);
  const powerMainOn = useDoorStore((s) => s.powerMainOn);
  const obstaclePlaced = useDoorStore((s) => s.obstaclePlaced);
  const powerStepEnabled = useDoorStore((s) => s.powerStepEnabled);
  const bodyColorId = useDoorStore((s) => s.bodyColorId);

  const setCameraPreset = useDoorStore((s) => s.setCameraPreset);
  const setTimeOfDay = useDoorStore((s) => s.setTimeOfDay);
  const toggleMuted = useDoorStore((s) => s.toggleMuted);
  const toggleObstacle = useDoorStore((s) => s.toggleObstacle);
  const setPowerStepEnabled = useDoorStore((s) => s.setPowerStepEnabled);
  const setBodyColorId = useDoorStore((s) => s.setBodyColorId);

  // Lightweight RAF update for the tiny door-openness progress bar without React re-renders
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (progressBarRef.current) {
        const pct = Math.round(liveSim.progress * 100);
        progressBarRef.current.style.width = `${pct}%`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const cycleTimeOfDay = () => {
    const next = timeOfDay === 'day' ? 'sunset' : timeOfDay === 'sunset' ? 'night' : 'day';
    setTimeOfDay(next);
  };

  const TimeIcon = timeOfDay === 'day' ? Sun : timeOfDay === 'sunset' ? Sunset : Moon;

  const isAlert = phase === 'REVERSING';
  const isEasyCloser = phase === 'EASY_CLOSER' || phase === 'HALF_LATCH_PAUSE';

  return (
    <>
      {/* ===================== TOP FLOATING STATUS & QUICK CONTROLS ===================== */}
      <header className="pointer-events-none fixed top-0 inset-x-0 z-20 safe-top px-3 pt-2 flex items-start justify-between gap-2">
        {/* Live Door Status Pill */}
        <div
          className={`pointer-events-auto flex flex-col gap-1 px-3 py-1.5 rounded-2xl backdrop-blur-md border shadow-lg transition-colors max-w-[62%] ${
            isAlert
              ? 'bg-rose-950/85 border-rose-400/80 text-rose-100'
              : isEasyCloser
                ? 'bg-indigo-950/85 border-indigo-400/80 text-indigo-100'
                : 'bg-slate-950/70 border-white/15 text-white'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isAlert
                  ? 'bg-rose-400 animate-ping'
                  : isEasyCloser
                    ? 'bg-indigo-400 animate-pulse'
                    : phase === 'CLOSED'
                      ? 'bg-emerald-400'
                      : phase === 'OPEN'
                        ? 'bg-sky-400'
                        : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span className="text-xs font-bold truncate">{lastEventLabel}</span>
          </div>
          {/* Live Door Stroke Gauge (0% = Closed, 100% = Open) */}
          <div className="w-full h-1 bg-white/15 rounded-full overflow-hidden">
            <div
              ref={progressBarRef}
              className="h-full bg-gradient-to-r from-emerald-400 via-sky-400 to-blue-400 rounded-full"
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Quick Top-Right Utility Buttons */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={cycleTimeOfDay}
            aria-label="時間帯を切替"
            className="w-10 h-10 rounded-2xl bg-slate-950/70 backdrop-blur-md border border-white/15 flex items-center justify-center text-amber-300 active:scale-95 shadow-lg"
          >
            <TimeIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={toggleMuted}
            aria-label="音量ミュート切替"
            className="w-10 h-10 rounded-2xl bg-slate-950/70 backdrop-blur-md border border-white/15 flex items-center justify-center active:scale-95 shadow-lg"
          >
            {muted ? (
              <VolumeX className="w-5 h-5 text-rose-400" />
            ) : (
              <Volume2 className="w-5 h-5 text-sky-300" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="設定を開く"
            className="w-10 h-10 rounded-2xl bg-slate-950/70 backdrop-blur-md border border-white/15 flex items-center justify-center text-slate-200 active:scale-95 shadow-lg"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Manual Mode Helper Banner when Power MAIN is OFF */}
      {!powerMainOn && (
        <div className="pointer-events-none fixed top-16 inset-x-0 z-20 flex justify-center px-4">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/90 text-slate-950 text-xs font-extrabold shadow-lg">
            <Hand className="w-4 h-4 shrink-0" />
            <span>ドアを指で左右にスライド！（半ドアで自動引き込み）</span>
          </div>
        </div>
      )}

      {/* ===================== BOTTOM SMARTPHONE CONTROL DOCK ===================== */}
      <footer className="pointer-events-none fixed bottom-0 inset-x-0 z-20 safe-bottom px-2.5 pb-2 flex flex-col gap-2">
        {/* Camera Angle Preset Strip */}
        <div className="pointer-events-auto flex items-center justify-center gap-1.5">
          <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-slate-950/72 backdrop-blur-md border border-white/15 shadow-lg">
            <Camera className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5 shrink-0" />
            {CAMERA_TABS.map((cam) => {
              const active = cameraPreset === cam.id;
              return (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => setCameraPreset(cam.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 ${
                    active
                      ? 'bg-sky-500 text-white shadow'
                      : 'text-slate-300 hover:text-white active:bg-white/10'
                  }`}
                >
                  {cam.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Tactile Car Control Panel */}
        <div className="pointer-events-auto">
          {dockTab === 'key' && <SmartKeyFob />}
          {dockTab === 'cockpit' && <CockpitSwitchPanel />}
          {dockTab === 'gimmicks' && (
            <div className="w-full max-w-md mx-auto bg-slate-900/92 backdrop-blur-md border border-slate-700 rounded-3xl p-2.5 shadow-xl space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {/* Anti-Pinch Bear Obstacle Toggle */}
                <button
                  type="button"
                  onClick={toggleObstacle}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs font-bold transition active:scale-95 ${
                    obstaclePlaced
                      ? 'bg-rose-500/25 border-rose-400 text-rose-100'
                      : 'bg-slate-800 border-slate-700 text-slate-200'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{obstaclePlaced ? '挟み込みテスト ON' : '挟み込みテスト'}</span>
                </button>

                {/* Power Side Step Toggle */}
                <button
                  type="button"
                  onClick={() => setPowerStepEnabled(!powerStepEnabled)}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs font-bold transition active:scale-95 ${
                    powerStepEnabled
                      ? 'bg-sky-500/25 border-sky-400 text-sky-100'
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  <Eye className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>電動ステップ {powerStepEnabled ? 'ON' : 'OFF'}</span>
                </button>
              </div>

              {/* Quick Body Color Swatches */}
              <div className="flex items-center justify-between gap-1.5 px-1 pt-0.5">
                {BODY_COLORS.map((c) => {
                  const selected = c.id === bodyColorId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setBodyColorId(c.id)}
                      aria-label={c.name}
                      className={`w-8 h-8 rounded-full overflow-hidden flex flex-col border-2 transition active:scale-90 ${
                        selected ? 'border-sky-400 scale-110 shadow-[0_0_10px_#38bdf8]' : 'border-white/30'
                      }`}
                    >
                      <span className="w-full h-1/3" style={{ backgroundColor: c.roofHex }} />
                      <span className="w-full h-2/3" style={{ backgroundColor: c.hex }} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Compact Mode Switcher Tabs (Smart Key / Cockpit Switch / Gimmicks) */}
        <div className="pointer-events-auto flex justify-center">
          <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-slate-950/80 backdrop-blur-md border border-white/12">
            {(
              [
                { id: 'key', label: 'スマートキー', icon: KeyRound },
                { id: 'cockpit', label: '運転席スイッチ', icon: SlidersHorizontal },
                { id: 'gimmicks', label: 'ギミック・色', icon: Sparkles },
              ] as { id: DockTab; label: string; icon: typeof KeyRound }[]
            ).map((tab) => {
              const Icon = tab.icon;
              const active = dockTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDockTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition ${
                    active
                      ? 'bg-white/18 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </footer>

      <ParentSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
