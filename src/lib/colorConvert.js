// Copyright (c) 2011-2016, Heather Arthur and Josh Junon
// https://github.com/Qix-/color-convert/blob/master/conversions.js
export function rgbToHSL(rgb) {
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  const delta = max - min;
  let h;
  let s;

  if (max === min) {
    h = 0;
  } else if (r === max) {
    h = (g - b) / delta;
  } else if (g === max) {
    h = 2 + (b - r) / delta;
  } else if (b === max) {
    h = 4 + (r - g) / delta;
  }

  h = Math.min(h * 60, 360);

  if (h < 0) {
    h += 360;
  }

  const l = (min + max) / 2;

  if (max === min) {
    s = 0;
  } else if (l <= 0.5) {
    s = delta / (max + min);
  } else {
    s = delta / (2 - max - min);
  }

  return [h, s * 100, l * 100];
}

export function interpHSL(alpha, c1, c2) {
  let hueDelta = c2[0] - c1[0];
  const altHueDelta =
    hueDelta > 0 ? c2[0] - (c1[0] + 360) : c2[0] + 360 - c1[0];
  if (Math.abs(altHueDelta) < Math.abs(hueDelta)) {
    hueDelta = altHueDelta;
  }

  const [s, l] = [1, 2].map((j) => c1[j] * (1 - alpha) + c2[j] * alpha);
  const hue = c1[0] + alpha * hueDelta;
  const h = (hue + 360) % 360;
  return [h, s, l];
}

export const parseRGB = (e) =>
  [e.substring(1, 3), e.substring(3, 5), e.substring(5)].map((s) =>
    parseInt(s, 16)
  );
