import { getStatusLabel, sortBooks } from '@/src/services/bookStorageUtils';
import { readBooksCache, writeBooksCache } from '@/src/services/bookCache';
import {
  addCloudBook,
  deleteCloudBook,
  getAllCloudBooks,
  hasCloudBook,
  updateCloudBook,
} from '@/src/services/cloudBookStorage';
import { auth } from '@/src/services/firebase';
import {
  addLocalBook,
  deleteLocalBook,
  getAllLocalBooks,
  updateLocalBook,
} from '@/src/services/localBookStorage';
import type { Book, BookInput, BookUpdate } from '@/src/types/book';

export { getStatusLabel };

function getSignedInUid() {
  return auth.currentUser?.uid ?? null;
}

async function mergeSignedInBooks(uid: string): Promise<Book[]> {
  const [cloudBooks, localBooks] = await Promise.all([getAllCloudBooks(uid), getAllLocalBooks()]);

  if (localBooks.length === 0) {
    return cloudBooks;
  }

  const cloudIds = new Set(cloudBooks.map((book) => book.id));
  const localOnly = localBooks.filter((book) => !cloudIds.has(book.id));
  return sortBooks([...cloudBooks, ...localOnly]);
}

type LoadBooksOptions = {
  uid?: string | null;
  onBooks?: (books: Book[]) => void;
};

/** Loads books with cache-first and progressive updates for a snappier home screen. */
export async function loadBooksForDisplay(options: LoadBooksOptions = {}): Promise<Book[]> {
  const uid = options.uid === undefined ? getSignedInUid() : options.uid;
  const emit = (books: Book[]) => options.onBooks?.(books);

  const cached = await readBooksCache(uid);
  if (cached && cached.length > 0) {
    emit(cached);
  }

  if (!uid) {
    const books = await getAllLocalBooks();
    emit(books);
    await writeBooksCache(null, books);
    return books;
  }

  const localBooks = await getAllLocalBooks();
  if (localBooks.length > 0) {
    emit(sortBooks(localBooks));
  }

  const books = await mergeSignedInBooks(uid);
  emit(books);
  await writeBooksCache(uid, books);
  return books;
}

export async function addBook(input: BookInput): Promise<Book> {
  const uid = getSignedInUid();
  if (uid) {
    return addCloudBook(uid, input);
  }

  return addLocalBook(input);
}

export async function getAllBooks(): Promise<Book[]> {
  const uid = getSignedInUid();
  if (uid) {
    return mergeSignedInBooks(uid);
  }

  return getAllLocalBooks();
}

export async function deleteBook(id: number): Promise<void> {
  const uid = getSignedInUid();
  if (uid) {
    if (await hasCloudBook(uid, id)) {
      return deleteCloudBook(uid, id);
    }

    return deleteLocalBook(id);
  }

  return deleteLocalBook(id);
}

export async function updateBook(id: number, updates: BookUpdate): Promise<Book> {
  const uid = getSignedInUid();
  if (uid) {
    if (await hasCloudBook(uid, id)) {
      return updateCloudBook(uid, id, updates);
    }

    return updateLocalBook(id, updates);
  }

  return updateLocalBook(id, updates);
}
