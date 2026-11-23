import { create } from 'zustand';
import {
  BODY_COLORS,
  type CameraPreset,
  type DoorPhase,
  type SoundProfile,
  type TimeOfDay,
  type TriggerSource,
} from '../simulation/types';
import { DOOR_METRICS } from '../simulation/doorKinematics';
import { doorAudio } from '../audio/DoorAudioEngine';

/**
 * High-frequency mutable simulation state updated inside R3F's 60fps useFrame loop
 * without triggering React re-renders.
 */
export interface LiveSimulationState {
  progress: number; // 0 = closed, 1 = open
  velocity: number; // progress units per second
  elasticBounce: number;
  elasticVelocity: number;
  phaseTimer: number;
  closingBeepTimer: number;

  // Lighting & animation live values
  interiorLight: number; // 0..1 smooth fade + afterglow
  interiorAfterglowTimer: number;
  hazardOn: boolean;
  hazardFlashesRemaining: number;
  hazardTimer: number;
  keyLedTimer: number;

  // Mechanical sub-animations
  outerHandlePull: number; // 0..1
  outerButtonPress: number; // 0..1
  innerHandlePull: number; // 0..1
  powerStepProgress: number; // 0..1
  kickGlowTimer: number;
  antiPinchFlashTimer: number;

  // Manual dragging
  isDragging: boolean;
  dragTargetProgress: number;
}

export const liveSim: LiveSimulationState = {
  // Start slightly open or fully open? Let's start OPEN so the child can IMMEDIATELY watch it close
  // (or start CLOSED? Wait: starting OPEN at 1.0 or CLOSED at 0.0?
  // Starting CLOSED at 0.0 feels like walking up to the parked minivan, and 1 tap opens then 1 tap closes —
  // actually starting OPEN or CLOSED: let's start at CLOSED = 0 so they get the full pop-out + close cycle,
  // OR wait: user said "外から閉まるのを眺めるのが好き" — starting OPEN (1.0) lets them press Close on the VERY FIRST TAP!
  // Let's check: starting OPEN (progress = 1.0) shows off the interior seats, step, open door on the rail immediately,
  // and the very first press triggers the iconic closing sequence! Let's start OPEN!)
  progress: 1.0,
  velocity: 0,
  elasticBounce: 0,
  elasticVelocity: 0,
  phaseTimer: 0,
  closingBeepTimer: 0,

  interiorLight: 1.0,
  interiorAfterglowTimer: 0,
  hazardOn: false,
  hazardFlashesRemaining: 0,
  hazardTimer: 0,
  keyLedTimer: 0,

  outerHandlePull: 0,
  outerButtonPress: 0,
  innerHandlePull: 0,
  powerStepProgress: 1.0,
  kickGlowTimer: 0,
  antiPinchFlashTimer: 0,

  isDragging: false,
  dragTargetProgress: 1.0,
};

interface DoorStore {
  // Discrete UI-observable state
  phase: DoorPhase;
  locked: boolean;
  childLock: boolean;
  powerMainOn: boolean;
  obstaclePlaced: boolean;
  powerStepEnabled: boolean;
  showHotspots: boolean;
  cameraPreset: CameraPreset;
  timeOfDay: TimeOfDay;
  bodyColorId: string;
  soundProfile: SoundProfile;
  volume: number;
  muted: boolean;
  dockCollapsed: boolean;
  lastEventLabel: string;

  // Actions
  triggerDoorToggle: (source: TriggerSource) => void;
  commandOpen: (source: TriggerSource) => void;
  commandClose: (source: TriggerSource) => void;
  triggerAntiPinch: () => void;
  setLocked: (locked: boolean) => void;
  toggleLocked: () => void;
  setChildLock: (enabled: boolean) => void;
  setPowerMainOn: (on: boolean) => void;
  togglePowerMain: () => void;
  toggleObstacle: () => void;
  setPowerStepEnabled: (enabled: boolean) => void;
  setShowHotspots: (show: boolean) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setTimeOfDay: (tod: TimeOfDay) => void;
  setBodyColorId: (id: string) => void;
  setSoundProfile: (profile: SoundProfile) => void;
  setVolume: (v: number) => void;
  toggleMuted: () => void;
  setDockCollapsed: (collapsed: boolean) => void;
  toggleDockCollapsed: () => void;
  beginManualDrag: () => void;
  updateManualDrag: (deltaProgress: number) => void;
  endManualDrag: (releaseVelocity: number) => void;
  stepSimulation: (dt: number) => void;
}

