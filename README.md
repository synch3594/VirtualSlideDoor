# リアル スライドドア（Virtual Slide Door）

ミニバン（日産 セレナ系テイスト）のパワースライドドアを**ただ開け閉めするだけ**を、現実に忠実に楽しめる3D Webアプリです。  
スライドドアが大好きな子どもがスマートフォンで直感的に遊べるよう、物理軌道・機構・音・光・操作スイッチのリアルさを追求しています。

詳細な要件・設計方針については [DESIGN.md](./DESIGN.md) を参照してください。

---

## 主な機能

- **実車に忠実な3次元物理軌道＆ローラー機構**
  - ツライチ状態からの**ポップアウト（せり出し）→ 平行スライド → 引き込みカーブ → 半ドア（カチッ）→ イージークローザー（自動引き込み）**を再現。
  - ボディ側面のセンターレール溝を走るローラーキャリッジと上下3点のローラーアームがリアルタイム連動。
- **Web Audio API によるリアルタイム音響合成**
  - 警告ブザー（開始「ピピッ」／閉動作「ピッ・ピッ…」／挟み込み反転「ピーッピーッピーッ！」／アンサーバック）。
  - ドア速度に応じてピッチが変化するDCモーター駆動音・レール走行音、ラッチ解除音、高トルクのイージークローザー音、ハザードリレー音。
  - ブザー音色は「セレナ風 電子ブザー」「やわらかチャイム」の2種類を切替可能。
- **実車さながらの多彩な操作インターフェース**
  - **車体への直接タッチ**: アウタークロームハンドル＆ワンタッチ黒スイッチ、足元キックセンサー、車内Bピラーボタン・インナーハンドル、閉動作中のドア前端エッジ（挟み込み検知）。
  - **スマートキーUI**: 施錠／解錠（ハザード・アンサーバック連動）、大型開閉ボタン＋赤色LED、足キックセンサーボタン。
  - **運転席スイッチ**: 開／閉ボタン＋**パワーMAIN ON/OFF**（OFF時は指で直接スライドする手動モードになり、半ドア位置まで閉めるとイージークローザーが作動）。
  - **ギミック＆演出**: ぬいぐるみによる挟み込み防止テスト、電動格納ステップ連動、ルームランプ残光消灯、4視点カメラ切替（斜め前／真横／レールアップ／車内2列目）、昼・夕方・夜切替、7色ボディカラー（2トーンルーフ含む）。
- **スマホ最適化＆PWA対応**
  - 縦持ち・横持ち両対応、誤ズーム・テキスト選択防止、ホーム画面追加によるフルスクリーン・オフライン動作対応。

---

## 技術スタック

- **Frontend**: React 19 / TypeScript / Vite 6 / Tailwind CSS 4
- **3D Graphics**: Three.js / `@react-three/fiber` / `@react-three/drei`
- **State Management**: Zustand
- **Audio**: Web Audio API（完全クライアントサイド合成・外部音声ファイル不要）
- **PWA**: `vite-plugin-pwa`

---

## 動作要件

- Node.js 20 以上（動作確認済み: Node.js v22 / npm 10）
- WebGL・Web Audio API 対応モダンブラウザ（iOS Safari / Android Chrome / デスクトップブラウザ）

---

## セットアップ・実行方法

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 開発サーバーの起動

```bash
npm run dev
```

起動後、ブラウザで `http://localhost:5173/` にアクセスします。

> **スマホからアクセスする場合**  
> `vite.config.ts` で `server.host: true` が有効になっています。PCと同じWi-Fiに接続したスマホのブラウザから `http://<PCのローカルIPアドレス>:5173/` にアクセスするとそのまま遊べます（例: `http://192.168.1.10:5173/`）。

### 3. 本番ビルド

```bash
npm run build
```

TypeScript の型チェック（`tsc -b`）後、`dist/` ディレクトリに本番アセットおよび PWA 用 Service Worker（`sw.js`・`manifest.webmanifest`）が生成されます。

### 4. 本番ビルドのローカルプレビュー

```bash
npm run preview
```

---

## ディレクトリ構成

```text
virtual_slide_door/
├── DESIGN.md                        # 要件・技術要素・設計書
├── README.md                        # 本ドキュメント
├── index.html
├── vite.config.ts                   # Vite & PWA 設定
├── public/
│   └── icon.svg                     # アプリ・PWAアイコン
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── index.css
    ├── store/
    │   └── useDoorStore.ts          # 状態管理・60fpsシミュレーションループ
    ├── simulation/
    │   ├── types.ts                 # 状態・カラー・設定の型定義
    │   └── doorKinematics.ts        # ポップアウト＆スライド3次元軌道計算
    ├── audio/
    │   └── DoorAudioEngine.ts       # Web Audio API リアルタイム音響エンジン
    ├── scene/
    │   ├── MinivanScene.tsx         # Three.js Canvas・シーン統合
    │   ├── CameraRig.tsx            # 視点プリセット補間・スマホ縦横FOV調整
    │   ├── EnvironmentRig.tsx       # 昼/夕方/夜ライティング・環境反射・駐車場
    │   └── models/
    │       ├── MinivanBody.tsx      # セレナ系車体・レール溝・ランプ・ホイール
    │       ├── MinivanInterior.tsx  # 2列目シート・Bピラーボタン・ルームランプ
    │       ├── SlidingDoor.tsx      # スライドドア本体・ハンドル・3点ローラーアーム
    │       └── PowerStep.tsx        # 電動格納ステップ・キックセンサー
    └── components/
        ├── HudOverlay.tsx           # 上部ステータス・視点切替・下部ドック
        ├── SmartKeyFob.tsx          # インテリジェントキー風リモコンUI
        ├── CockpitSwitchPanel.tsx   # 運転席スイッチ（MAIN ON/OFF対応）
        └── ParentSettingsModal.tsx  # 保護者向け設定パネル
```
