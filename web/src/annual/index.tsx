import { useEffect, useRef, useState } from 'react';
import { Check, Heart, Trophy } from 'lucide-react';
import type { Book, YearState } from '../../../shared/contracts';
import type { Journal } from '../data';
import { BookCover } from '../components/BookCover';
import { bracket, colors, inMonth, letters, months, squares } from './model';
import './annual.css';

type Props = {books: Book[]; journal: Journal};
type Group = keyof Omit<YearState,'revision'>;
type Category = 'Bingo' | 'De A a Z' | 'Arco-íris' | 'Favoritos';
const categories: Category[] = ['Bingo','De A a Z','Arco-íris','Favoritos'];

function AnnualBook({book}: {book: Book}) {
  return <span className="an-book">
    <span className="an-cover" aria-hidden="true"><BookCover title={book.title} coverUrl={book.coverUrl}/></span>
    <span className="an-book-title">{book.title}</span>
  </span>;
}

export function Annual({books,journal}: Props) {
  const now = new Date().getFullYear();
  const [year,setYear] = useState(now);
  const years = [...new Set([now,now-1,now+1,year,...books.flatMap(b => [
    ...b.plannedYears, ...b.readings.flatMap(r => r.finished ? [+r.finished.slice(0,4)] : [])
  ])])].sort((a,b) => b-a);
  return <section className="annual"><header className="an-year"><label>Diário de <select value={year} onChange={e=>setYear(Number(e.target.value))}>{years.map(y=><option key={y}>{y}</option>)}</select></label></header>
    <YearJournal key={year} books={books} journal={journal} year={year}/></section>;
}
function YearJournal({books,journal,year}:Props & {year:number}) {
  const [state,setState] = useState<YearState|null>(null);
  const [category,setCategory] = useState<Category>('Bingo');
  const [selection,setSelection] = useState<{group:Group,key:string,label:string}|null>(null);
  const choiceButton = useRef<HTMLButtonElement|null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [reload,setReload] = useState(0);
  useEffect(()=>{
    let live = true;
    setState(null);
    setError('');
    journal.getYear(year).then(s=>{if(live)setState(s)}).catch(()=>{if(live)setError('Não foi possível abrir o diário anual.')});
    return ()=>{live=false};
  },[journal,year,reload]);
  const available = books.filter(b=>b.readings.some(r=>r.finished?.startsWith(year+'-')));
  const booksById = new Map(books.map(book=>[book.id,book]));
  function closePicker() {
    setSelection(null);
    requestAnimationFrame(()=>choiceButton.current?.focus());
  }
  async function select(group:Group,key:string,id:string) {
    if (!state || busy) return;
    const next = {...state,[group]:{...state[group]}};
    if(id) next[group][key] = id; else delete next[group][key];
    setBusy(true); setError('');
    try { setState(await journal.saveYear(year,next)); if (selection) closePicker(); }
    catch(reason) {setError(reason instanceof Error ? reason.message : 'Não foi possível salvar a escolha.');}
    finally {setBusy(false);}
  }
  if(!state) return <div role="status">{error || 'Abrindo o diário anual…'} {error && <button onClick={()=>setReload(n=>n+1)}>Tentar novamente</button>}</div>;
  const nominees=months.map((_,i)=>available.find(b=>b.id===state.monthly[String(i+1)] && inMonth(b,year,i+1))?.id || '');
  const tournament=bracket(nominees,state.rounds);
  const winner = booksById.get(tournament.winner);
  const group = category==='Bingo' ? 'squares' : category==='De A a Z' ? 'letters' : 'colors';
  const items=category==='Bingo'?squares:category==='De A a Z'?letters:Object.keys(colors);
  return <>
    <nav aria-label="Desafios anuais" className="an-tabs">{categories.map(c=><button key={c} aria-pressed={category===c} onClick={()=>{setCategory(c);setSelection(null)}}>{c}</button>)}</nav>
    {error && <p role="alert">{error} <button onClick={()=>{setSelection(null);setReload(n=>n+1)}}>Atualizar o diário</button></p>}
    {category!=='Favoritos' ? <>
      <div className="an-heading"><h2>{category==='Bingo'?'Bingo literário':category==='De A a Z'?'Um título por letra':'Arco-íris de capas'}</h2><span>{Object.keys(state[group]).length} de {category==='Bingo'?24:items.length}</span></div>
      <div className={'an-grid an-'+group}>{items.map((label,i)=>{
        const key=group==='squares'?String(i):label, value=state[group][key];
        const book = booksById.get(value);
        if(group==='squares' && i===12) return <div className="an-free" key={key}><img src="/marca/lua.png" alt=""/><span>Casa livre</span></div>;
        return <button disabled={busy} key={key} className={'an-cell'+(value?' chosen':'')} onClick={event=>{
          choiceButton.current=event.currentTarget;
          setSelection({group,key,label});
        }}>
          {group==='colors'
            ? <span className="an-color-label"><i aria-hidden="true" style={{background:colors[label]}}/><strong>{label}</strong></span>
            : <strong>{label}</strong>}
          {group==='colors' && book
            ? <AnnualBook book={book}/>
            : value && <small><Check aria-hidden="true" size={13}/>{value==='*'?'Concluído':book?.title ?? 'Livro indisponível'}</small>}</button>;
      })}</div>
      {selection&&<section className="an-picker"><h3>{selection.label}</h3><label>Vincular um livro da estante<select autoFocus disabled={busy} defaultValue={state[selection.group][selection.key]||''} key={selection.group+selection.key}
        onChange={e=>void select(selection.group,selection.key,e.target.value)}>
        <option value="">Selecione um livro</option>{selection.group==='squares'&&<option value="*">Marcar como concluído</option>}
        {books.map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select></label>
        <div>{state[selection.group][selection.key]&&<button disabled={busy} onClick={()=>void select(selection.group,selection.key,'')}>Limpar escolha</button>}
        <button disabled={busy} onClick={closePicker}>Fechar</button></div></section>}
    </> : <>
      <div className="an-heading"><h2>Favoritos do mês</h2><Heart size={22}/></div>
      <div className="an-months">{months.map((m,i)=>{
        const choices=available.filter(b=>inMonth(b,year,i+1));
        return <label key={m}>{m}<select disabled={!choices.length||busy} value={nominees[i]} onChange={e=>void select('monthly',String(i+1),e.target.value)}>
          <option value="">{choices.length?'Escolha um favorito':'Nenhuma leitura'}</option>{choices.map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select></label>;
      })}</div>
      <div className="an-heading"><h2>Favorito do ano</h2><Trophy size={22}/></div>
      {!nominees.some(Boolean)&&<p>Escolha um favorito mensal para iniciar as rodadas.</p>}
      {tournament.stages.map((stage,i)=>{
        const matches=stage.filter(m=>!m.pending && m.pair.length>1);
        return matches.length>0&&<section className="an-round" key={i}><h3>{['Primeira rodada','Quartas de final','Semifinal','Final'][i]}</h3>{matches.map(m=>
          <div className="an-match" key={m.key}>{m.pair.map(id=>{
            const candidate = booksById.get(id);
            return candidate && <button disabled={busy} key={id} aria-pressed={m.winner===id} onClick={()=>void select('rounds',m.key,id)}>
              <AnnualBook book={candidate}/>
            </button>;
          })}</div>)}</section>;
      })}
      {winner&&<p className="an-winner" role="status"><Trophy aria-hidden="true" size={20}/><AnnualBook book={winner}/></p>}
    </>}
  </>;
}
