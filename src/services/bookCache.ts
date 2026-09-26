import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Book } from '@/src/types/book';

const CACHE_KEY_PREFIX = 'shelfie:books:';

function cacheKey(uid: string | null) {
  return `${CACHE_KEY_PREFIX}${uid ?? 'local'}`;
}

export async function readBooksCache(uid: string | null): Promise<Book[] | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(uid));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Book[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeBooksCache(uid: string | null, books: Book[]): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(uid), JSON.stringify(books));
  } catch {
    // Ignore cache write failures.
  }
}
