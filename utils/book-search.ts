import { Directory, File, Paths } from 'expo-file-system';

import { GoogleBooksSearchError, searchGoogleBooks } from '@/utils/google-books';
import {
  downloadOpenLibraryCover,
  OpenLibrarySearchError,
  searchOpenLibrary,
  type OpenLibraryBook,
} from '@/utils/open-library';

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
  if (trimmed.length < 2) {
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
