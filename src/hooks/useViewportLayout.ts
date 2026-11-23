import { useEffect, useState } from 'react';

export interface ViewportLayout {
  width: number;
  height: number;
  isPortrait: boolean;
  /** Smartphone / short landscape screen where a bottom dock would cover the vehicle */
  isCompactLandscape: boolean;
  /** Very short landscape viewport (e.g. small phones or tall mobile browser chrome) */
  isUltraShort: boolean;
  /** Width of the right-hand side dock in compact landscape mode (px) */
  sideDockWidth: number;
}

export function getViewportLayout(width: number, height: number): ViewportLayout {
  const safeW = Math.max(1, width);
  const safeH = Math.max(1, height);
  const isPortrait = safeH > safeW;
  const isCompactLandscape = !isPortrait && safeH <= 540;
  const isUltraShort = !isPortrait && safeH <= 360;
  const sideDockWidth = safeW < 720 ? 196 : 214;

  return {
    width: safeW,
    height: safeH,
    isPortrait,
    isCompactLandscape,
    isUltraShort,
    sideDockWidth,
  };
}

function readViewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') {
    return { width: 390, height: 844 };
  }
  const vv = window.visualViewport;
  return {
    width: Math.round(vv?.width ?? window.innerWidth),
    height: Math.round(vv?.height ?? window.innerHeight),
  };
}

export function useViewportLayout(): ViewportLayout {
  const [layout, setLayout] = useState<ViewportLayout>(() => {
    const { width, height } = readViewportSize();
    return getViewportLayout(width, height);
  });

  useEffect(() => {
    const update = () => {
      const { width, height } = readViewportSize();
      setLayout((prev) =>
        prev.width === width && prev.height === height ? prev : getViewportLayout(width, height)
      );
    };

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.visualViewport?.addEventListener('resize', update);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  return layout;
}
