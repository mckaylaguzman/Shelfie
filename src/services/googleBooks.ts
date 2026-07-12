const SEARCH_URL = 'https://www.googleapis.com/books/v1/volumes';

export type GoogleBookResult = {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
};

export class GoogleBooksSearchError extends Error {
  kind: 'offline' | 'unknown';

  constructor(kind: 'offline' | 'unknown', message: string) {
    super(message);
    this.kind = kind;
  }
}

type GoogleBooksImageLinks = {
  smallThumbnail?: string;
  thumbnail?: string;
  small?: string;
  medium?: string;
  large?: string;
  extraLarge?: string;
};

type GoogleBooksVolumeInfo = {
  title?: string;
  authors?: string[];
  imageLinks?: GoogleBooksImageLinks;
};

type GoogleBooksItem = {
  id: string;
  volumeInfo?: GoogleBooksVolumeInfo;
};

type GoogleBooksResponse = {
  items?: GoogleBooksItem[];
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

function pickBestCoverUrl(imageLinks?: GoogleBooksImageLinks): string | null {
  if (!imageLinks) {
    return null;
  }

  const url =
    imageLinks.extraLarge ||
    imageLinks.large ||
    imageLinks.medium ||
    imageLinks.small ||
    imageLinks.thumbnail ||
    imageLinks.smallThumbnail;

  if (!url) {
    return null;
  }

  return url.replace(/^http:\/\//i, 'https://');
}

function mapItem(item: GoogleBooksItem): GoogleBookResult {
  const info = item.volumeInfo ?? {};
  const authors = (info.authors ?? []).map((name) => name.trim()).filter(Boolean);

  return {
    id: item.id,
    title: info.title?.trim() || 'Unknown title',
    author: authors.length > 0 ? authors.join(', ') : 'Unknown author',
    coverUrl: pickBestCoverUrl(info.imageLinks),
  };
}

export async function searchGoogleBooks(query: string): Promise<GoogleBookResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const params = new URLSearchParams({
    q: trimmed,
    maxResults: '8',
  });

  try {
    const response = await fetch(`${SEARCH_URL}?${params.toString()}`);
    if (!response.ok) {
      throw new GoogleBooksSearchError('unknown', 'Search request failed');
    }

    const data = (await response.json()) as GoogleBooksResponse;
    return (data.items ?? []).map(mapItem);
  } catch (error) {
    if (error instanceof GoogleBooksSearchError) {
      throw error;
    }

    if (isNetworkError(error)) {
      throw new GoogleBooksSearchError(
        'offline',
        'No internet connection. You can still enter book details manually.',
      );
    }

    throw new GoogleBooksSearchError('unknown', 'Something went wrong while searching.');
  }
}
