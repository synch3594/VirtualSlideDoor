import { useEffect } from 'react';
import { MinivanScene } from './scene/MinivanScene';
import { HudOverlay } from './components/HudOverlay';
import { doorAudio } from './audio/DoorAudioEngine';

export function App() {
  // Ensure mobile Safari / Chrome Web Audio unlocks cleanly on the very first touch
  useEffect(() => {
    const unlock = () => {
      doorAudio.unlock();
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  return (
    <main className="relative w-full h-full overflow-hidden bg-slate-950">
      <div className="absolute inset-0">
        <MinivanScene />
      </div>
      <HudOverlay />
    </main>
  );
}

export default App;
