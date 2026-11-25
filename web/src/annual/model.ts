import type { Book, YearState } from '../../../shared/contracts';

export const months = Array.from({ length: 12 }, (_, m) =>
  new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2020, m, 1)));
export const squares = [
  'Autoria brasileira', 'Mais de 500 páginas', 'Publicado neste ano', 'Letra L no título', 'Novo autor',
  'Livro comentado do ano', 'Uma leitura que emocionou', 'Outro país como cenário', 'Volume único', 'Desafio do ano concluído',
  'Cinco luas', 'Indicação do BookTok', 'Casa livre', 'Capa rosa', 'Romance',
  'Personagem favorito', 'Leitura de madrugada', 'Quatro livros no mês', 'Uma saga concluída', 'Três livros no mês',
  'Leitura com música', 'Livro físico', 'No transporte público', 'Livro comprado', 'Escolhido pela capa',
];
export const colors: Record<string,string> = {
  Vermelho:'#ab4b51', Laranja:'#cb723f', Amarelo:'#c49b37', Verde:'#54795d', Azul:'#4e769d', Anil:'#4b4d7d', Violeta:'#81628b',
};
export const letters = Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
export const inMonth = (book:Book, year:number, month:number) =>
  book.readings.some(r => r.finished?.slice(0,7) === year + '-' + String(month).padStart(2,'0'));

export function bracket(monthly: string[], rounds: YearState['rounds']) {
  // Quatro vagas livres distribuem os doze meses entre as duas metades da chave.
  let current = [monthly[0], '', monthly[1], monthly[2], monthly[3], '', monthly[4], monthly[5],
    monthly[6], '', monthly[7], monthly[8], monthly[9], '', monthly[10], monthly[11]]
    .map(id => ({ id: id || '', pending: false }));
  const stages: {key:string; pair:string[]; winner:string; pending:boolean}[][] = [];
  while (current.length > 1) {
    const next = [];
    const matches = [];
    for (let n = 0; n < current.length; n += 2) {
      const a = current[n], b = current[n + 1];
      const pair = [...new Set([a.id,b.id].filter(Boolean))];
      const pending = a.pending || b.pending;
      const key = 'r' + stages.length + '-' + n / 2;
      const winner = pending ? '' : pair.length === 1 ? pair[0] : pair.includes(rounds[key]) ? rounds[key] : '';
      matches.push({key,pair,winner,pending});
      next.push({id:winner, pending:pending || (pair.length > 1 && !winner)});
    }
    stages.push(matches);
    current = next;
  }
  return { stages, winner:current[0].id };
}
