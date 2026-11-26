import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { setTimeout as pause } from 'node:timers/promises';

const migrations = new URL('../api/prisma/migrations/', import.meta.url);
const runId = randomUUID();
let containerId;

function docker(args, input) {
  return execFileSync('docker', args, {
    input, maxBuffer: 32 * 1024 * 1024, timeout: 120_000, windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}
function sql(database, query) {
  return docker(['exec', '-i', containerId, 'psql', '-X', '-q', '-A', '-t',
    '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], query).toString('utf8').trim();
}

const fixtures = `
INSERT INTO "Book" ("id", "owner", "identity", "title", "author", "status", "tags", "plannedYears")
VALUES ('ee358076-bb0a-49ac-874d-2e8c473c2b41', 'leitora-ficticia', 'manual:mar', 'Mar de Papel', 'Lua do Sul', 'read', ARRAY['aventura'], ARRAY[2025]);

INSERT INTO "Reading" ("bookId", "id", "position", "format", "days", "finished", "rating", "favorite", "review")
VALUES ('ee358076-bb0a-49ac-874d-2e8c473c2b41', '4506844a-f41b-4cda-8dff-32d2a102bbc3', 0, 'physical', ARRAY[]::text[], '2025-01', 0, FALSE, 'Uma resenha fictícia sobre o primeiro encontro.'),
       ('ee358076-bb0a-49ac-874d-2e8c473c2b41', '00d67465-9dc8-4497-a639-96b8173d48dc', 1, 'audio', ARRAY['2025-10-03', '2025-10-08'], '2025-10-08', 4.5, TRUE, 'Na releitura, a voz mudou a minha impressão.');

INSERT INTO "JournalYear" ("owner", "year", "squares", "letters", "colors", "monthly", "rounds")
VALUES ('leitora-ficticia', 2025, '{"1":"*"}', '{}', '{}', '{"10":"ee358076-bb0a-49ac-874d-2e8c473c2b41"}', '{}');
`;
function snapshot(database) {
  const result = sql(database, `
    SELECT jsonb_build_object(
      'livros', (SELECT jsonb_agg(b ORDER BY b.id) FROM "Book" b),
      'fichas', (SELECT jsonb_agg(r ORDER BY r.position) FROM "Reading" r),
      'anos', (SELECT jsonb_agg(y ORDER BY y.year) FROM "JournalYear" y)
    );
  `);
  return JSON.parse(result);
}

try {
  const result = docker(['run', '--rm', '-d', '--network', 'none', '--label', 'paginarium.restauracao=' + runId,
    '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_DB=origem', 'postgres:17']);
  const id = result.toString().trim();
  assert.match(id, /^[0-9a-f]{64}$/);
  containerId = id;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      // O servidor temporário do initdb só escuta em socket; TCP indica a instância definitiva.
      docker(['exec', id, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'origem']);
      ready = true;
      break;
    } catch {
      await pause(500);
    }
  }
  assert.ok(ready, 'O PostgreSQL de testes não iniciou.');
  const dirs = readdirSync(migrations, { withFileTypes: true }).filter(dir => dir.isDirectory()).map(dir => dir.name).sort();
  assert.ok(dirs.length, 'Nenhuma migração encontrada.');
  for (const dir of dirs) sql('origem', readFileSync(new URL(dir + '/migration.sql', migrations), 'utf8'));
  sql('origem', fixtures);
  const original = snapshot('origem');
  assert.equal(original.livros.length, 1);
  assert.deepEqual(original.fichas.map(f => f.rating), [0, 4.5]);
  assert.deepEqual(original.fichas.map(f => f.finished), ['2025-01', '2025-10-08']);
  assert.equal(original.anos.length, 1);

  const archive = docker(['exec', id, 'pg_dump', '--format=custom', '--no-owner', '--no-acl', '-U', 'postgres', '-d', 'origem']);
  assert.equal(archive.subarray(0, 5).toString(), 'PGDMP');
  docker(['exec', id, 'createdb', '-U', 'postgres', 'restaurada']);
  docker(['exec', '-i', id, 'pg_restore', '--exit-on-error', '--single-transaction', '--no-owner', '--no-acl',
    '-U', 'postgres', '-d', 'restaurada'], archive);
  assert.deepEqual(snapshot('restaurada'), original);
  console.log('Restauração verificada: livro, duas fichas, resenhas, datas, notas e escolhas anuais idênticos.');
} finally {
  if (containerId) {
    const label = docker(['inspect', '--format', '{{ index .Config.Labels "paginarium.restauracao" }}', containerId]).toString().trim();
    assert.equal(label, runId);
    docker(['rm', '--force', '--volumes', containerId]);
  }
}
