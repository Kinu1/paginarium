import assert from 'node:assert/strict'
import { test } from 'node:test'
import { activityByDay, completedByWork, ratingText, setStatus } from './model.ts'
import { draftKey, recoverDraft } from './draft.ts'
import { withReadingDefaults, pageProgress, readingProblem } from './readingDefaults.ts'

const book = { id: 'b', revision: 1, workKey: '/works/OL1W', status: 'want',
  title: 'A ilha', author: 'Lua', tags: ['nacional', 'romance'], plannedYears: [], readings: [] }
const filters = { year: 2026, month: '', tags: [], rating: '', format: '', favorite: false }
const january = { id: 'r1', format: 'physical', days: [], finished: '2026-01', rating: null, favorite: false, review: '' }
const october = { id: 'r2', format: 'audio', days: ['2026-10-01', '2026-10-03'], finished: '2026-10-04', rating: 0, favorite: true, review: 'Ouvi na viagem.' }

test('cada mês abre a ficha correspondente e o ano agrupa por obra', () => {
  const books = [{ ...book, status: 'read', readings: [january, october] }]
  const year = completedByWork(books, filters)
  assert.equal(year.length, 1)
  assert.equal(year[0].length, 2)
  assert.equal(completedByWork(books, { ...filters, month: '01' })[0][0].reading.id, january.id)
  assert.equal(completedByWork(books, { ...filters, month: '10' })[0][0].reading.id, october.id)
  assert.equal(completedByWork(books, { ...filters, tags: ['romance', 'nacional'], format: 'audio', favorite: true, rating: '0' })[0][0].reading.id, october.id)
  assert.equal(completedByWork(books, { ...filters, format: 'audio', rating: 'none' }).length, 0)
  assert.equal(completedByWork(books, { ...filters, rating: 'none' })[0][0].reading.id, january.id)
})

test('calendário une livros na data correta, sem supor dias pela conclusão', () => {
  const second = { ...book, id: 'b2', workKey: null, readings: [{ ...october, id: 'r3', days: ['2026-10-01'], finished: null }] }
  const books = [{ ...book, readings: [january, october] }, second]
  const days = activityByDay(books, filters, '2026-10')
  assert.equal(days.size, 2)
  assert.deepEqual(days.get('2026-10-01').map(entry => entry.book.id), ['b', 'b2'])
  assert.equal(days.has('2026-10-02'), false)
  assert.equal(activityByDay(books, filters, '2026-01').size, 0)
})

test('nova releitura preserva a anterior e distingue zero, meia lua e sem nota', () => {
  const first = setStatus(book, 'read', '2026-01-15')
  const second = setStatus(first, 'rereading')
  const complete = setStatus(second, 'read', '2026-10-12')
  assert.equal(complete.readings.length, 2)
  assert.equal(complete.readings[0].finished, '2026-01-15')
  assert.equal(complete.readings[1].finished, '2026-10-12')
  assert.notEqual(complete.readings[0].id, complete.readings[1].id)
  assert.equal(ratingText(4.5), '4,5 de 5 luas')
  assert.notEqual(ratingText(0), ratingText(null))
})

test('o rascunho respeita a conta e conserva campos editados no outro aparelho', () => {
  assert.notEqual(draftKey('u1', 'b'), draftKey('u2', 'b'))
  assert.notEqual(draftKey('a:b', 'c'), draftKey('a', 'b:c'))
  const original = { ...book, status: 'read', readings: [january] }
  const local = { ...original, readings: [{ ...january, review: 'Minha frase' }] }
  const remote = { ...original, revision: 2, tags: ['outra'], readings: [{ ...january, favorite: true, review: 'Frase do celular' }] }
  const saved = recoverDraft({ base: original, book: local, readingId: january.id }, remote)
  assert.deepEqual(saved.tags, ['outra'])
  assert.equal(saved.revision, 2)
  assert.equal(saved.readings[0].favorite, true)
  assert.equal(saved.readings[0].review, 'Frase do celular\n\nMinha frase')
})

test('duas releituras iniciadas em paralelo viram uma ficha ativa com ambos os textos e dias', () => {
  const original = { ...book, status: 'read', readings: [january] }
  const remoteReading = { ...october, id: 'r2', finished: null, review: 'Texto do celular', days: ['2026-10-03'] }
  const localReading = { ...october, id: 'r3', finished: null, review: 'Texto do computador', days: ['2026-10-02'] }
  const remote = { ...original, revision: 2, status: 'rereading', readings: [january, remoteReading] }
  const local = { ...original, status: 'rereading', readings: [january, localReading] }
  const merged = recoverDraft({ base: original, book: local, readingId: localReading.id }, remote)
  assert.equal(merged.readings.length, 2)
  const active = merged.readings.filter(r => r.finished === null)
  assert.equal(active.length, 1)
  assert.equal(active[0].id, remoteReading.id)
  assert.equal(active[0].review, 'Texto do celular\n\nTexto do computador')
  assert.deepEqual(active[0].days, ['2026-10-02', '2026-10-03'])
})

test('abandonar e retomar mantém a ficha com a mesma data, páginas e percentual', () => {
  const first = setStatus(book,'reading','2026-01-04')
  const active = {...first.readings[0],currentPage:0,totalPages:180,progressPercent:0}
  const paused = setStatus({...first,readings:[active]},'abandoned')
  const resumed = setStatus(paused,'reading','2026-02-05')
  assert.deepEqual(resumed.readings,[active])
  assert.equal(resumed.readings[0].started,'2026-01-04')
  assert.equal(setStatus(book,'read','2026-01-15').readings[0].started,null)
  assert.equal(ratingText(4.25),'4,25 de 5 luas')
  assert.equal(ratingText(4.75),'4,75 de 5 luas')
})

test('livros antigos carregam campos vazios e validar progresso respeita zero e mês de conclusão',()=>{
  const legacy=withReadingDefaults({...book,readings:[january]}).readings[0]
  assert.equal(legacy.started,null)
  assert.equal(legacy.progressPercent,null)
  assert.equal(pageProgress(0,100),0)
  assert.equal(pageProgress(21,40),53)
  assert.equal(pageProgress(101,100),null)
  assert.equal(readingProblem({...legacy,started:'2026-01-31'}),null)
  assert.ok(readingProblem({...legacy,started:'2026-02-01'}))
  assert.ok(readingProblem({...legacy,currentPage:101,totalPages:100}))
})
