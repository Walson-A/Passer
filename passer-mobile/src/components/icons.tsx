import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Stroke icons on a 24px grid, drawn from the Lucide set the desktop app uses
 * so both halves of Passer share one icon language.
 */
export type IconProps = { size?: number; color: string; strokeWidth?: number };

function Glyph({ size = 20, color, strokeWidth = 1.75, children }: IconProps & { children: ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export function LaptopIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16" />
    </Glyph>
  );
}

export function SmartphoneIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Rect x={5} y={2} width={14} height={20} rx={2} />
      <Path d="M12 18h.01" />
    </Glyph>
  );
}

/** Lucide `layers-2`, standing in for the Shortcuts app. */
export function LayersIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M13 13.74a2 2 0 0 1-2 0L2.5 8.87a1 1 0 0 1 0-1.74L11 2.26a2 2 0 0 1 2 0l8.5 4.87a1 1 0 0 1 0 1.74z" />
      <Path d="m20 14.285 1.5.845a1 1 0 0 1 0 1.74L13 21.74a2 2 0 0 1-2 0l-8.5-4.87a1 1 0 0 1 0-1.74l1.5-.845" />
    </Glyph>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="m6 9 6 6 6-6" />
    </Glyph>
  );
}

export function ChevronUpIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="m18 15-6-6-6 6" />
    </Glyph>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="m9 18 6-6-6-6" />
    </Glyph>
  );
}

export function ChevronsDownIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="m7 6 5 5 5-5M7 13l5 5 5-5" />
    </Glyph>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </Glyph>
  );
}

export function ClipboardIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Rect x={8} y={2} width={8} height={4} rx={1} />
      <Path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </Glyph>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </Glyph>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Rect x={3} y={3} width={18} height={18} rx={2} />
      <Circle cx={9} cy={9} r={2} />
      <Path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </Glyph>
  );
}

export function FileIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <Path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </Glyph>
  );
}

export function VideoIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
      <Rect x={2} y={6} width={14} height={12} rx={2} />
    </Glyph>
  );
}

export function PackageIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="m7.5 4.27 9 5.15" />
      <Path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <Path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
    </Glyph>
  );
}

export function TextIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M17 6.1H3M21 12.1H3M15.1 18H3" />
    </Glyph>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Glyph>
  );
}

export function ArrowDownToLineIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M12 17V3M6 11l6 6 6-6M19 21H5" />
    </Glyph>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
    </Glyph>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M20 6 9 17l-5-5" />
    </Glyph>
  );
}

export function XIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M18 6 6 18M6 6l12 12" />
    </Glyph>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </Glyph>
  );
}

export function RotateIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8M21 3v5h-5" />
    </Glyph>
  );
}

export function ScanIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" />
    </Glyph>
  );
}

export function FlashlightIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M18 6c0 2-2 2-2 4v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V10c0-2-2-2-2-4V2h12zM6 6h12M12 12v.01" />
    </Glyph>
  );
}

export function WifiIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M12 20h.01M2 8.82a15 15 0 0 1 20 0M5 12.859a10 10 0 0 1 14 0M8.5 16.429a5 5 0 0 1 7 0" />
    </Glyph>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </Glyph>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </Glyph>
  );
}

export function VibrateIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="m2 8 2 2-2 2 2 2-2 2M22 8l-2 2 2 2-2 2 2 2" />
      <Rect x={8} y={5} width={8} height={14} rx={1} />
    </Glyph>
  );
}

export function PasteIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Rect x={8} y={2} width={8} height={4} rx={1} />
      <Path d="M16 4h2a2 2 0 0 1 2 2v4M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
      <Rect x={12} y={12} width={9} height={10} rx={1.5} />
    </Glyph>
  );
}
