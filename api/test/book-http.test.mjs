import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import sharp from "sharp";
import { BooksController } from "../dist/controllers.js";
import { LibraryService } from "../dist/library.service.js";
import { maxCoverBytes } from "../dist/book-cover.js";

test("Nest encaminha JSON e multipart, oferece capa privada sem cache e responde 204 na exclusão", async () => {
  const id = randomUUID();
  const image = await sharp({
    create: { width: 2, height: 3, channels: 3, background: "green" },
  })
    .png()
    .toBuffer();
  const calls = [];
  const library = {
    add(_owner, data, cover) {
      calls.push({ data, cover });
      return { id };
    },
    metadata(_owner, bookId, data, cover) {
      calls.push({ bookId, data, cover });
      return { id: bookId };
    },
    cover() {
      return { bytes: image, mime: "image/png" };
    },
    remove(_owner, bookId, revision) {
      calls.push({ bookId, revision });
    },
  };
  class TestModule {}
  Module({
    controllers: [BooksController],
    providers: [{ provide: LibraryService, useValue: library }],
  })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  try {
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl();
    function form(data, bytes = image) {
      const body = new FormData();
      body.append("data", JSON.stringify(data));
      body.append("file", new Blob([bytes], { type: "image/png" }), "capa.png");
      return body;
    }
    const data = { title: "Livro", author: "Ana", coverUrl: null };
    const created = await fetch(base + "/books", {
      method: "POST",
      body: form(data),
    });
    assert.equal(created.status, 201, await created.text());
    assert.deepEqual(calls[0].data, data);
    assert.deepEqual(Buffer.from(calls[0].cover.bytes), image);
    const path = base + "/books/" + id;
    const patched = await fetch(path, {
      method: "PATCH",
      body: form({ revision: 1 }),
    });
    assert.equal(patched.status, 200, await patched.text());
    assert.equal(calls[1].bookId, id);
    const edit = await fetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision: 2, coverUrl: null }),
    });
    assert.equal(edit.status, 200);
    assert.equal(calls[2].cover, undefined);
    const atLimit = Buffer.alloc(maxCoverBytes);
    image.copy(atLimit);
    const full = await fetch(path, {method:"PATCH",body:form({revision:3},atLimit)});
    assert.equal(full.status,200,await full.text());
    const tooLarge = await fetch(path, {
      method: "PATCH",
      body: form({ revision: 3 }, Buffer.alloc(maxCoverBytes + 1)),
    });
    assert.equal(tooLarge.status, 413);
    const photo = await fetch(path + "/cover");
    assert.equal(photo.status, 200);
    assert.equal(photo.headers.get("cache-control"), "private, no-store");
    assert.equal(photo.headers.get("content-type"), "image/png");
    assert.deepEqual(Buffer.from(await photo.arrayBuffer()), image);
    assert.equal(
      (await fetch(base + "/books/" + id.toUpperCase() + "?revision=3", { method: "DELETE" })).status,
      204,
    );
    assert.deepEqual(calls.at(-1), { bookId: id, revision: 3 });
  } finally {
    await app.close();
  }
});
