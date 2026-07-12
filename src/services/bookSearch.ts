import { Directory, File, Paths } from 'expo-file-system';

import { GoogleBooksSearchError, searchGoogleBooks } from '@/src/services/googleBooks';
import {
  downloadOpenLibraryCover,
  OpenLibrarySearchError,
  searchOpenLibrary,
  type OpenLibraryBook,
} from '@/src/services/openLibrary';

export type BookSearchResult = {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  coverId: number | null;
};

export class BookSearchError extends Error {
  kind: 'offline' | 'unknown';

  constructor(kind: 'offline' | 'unknown', message: string) {
    super(message);
    this.kind = kind;
  }
}

export type BookSearchStatus = 'idle' | 'loading' | 'no-results' | 'offline';

export const BOOK_SEARCH_DEBOUNCE_MS = 400;
export const BOOK_SEARCH_MIN_QUERY_LENGTH = 2;

function mapOpenLibraryResult(result: OpenLibraryBook): BookSearchResult {
  return {
    id: result.id,
    title: result.title,
    author: result.author,
    coverUrl: result.coverUrl,
    coverId: result.coverId,
  };
}

function mapGoogleResult(result: Awaited<ReturnType<typeof searchGoogleBooks>>[number]): BookSearchResult {
  return {
    id: result.id,
    title: result.title,
    author: result.author,
    coverUrl: result.coverUrl,
    coverId: null,
  };
}

function toBookSearchError(error: GoogleBooksSearchError | OpenLibrarySearchError): BookSearchError {
  return new BookSearchError(error.kind, error.message);
}

export async function searchBooks(query: string): Promise<BookSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < BOOK_SEARCH_MIN_QUERY_LENGTH) {
    return [];
  }

  try {
    const googleResults = await searchGoogleBooks(trimmed);
    if (googleResults.length > 0) {
      return googleResults.map(mapGoogleResult);
    }
  } catch {
    // Google failed or returned nothing — fall through to Open Library.
  }

  try {
    const openLibraryResults = await searchOpenLibrary(trimmed);
    return openLibraryResults.map(mapOpenLibraryResult);
  } catch (error) {
    if (error instanceof OpenLibrarySearchError) {
      throw toBookSearchError(error);
    }
    throw error;
  }
}

async function downloadCoverFromUrl(url: string): Promise<string | null> {
  const cacheDir = new Directory(Paths.cache, 'book-search-covers');
  if (!cacheDir.exists) {
    cacheDir.create({ idempotent: true, intermediates: true });
  }

  const destFile = new File(cacheDir, `cover-${Date.now()}.jpg`);

  try {
    const downloaded = await File.downloadFileAsync(url, destFile);
    return downloaded.uri;
  } catch {
    return null;
  }
}

export async function downloadSearchCover(result: BookSearchResult): Promise<string | null> {
  if (result.coverId) {
    return downloadOpenLibraryCover(result.coverId);
  }

  if (result.coverUrl) {
    return downloadCoverFromUrl(result.coverUrl);
  }

  return null;
}

export async function runBookSearchQuery(query: string): Promise<{
  status: BookSearchStatus;
  results: BookSearchResult[];
}> {
  const trimmed = query.trim();
  if (trimmed.length < BOOK_SEARCH_MIN_QUERY_LENGTH) {
    return { status: 'idle', results: [] };
  }

  try {
    const results = await searchBooks(trimmed);
    return {
      status: results.length === 0 ? 'no-results' : 'idle',
      results,
    };
  } catch {
    return { status: 'offline', results: [] };
  }
}

export async function loadCoverForSearchResult(result: BookSearchResult): Promise<string | null> {
  if (!result.coverId && !result.coverUrl) {
    return null;
  }

  return downloadSearchCover(result);
}
