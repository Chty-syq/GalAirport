import { useState, useEffect } from "react";

/**
 * Analyse a cover image and return an `object-position` value that centres
 * the crop on the character's face region.
 *
 * Strategy:
 *  1. Draw the image to an offscreen canvas at reduced resolution.
 *  2. Score each row by how many pixels match anime skin-tone heuristics.
 *  3. Compute the weighted vertical centre of skin-tone rows.
 *  4. Convert that position to a CSS `object-position` percentage.
 *
 * Falls back to "center 20%" when the signal is too weak (non-character art,
 * pure CG scenes, etc.), which already beats the default "center center" for
 * portrait covers displayed in a landscape container.
 */

const SAMPLE_MAX = 160; // max dimension when downscaling for analysis
const FALLBACK = "center 20%";

function isAnimeSkin(r: number, g: number, b: number): boolean {
  // Warm, light-to-mid tone: R highest, G middle, B lowest
  // Covers pale, normal and slightly tanned anime skin
  return (
    r > 140 &&
    g > 85 &&
    b > 55 &&
    r > g + 10 &&
    g >= b - 15 &&
    // Exclude near-white (bright backgrounds / clothing)
    !(r > 235 && g > 225 && b > 215) &&
    // Exclude near-grey (desaturated regions)
    r - b < 130
  );
}

function analyseImage(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) { resolve(FALLBACK); return; }

        const scale = SAMPLE_MAX / Math.max(w, h);
        const sw = Math.max(1, Math.round(w * scale));
        const sh = Math.max(1, Math.round(h * scale));

        const canvas = document.createElement("canvas");
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) { resolve(FALLBACK); return; }

        ctx.drawImage(img, 0, 0, sw, sh);
        const { data } = ctx.getImageData(0, 0, sw, sh);

        // Per-row skin tone score
        const scores = new Float32Array(sh);
        for (let y = 0; y < sh; y++) {
          let row = 0;
          for (let x = 0; x < sw; x++) {
            const i = (y * sw + x) * 4;
            if (isAnimeSkin(data[i], data[i + 1], data[i + 2])) row++;
          }
          scores[y] = row;
        }

        // Weighted vertical centre of skin-tone pixels
        let totalWeight = 0;
        let weightedY = 0;
        for (let y = 0; y < sh; y++) {
          totalWeight += scores[y];
          weightedY += scores[y] * y;
        }

        // If fewer than 3 % of sampled pixels look like skin, give up
        const minSignal = sw * sh * 0.03;
        if (totalWeight < minSignal) { resolve(FALLBACK); return; }

        const faceCenter = weightedY / totalWeight; // px in downscaled image
        const faceFraction = faceCenter / sh;       // 0 – 1

        // Translate face fraction to object-position percentage.
        // The aspect-video container (16:9) shows ~42 % of a 3:4 portrait.
        // We want the face centre to land near the middle of that slice.
        // Clamping keeps the result sensible for unusual compositions.
        const pct = Math.max(5, Math.min(75, faceFraction * 100));
        resolve(`center ${pct.toFixed(0)}%`);
      } catch {
        resolve(FALLBACK);
      }
    };

    img.onerror = () => resolve(FALLBACK);
    img.src = src;
  });
}

export function useSmartCrop(src: string | undefined): string {
  const [position, setPosition] = useState<string>(FALLBACK);

  useEffect(() => {
    if (!src) {
      setPosition(FALLBACK);
      return;
    }
    analyseImage(src).then(setPosition);
  }, [src]);

  return position;
}
