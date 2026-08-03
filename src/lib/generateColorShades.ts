export interface ShadeColor {
  color: string;
  textColor: string;
}

/**
 * Generates an array of `x` shades from a single base color string,
 * along with an accessible contrasting text color.
 *
 * @param {string} baseColor - The starting color in HEX, RGB, or RGBA
 * @param {number} x - The number of shades to generate
 * @returns {ShadeColor[]} An array of objects containing the shade and contrasting text color
 */
export function generateColorShades(baseColor: string, x: number): ShadeColor[] {
  // 1. Parse the input string into RGBA values
  const parseColor = (str: string) => {
    str = str.trim().toLowerCase();
    let r = 0, g = 0, b = 0, a = 1;

    if (str.startsWith("#")) {
      let hex = str.replace("#", "");
      if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
      if (hex.length === 8) {
        a = parseInt(hex.slice(6, 8), 16) / 255;
        hex = hex.slice(0, 6);
      }
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else if (str.startsWith("rgb")) {
      const match = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
      if (match) {
        r = parseFloat(match[1]);
        g = parseFloat(match[2]);
        b = parseFloat(match[3]);
        a = match[4] ? parseFloat(match[4]) : 1;
      }
    }
    return { r, g, b, a };
  };

  // 2. Convert RGBA to HSL
  const { r, g, b, a } = parseColor(baseColor);
  const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm), min = Math.min(rNorm, gNorm, bNorm);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
      case gNorm: h = (bNorm - rNorm) / d + 2; break;
      case bNorm: h = (rNorm - gNorm) / d + 4; break;
    }
    h /= 6;
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);

  // Helper function to convert HSL back to RGB for accurate contrast checking
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  // 3. Generate `x` shades
  const shades: ShadeColor[] = [];
  const minLightness = 20;
  const maxLightness = 85;
  const step = x > 1 ? (maxLightness - minLightness) / (x - 1) : 0;

  for (let i = 0; i < x; i++) {
    const lightness = Math.round(minLightness + i * step);
    const colorStr = a < 1
      ? `hsla(${h}, ${s}%, ${lightness}%, ${a})`
      : `hsl(${h}, ${s}%, ${lightness}%)`;

    // Calculate contrast: Convert the current HSL shade back to RGB
    const hNorm = h / 360;
    const sNorm = s / 100;
    const lNorm = lightness / 100;

    let rShade, gShade, bShade;
    if (sNorm === 0) {
      rShade = gShade = bShade = lNorm;
    } else {
      const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
      const p = 2 * lNorm - q;
      rShade = hue2rgb(p, q, hNorm + 1/3);
      gShade = hue2rgb(p, q, hNorm);
      bShade = hue2rgb(p, q, hNorm - 1/3);
    }

    // YIQ formula calculates perceived brightness (0 to 255)
    const yiq = ((rShade * 255 * 299) + (gShade * 255 * 587) + (bShade * 255 * 114)) / 1000;

    // If brightness is 128 or higher, the color is light, so use dark text. Otherwise, use light text.
    const textColor = yiq >= 128 ? "#000000" : "#FFFFFF";

    shades.push({
      color: colorStr,
      textColor: textColor
    });
  }

  return shades;
}
