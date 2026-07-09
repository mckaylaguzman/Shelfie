export const TABLET_BREAKPOINT = 768;
export const LARGE_TABLET_BREAKPOINT = 1024;
export const MAX_CONTENT_WIDTH = 560;
export const TABLET_CONTENT_WIDTH = 720;
export const LARGE_TABLET_CONTENT_WIDTH = 860;

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

export function getHomeContentWidth(screenWidth: number, options: LayoutOptions = {}) {
  if (isLargeTabletLayout(screenWidth, options)) {
    return Math.min(screenWidth - 80, LARGE_TABLET_CONTENT_WIDTH);
  }
  if (isTabletLayout(screenWidth, options)) {
    return Math.min(screenWidth - 48, TABLET_CONTENT_WIDTH);
  }
  return Math.min(screenWidth - 40, MAX_CONTENT_WIDTH);
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
