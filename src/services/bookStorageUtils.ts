import type { Book, BookInput, BookStatus } from '@/src/types/book';

export function getStatusLabel(status: BookStatus) {
  switch (status) {
    case 'tbr':
      return 'TBR';
    case 'reading':
      return 'Reading';
    case 'finished':
      return 'Finished';
  }
}

export function finishedFields(input: Pick<BookInput, 'status' | 'rating' | 'dateFinished' | 'review'>) {
  if (input.status !== 'finished') {
    return {
      rating: 0,
      dateFinished: '',
      review: '',
    };
  }

  return {
    rating: input.rating ?? 0,
    dateFinished: (input.dateFinished ?? new Date()).toISOString(),
    review: input.review?.trim() ?? '',
  };
}

const STATUS_ORDER: Record<Book['status'], number> = {
  reading: 0,
  tbr: 1,
  finished: 2,
};

export function sortBooks(books: Book[]): Book[] {
  return [...books].sort((left, right) => {
    const statusDiff = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
    if (statusDiff !== 0) {
      return statusDiff;
    }

    if (left.status === 'finished' && right.status === 'finished') {
      const dateDiff = right.dateFinished.localeCompare(left.dateFinished);
      if (dateDiff !== 0) {
        return dateDiff;
      }
    }

    return right.id - left.id;
  });
}
