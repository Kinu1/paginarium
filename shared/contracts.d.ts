export interface CatalogBook {
  title: string;
  author: string;
  coverUrl: string | null;
  workKey: string | null;
  editionKey: string | null;
}
export type ReadingFormat = 'physical' | 'ebook' | 'audio';
export type BookStatus = 'want' | 'reading' | 'rereading' | 'read';
export interface Reading {
  id: string;
  format: ReadingFormat;
  days: string[];
  finished: string | null;
  rating: number | null;
  favorite: boolean;
  review: string;
}
export interface Book extends CatalogBook {
  id: string;
  revision: number;
  status: BookStatus;
  tags: string[];
  plannedYears: number[];
  readings: Reading[];
}
export interface YearState {
  revision: number;
  squares: Record<string, string>;
  letters: Record<string, string>;
  colors: Record<string, string>;
  monthly: Record<string, string>;
  rounds: Record<string, string>;
}