function triggerHazardFlashes(flashes: number): void {
  liveSim.hazardFlashesRemaining = Math.max(liveSim.hazardFlashesRemaining, flashes);
  if (!liveSim.hazardOn && liveSim.hazardTimer <= 0) {
    liveSim.hazardOn = true;
    liveSim.hazardTimer = 0.28;
    doorAudio.playHazardRelay(true);
  }
}

export const useDoorStore = create<DoorStore>((set, get) => ({
  phase: 'OPEN',
  locked: false,
  childLock: false,
  powerMainOn: true,
  obstaclePlaced: false,
  powerStepEnabled: true,
  showHotspots: true,
  cameraPreset: 'exterior_front34',
  timeOfDay: 'day',
  bodyColorId: BODY_COLORS[0].id,
  soundProfile: 'electronic',
  volume: 0.85,
  muted: false,
  dockCollapsed: false,
  lastEventLabel: '全開',

  triggerDoorToggle: (source) => {
    doorAudio.unlock();
    const state = get();

    // Animate visual trigger feedback
    if (source === 'outer_handle') liveSim.outerHandlePull = 1;
    if (source === 'outer_button') liveSim.outerButtonPress = 1;
    if (source === 'inner_handle') liveSim.innerHandlePull = 1;
    if (source === 'smart_key') liveSim.keyLedTimer = 0.45;
    if (source === 'kick_sensor') liveSim.kickGlowTimer = 0.9;

    // Check locks when closed
    if (state.phase === 'CLOSED') {
      if (state.locked && source !== 'smart_key' && source !== 'cockpit_switch') {
        doorAudio.playHandleClick(true);
        doorAudio.playBuzzerReject();
        set({ lastEventLabel: '施錠中（ロック解除してください）' });
        return;
      }
      if (state.childLock && source === 'inner_handle') {
        doorAudio.playHandleClick(true);
        doorAudio.playBuzzerReject();
        set({ lastEventLabel: 'チャイルドロック中' });
        return;
      }
      if (state.locked && (source === 'smart_key' || source === 'cockpit_switch')) {
        // Smart key / cockpit auto-unlocks before opening
        doorAudio.playDoorLockActuator();
        set({ locked: false });
      }
    }

    // If Power MAIN is OFF, only manual drag works (except unlatching feel)
    if (!state.powerMainOn && source !== 'manual_drag') {
      doorAudio.playHandleClick(false);
      if (state.phase === 'CLOSED') {
        // Unlatch slightly so child can drag it open manually!
        doorAudio.playLatchRelease();
        liveSim.progress = 0.06;
        liveSim.velocity = 0.14;
        set({ phase: 'MANUAL', lastEventLabel: '手動モード（指でスライド）' });
      } else {
        set({ lastEventLabel: 'パワーOFF（手動で動かしてね）' });
      }
      return;
    }

    // State machine toggle logic
    const p = state.phase;
    if (p === 'CLOSED') {
      state.commandOpen(source);
    } else if (p === 'OPEN') {
      state.commandClose(source);
    } else if (
      p === 'OPENING_POPOUT' ||
      p === 'OPENING_SLIDE' ||
      p === 'CLOSING_SLIDE' ||
      p === 'CLOSING_PULLIN'
    ) {
      // Mid-travel press -> Pause!
      doorAudio.playBuzzerPause();
      liveSim.velocity = 0;
      set({ phase: 'PAUSED', lastEventLabel: '一時停止' });
    } else if (p === 'PAUSED' || p === 'MANUAL') {
      // From paused/manual, close if more than 35% open, else open
      if (liveSim.progress > 0.35) {
        state.commandClose(source);
      } else {
        state.commandOpen(source);
      }
    } else if (p === 'EASY_CLOSER' || p === 'HALF_LATCH_PAUSE') {
      // Let easy closer finish or abort open
      state.commandOpen(source);
    }
  },

  commandOpen: (source) => {
    doorAudio.unlock();
    const state = get();
    if (!state.powerMainOn) {
      doorAudio.playHandleClick(false);
      set({ lastEventLabel: 'パワーOFF（手動モード）' });
      return;
    }
    if (state.phase === 'OPEN' || state.phase === 'OPENING_SLIDE' || state.phase === 'OPENING_POPOUT') {
      return;
    }
    if (state.locked) {
      doorAudio.playDoorLockActuator();
      set({ locked: false });
    }
    if (source === 'kick_sensor') {
      doorAudio.playKickSensor();
      liveSim.kickGlowTimer = 0.9;
    } else if (source === 'smart_key') {
      liveSim.keyLedTimer = 0.45;
    } else if (source === 'outer_handle') {
      liveSim.outerHandlePull = 1;
      doorAudio.playHandleClick(false);
    } else if (source === 'outer_button') {
      liveSim.outerButtonPress = 1;
      doorAudio.playHandleClick(false);
    }

    doorAudio.playBuzzerStart();
    triggerHazardFlashes(1);

    if (liveSim.progress <= DOOR_METRICS.easyCloserProgress) {
      liveSim.phaseTimer = 0.16;
      doorAudio.playLatchRelease();
      set({ phase: 'UNLATCHING', lastEventLabel: 'ラッチ解除 → 開いています' });
    } else if (liveSim.progress < DOOR_METRICS.popoutEndProgress) {
      set({ phase: 'OPENING_POPOUT', lastEventLabel: 'ポップアウト中' });
    } else {
      set({ phase: 'OPENING_SLIDE', lastEventLabel: 'スライド開動作中' });
    }
  },

  commandClose: (source) => {
    doorAudio.unlock();
    const state = get();
    if (!state.powerMainOn) {
      doorAudio.playHandleClick(false);
      set({ lastEventLabel: 'パワーOFF（手動モード）' });
      return;
    }
    if (
      state.phase === 'CLOSED' ||
      state.phase === 'CLOSING_SLIDE' ||
      state.phase === 'CLOSING_PULLIN' ||
      state.phase === 'EASY_CLOSER'
    ) {
      return;
    }
    if (source === 'kick_sensor') {
      doorAudio.playKickSensor();
      liveSim.kickGlowTimer = 0.9;
    } else if (source === 'smart_key') {
      liveSim.keyLedTimer = 0.45;
    } else if (source === 'outer_handle') {
      liveSim.outerHandlePull = 1;
      doorAudio.playHandleClick(false);
    } else if (source === 'outer_button') {
      liveSim.outerButtonPress = 1;
      doorAudio.playHandleClick(false);
    }

    doorAudio.playBuzzerStart();
    liveSim.closingBeepTimer = 0.56;
    triggerHazardFlashes(2);

    if (liveSim.progress <= DOOR_METRICS.easyCloserProgress) {
      liveSim.phaseTimer = 0.1;
      set({ phase: 'EASY_CLOSER', lastEventLabel: 'イージークローザー作動中' });
    } else if (liveSim.progress <= DOOR_METRICS.popoutEndProgress) {
      set({ phase: 'CLOSING_PULLIN', lastEventLabel: '引き込み中' });
    } else {
      set({ phase: 'CLOSING_SLIDE', lastEventLabel: '閉まっています' });
    }
  },

  triggerAntiPinch: () => {
    doorAudio.unlock();
    const state = get();
    if (
      state.phase === 'CLOSING_SLIDE' ||
      state.phase === 'CLOSING_PULLIN' ||
      state.phase === 'EASY_CLOSER'
    ) {
      doorAudio.playBuzzerAntiPinch();
      triggerHazardFlashes(3);
      liveSim.velocity = 0.05;
      liveSim.phaseTimer = 0.18;
      liveSim.antiPinchFlashTimer = 1.2;
      set({ phase: 'REVERSING', lastEventLabel: '挟み込み検知！反転します' });
    }
  },

  setLocked: (locked) => {
    doorAudio.unlock();
    liveSim.keyLedTimer = 0.4;
    if (locked && get().phase !== 'CLOSED') {
      // Cannot fully lock open sliding door (answer-back reject beep)
      doorAudio.playBuzzerReject();
      set({ lastEventLabel: 'ドアを閉めてからロックしてね' });
      return;
    }
    doorAudio.playDoorLockActuator();
    doorAudio.playAnswerBack(locked ? 1 : 2);
    triggerHazardFlashes(locked ? 1 : 2);
    set({ locked, lastEventLabel: locked ? 'ドアロック（施錠）' : 'ロック解除（解錠）' });
  },

  toggleLocked: () => {
    get().setLocked(!get().locked);
  },

  setChildLock: (enabled) => set({ childLock: enabled }),

  setPowerMainOn: (on) => {
    doorAudio.unlock();
    doorAudio.playHandleClick(false);
    const currentPhase = get().phase;
    if (!on) {
      liveSim.velocity = 0;
      const nextPhase: DoorPhase =
        currentPhase === 'CLOSED' || currentPhase === 'OPEN' ? currentPhase : 'MANUAL';
      set({
        powerMainOn: false,
        phase: nextPhase,
        lastEventLabel: 'パワーOFF（手動スライドモード）',
      });
    } else {
      const nextPhase: DoorPhase =
        liveSim.progress <= 0.002
          ? 'CLOSED'
          : liveSim.progress >= 0.998
            ? 'OPEN'
            : 'PAUSED';
      set({
        powerMainOn: true,
        phase: nextPhase,
        lastEventLabel: 'パワースライドドア ON',
      });
    }
  },

  togglePowerMain: () => get().setPowerMainOn(!get().powerMainOn),

  toggleObstacle: () => {
    doorAudio.unlock();
    const next = !get().obstaclePlaced;
    doorAudio.playHandleClick(false);
    set({
      obstaclePlaced: next,
      lastEventLabel: next ? 'ぬいぐるみ配置（挟み込みテスト）' : 'ぬいぐるみ片付け',
    });
  },

  setPowerStepEnabled: (enabled) => set({ powerStepEnabled: enabled }),
  setShowHotspots: (show) => set({ showHotspots: show }),
  setCameraPreset: (preset) => set({ cameraPreset: preset }),
  setTimeOfDay: (tod) => set({ timeOfDay: tod }),
  setBodyColorId: (id) => set({ bodyColorId: id }),

  setSoundProfile: (profile) => {
    doorAudio.setProfile(profile);
    set({ soundProfile: profile });
  },

  setVolume: (v) => {
    doorAudio.setVolume(v);
    set({ volume: v, muted: v === 0 });
  },

  toggleMuted: () => {
    doorAudio.unlock();
    const next = !get().muted;
    doorAudio.setMuted(next);
    set({ muted: next });
  },

  setDockCollapsed: (collapsed) => set({ dockCollapsed: collapsed }),
  toggleDockCollapsed: () => set((s) => ({ dockCollapsed: !s.dockCollapsed })),

  beginManualDrag: () => {
    doorAudio.unlock();
    const state = get();
    if (state.locked && state.phase === 'CLOSED') {
      doorAudio.playHandleClick(true);
      doorAudio.playBuzzerReject();
      set({ lastEventLabel: '施錠中' });
      return;
    }
    if (state.phase === 'CLOSED') {
      doorAudio.playLatchRelease();
    }
    liveSim.isDragging = true;
    liveSim.dragTargetProgress = liveSim.progress;
    liveSim.velocity = 0;
    set({ phase: 'MANUAL', lastEventLabel: '手動スライド中' });
  },

  updateManualDrag: (deltaProgress) => {
    if (!liveSim.isDragging) return;
    const prev = liveSim.progress;
    let next = Math.max(0, Math.min(1, prev + deltaProgress));

    // If obstacle placed, block manual closing past 0.25
    if (get().obstaclePlaced && next < 0.25 && deltaProgress < 0) {
      next = 0.25;
      liveSim.antiPinchFlashTimer = 0.5;
    }

    liveSim.dragTargetProgress = next;
    liveSim.progress = next;
    liveSim.velocity = deltaProgress * 40; // Instantaneous velocity hint for audio
  },

  endManualDrag: (releaseVelocity) => {
    if (!liveSim.isDragging) return;
    liveSim.isDragging = false;
    liveSim.velocity = Math.max(-1.4, Math.min(1.4, releaseVelocity));

    // If manually pulled close to the body (half-latch zone), trigger Easy Closer!
    if (liveSim.progress <= DOOR_METRICS.easyCloserProgress + 0.035 && liveSim.progress > 0.004) {
      doorAudio.playHalfLatch();
      liveSim.phaseTimer = 0.14;
      liveSim.velocity = 0;
      set({ phase: 'HALF_LATCH_PAUSE', lastEventLabel: '半ドア → イージークローザー' });
    } else if (liveSim.progress <= 0.004) {
      liveSim.progress = 0;
      liveSim.velocity = 0;
      doorAudio.playDoorCloseThud(0.85);
      set({ phase: 'CLOSED', lastEventLabel: '全閉' });
    } else if (liveSim.progress >= 0.995) {
      liveSim.progress = 1;
      liveSim.velocity = 0;
      doorAudio.playStopperThud(0.5);
      set({ phase: 'OPEN', lastEventLabel: '全開' });
    }
  },

  stepSimulation: (rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const state = get();
    let phase = state.phase;
    let nextPhase: DoorPhase = phase;
    let nextLabel: string | null = null;

    const { easyCloserProgress, popoutEndProgress } = DOOR_METRICS;

    // 1. Decay visual sub-animations
    liveSim.outerHandlePull = Math.max(0, liveSim.outerHandlePull - dt * 3.6);
    liveSim.outerButtonPress = Math.max(0, liveSim.outerButtonPress - dt * 5.0);
    liveSim.innerHandlePull = Math.max(0, liveSim.innerHandlePull - dt * 3.6);
    liveSim.keyLedTimer = Math.max(0, liveSim.keyLedTimer - dt);
    liveSim.kickGlowTimer = Math.max(0, liveSim.kickGlowTimer - dt);
    liveSim.antiPinchFlashTimer = Math.max(0, liveSim.antiPinchFlashTimer - dt);

    // 2. Elastic stopper spring-damper settle
    if (Math.abs(liveSim.elasticBounce) > 0.0001 || Math.abs(liveSim.elasticVelocity) > 0.0001) {
      const k = 220;
      const damping = 18;
      const acc = -k * liveSim.elasticBounce - damping * liveSim.elasticVelocity;
      liveSim.elasticVelocity += acc * dt;
      liveSim.elasticBounce += liveSim.elasticVelocity * dt;
      if (Math.abs(liveSim.elasticBounce) < 0.0002 && Math.abs(liveSim.elasticVelocity) < 0.0005) {
        liveSim.elasticBounce = 0;
        liveSim.elasticVelocity = 0;
      }
    }

    // 3. Hazard flash timer (real ~0.34s on / 0.34s off cadence)
    if (liveSim.hazardFlashesRemaining > 0 || liveSim.hazardOn) {
      liveSim.hazardTimer -= dt;
      if (liveSim.hazardTimer <= 0) {
        if (liveSim.hazardOn) {
          liveSim.hazardOn = false;
          liveSim.hazardFlashesRemaining = Math.max(0, liveSim.hazardFlashesRemaining - 1);
          liveSim.hazardTimer = liveSim.hazardFlashesRemaining > 0 ? 0.28 : 0;
          doorAudio.playHazardRelay(false);
        } else if (liveSim.hazardFlashesRemaining > 0) {
          liveSim.hazardOn = true;
          liveSim.hazardTimer = 0.28;
          doorAudio.playHazardRelay(true);
        }
      }
    }

    // 4. Core Door State Machine & Physics
    let isPowerMotor = false;
    let isEasyCloser = false;
    let easyCloserPct = 0;

    if (phase === 'UNLATCHING') {
      liveSim.phaseTimer -= dt;
      if (liveSim.phaseTimer <= 0) {
        nextPhase = 'OPENING_POPOUT';
        nextLabel = 'ポップアウト中';
      }
    } else if (phase === 'OPENING_POPOUT' || phase === 'OPENING_SLIDE') {
      isPowerMotor = true;
      // Realistic minivan power sliding door takes ~3.8 - 4.4s full travel
      // Slower during curved pop-out & final approach to rear stopper
      const nearEnd = Math.max(0, 1 - liveSim.progress);
      const targetSpeed =
        phase === 'OPENING_POPOUT'
          ? 0.21
          : nearEnd < 0.14
            ? 0.08 + (nearEnd / 0.14) * 0.2
            : 0.28;

      const accel = 0.72;
      liveSim.velocity += Math.sign(targetSpeed - liveSim.velocity) * Math.min(Math.abs(targetSpeed - liveSim.velocity), accel * dt);
      liveSim.progress = Math.min(1, liveSim.progress + liveSim.velocity * dt);

      if (phase === 'OPENING_POPOUT' && liveSim.progress >= popoutEndProgress) {
        nextPhase = 'OPENING_SLIDE';
        nextLabel = 'スライド開動作中';
      }

      if (liveSim.progress >= 1) {
        liveSim.progress = 1;
        liveSim.elasticVelocity = -2.2; // Gentle settle against rear stopper
        liveSim.velocity = 0;
        doorAudio.playStopperThud(0.45);
        nextPhase = 'OPEN';
        nextLabel = '全開';
      }
    } else if (phase === 'CLOSING_SLIDE' || phase === 'CLOSING_PULLIN') {
      isPowerMotor = true;

      // Iconic closing warning beep cadence ("ピッ…ピッ…ピッ…")
      liveSim.closingBeepTimer -= dt;
      if (liveSim.closingBeepTimer <= 0) {
        doorAudio.playBuzzerClosingStep();
        liveSim.closingBeepTimer = 0.62;
      }

      // Check obstacle anti-pinch trigger (~24% open near doorway edge)
      if (state.obstaclePlaced && liveSim.progress <= 0.26 && liveSim.progress >= 0.16) {
        doorAudio.playBuzzerAntiPinch();
        triggerHazardFlashes(3);
        liveSim.velocity = 0;
        liveSim.phaseTimer = 0.18;
        liveSim.antiPinchFlashTimer = 1.4;
        nextPhase = 'REVERSING';
        nextLabel = '挟み込み検知！反転します';
      } else {
        // Smoother, slightly more deliberate closing speed so watching from outside feels super real!
        const distToHalfLatch = Math.max(0, liveSim.progress - easyCloserProgress);
        const targetSpeed =
          phase === 'CLOSING_PULLIN'
            ? -(0.095 + Math.min(1, distToHalfLatch / 0.14) * 0.125)
            : -0.255;

        const accel = 0.65;
        liveSim.velocity +=
          Math.sign(targetSpeed - liveSim.velocity) *
          Math.min(Math.abs(targetSpeed - liveSim.velocity), accel * dt);
        liveSim.progress = Math.max(easyCloserProgress, liveSim.progress + liveSim.velocity * dt);

        if (phase === 'CLOSING_SLIDE' && liveSim.progress <= popoutEndProgress) {
          nextPhase = 'CLOSING_PULLIN';
          nextLabel = '引き込み中…';
        }

        if (liveSim.progress <= easyCloserProgress + 0.001) {
          liveSim.progress = easyCloserProgress;
          liveSim.velocity = 0;
          liveSim.phaseTimer = 0.14; // Brief authentic half-latch beat before closer pulls in!
          doorAudio.playHalfLatch();
          nextPhase = 'HALF_LATCH_PAUSE';
          nextLabel = '半ドア → イージークローザー';
        }
      }
    } else if (phase === 'HALF_LATCH_PAUSE') {
      liveSim.phaseTimer -= dt;
      if (liveSim.phaseTimer <= 0) {
        nextPhase = 'EASY_CLOSER';
        nextLabel = 'イージークローザー引き込み中';
      }
    } else if (phase === 'EASY_CLOSER') {
      isEasyCloser = true;
      // High-torque smooth pull-in over ~0.68 seconds!
      const pullSpeed = easyCloserProgress / 0.68;
      liveSim.velocity = -pullSpeed;
      liveSim.progress = Math.max(0, liveSim.progress - pullSpeed * dt);
      easyCloserPct = 1 - liveSim.progress / easyCloserProgress;

      if (liveSim.progress <= 0.0005) {
        liveSim.progress = 0;
        liveSim.velocity = 0;
        liveSim.elasticVelocity = 1.6; // Tiny flush seal compression rebound
        liveSim.interiorAfterglowTimer = 2.6; // Keep dome light softly glowing for 2.6s!
        doorAudio.playDoorCloseThud(0.72);
        nextPhase = 'CLOSED';
        nextLabel = '全閉（イージークローザー完了）';
      }
    } else if (phase === 'REVERSING') {
      liveSim.phaseTimer -= dt;
      if (liveSim.phaseTimer <= 0) {
        nextPhase = 'OPENING_SLIDE';
        nextLabel = '安全のため開いています';
      }
    } else if (phase === 'MANUAL') {
      if (!liveSim.isDragging) {
        // Free-rolling inertia + rail friction
        if (Math.abs(liveSim.velocity) > 0.004) {
          const friction = 1.85;
          const sign = Math.sign(liveSim.velocity);
          liveSim.velocity = sign * Math.max(0, Math.abs(liveSim.velocity) - friction * dt);
          const nextP = liveSim.progress + liveSim.velocity * dt;

          if (state.obstaclePlaced && nextP < 0.25 && liveSim.velocity < 0) {
            liveSim.progress = 0.25;
            liveSim.velocity = 0.18;
            liveSim.antiPinchFlashTimer = 0.7;
            doorAudio.playStopperThud(0.4);
          } else if (nextP <= 0) {
            const impactSpeed = Math.abs(liveSim.velocity);
            liveSim.progress = 0;
            liveSim.velocity = 0;
            liveSim.elasticVelocity = Math.min(4, impactSpeed * 3.5);
            liveSim.interiorAfterglowTimer = 2.2;
            doorAudio.playDoorCloseThud(Math.min(1.2, 0.55 + impactSpeed * 0.7));
            nextPhase = 'CLOSED';
            nextLabel = '全閉（手動）';
          } else if (nextP >= 1) {
            const impactSpeed = Math.abs(liveSim.velocity);
            liveSim.progress = 1;
            liveSim.velocity = 0;
            liveSim.elasticVelocity = -Math.min(3.5, impactSpeed * 3);
            doorAudio.playStopperThud(Math.min(0.9, 0.3 + impactSpeed * 0.6));
            nextPhase = 'OPEN';
            nextLabel = '全開（手動）';
          } else {
            liveSim.progress = nextP;
            // Slow glide into half-latch zone triggers Easy Closer!
            if (
              liveSim.velocity < 0 &&
              Math.abs(liveSim.velocity) < 0.42 &&
              liveSim.progress <= easyCloserProgress + 0.012
            ) {
              liveSim.progress = easyCloserProgress;
              liveSim.velocity = 0;
              liveSim.phaseTimer = 0.13;
              doorAudio.playHalfLatch();
              nextPhase = 'HALF_LATCH_PAUSE';
              nextLabel = '半ドア → イージークローザー';
            }
          }
        } else {
          liveSim.velocity = 0;
        }
      }
    }

    // 5. Interior dome light & welcome lamp (smooth theater dimming + afterglow!)
    const doorIsAjar = liveSim.progress > 0.025;
    if (doorIsAjar) {
      liveSim.interiorLight = Math.min(1, liveSim.interiorLight + dt * 2.6);
      liveSim.interiorAfterglowTimer = 2.4;
    } else if (liveSim.interiorAfterglowTimer > 0) {
      liveSim.interiorAfterglowTimer -= dt;
      // Stay gently lit during afterglow
    } else {
      liveSim.interiorLight = Math.max(0, liveSim.interiorLight - dt * 0.75);
    }

    // 6. Electric power step synced with door opening
    const stepTarget = state.powerStepEnabled && liveSim.progress > 0.055 ? 1 : 0;
    const stepSpeed = 2.4;
    if (liveSim.powerStepProgress < stepTarget) {
      liveSim.powerStepProgress = Math.min(stepTarget, liveSim.powerStepProgress + stepSpeed * dt);
    } else if (liveSim.powerStepProgress > stepTarget) {
      liveSim.powerStepProgress = Math.max(stepTarget, liveSim.powerStepProgress - stepSpeed * dt);
    }

    // 7. Update continuous Web Audio synthesizer
    const normSpeed = Math.min(1.5, Math.abs(liveSim.velocity) / 0.28);
    doorAudio.updateContinuous(normSpeed, isPowerMotor, isEasyCloser, easyCloserPct);

    // 8. Commit discrete phase changes to React store only when changed
    if (nextPhase !== phase) {
      set({
        phase: nextPhase,
        ...(nextLabel ? { lastEventLabel: nextLabel } : {}),
      });
    }
  },
}));
