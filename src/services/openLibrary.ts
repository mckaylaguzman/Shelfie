import { Directory, File, Paths } from 'expo-file-system';

const SEARCH_URL = 'https://openlibrary.org/search.json';
const COVER_URL = 'https://covers.openlibrary.org/b/id';

export type OpenLibraryBook = {
  id: string;
  title: string;
  author: string;
  coverId: number | null;
  coverUrl: string | null;
};

export class OpenLibrarySearchError extends Error {
  kind: 'offline' | 'unknown';

  constructor(kind: 'offline' | 'unknown', message: string) {
    super(message);
    this.kind = kind;
  }
}

type OpenLibraryDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
};

type OpenLibraryResponse = {
  docs?: OpenLibraryDoc[];
};

function isNetworkError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('internet connection') ||
    message.includes('offline')
  );
}

function mapDoc(doc: OpenLibraryDoc, index: number): OpenLibraryBook {
  const coverId = doc.cover_i ?? null;

  return {
    id: doc.key ?? `result-${index}`,
    title: doc.title?.trim() || 'Unknown title',
    author: doc.author_name?.[0]?.trim() || 'Unknown author',
    coverId,
    coverUrl: coverId ? `${COVER_URL}/${coverId}-M.jpg` : null,
  };
}

export async function searchOpenLibrary(query: string): Promise<OpenLibraryBook[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const params = new URLSearchParams({
    q: trimmed,
    limit: '8',
    fields: 'key,title,author_name,cover_i',
  });

  try {
    const response = await fetch(`${SEARCH_URL}?${params.toString()}`);
    if (!response.ok) {
      throw new OpenLibrarySearchError('unknown', 'Search request failed');
    }

    const data = (await response.json()) as OpenLibraryResponse;
    return (data.docs ?? []).map(mapDoc);
  } catch (error) {
    if (error instanceof OpenLibrarySearchError) {
      throw error;
    }

    if (isNetworkError(error)) {
      throw new OpenLibrarySearchError(
        'offline',
        'No internet connection. You can still enter book details manually.',
      );
    }

    throw new OpenLibrarySearchError('unknown', 'Something went wrong while searching.');
  }
}

export async function downloadOpenLibraryCover(coverId: number): Promise<string | null> {
  const cacheDir = new Directory(Paths.cache, 'open-library-covers');
  if (!cacheDir.exists) {
    cacheDir.create({ idempotent: true, intermediates: true });
  }

  const destFile = new File(cacheDir, `cover-${coverId}-${Date.now()}.jpg`);

  try {
    const downloaded = await File.downloadFileAsync(`${COVER_URL}/${coverId}-L.jpg`, destFile);
    return downloaded.uri;
  } catch {
    return null;
  }
}
