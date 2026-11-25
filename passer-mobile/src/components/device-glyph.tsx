import { useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { memberKind, screenFor } from '@/core/devices';
import { useTheme } from '@/theme/theme';

/**
 * A device drawn as on the desktop: its outline, and a screen painted with the wallpaper
 * derived from its id, so the same device has the same colours on the phone and the PC.
 * Decorative: the name always sits next to it.
 */
export function DeviceGlyph({
  id,
  name,
  kind,
  size = 44,
  dim = false,
}: {
  id: string;
  name: string;
  /** What the member said it is (passer-core); guessed from the name when missing or unknown. */
  kind?: string | null;
  /** Width in points; the height follows the drawing. */
  size?: number;
  dim?: boolean;
}) {
  const { scheme } = useTheme();
  const gradient = `screen-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [from, to] = screenFor(id);
  const shape = memberKind({ name, kind });
  const body = scheme === 'dark' ? '#1F1F22' : '#2A2A2E';
  const edge = scheme === 'dark' ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.0)';
  const base = scheme === 'dark' ? '#2A2A2E' : '#C7C7CC';
  const height = Math.round(size * 0.75);

  return (
    <Svg
      width={size}
      height={height}
      viewBox="0 0 48 36"
      opacity={dim ? 0.45 : 1}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <LinearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      {shape === 'phone' ? (
        <>
          <Rect x={15} y={1} width={18} height={34} rx={4.5} fill={body} stroke={edge} strokeWidth={0.8} />
          <Rect x={17} y={3} width={14} height={30} rx={3} fill={`url(#${gradient})`} />
          <Rect x={21.5} y={4.6} width={5} height={1.6} rx={0.8} fill={body} />
        </>
      ) : shape === 'tablet' ? (
        <>
          <Rect x={10} y={1} width={28} height={34} rx={4} fill={body} stroke={edge} strokeWidth={0.8} />
          <Rect x={12.5} y={3.5} width={23} height={29} rx={2} fill={`url(#${gradient})`} />
        </>
      ) : shape === 'laptop' ? (
        <>
          <Rect x={6} y={2} width={36} height={24} rx={2.5} fill={body} stroke={edge} strokeWidth={0.8} />
          <Rect x={8.5} y={4.5} width={31} height={19} rx={1} fill={`url(#${gradient})`} />
          <Path d="M1 29h46l-3 4H4z" fill={base} stroke={edge} strokeWidth={0.8} strokeLinejoin="round" />
        </>
      ) : (
        <>
          <Rect x={4} y={1} width={40} height={26} rx={2.5} fill={body} stroke={edge} strokeWidth={0.8} />
          <Rect x={6.5} y={3.5} width={35} height={21} rx={1} fill={`url(#${gradient})`} />
          <Path d="M20 27h8l1.5 6h-11z" fill={base} />
          <Rect x={15} y={32.5} width={18} height={2.5} rx={1.2} fill={base} />
        </>
      )}
    </Svg>
  );
}
