import type { Book, CatalogBook, Reading, YearState } from '../../shared/contracts';

const titles = [
  ['O atlas das marés', 'Helena Valença', 'atlas', 'Ficção'],
  ['A casa das peônias', 'Cecília Mota', 'peonias', 'Romance'],
  ['O silêncio das garças', 'Tomás Ayres', 'garcas', 'Poesia'],
  ['O lado azul da montanha', 'Lia Figueira', 'montanha', 'Viagem'],
  ['Cartas do palácio', 'Clara Solano', 'palacio', 'Romance'],
  ['Onde a noite demora', 'Martim Linhares', 'noite', 'Contos'],
] as const;

export const demoCatalog: CatalogBook[] = titles.map(([title, author, slug]) => ({
  title, author, coverUrl: '/capas/' + slug + '.jpg', workKey: 'demo-' + slug, editionKey: 'demo-ed-' + slug,
}));
export function emptyYear(): YearState {
  return { revision: 0, squares: {}, letters: {}, colors: {}, monthly: {}, rounds: {} };
}
export function newShelfBook(data: CatalogBook): Book {
  return { ...data, id: crypto.randomUUID(), revision: 1, status: 'want', tags: [], plannedYears: [], readings: [] };
}
export function initialShelf(): Book[] {
  const today = new Date();
  const month = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  const previous = new Date(today.getFullYear(), today.getMonth() - 1, 14);
  const before = previous.getFullYear() + '-' + String(previous.getMonth() + 1).padStart(2, '0');
  return demoCatalog.slice(0, 5).map((catalog, i) => {
    const book = newShelfBook(catalog);
    book.tags = [titles[i][3]];
    book.plannedYears = [today.getFullYear()];
    const reading: Reading = { id: crypto.randomUUID(), format: 'physical', days: [], started: null,
      currentPage: null, totalPages: null, progressPercent: null, finished: null, rating: null, favorite: false, review: '' };
    if (i === 0) {
      book.status = 'reading';
      reading.days = [month + '-01'];
      reading.started = month + '-01';
      reading.currentPage = 42;
      reading.totalPages = 210;
      reading.progressPercent = 20;
      book.readings = [reading];
    } else if (i === 1 || i === 3) {
      book.status = 'read';
      reading.format = i === 1 ? 'ebook' : 'audio';
      reading.finished = i === 1 ? month + '-01' : before;
      reading.days = i === 1 ? [month + '-01'] : [];
      reading.rating = i === 1 ? 4.5 : 4;
      reading.favorite = i === 1;
      reading.review = i === 1 ? 'As cartas da avó foram a minha parte favorita. Voltei ao primeiro capítulo assim que terminei.' : '';
      book.readings = [reading];
    }
    return book;
  });
}
