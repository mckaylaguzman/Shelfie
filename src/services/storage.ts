import { getStatusLabel, sortBooks } from '@/src/services/bookStorageUtils';
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
