import { z } from "zod";
import { uuid } from "../validation.js";

export const formats = z.enum([
  "list",
  "bingo",
  "alphabet",
  "rainbow",
  "competition",
]);
const fixed = {
  bingo: Array.from({ length: 25 }, (_, i) => String(i)).filter(
    (k) => k !== "12",
  ),
  alphabet: [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"],
  rainbow: [
    "Vermelho",
    "Laranja",
    "Amarelo",
    "Verde",
    "Azul",
    "Anil",
    "Violeta",
  ],
  competition: [],
};
const key = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[\p{L}\p{N}_-]+$/u)
  .refine((k) => !["__proto__", "prototype", "constructor"].includes(k));
export const rulesSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1200),
    instructions: z.string().trim().max(4000),
    format: formats,
    items: z
      .array(z.strictObject({ key, label: z.string().trim().min(1).max(300) }))
      .max(100),
  })
  .superRefine((rules, ctx) => {
    const keys = new Set(rules.items.map((i) => i.key));
    if (keys.size !== rules.items.length)
      ctx.addIssue({
        code: "custom",
        message: "Dê uma chave diferente a cada item.",
      });
    if (rules.format === "list") {
      if (!keys.size)
        ctx.addIssue({
          code: "custom",
          message: "Inclua pelo menos uma meta na lista.",
        });
      return;
    }
    const expected: string[] = fixed[rules.format];
    if (expected.length !== keys.size || expected.some((k) => !keys.has(k)))
      ctx.addIssue({
        code: "custom",
        message: "Os itens devem corresponder às posições deste formato.",
      });
  });
export const progressSchema = z.record(
  key,
  z.union([uuid, z.literal("*")]),
);
export type Rules = z.infer<typeof rulesSchema>;
export type Format = z.infer<typeof formats>;
