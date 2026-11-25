import test from 'node:test';
import assert from 'node:assert/strict';
import { bracket, inMonth } from './model.ts';

test('o favorito pode ser escolhido com meses vazios e reavalia a chave ao trocar um finalista', () => {
  const months = Array(12).fill('');
  months[0] = 'primeiro';
  months[6] = 'segundo';
  assert.equal(bracket(months, {}).winner, '');
  const rounds = {'r3-0':'primeiro'};
  assert.equal(bracket(months, rounds).winner, 'primeiro');
  months[0] = 'terceiro';
  assert.equal(bracket(months, rounds).winner, '');
  months[6] = '';
  assert.equal(bracket(months, {}).winner, 'terceiro');
});

test('um livro pode concorrer em cada mês em que foi concluído', () => {
  const book = {readings:[{finished:'2025-01'}, {finished:'2025-10-20'}, {finished:null}]};
  assert.ok(inMonth(book,2025,1));
  assert.ok(inMonth(book,2025,10));
  assert.equal(inMonth(book,2025,9), false);
});
