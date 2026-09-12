import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/theme/theme';

import type { SocketName } from './sockets';

export const BRANCHES_HEIGHT = 34;

/** Must match the sockets row: 20pt side padding, 8pt gap. */
const SIDE_PADDING = 20;
const SOCKET_GAP = 8;

type BranchesProps = {
  /** The branch the latest transfer travelled along. */
  lit: SocketName | null;
  /** The branch a transfer is travelling along right now. */
  receiving: SocketName | null;
  dimmed: boolean;
};

/** Joins the two sockets to the conduit, so the route to each destination is drawn, not described. */
export function Branches({ lit, receiving, dimmed }: BranchesProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  const socketWidth = (width - SIDE_PADDING * 2 - SOCKET_GAP) / 2;
  const left = SIDE_PADDING + socketWidth / 2;
  const right = width - SIDE_PADDING - socketWidth / 2;
  const junction = width / 2;

  const strokeFor = (socket: SocketName) => {
    if (receiving === socket) return colors.status.warn;
    if (!dimmed && lit === socket) return colors.conduit.branchActive;
    return colors.conduit.branchIdle;
  };

  const curve = (x: number) => `M${x} 0C${x} 24 ${junction} 10 ${junction} ${BRANCHES_HEIGHT}`;

  return (
    <Svg width={width} height={BRANCHES_HEIGHT} style={styles.svg} pointerEvents="none">
      <Path d={curve(right)} stroke={strokeFor('passboard')} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Path d={curve(left)} stroke={strokeFor('clipboard')} strokeWidth={2} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  svg: { overflow: 'visible' },
});
