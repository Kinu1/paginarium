import { BadRequestException } from "@nestjs/common";
import { z } from "zod";

const uuid = z.uuid();
const year = z.number().int().min(1).max(9999);
const monthPattern = /^([0-9]{4})-(0[1-9]|1[0-2])$/;
const dayPattern = /^([0-9]{4})-(0[1-9]|1[0-2])-([0-9]{2})$/;

function validDay(value: string) {
  if (!dayPattern.test(value) || value.startsWith("0000")) return false;
  const date = new Date(value + "T12:00:00Z");
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

const completed = z
  .string()
  .refine(
    (value) =>
      validDay(value) ||
      (monthPattern.test(value) && !value.startsWith("0000")),
  );
const labels = z.string().trim().min(1).max(64);
const workKey = z.string().regex(/^\/works\/OL\d{1,16}W$/);
const editionKey = z.string().regex(/^\/books\/OL\d{1,16}M$/);
const cover = z.url({ protocol: /^https$/ }).max(2048);
export const createBook = z.strictObject({
  title: z.string().trim().min(1).max(500),
  author: z.string().trim().min(1).max(500),
  coverUrl: cover.nullish(),
  workKey: workKey.nullish(),
  editionKey: editionKey.nullish(),
});
const revisionNumber = z.number().int().min(1).max(2147483646);
export const patchBook = createBook
  .pick({ title: true, author: true, coverUrl: true })
  .partial()
  .extend({ revision: revisionNumber });

export const reading = z
  .strictObject({
    id: uuid,
    format: z.enum(["physical", "ebook", "audio"]),
    started: z.string().refine(validDay).nullish(),
    currentPage: z.number().int().min(0).max(2147483647).nullish(),
    totalPages: z.number().int().min(1).max(2147483647).nullish(),
    progressPercent: z.number().min(0).max(100).nullish(),
    days: z
      .array(z.string().refine(validDay))
      .max(20000)
      .refine((days) => new Set(days).size === days.length),
    finished: completed.nullable(),
    rating: z.number().min(0).max(5).multipleOf(0.25).nullable(),
    favorite: z.boolean(),
    review: z.string().max(30000),
  })
  .superRefine((r, ctx) => {
    if (
      r.format !== "audio" &&
      r.currentPage != null &&
      r.totalPages != null &&
      r.currentPage > r.totalPages
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["currentPage"],
        message: "A página atual supera o total de páginas.",
      });
    }
    const start = r.started;
    if (
      start &&
      (r.days.some((day) => day < start) ||
        (r.finished && start.slice(0, r.finished.length) > r.finished))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["started"],
        message:
          "O início precisa anteceder as datas registradas e a conclusão.",
      });
    }
    if (!r.finished && (r.favorite || r.rating !== null))
      ctx.addIssue({
        code: "custom",
        message: "Conclua a leitura antes de avaliar ou favoritar.",
      });
    const end = r.finished;
    if (end && r.days.some((day) => day.slice(0, end.length) > end))
      ctx.addIssue({
        code: "custom",
        path: ["days"],
        message:
          "O último dia registrado deve ser anterior ou igual à conclusão.",
      });
  });

export const updateBook = z
  .strictObject({
    revision: revisionNumber,
    status: z.enum(["want", "reading", "rereading", "read", "abandoned"]),
    tags: z
      .array(labels)
      .max(40)
      .transform((tags) => Array.from(new Set(tags))),
    plannedYears: z
      .array(year)
      .max(250)
      .transform((years) => Array.from(new Set(years)).sort((a, b) => a - b)),
    readings: z.array(reading).max(300),
  })
  .superRefine((b, ctx) => {
    if (new Set(b.readings.map((r) => r.id)).size !== b.readings.length)
      ctx.addIssue({
        code: "custom",
        path: ["readings"],
        message: "As leituras devem ter identificadores distintos.",
      });
    if (b.readings.filter((r) => !r.finished).length > 1)
      ctx.addIssue({
        code: "custom",
        path: ["readings"],
        message: "Apenas uma leitura pode estar em andamento.",
      });
    if (
      b.status === "read" &&
      (!b.readings.length || b.readings.some((r) => !r.finished))
    )
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: "Informe a conclusão de cada leitura.",
      });
  });

const key = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[\p{L}\p{N}_-]+$/u)
  .refine((k) => !["__proto__", "constructor", "prototype"].includes(k));
const choices = (max: number, mark = false) =>
  z
    .record(key, mark ? z.union([uuid, z.literal("*")]) : uuid)
    .refine((map) => Object.keys(map).length <= max);
export const updateYear = z.strictObject({
  revision: z.number().int().min(0).max(2147483646),
  squares: choices(25, true),
  letters: choices(26),
  colors: choices(16),
  monthly: choices(12),
  rounds: choices(32),
});

export const parseYear = (value: string) => {
  if (!/^[0-9]{4}$/.test(value)) throw new BadRequestException("Ano inválido.");
  return parse(year, Number(value));
};
export const parseId = (value: string) => parse(uuid, value);
export const parseRevision = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{1,10}$/.test(value))
    throw new BadRequestException("Informe a revisão do livro.");
  return parse(revisionNumber, Number(value));
};
export const parseWork = (value: unknown) => parse(workKey, value);
export const parseQuery = (value: unknown) =>
  parse(z.string().trim().min(1).max(200), value);

export function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new BadRequestException(
      first.code === "custom" && first.message !== "Invalid input"
        ? first.message
        : "Valor inválido em " + (first.path.join(".") || "requisição") + ".",
    );
  }
  return result.data;
}
export type NewBook = z.infer<typeof createBook>;
export type BookMetadata = z.infer<typeof patchBook>;
export type BookChanges = z.infer<typeof updateBook>;
export type YearChanges = z.infer<typeof updateYear>;
