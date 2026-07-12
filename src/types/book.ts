export const BOOK_STATUSES = ['tbr', 'reading', 'finished'] as const;
export type BookStatus = (typeof BOOK_STATUSES)[number];

export const BOOK_FORMATS = ['physical', 'audiobook'] as const;
export type BookFormat = (typeof BOOK_FORMATS)[number];

export type Book = {
  id: number;
  title: string;
  author: string;
  status: BookStatus;
  format: BookFormat;
  rating: number;
  dateFinished: string;
  review: string;
  coverImageUri: string | null;
};

export type BookInput = {
  title: string;
  author: string;
  status: BookStatus;
  format?: BookFormat;
  rating?: number;
  dateFinished?: Date;
  review?: string;
  coverImageUri: string | null;
};

export type BookUpdate = {
  title?: string;
  author?: string;
  status?: BookStatus;
  format?: BookFormat;
  rating?: number;
  dateFinished?: Date;
  review?: string;
  coverImageUri?: string | null;
};
