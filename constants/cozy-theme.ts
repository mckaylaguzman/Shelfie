export const TABLET_BREAKPOINT = 768;
export const LARGE_TABLET_BREAKPOINT = 1024;

/** Shared screen column — 20px side inset on phone, up to 700px centered on tablet. */
export const SCREEN_HORIZONTAL_PADDING = 20;
export const SCREEN_MAX_CONTENT_WIDTH = 700;

/** @deprecated Use SCREEN_MAX_CONTENT_WIDTH */
export const MAX_CONTENT_WIDTH = SCREEN_MAX_CONTENT_WIDTH;

type LayoutOptions = {
  isPad?: boolean;
};

/** Pass `isPad` from Platform.isPad on iOS — iPad mini portrait is 744pt. */
export function isTabletLayout(screenWidth: number, options: LayoutOptions = {}) {
  return (options.isPad ?? false) || screenWidth >= TABLET_BREAKPOINT;
}

export function isLargeTabletLayout(screenWidth: number, options: LayoutOptions = {}) {
  if (options.isPad) {
    return screenWidth >= 900;
  }
  return screenWidth >= LARGE_TABLET_BREAKPOINT;
}

export function getScreenContentLayout(screenWidth: number, options: LayoutOptions = {}) {
  const isTablet = isTabletLayout(screenWidth, options);
  const columnWidth = isTablet
    ? Math.min(screenWidth, SCREEN_MAX_CONTENT_WIDTH)
    : screenWidth - SCREEN_HORIZONTAL_PADDING * 2;
  const edgeInset = (screenWidth - columnWidth) / 2;

  return {
    isTablet,
    columnWidth,
    edgeInset,
    horizontalPadding: SCREEN_HORIZONTAL_PADDING,
  };
}

/** @deprecated Use getScreenContentLayout */
export function getHomeContentWidth(screenWidth: number, options: LayoutOptions = {}) {
  return getScreenContentLayout(screenWidth, options).columnWidth;
}

export function formatBookDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getGridColumns(width: number) {
  if (width >= LARGE_TABLET_BREAKPOINT) {
    return 4;
  }
  if (width >= TABLET_BREAKPOINT) {
    return 3;
  }
  return 2;
}
