import type { User } from 'firebase/auth';
import type { Book, CatalogBook, YearState } from '../../shared/contracts';
import { demoCatalog, emptyYear, initialShelf, newShelfBook } from './demo';
import { isPrivateCover } from './components/coverFile';
import { withReadingDefaults } from './diario/readingDefaults';

export type BookMetadata = { title: string; author: string; coverUrl?: string | null };

export interface Journal {
  list(): Promise<Book[]>;
  search(q: string): Promise<CatalogBook[]>;
  editions(book: CatalogBook): Promise<CatalogBook[]>;
  add(book: CatalogBook, file?: File): Promise<Book>;
  edit(book: Book, metadata: BookMetadata, file?: File): Promise<Book>;
  remove(book: Book): Promise<void>;
  cover(path: string, signal: AbortSignal): Promise<Blob>;
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
  constructor(message = 'A ficha mudou em outra janela. Reabra-a para ver a versão atual. Seu rascunho foi preservado.') { super(message); }
}
const shelf = () => load(shelfKey, initialShelf).map(withReadingDefaults);
function assertRevision(books: Book[], book: Book) {
  const pos = books.findIndex(item=>item.id === book.id);
  if (pos < 0 || books[pos].revision !== book.revision) throw new ConflictError();
  return pos;
}
function dataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível guardar a imagem neste aparelho.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}
function personalYear(year:number): YearState {
  const state=load(yearKey(year),emptyYear);
  const ids=new Set(shelf().map(book=>book.id));
  for(const group of ['squares','letters','colors','monthly','rounds'] as const) {
    state[group]=Object.fromEntries(Object.entries(state[group]).filter(([,id])=>ids.has(id)||(group==='squares'&&id==='*')));
  }
  return state;
}
const demo: Journal = {
  list: async () => shelf(),
  search: async (q) => demoCatalog.filter(b => fold(b.title + ' ' + b.author).includes(fold(q))),
  editions: async b => [b],
  add: async (data,file) => exclusive(shelfKey, async () => {
    const books = shelf();
    const existing = books.find(b => data.workKey ? b.workKey === data.workKey : !b.workKey && fold(b.title) === fold(data.title) && fold(b.author) === fold(data.author));
    if (existing) return existing;
    const book = newShelfBook(file ? {...data,coverUrl:await dataUrl(file)} : data);
    localStorage.setItem(shelfKey, JSON.stringify([...books, book]));
    return book;
  }),
  edit: async (book,metadata,file) => exclusive(shelfKey,async ()=>{
    const books=shelf();
    const pos=assertRevision(books,book);
    const saved={...books[pos],...metadata,revision:book.revision+1};
    if(file) saved.coverUrl=await dataUrl(file);
    if(!saved.workKey && books.some(other=>other.id!==saved.id && !other.workKey && fold(other.title)===fold(saved.title) && fold(other.author)===fold(saved.author)))
      throw new Error('Já existe um livro manual com este título e autoria na sua estante.');
    books[pos]=saved;
    localStorage.setItem(shelfKey,JSON.stringify(books));
    return saved;
  }),
  remove: async book => exclusive(shelfKey,()=>{
    const books=shelf();
    const pos=assertRevision(books,book);
    books.splice(pos,1);
    localStorage.setItem(shelfKey,JSON.stringify(books));
  }),
  cover: async () => { throw new Error('Esta capa exige uma conta.'); },
  save: async (book) => exclusive(shelfKey, () => {
    const books = shelf();
    const pos = books.findIndex(b => b.id === book.id);
    if (pos < 0 || book.revision !== books[pos].revision) throw new ConflictError();
    const saved = { ...book, revision: book.revision + 1 };
    books[pos] = saved;
    localStorage.setItem(shelfKey, JSON.stringify(books));
    return saved;
  }),
  getYear: async y => personalYear(y),
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
  async function fetchApi(path: string, method = 'GET', payload?: unknown, signal?:AbortSignal) {
    const token = await user!.getIdToken();
    const response = await fetch(base + path, {
      method, headers: { Authorization: 'Bearer ' + token, ...(payload && !(payload instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
      body: payload instanceof FormData ? payload : payload ? JSON.stringify(payload) : undefined,
      signal: signal ?? AbortSignal.timeout(90000), redirect: 'error',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      const message = Array.isArray(error?.message) ? error.message.join(' ') : error?.message;
      if (response.status === 409) throw new ConflictError(typeof message === 'string' ? message : undefined);
      throw new Error(typeof message === 'string' ? message : 'Não foi possível concluir a operação. Tente novamente.');
    }
    return response;
  }
  async function request<T>(path:string, method='GET', payload?:unknown):Promise<T> {
    return (await fetchApi(path,method,payload)).json() as Promise<T>;
  }
  function body(data:unknown,file?:File) {
    if(!file)return data;
    const form=new FormData();
    form.set('data',JSON.stringify(data));
    form.set('file',file);
    return form;
  }
  function coverRevision(book:Book):Book {
    return isPrivateCover(book.coverUrl) ? {...book,coverUrl:book.coverUrl.split('?')[0]+'?v='+book.revision} : book;
  }
  return {
    list: async () => (await request<Book[]>('/books')).map(coverRevision),
    search: q => request('/catalog?q=' + encodeURIComponent(q)),
    editions: b => b.workKey ? request('/catalog/editions?' + new URLSearchParams({workKey:b.workKey, author:b.author})) : Promise.resolve([b]),
    add: async (b,file) => coverRevision(await request('/books','POST',body(b,file))),
    edit: async ({id,revision},metadata,file) => coverRevision(await request('/books/'+encodeURIComponent(id),'PATCH',body({revision,...metadata},file))),
    remove: async ({id,revision}) => {await fetchApi('/books/'+encodeURIComponent(id)+'?revision='+revision,'DELETE');},
    cover: async (path,signal) => {
      if(!isPrivateCover(path)) throw new Error('Caminho de capa inválido.');
      return (await fetchApi(path,'GET',undefined,signal)).blob();
    },
    save: async ({id,revision,status,tags,plannedYears,readings}) => coverRevision(await request('/books/' + encodeURIComponent(id), 'PUT', {revision,status,tags,plannedYears,readings})),
    getYear: y => request('/years/' + y),
    saveYear: (y,s) => request('/years/' + y, 'PUT', s),
  };
}
