import { Directory, File, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';

import { finishedFields } from '@/src/services/bookStorageUtils';
import type { Book, BookInput, BookStatus, BookUpdate } from '@/src/types/book';

const DB_NAME = 'shelfie.db';
const COVERS_DIR = 'covers';

type BookRow = {
  id: number;
  title: string;
  author: string;
  status: BookStatus;
  format: Book['format'];
  rating: number;
  dateFinished: string;
  review: string;
  coverImageUri: string | null;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrateDb(db: SQLite.SQLiteDatabase) {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(books)');
  const hasStatus = columns.some((column) => column.name === 'status');
  const hasFormat = columns.some((column) => column.name === 'format');

  if (!hasStatus) {
    await db.execAsync(`ALTER TABLE books ADD COLUMN status TEXT NOT NULL DEFAULT 'finished';`);
  }

  if (!hasFormat) {
    await db.execAsync(`ALTER TABLE books ADD COLUMN format TEXT NOT NULL DEFAULT 'physical';`);
  }
}

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS books (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          author TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'finished',
          format TEXT NOT NULL DEFAULT 'physical',
          rating INTEGER NOT NULL DEFAULT 0,
          dateFinished TEXT NOT NULL DEFAULT '',
          review TEXT NOT NULL DEFAULT '',
          coverImageUri TEXT
        );
      `);
      await migrateDb(db);
      return db;
    })();
  }

  return dbPromise;
}

function getCoversDirectory() {
  const dir = new Directory(Paths.document, COVERS_DIR);
  if (!dir.exists) {
    dir.create({ idempotent: true, intermediates: true });
  }
  return dir;
}

function getCoverExtension(uri: string) {
  const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match?.[1]?.toLowerCase() ?? 'jpg';
}

async function persistCoverImage(tempUri: string | null) {
  if (!tempUri) {
    return null;
  }

  const coversDir = getCoversDirectory();
  const filename = `cover-${Date.now()}.${getCoverExtension(tempUri)}`;
  const sourceFile = new File(tempUri);
  const destFile = new File(coversDir, filename);

  sourceFile.copy(destFile);

  return destFile.uri;
}

async function deleteCoverImage(uri: string | null) {
  if (!uri) {
    return;
  }

  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Ignore missing or inaccessible cover files.
  }
}

function rowToBook(row: BookRow): Book {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    status: row.status,
    format: row.format ?? 'physical',
    rating: row.rating,
    dateFinished: row.dateFinished,
    review: row.review,
    coverImageUri: row.coverImageUri,
  };
}

export async function addLocalBook(input: BookInput): Promise<Book> {
  const db = await getDb();
  const coverImageUri = await persistCoverImage(input.coverImageUri);
  const title = input.title.trim();
  const author = input.author.trim();
  const { rating, dateFinished, review } = finishedFields(input);

  const result = await db.runAsync(
    `INSERT INTO books (title, author, status, format, rating, dateFinished, review, coverImageUri)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    title,
    author,
    input.status,
    input.format ?? 'physical',
    rating,
    dateFinished,
    review,
    coverImageUri,
  );

  return {
    id: result.lastInsertRowId,
    title,
    author,
    status: input.status,
    format: input.format ?? 'physical',
    rating,
    dateFinished,
    review,
    coverImageUri,
  };
}

export async function getAllLocalBooks(): Promise<Book[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<BookRow>(`
    SELECT * FROM books
    ORDER BY
      CASE status
        WHEN 'reading' THEN 0
        WHEN 'tbr' THEN 1
        ELSE 2
      END,
      CASE WHEN status = 'finished' THEN dateFinished ELSE '' END DESC,
      id DESC
  `);

  return rows.map(rowToBook);
}

export async function getLocalBookCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM books');
  return row?.count ?? 0;
}

export async function deleteLocalBook(id: number): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<Pick<BookRow, 'coverImageUri'>>(
    'SELECT coverImageUri FROM books WHERE id = ?',
    id,
  );

  if (!existing) {
    return;
  }

  await deleteCoverImage(existing.coverImageUri);
  await db.runAsync('DELETE FROM books WHERE id = ?', id);
}

export async function updateLocalBook(id: number, updates: BookUpdate): Promise<Book> {
  const db = await getDb();
  const existing = await db.getFirstAsync<BookRow>('SELECT * FROM books WHERE id = ?', id);

  if (!existing) {
    throw new Error(`Book with id ${id} not found`);
  }

  let coverImageUri = existing.coverImageUri;

  if (updates.coverImageUri !== undefined && updates.coverImageUri !== existing.coverImageUri) {
    await deleteCoverImage(existing.coverImageUri);
    coverImageUri = updates.coverImageUri
      ? await persistCoverImage(updates.coverImageUri)
      : null;
  }

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

  await db.runAsync(
    `UPDATE books
     SET title = ?, author = ?, status = ?, format = ?, rating = ?, dateFinished = ?, review = ?, coverImageUri = ?
     WHERE id = ?`,
    title,
    author,
    status,
    format,
    rating,
    dateFinished,
    review,
    coverImageUri,
    id,
  );

  return {
    id,
    title,
    author,
    status,
    format,
    rating,
    dateFinished,
    review,
    coverImageUri,
  };
}

export async function clearAllLocalBooks(): Promise<void> {
  const books = await getAllLocalBooks();

  for (const book of books) {
    await deleteCoverImage(book.coverImageUri);
  }

  const db = await getDb();
  await db.runAsync('DELETE FROM books');
}
