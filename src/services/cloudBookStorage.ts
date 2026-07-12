import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { finishedFields, sortBooks } from '@/src/services/bookStorageUtils';
import { coverToDataUri, encodeCoverForCloud, type EncodedCover } from '@/src/services/coverEncoding';
import { firestore } from '@/src/services/firebase';
import type { Book, BookInput, BookUpdate } from '@/src/types/book';

type CloudBookDocument = {
  id: number;
  title: string;
  author: string;
  status: Book['status'];
  format: Book['format'];
  rating: number;
  dateFinished: string;
  review: string;
  coverImageBase64: string | null;
  coverMimeType: string | null;
};

function booksCollection(uid: string) {
  return collection(firestore, 'users', uid, 'books');
}

function bookDocument(uid: string, id: number) {
  return doc(firestore, 'users', uid, 'books', String(id));
}

export async function hasCloudBook(uid: string, id: number): Promise<boolean> {
  const snapshot = await getDoc(bookDocument(uid, id));
  return snapshot.exists();
}

function docToBook(id: number, data: CloudBookDocument): Book {
  const cover: EncodedCover | null =
    data.coverImageBase64 && data.coverMimeType
      ? { base64: data.coverImageBase64, mimeType: data.coverMimeType }
      : null;

  return {
    id,
    title: data.title,
    author: data.author,
    status: data.status,
    format: data.format ?? 'physical',
    rating: data.rating,
    dateFinished: data.dateFinished,
    review: data.review,
    coverImageUri: coverToDataUri(cover),
  };
}

function createBookId() {
  return Date.now();
}

async function buildCoverFields(uri: string | null | undefined, existing?: CloudBookDocument) {
  if (uri === undefined) {
    return {
      coverImageBase64: existing?.coverImageBase64 ?? null,
      coverMimeType: existing?.coverMimeType ?? null,
    };
  }

  if (uri === null) {
    return {
      coverImageBase64: null,
      coverMimeType: null,
    };
  }

  const encoded = await encodeCoverForCloud(uri);
  return {
    coverImageBase64: encoded?.base64 ?? null,
    coverMimeType: encoded?.mimeType ?? null,
  };
}

export async function addCloudBook(uid: string, input: BookInput): Promise<Book> {
  const id = createBookId();
  const title = input.title.trim();
  const author = input.author.trim();
  const { rating, dateFinished, review } = finishedFields(input);
  const coverFields = await buildCoverFields(input.coverImageUri);

  const document: CloudBookDocument = {
    id,
    title,
    author,
    status: input.status,
    format: input.format ?? 'physical',
    rating,
    dateFinished,
    review,
    ...coverFields,
  };

  await setDoc(bookDocument(uid, id), document);

  return docToBook(id, document);
}

export async function getAllCloudBooks(uid: string): Promise<Book[]> {
  const snapshot = await getDocs(booksCollection(uid));
  const books = snapshot.docs.map((bookDoc) => {
    const data = bookDoc.data() as CloudBookDocument;
    const id = data.id ?? Number(bookDoc.id);
    return docToBook(id, data);
  });

  return sortBooks(books);
}

export async function deleteCloudBook(uid: string, id: number): Promise<void> {
  const ref = bookDocument(uid, id);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    return;
  }

  await deleteDoc(ref);
}

export async function updateCloudBook(uid: string, id: number, updates: BookUpdate): Promise<Book> {
  const ref = bookDocument(uid, id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    throw new Error(`Book with id ${id} not found`);
  }

  const existing = snapshot.data() as CloudBookDocument;
  const title = updates.title?.trim() ?? existing.title;
  const author = updates.author?.trim() ?? existing.author;
  const status = updates.status ?? existing.status;
  const format = updates.format ?? existing.format;

  let rating = existing.rating;
  let dateFinished = existing.dateFinished;
  let review = existing.review;

  if (status === 'finished') {
    rating = updates.rating ?? existing.rating;
    dateFinished = updates.dateFinished?.toISOString() ?? existing.dateFinished;
    review = updates.review?.trim() ?? existing.review;
  } else {
    rating = 0;
    dateFinished = '';
    review = '';
  }

  const coverFields = await buildCoverFields(updates.coverImageUri, existing);

  const document: CloudBookDocument = {
    id,
    title,
    author,
    status,
    format,
    rating,
    dateFinished,
    review,
    ...coverFields,
  };

  await updateDoc(ref, document);

  return docToBook(id, document);
}

export async function upsertCloudBook(uid: string, book: Book): Promise<void> {
  const coverFields = await buildCoverFields(book.coverImageUri);

  const document: CloudBookDocument = {
    id: book.id,
    title: book.title,
    author: book.author,
    status: book.status,
    format: book.format,
    rating: book.rating,
    dateFinished: book.dateFinished,
    review: book.review,
    ...coverFields,
  };

  await setDoc(bookDocument(uid, book.id), document);
}

export async function deleteAllCloudBooks(uid: string): Promise<void> {
  const snapshot = await getDocs(booksCollection(uid));
  if (snapshot.empty) {
    return;
  }

  const batchSize = 500;
  for (let index = 0; index < snapshot.docs.length; index += batchSize) {
    const batch = writeBatch(firestore);
    const chunk = snapshot.docs.slice(index, index + batchSize);
    chunk.forEach((bookDoc) => {
      batch.delete(bookDoc.ref);
    });
    await batch.commit();
  }
}
