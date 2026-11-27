import {
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import sharp from "sharp";
import { z } from "zod";
import { parse } from "./validation.js";

export const maxCoverBytes = 150 * 1024;
export const CoverInterceptor = FileInterceptor("file", {
  limits: {
    // O parser sinaliza truncamento ao atingir o limite, inclusive quando o arquivo termina ali.
    fileSize: maxCoverBytes + 1,
    files: 1,
    fields: 1,
    fieldSize: 8192,
    parts: 3,
  },
});
export type UploadedCover = { buffer: Buffer; mimetype: string };
export type Cover = { bytes: Uint8Array<ArrayBuffer>; mime: string };

export async function checkCover(
  file?: UploadedCover,
): Promise<Cover | undefined> {
  if (!file) return undefined;
  if (file.buffer.byteLength > maxCoverBytes)
    throw new PayloadTooLargeException("Use uma capa de até 150 KiB.");
  const formats: Record<string, string> = {
    "image/jpeg": "jpeg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const expected = formats[file.mimetype];
  if (!expected)
    throw new UnsupportedMediaTypeException(
      "A capa precisa ser JPEG, PNG ou WebP.",
    );
  try {
    const image = sharp(file.buffer, {
      failOn: "warning",
      limitInputPixels: 16_000_000,
    });
    const metadata = await image.metadata();
    if (metadata.format !== expected || (metadata.pages ?? 1) > 1)
      throw new Error("Formato incompatível.");
    // A leitura dos pixels verifica também o conteúdo além do cabeçalho do arquivo.
    await image.resize(1, 1).raw().toBuffer();
  } catch {
    throw new BadRequestException(
      "Arquivo de capa inválido ou imagem muito grande.",
    );
  }
  return { bytes: Uint8Array.from(file.buffer), mime: file.mimetype };
}

export function bookInput<T>(
  contentType: string | undefined,
  body: unknown,
  schema: z.ZodType<T>,
): T {
  if (!contentType?.toLowerCase().startsWith("multipart/form-data"))
    return parse(schema, body);
  const { data } = parse(z.strictObject({ data: z.string() }), body);
  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    throw new BadRequestException("O campo data precisa conter JSON válido.");
  }
  return parse(schema, payload);
}
