import { X, Volume2, VolumeX, Sun, Sunset, Moon } from 'lucide-react';
import { BODY_COLORS, type SoundProfile, type TimeOfDay } from '../simulation/types';
import { useDoorStore } from '../store/useDoorStore';

interface ParentSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ParentSettingsModal({ open, onClose }: ParentSettingsModalProps) {
  const volume = useDoorStore((s) => s.volume);
  const muted = useDoorStore((s) => s.muted);
  const soundProfile = useDoorStore((s) => s.soundProfile);
  const bodyColorId = useDoorStore((s) => s.bodyColorId);
  const timeOfDay = useDoorStore((s) => s.timeOfDay);
  const powerStepEnabled = useDoorStore((s) => s.powerStepEnabled);
  const childLock = useDoorStore((s) => s.childLock);
  const showHotspots = useDoorStore((s) => s.showHotspots);

  const setVolume = useDoorStore((s) => s.setVolume);
  const toggleMuted = useDoorStore((s) => s.toggleMuted);
  const setSoundProfile = useDoorStore((s) => s.setSoundProfile);
  const setBodyColorId = useDoorStore((s) => s.setBodyColorId);
  const setTimeOfDay = useDoorStore((s) => s.setTimeOfDay);
  const setPowerStepEnabled = useDoorStore((s) => s.setPowerStepEnabled);
  const setChildLock = useDoorStore((s) => s.setChildLock);
  const setShowHotspots = useDoorStore((s) => s.setShowHotspots);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm p-3"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[85dvh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-3xl p-5 shadow-2xl text-slate-100 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">せってい（保護者向け）</h2>
            <p className="text-xs text-slate-400">カラー・音・時間帯・ギミックをカスタマイズ</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center active:scale-95"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Volume */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>音量</span>
            <span>{muted ? '消音中' : `${Math.round(volume * 100)}%`}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleMuted}
              className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200"
            >
              {muted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-sky-400" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="flex-1 accent-sky-400 h-2"
            />
          </div>
        </div>

        {/* Sound Profile */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-300">ブザー音色</span>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: 'serena', label: 'セレナ風 電子ブザー' },
                { id: 'soft', label: 'やわらかチャイム' },
              ] as { id: SoundProfile; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSoundProfile(opt.id)}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition ${
                  soundProfile === opt.id
                    ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Time of Day */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-300">時間帯・ライト</span>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'day', label: 'ひる', icon: Sun },
                { id: 'sunset', label: 'ゆうがた', icon: Sunset },
                { id: 'night', label: 'よる', icon: Moon },
              ] as { id: TimeOfDay; label: string; icon: typeof Sun }[]
            ).map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTimeOfDay(opt.id)}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition ${
                    timeOfDay === opt.id
                      ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Body Color */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-300">ボディカラー</span>
          <div className="grid grid-cols-2 gap-2">
            {BODY_COLORS.map((c) => {
              const active = c.id === bodyColorId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setBodyColorId(c.id)}
                  className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition ${
                    active
                      ? 'bg-sky-500/20 border-sky-400 text-white'
                      : 'bg-slate-800/70 border-slate-700 text-slate-300'
                  }`}
                >
                  <span
                    className="w-7 h-7 rounded-full border border-white/30 shrink-0 overflow-hidden flex flex-col"
                  >
                    <span className="w-full h-1/3" style={{ backgroundColor: c.roofHex }} />
                    <span className="w-full h-2/3" style={{ backgroundColor: c.hex }} />
                  </span>
                  <span className="text-[11px] font-semibold leading-tight">{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Realism Feature Toggles */}
        <div className="space-y-2.5 pt-1 border-t border-slate-800">
          {[
            {
              label: '電動格納ステップ（ドア連動）',
              checked: powerStepEnabled,
              onChange: () => setPowerStepEnabled(!powerStepEnabled),
            },
            {
              label: 'チャイルドロック（車内ハンドル無効）',
              checked: childLock,
              onChange: () => setChildLock(!childLock),
            },
            {
              label: 'タップできる場所のガイド表示',
              checked: showHotspots,
              onChange: () => setShowHotspots(!showHotspots),
            },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onChange}
              className="w-full flex items-center justify-between py-2 px-3 rounded-xl bg-slate-800/70 border border-slate-700/80"
            >
              <span className="text-xs font-medium text-slate-200">{item.label}</span>
              <span
                className={`w-11 h-6 rounded-full p-0.5 transition-colors flex items-center ${
                  item.checked ? 'bg-sky-500 justify-end' : 'bg-slate-600 justify-start'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-white shadow" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
