import { upsertCloudBook } from '@/src/services/cloudBookStorage';
import { clearAllLocalBooks, getAllLocalBooks, getLocalBookCount } from '@/src/services/localBookStorage';

export { getLocalBookCount };

export async function migrateLocalBooksToCloud(uid: string): Promise<number> {
  const localBooks = await getAllLocalBooks();
  if (localBooks.length === 0) {
    return 0;
  }

  for (const book of localBooks) {
    await upsertCloudBook(uid, book);
  }

  await clearAllLocalBooks();
  return localBooks.length;
}
