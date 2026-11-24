import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { toQR } from 'toqr';

/**
 * A QR code drawn as one SVG path: dark modules on white with a quiet zone, which every
 * scanner reads whatever the app's theme.
 */
export function QrCode({ value, size, label }: { value: string; size: number; label: string }) {
  const { path, count } = useMemo(() => {
    const modules = toQR(value);
    const side = Math.round(Math.sqrt(modules.length));
    let d = '';
    for (let y = 0; y < side; y += 1) {
      for (let x = 0; x < side; x += 1) {
        if (modules[y * side + x]) d += `M${x + 4} ${y + 4}h1v1h-1z`;
      }
    }
    return { path: d, count: side + 8 };
  }, [value]);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${count} ${count}`} accessibilityRole="image" accessibilityLabel={label}>
      <Rect x={0} y={0} width={count} height={count} rx={2} fill="#FFFFFF" />
      <Path d={path} fill="#0F0F0F" />
    </Svg>
  );
}
