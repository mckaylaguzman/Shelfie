import { readAsStringAsync } from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const MAX_COVER_BASE64_LENGTH = 500 * 1024;

export type EncodedCover = {
  base64: string;
  mimeType: string;
};

function parseDataUri(uri: string): EncodedCover | null {
  const match = uri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    base64: match[2],
  };
}

function base64ToDataUri(cover: EncodedCover | null): string | null {
  if (!cover) {
    return null;
  }

  return `data:${cover.mimeType};base64,${cover.base64}`;
}

export function coverToDataUri(cover: EncodedCover | null): string | null {
  return base64ToDataUri(cover);
}

async function readUriAsBase64(uri: string): Promise<EncodedCover> {
  const base64 = await readAsStringAsync(uri, { encoding: 'base64' });
  return {
    base64,
    mimeType: 'image/jpeg',
  };
}

async function compressUri(uri: string, width?: number): Promise<EncodedCover> {
  const actions = width ? [{ resize: { width } }] : [];
  let compress = 0.85;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await manipulateAsync(uri, actions, {
      compress,
      format: SaveFormat.JPEG,
      base64: true,
    });

    if (result.base64 && result.base64.length <= MAX_COVER_BASE64_LENGTH) {
      return {
        base64: result.base64,
        mimeType: 'image/jpeg',
      };
    }

    compress -= 0.1;
  }

  const nextWidth = width ? Math.round(width * 0.75) : 800;
  if (nextWidth < 120) {
    const fallback = await manipulateAsync(uri, [{ resize: { width: 120 } }], {
      compress: 0.5,
      format: SaveFormat.JPEG,
      base64: true,
    });

    if (!fallback.base64) {
      throw new Error('Unable to compress cover image.');
    }

    return {
      base64: fallback.base64,
      mimeType: 'image/jpeg',
    };
  }

  return compressUri(uri, nextWidth);
}

async function fitCoverToLimit(cover: EncodedCover, sourceUri: string | null): Promise<EncodedCover> {
  if (cover.base64.length <= MAX_COVER_BASE64_LENGTH) {
    return cover;
  }

  if (sourceUri) {
    return compressUri(sourceUri);
  }

  return compressUri(base64ToDataUri(cover) ?? '');
}

export async function encodeCoverForCloud(uri: string | null): Promise<EncodedCover | null> {
  if (!uri) {
    return null;
  }

  if (uri.startsWith('data:')) {
    const parsed = parseDataUri(uri);
    if (!parsed) {
      return null;
    }

    return fitCoverToLimit(parsed, null);
  }

  try {
    const raw = await readUriAsBase64(uri);
    return fitCoverToLimit(raw, uri);
  } catch {
    return compressUri(uri);
  }
}
