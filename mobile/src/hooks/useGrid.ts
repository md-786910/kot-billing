import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Shortest screen side (dp) from which the device is treated as a tablet */
export const TABLET_MIN_SIDE = 600;

/** Usable screen width: the window minus any side insets (cutouts or a side navigation bar in landscape) */
export function useContentWidth() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return width - insets.left - insets.right;
}

/**
 * Columns for a card list: as many as fit at `minItemWidth`, so phones get one column and
 * tablets two or three (more in landscape). Re-renders on rotation.
 */
export function useGrid(minItemWidth: number, padding: number, gap: number) {
  const inner = useContentWidth() - padding * 2;
  const columns = Math.max(1, Math.floor((inner + gap) / (minItemWidth + gap)));
  const itemWidth = Math.floor((inner - gap * (columns - 1)) / columns);
  return { columns, itemWidth };
}
