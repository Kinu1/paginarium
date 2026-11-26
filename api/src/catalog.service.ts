import {
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";

type CatalogBook = {
  title: string;
  author: string;
  coverUrl: string | null;
  workKey: string | null;
  editionKey: string | null;
};
type Edition = {
  title?: string;
  key?: string;
  cover_i?: number;
  covers?: number[];
  language?: string[];
  languages?: { key: string }[];
};
type Work = Edition & {
  author_name?: string[];
  editions?: { docs?: Edition[] };
};
type Cached = { until: number; books: CatalogBook[] };

function cover(id?: number) {
  return id && id > 0
    ? `https://covers.openlibrary.org/b/id/${id}-M.jpg`
    : null;
}
function makeEdition(
  workKey: string,
  author: string,
  ed: Edition,
  title: string,
) {
  return {
    workKey,
    author,
    title: ed.title || title,
    editionKey: ed.key?.match(/^\/books\/OL\d+M$/)?.[0] || null,
    coverUrl: cover(ed.cover_i ?? ed.covers?.find((id) => id > 0)),
  };
}
export function searchResults(docs: Work[]): CatalogBook[] {
  const result = new Map<string, CatalogBook>();
  for (const work of docs) {
    if (!work.key || !/^\/works\/OL\d+W$/.test(work.key) || !work.title)
      continue;
    const author = work.author_name?.join(", ") || "Autoria não informada";
    const editions = work.editions?.docs;
    if (editions?.length) {
      for (const ed of editions) {
        const b = makeEdition(work.key, author, ed, work.title);
        result.set(b.editionKey ?? work.key, b);
      }
    } else {
      result.set(work.key, {
        workKey: work.key,
        editionKey: null,
        author,
        title: work.title,
        coverUrl: cover(work.cover_i),
      });
    }
  }
  return [...result.values()];
}

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);
  private cache = new Map<string, Cached>();
  private ongoing = new Map<string, Promise<CatalogBook[]>>();
  private nextSlot = 0;

  search(query: string) {
    const isbn = query.replace(/[\s-]/g, "");
    const params = new URLSearchParams({
      q: /^(?:\d{9}[\dXx]|\d{13})$/.test(isbn) ? "isbn:" + isbn : query,
      lang: "pt",
      limit: "18",
      fields:
        "key,title,author_name,cover_i,editions,editions.key,editions.title,editions.cover_i,editions.language",
    });
    return this.load("search:" + params, "/search.json?" + params, (payload) =>
      searchResults((payload as { docs?: Work[] }).docs ?? []),
    );
  }

  editions(key: string, author: string) {
    return this.load(
      "editions:" + key + ":" + author,
      key + "/editions.json?limit=100",
      (payload) => {
        const entries = (payload as { entries?: Edition[] }).entries ?? [];
        const portuguese = (e: Edition) =>
          e.languages?.some((l) => l.key === "/languages/por") ? 1 : 0;
        return entries
          .filter((e) => e.title && /^\/books\/OL\d+M$/.test(e.key || ""))
          .sort((a, b) => portuguese(b) - portuguese(a))
          .map((ed) => makeEdition(key, author, ed, ed.title!));
      },
    );
  }

  private load(
    key: string,
    path: string,
    convert: (payload: unknown) => CatalogBook[],
  ) {
    const hit = this.cache.get(key);
    if (hit && hit.until > Date.now()) return Promise.resolve(hit.books);
    const inProgress = this.ongoing.get(key);
    if (inProgress) return inProgress;
    const now = Date.now();
    const wait = Math.max(0, this.nextSlot - now);
    if (wait > 4000)
      throw new HttpException(
        "O catálogo está ocupado. Tente novamente em instantes.",
        429,
      );
    this.nextSlot = now + wait + 1100;
    const request = (async () => {
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
      const started = Date.now();
      try {
        const contact = process.env.OPEN_LIBRARY_CONTACT?.trim();
        const response = await fetch("https://openlibrary.org" + path, {
          signal: AbortSignal.timeout(20000),
          headers: {
            "User-Agent": contact
              ? `Paginarium/1.0 (${contact}; +https://github.com/Kinu1/paginarium)`
              : "Paginarium/1.0 (+https://github.com/Kinu1/paginarium)",
            Accept: "application/json",
          },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const books = convert(await response.json());
        if (this.cache.size >= 160)
          this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(key, { books, until: Date.now() + 10 * 60_000 });
        return books;
      } catch (error) {
        let reason = "Erro de rede";
        if (error instanceof Error) {
          reason = /^HTTP \d{3}$/.test(error.message) ? error.message : error.name;
          const cause = error.cause;
          if (cause instanceof Error && "code" in cause &&
              typeof cause.code === "string" && /^[A-Z0-9_]+$/.test(cause.code)) {
            reason += " " + cause.code;
          }
        }
        this.logger.warn(`Open Library: ${reason} após ${Date.now() - started} ms`);
        throw new ServiceUnavailableException(
          "O catálogo está indisponível. Tente novamente ou adicione o livro manualmente.",
        );
      } finally {
        this.ongoing.delete(key);
      }
    })();
    this.ongoing.set(key, request);
    return request;
  }
}
