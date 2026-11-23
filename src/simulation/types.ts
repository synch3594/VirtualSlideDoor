export type DoorPhase =
  | 'CLOSED'
  | 'UNLATCHING'
  | 'OPENING_POPOUT'
  | 'OPENING_SLIDE'
  | 'OPEN'
  | 'CLOSING_SLIDE'
  | 'CLOSING_PULLIN'
  | 'HALF_LATCH_PAUSE'
  | 'EASY_CLOSER'
  | 'PAUSED'
  | 'REVERSING'
  | 'MANUAL';

export type CameraPreset =
  | 'exterior_front34' // デフォルト：外から閉まるのを眺める特等席（斜め前）
  | 'exterior_side'    // 真横：ドア全体のスライドと開口部
  | 'rail_closeup'     // 斜め後ろアップ：センターレール＆ローラーアーム機構
  | 'interior_row2';   // 車内2列目視点：Bピラーボタン・インナーハンドル・外の景色

export type TimeOfDay = 'day' | 'sunset' | 'night';

export type SoundProfile = 'serena' | 'soft';

export type TriggerSource =
  | 'outer_handle'
  | 'outer_button'
  | 'smart_key'
  | 'cockpit_switch'
  | 'b_pillar_button'
  | 'inner_handle'
  | 'kick_sensor'
  | 'manual_drag';

export interface BodyColorOption {
  id: string;
  name: string;
  hex: string;
  roofHex: string; // 2-tone roof or matching roof
  metalness: number;
  roughness: number;
}

export const BODY_COLORS: BodyColorOption[] = [
  {
    id: 'prism-white-2tone',
    name: 'プリズムホワイト (2トーン)',
    hex: '#f1f5f9',
    roofHex: '#0f172a',
    metalness: 0.28,
    roughness: 0.14,
  },
  {
    id: 'prism-white',
    name: 'プリズムホワイト',
    hex: '#f3f6fa',
    roofHex: '#f3f6fa',
    metalness: 0.25,
    roughness: 0.14,
  },
  {
    id: 'diamond-black',
    name: 'ダイヤモンドブラック',
    hex: '#141821',
    roofHex: '#141821',
    metalness: 0.65,
    roughness: 0.16,
  },
  {
    id: 'turquoise-2tone',
    name: 'ターコイズブルー (2トーン)',
    hex: '#0e7490',
    roofHex: '#0f172a',
    metalness: 0.52,
    roughness: 0.18,
  },
  {
    id: 'azurite-blue',
    name: 'アズライトブルー',
    hex: '#1d4ed8',
    roofHex: '#1d4ed8',
    metalness: 0.58,
    roughness: 0.17,
  },
  {
    id: 'dark-metal-gray',
    name: 'ダークメタルグレー',
    hex: '#475569',
    roofHex: '#334155',
    metalness: 0.68,
    roughness: 0.18,
  },
  {
    id: 'cardinal-red-2tone',
    name: 'カーディナルレッド (2トーン)',
    hex: '#b91c1c',
    roofHex: '#0f172a',
    metalness: 0.52,
    roughness: 0.17,
  },
];

export interface DoorPose {
  /** Outward offset (+X in meters, 0 = flush closed, ~0.115 = full pop-out) */
  xOffset: number;
  /** Rearward offset (-Z in meters, 0 = closed, ~-0.86 = full open) */
  zOffset: number;
  /** Subtle yaw angle around Y axis (radians) during pop-out/pull-in */
  yaw: number;
  /** Center roller carrier position along body center rail (world Z) */
  centerRollerZ: number;
  /** Center roller carrier X depth inside body rail channel */
  centerRollerX: number;
}
