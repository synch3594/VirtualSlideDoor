import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Eye,
  Hand,
  KeyRound,
  Moon,
  PanelRightClose,
  PanelRightOpen,
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
import { useViewportLayout } from '../hooks/useViewportLayout';
import { SlideDoorIcon, SmartKeyFob } from './SmartKeyFob';
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
  const [dockTab, setDockTab] = useState<DockTab>('cockpit');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const layout = useViewportLayout();

  const phase = useDoorStore((s) => s.phase);
  const lastEventLabel = useDoorStore((s) => s.lastEventLabel);
  const cameraPreset = useDoorStore((s) => s.cameraPreset);
  const timeOfDay = useDoorStore((s) => s.timeOfDay);
  const muted = useDoorStore((s) => s.muted);
  const powerMainOn = useDoorStore((s) => s.powerMainOn);
  const obstaclePlaced = useDoorStore((s) => s.obstaclePlaced);
  const powerStepEnabled = useDoorStore((s) => s.powerStepEnabled);
  const bodyColorId = useDoorStore((s) => s.bodyColorId);
  const dockCollapsed = useDoorStore((s) => s.dockCollapsed);

  const setCameraPreset = useDoorStore((s) => s.setCameraPreset);
  const setTimeOfDay = useDoorStore((s) => s.setTimeOfDay);
  const toggleMuted = useDoorStore((s) => s.toggleMuted);
  const toggleObstacle = useDoorStore((s) => s.toggleObstacle);
  const setPowerStepEnabled = useDoorStore((s) => s.setPowerStepEnabled);
  const setBodyColorId = useDoorStore((s) => s.setBodyColorId);
  const toggleDockCollapsed = useDoorStore((s) => s.toggleDockCollapsed);
  const triggerDoorToggle = useDoorStore((s) => s.triggerDoorToggle);

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

  const quickActionLabel = !powerMainOn
    ? '手動'
    : isMoving
      ? 'とめる'
      : phase === 'OPEN'
        ? 'しめる'
        : phase === 'CLOSED'
          ? 'あける'
          : 'うごかす';

  const quickActionTone = !powerMainOn
    ? 'bg-slate-900/85 border-slate-600 text-slate-300'
    : isClosing
      ? 'bg-amber-600/90 border-amber-300 text-white shadow-amber-500/30'
      : isMoving
        ? 'bg-sky-600/90 border-sky-300 text-white shadow-sky-500/30'
        : phase === 'OPEN'
          ? 'bg-gradient-to-b from-sky-500 to-blue-600 border-sky-300 text-white shadow-sky-500/35'
          : 'bg-gradient-to-b from-emerald-500 to-teal-600 border-emerald-300 text-white shadow-emerald-500/35';

  const statusTone = isAlert
    ? 'bg-rose-950/85 border-rose-400/80 text-rose-100'
    : isEasyCloser
      ? 'bg-indigo-950/85 border-indigo-400/80 text-indigo-100'
      : 'bg-slate-950/70 border-white/15 text-white';

  const statusDotTone = isAlert
    ? 'bg-rose-400 animate-ping'
    : isEasyCloser
      ? 'bg-indigo-400 animate-pulse'
      : phase === 'CLOSED'
        ? 'bg-emerald-400'
        : phase === 'OPEN'
          ? 'bg-sky-400'
          : 'bg-amber-400 animate-pulse';

  /* ============================================================================
   * COMPACT LANDSCAPE MODE (Smartphone Horizontal)
   * Keeps the entire left/center height open for the 3D minivan while docking
   * thumb-friendly controls along the right edge (and collapsible to full view).
   * ============================================================================ */
  if (layout.isCompactLandscape) {
    return (
      <>
        {/* Top-Left Minimal Status Pill (+ compact manual hint below if Power OFF) */}
        <header
          className="pointer-events-none fixed top-0 left-0 z-20 safe-top safe-left px-2.5 pt-1.5 flex flex-col items-start gap-1"
          style={{
            maxWidth: dockCollapsed
              ? 'calc(100vw - 190px)'
              : `calc(100vw - ${layout.sideDockWidth + 24}px)`,
          }}
        >
          <div
            className={`pointer-events-auto flex flex-col gap-1 px-2.5 py-1 rounded-xl backdrop-blur-md border shadow-lg transition-colors max-w-full ${statusTone}`}
          >
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotTone}`} />
              <span className="text-[11px] font-bold truncate">{lastEventLabel}</span>
            </div>
            <div className="w-full min-w-[96px] h-1 bg-white/15 rounded-full overflow-hidden">
              <div
                ref={progressBarRef}
                className="h-full bg-gradient-to-r from-emerald-400 via-sky-400 to-blue-400 rounded-full"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {!powerMainOn && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/90 text-slate-950 text-[10px] font-extrabold shadow-lg">
              <Hand className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">ドアを指で左右にスライド！</span>
            </div>
          )}
        </header>

        {/* Bottom-Left Slim Camera Angle Preset Strip */}
        <div className="pointer-events-none fixed bottom-0 left-0 z-20 safe-bottom safe-left px-2.5 pb-1.5">
          <div className="pointer-events-auto inline-flex items-center gap-0.5 p-0.5 rounded-xl bg-slate-950/72 backdrop-blur-md border border-white/15 shadow-lg">
            <Camera className="w-3 h-3 text-slate-400 ml-1.5 mr-0.5 shrink-0" />
            {CAMERA_TABS.map((cam) => {
              const active = cameraPreset === cam.id;
              return (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => setCameraPreset(cam.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition active:scale-95 ${
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

        {/* Right Side Control Dock (Expanded) OR Compact Floating Corner Actions (Collapsed) */}
        {!dockCollapsed ? (
          <aside className="pointer-events-none fixed top-0 right-0 bottom-0 z-20 safe-top safe-bottom safe-right py-1.5 pr-1.5 flex">
            <div
              className="pointer-events-auto h-full flex flex-col gap-1.5 rounded-2xl bg-slate-950/78 backdrop-blur-md border border-white/14 p-1.5 shadow-2xl"
              style={{ width: layout.sideDockWidth }}
            >
              {/* Top Utility Row inside Side Dock */}
              <div className="grid grid-cols-4 gap-1 shrink-0">
                <button
                  type="button"
                  onClick={cycleTimeOfDay}
                  aria-label="時間帯を切替"
                  className="h-8 rounded-xl bg-white/8 hover:bg-white/14 border border-white/10 flex items-center justify-center text-amber-300 active:scale-95 transition"
                >
                  <TimeIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={toggleMuted}
                  aria-label="音量ミュート切替"
                  className="h-8 rounded-xl bg-white/8 hover:bg-white/14 border border-white/10 flex items-center justify-center active:scale-95 transition"
                >
                  {muted ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-sky-300" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  aria-label="設定を開く"
                  className="h-8 rounded-xl bg-white/8 hover:bg-white/14 border border-white/10 flex items-center justify-center text-slate-200 active:scale-95 transition"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={toggleDockCollapsed}
                  aria-label="操作パネルをしまう"
                  title="操作パネルをしまう"
                  className="h-8 rounded-xl bg-white/8 hover:bg-white/14 border border-white/10 flex items-center justify-center text-slate-200 active:scale-95 transition"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>

              {/* Compact Mode Switcher Tabs */}
              <div className="grid grid-cols-3 gap-0.5 p-0.5 rounded-xl bg-white/6 border border-white/8 shrink-0">
                {(
                  [
                    { id: 'key', label: 'キー', icon: KeyRound },
                    { id: 'cockpit', label: '運転席', icon: SlidersHorizontal },
                    { id: 'gimmicks', label: '色・他', icon: Sparkles },
                  ] as { id: DockTab; label: string; icon: typeof KeyRound }[]
                ).map((tab) => {
                  const Icon = tab.icon;
                  const active = dockTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setDockTab(tab.id)}
                      className={`flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-bold transition ${
                        active ? 'bg-white/18 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Icon className="w-3 h-3 shrink-0" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Active Control Panel */}
              <div className="flex-1 min-h-0 flex flex-col justify-center overflow-y-auto">
                {dockTab === 'key' && <SmartKeyFob layout="side" />}
                {dockTab === 'cockpit' && <CockpitSwitchPanel layout="side" />}
                {dockTab === 'gimmicks' && (
                  <div className="flex flex-col gap-1.5 w-full">
                    <button
                      type="button"
                      onClick={toggleObstacle}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border text-[11px] font-bold transition active:scale-95 ${
                        obstaclePlaced
                          ? 'bg-rose-500/25 border-rose-400 text-rose-100'
                          : 'bg-slate-800/90 border-slate-700 text-slate-200'
                      }`}
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>{obstaclePlaced ? '挟み込みテスト ON' : '挟み込みテスト'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPowerStepEnabled(!powerStepEnabled)}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border text-[11px] font-bold transition active:scale-95 ${
                        powerStepEnabled
                          ? 'bg-sky-500/25 border-sky-400 text-sky-100'
                          : 'bg-slate-800/90 border-slate-700 text-slate-300'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span>電動ステップ {powerStepEnabled ? 'ON' : 'OFF'}</span>
                    </button>

                    <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                      {BODY_COLORS.map((c) => {
                        const selected = c.id === bodyColorId;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setBodyColorId(c.id)}
                            aria-label={c.name}
                            className={`w-7 h-7 rounded-full overflow-hidden flex flex-col border-2 transition active:scale-90 ${
                              selected
                                ? 'border-sky-400 scale-110 shadow-[0_0_8px_#38bdf8]'
                                : 'border-white/30'
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
            </div>
          </aside>
        ) : (
          <>
            {/* Top-Right Compact Utilities + Expand Dock Button */}
            <div className="pointer-events-none fixed top-0 right-0 z-20 safe-top safe-right px-2.5 pt-1.5">
              <div className="pointer-events-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={cycleTimeOfDay}
                  aria-label="時間帯を切替"
                  className="w-8 h-8 rounded-xl bg-slate-950/70 backdrop-blur-md border border-white/15 flex items-center justify-center text-amber-300 active:scale-95 shadow-lg"
                >
                  <TimeIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={toggleMuted}
                  aria-label="音量ミュート切替"
                  className="w-8 h-8 rounded-xl bg-slate-950/70 backdrop-blur-md border border-white/15 flex items-center justify-center active:scale-95 shadow-lg"
                >
                  {muted ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-sky-300" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  aria-label="設定を開く"
                  className="w-8 h-8 rounded-xl bg-slate-950/70 backdrop-blur-md border border-white/15 flex items-center justify-center text-slate-200 active:scale-95 shadow-lg"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={toggleDockCollapsed}
                  aria-label="操作パネルを開く"
                  className="h-8 px-2.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-sky-400/50 flex items-center gap-1 text-sky-200 text-[11px] font-bold active:scale-95 shadow-lg"
                >
                  <PanelRightOpen className="w-3.5 h-3.5" />
                  <span>操作</span>
                </button>
              </div>
            </div>

            {/* Bottom-Right Floating One-Tap Slide Door Action Pill */}
            <div className="pointer-events-none fixed bottom-0 right-0 z-20 safe-bottom safe-right px-2.5 pb-1.5">
              <button
                type="button"
                onClick={() => triggerDoorToggle('smart_key')}
                className={`pointer-events-auto flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border-2 shadow-xl active:scale-95 transition ${quickActionTone}`}
              >
                <SlideDoorIcon className="w-8 h-5" />
                <span className="text-xs font-extrabold tracking-wide">{quickActionLabel}</span>
              </button>
            </div>
          </>
        )}

        <ParentSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </>
    );
  }

  /* ============================================================================
   * STANDARD MODE (Smartphone Portrait, Tablet, Desktop)
   * ============================================================================ */
  return (
    <>
      {/* ===================== TOP FLOATING STATUS & QUICK CONTROLS ===================== */}
      <header className="pointer-events-none fixed top-0 inset-x-0 z-20 safe-top safe-left safe-right px-3 pt-2 flex items-start justify-between gap-2">
        {/* Live Door Status Pill */}
        <div
          className={`pointer-events-auto flex flex-col gap-1 px-3 py-1.5 rounded-2xl backdrop-blur-md border shadow-lg transition-colors max-w-[62%] ${statusTone}`}
        >
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${statusDotTone}`} />
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
      <footer className="pointer-events-none fixed bottom-0 inset-x-0 z-20 safe-bottom safe-left safe-right px-2.5 pb-2 flex flex-col gap-2">
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

        {/* Active Tactile Car Control Panel (Collapsible) */}
        {!dockCollapsed && (
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
                          selected
                            ? 'border-sky-400 scale-110 shadow-[0_0_10px_#38bdf8]'
                            : 'border-white/30'
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
        )}

        {/* Bottom Mode Switcher Tabs OR Collapsed Quick Bar */}
        <div className="pointer-events-auto flex justify-center">
          {!dockCollapsed ? (
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
                      active ? 'bg-white/18 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={toggleDockCollapsed}
                aria-label="操作パネルをしまう"
                title="操作パネルをしまう"
                className="flex items-center justify-center w-7 h-7 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 p-1 rounded-2xl bg-slate-950/80 backdrop-blur-md border border-white/15 shadow-lg">
              <button
                type="button"
                onClick={() => triggerDoorToggle('smart_key')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-extrabold transition active:scale-95 ${quickActionTone}`}
              >
                <SlideDoorIcon className="w-7 h-4" />
                <span>{quickActionLabel}</span>
              </button>
              <button
                type="button"
                onClick={toggleDockCollapsed}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/16 text-slate-100 text-xs font-bold transition active:scale-95"
              >
                <ChevronUp className="w-4 h-4 text-sky-300" />
                <span>パネルを開く</span>
              </button>
            </div>
          )}
        </div>
      </footer>

      <ParentSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
