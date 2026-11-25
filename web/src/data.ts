import type { User } from 'firebase/auth';
import type { Book, CatalogBook, YearState } from '../../shared/contracts';
import { demoCatalog, emptyYear, initialShelf, newShelfBook } from './demo';

export interface Journal {
  list(): Promise<Book[]>;
  search(q: string): Promise<CatalogBook[]>;
  editions(book: CatalogBook): Promise<CatalogBook[]>;
  add(book: CatalogBook): Promise<Book>;
  save(book: Book): Promise<Book>;
  getYear(year: number): Promise<YearState>;
  saveYear(year: number, state: YearState): Promise<YearState>;
}

const shelfKey = 'paginarium:demo:v1:books';
const yearKey = (year: number) => 'paginarium:demo:v1:year:' + year;
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
function load<T>(key: string, start: () => T): T {
  const stored = localStorage.getItem(key);
  if (stored !== null) return JSON.parse(stored) as T;
  const value = start();
  localStorage.setItem(key, JSON.stringify(value));
  return value;
}
function exclusive<T>(key: string, operation: () => T): Promise<T> {
  return navigator.locks ? navigator.locks.request(key, operation) : Promise.resolve().then(operation);
}
export class ConflictError extends Error {
  constructor() { super('A ficha mudou em outra janela. Reabra-a para ver a versão atual. Seu rascunho foi preservado.'); }
}
const shelf = () => load(shelfKey, initialShelf);
const demo: Journal = {
  list: async () => shelf(),
  search: async (q) => demoCatalog.filter(b => fold(b.title + ' ' + b.author).includes(fold(q))),
  editions: async b => [b],
  add: async (data) => exclusive(shelfKey, () => {
    const books = shelf();
    const existing = books.find(b => data.workKey ? b.workKey === data.workKey : !b.workKey && fold(b.title) === fold(data.title) && fold(b.author) === fold(data.author));
    if (existing) return existing;
    const book = newShelfBook(data);
    localStorage.setItem(shelfKey, JSON.stringify([...books, book]));
    return book;
  }),
  save: async (book) => exclusive(shelfKey, () => {
    const books = shelf();
    const pos = books.findIndex(b => b.id === book.id);
    if (pos < 0 || book.revision !== books[pos].revision) throw new ConflictError();
    const saved = { ...book, revision: book.revision + 1 };
    books[pos] = saved;
    localStorage.setItem(shelfKey, JSON.stringify(books));
    return saved;
  }),
  getYear: async y => load(yearKey(y), emptyYear),
  saveYear: async (y, state) => exclusive(yearKey(y), () => {
    if (load(yearKey(y), emptyYear).revision !== state.revision) throw new ConflictError();
    const saved = { ...state, revision: state.revision + 1 };
    localStorage.setItem(yearKey(y), JSON.stringify(saved));
    return saved;
  }),
};

export function createJournal(user: User | null): Journal {
  if (!user) return demo;
  const base = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api')).replace(/\/$/, '');
  async function request<T>(path: string, method = 'GET', payload?: unknown): Promise<T> {
    const token = await user!.getIdToken();
    const response = await fetch(base + path, {
      method, headers: { Authorization: 'Bearer ' + token, ...(payload ? { 'Content-Type': 'application/json' } : {}) },
      body: payload ? JSON.stringify(payload) : undefined, signal: AbortSignal.timeout(90000),
    });
    if (response.status === 409) throw new ConflictError();
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      const message = Array.isArray(error?.message) ? error.message.join(' ') : error?.message;
      throw new Error(typeof message === 'string' ? message : 'Não foi possível concluir a operação. Tente novamente.');
    }
    return response.json() as Promise<T>;
  }
  return {
    list: () => request('/books'),
    search: q => request('/catalog?q=' + encodeURIComponent(q)),
    editions: b => b.workKey ? request('/catalog/editions?' + new URLSearchParams({workKey:b.workKey, author:b.author})) : Promise.resolve([b]),
    add: b => request('/books', 'POST', b),
    save: ({id,revision,status,tags,plannedYears,readings}) => request('/books/' + encodeURIComponent(id), 'PUT', {revision,status,tags,plannedYears,readings}),
    getYear: y => request('/years/' + y),
    saveYear: (y,s) => request('/years/' + y, 'PUT', s),
  };
}
