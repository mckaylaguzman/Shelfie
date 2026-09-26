import { Platform, StyleProp, View, ViewStyle, useWindowDimensions } from 'react-native';

import { getScreenContentLayout } from '@/constants/cozy-theme';

/** Shared ScrollView contentContainerStyle for full screens and page-sheet modals. */
export const screenScrollContentStyle: ViewStyle = {
  flexGrow: 1,
  alignItems: 'center',
};

type ScreenContainerProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function useScreenLayout() {
  const { width } = useWindowDimensions();
  const isPad = Platform.OS === 'ios' && Platform.isPad;

  return getScreenContentLayout(width, { isPad });
}

export function ScreenContainer({ children, style }: ScreenContainerProps) {
  const { width } = useWindowDimensions();
  const isPad = Platform.OS === 'ios' && Platform.isPad;
  const { columnWidth } = getScreenContentLayout(width, { isPad });

  return (
    <View
      style={[
        {
          width: columnWidth,
          alignSelf: 'center',
        },
        style,
      ]}>
      {children}
    </View>
  );
}
