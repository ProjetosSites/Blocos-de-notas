'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive, ArrowLeft, Bell, BookOpen, Check, CheckSquare, ChevronRight, Clipboard,
  CloudOff, Copy, Download, Edit3, FileImage, Folder, Grid2X2, Heart, Image as ImageIcon,
  Lightbulb, List, Menu, MoreHorizontal, Palette, PenLine, Pin, Plus, RotateCcw, Search,
  Settings, Share2, Sparkles, Star, Trash2, Type, Upload, X, Zap,
} from 'lucide-react'

type ModelId = 'simple' | 'grid' | 'tasks' | 'icons' | 'quick' | 'reminder' | 'drawing' | 'categories' | 'images' | 'yellow'
type Note = { id: string; title: string; content: string; model: ModelId; favorite: boolean; pinned: boolean; category?: string; createdAt: string; updatedAt: string; deleted?: boolean; drawing?: string; tasks?: { text: string; done: boolean }[] }

const models: { id: ModelId; name: string; description: string; icon: typeof PenLine; tone: string; preview: string }[] = [
  { id: 'simple', name: 'Notas simples', description: 'Para textos e informações gerais', icon: PenLine, tone: 'coral', preview: 'Uma ideia por linha...\nOrganize seus pensamentos\nsem complicação.' },
  { id: 'grid', name: 'Notas quadriculadas', description: 'Cálculos, esquemas e desenhos', icon: Grid2X2, tone: 'sky', preview: 'x² + y² = r²\n┌───┬───┐\n│   │   │' },
  { id: 'tasks', name: 'Lista de tarefas', description: 'Acompanhe seu progresso', icon: CheckSquare, tone: 'mint', preview: '✓ Revisar apresentação\n○ Comprar ingredientes\n○ Responder e-mails' },
  { id: 'icons', name: 'Notas com ícones', description: 'Ideias com marcadores visuais', icon: Sparkles, tone: 'lavender', preview: '💡 Ideia principal\n📌 Ponto importante\n→ Próximo passo' },
  { id: 'quick', name: 'Notas rápidas', description: 'Capture antes que escape', icon: Zap, tone: 'yellow', preview: 'Ligar para a Ana\nantes das 18h' },
  { id: 'reminder', name: 'Lembretes', description: 'Data, horário e alertas', icon: Bell, tone: 'peach', preview: 'Hoje, 14:30\nEnviar orçamento\n🔔 Lembrar-me' },
  { id: 'drawing', name: 'Desenho livre', description: 'Solte a criatividade', icon: Palette, tone: 'rose', preview: '   ╱╲  ✦\n  ╱  ╲\n ╱____╲' },
  { id: 'categories', name: 'Notas por categorias', description: 'Tudo no seu lugar', icon: Folder, tone: 'blue', preview: '📁 Trabalho  12\n📁 Estudos   8\n📁 Pessoal   5' },
  { id: 'images', name: 'Notas com imagens', description: 'Fotos e textos juntos', icon: ImageIcon, tone: 'green', preview: '┌────────────┐\n│  sua foto  │\n└────────────┘\nUma legenda...' },
  { id: 'yellow', name: 'Papel amarelado', description: 'O conforto de um caderno', icon: BookOpen, tone: 'paper', preview: 'Querido diário,\n\nHoje foi um dia\nespecial porque...' },
]

const modelMap = Object.fromEntries(models.map((m) => [m.id, m])) as Record<ModelId, typeof models[number]>
const uid = () => crypto.randomUUID()
const today = () => new Date().toISOString()

function loadNotes(): Promise<Note[]> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') { resolve([]); return }
    const req = indexedDB.open('noteflow-db', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('notes', { keyPath: 'id' })
    req.onsuccess = () => { const tx = req.result.transaction('notes', 'readonly'); const all = tx.objectStore('notes').getAll(); all.onsuccess = () => resolve(all.result || []) }
    req.onerror = () => resolve([])
  })
}
function saveNotes(notes: Note[]) {
  if (typeof indexedDB === 'undefined') return
  const req = indexedDB.open('noteflow-db', 1)
  req.onsuccess = () => { const tx = req.result.transaction('notes', 'readwrite'); const store = tx.objectStore('notes'); store.clear(); notes.forEach((note) => store.put(note)) }
}

export default function Page() {
  const [notes, setNotes] = useState<Note[]>([])
  const [screen, setScreen] = useState<'home' | 'models' | 'all' | 'trash' | 'editor'>('home')
  const [active, setActive] = useState<Note | null>(null)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [dark, setDark] = useState(false)
  const [filter, setFilter] = useState<ModelId | 'all'>('all')

  useEffect(() => { loadNotes().then(setNotes); if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {}) }, [])
  useEffect(() => { if (notes.length) saveNotes(notes) }, [notes])
  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])
  const visible = useMemo(() => notes.filter((n) => !n.deleted && (filter === 'all' || n.model === filter) && (search === '' || `${n.title} ${n.content}`.toLowerCase().includes(search.toLowerCase()))).sort((a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.updatedAt) - +new Date(a.updatedAt)), [notes, filter, search])
  const trashNotes = useMemo(() => notes.filter((n) => n.deleted), [notes])
  const favorites = visible.filter((n) => n.favorite)

  function createNote(model: ModelId) { const now = today(); const note: Note = { id: uid(), title: '', content: '', model, favorite: false, pinned: false, createdAt: now, updatedAt: now, tasks: model === 'tasks' ? [{ text: '', done: false }] : [] }; setNotes((prev) => [note, ...prev]); setActive(note); setScreen('editor') }
  function updateNote(patch: Partial<Note>) { if (!active) return; const next = { ...active, ...patch, updatedAt: today() }; setActive(next); setNotes((prev) => prev.map((n) => n.id === next.id ? next : n)) }
  function duplicate(note: Note) { const copy = { ...note, id: uid(), title: `${note.title || 'Nota'} (cópia)`, createdAt: today(), updatedAt: today() }; setNotes((prev) => [copy, ...prev]); setActive(copy) }
  function remove(note: Note) { setNotes((prev) => prev.map((n) => n.id === note.id ? { ...n, deleted: true, updatedAt: today() } : n)); setActive(null); setScreen('home') }
  function exportBackup() { const blob = new Blob([JSON.stringify(notes)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'noteflow-backup.json'; a.click(); URL.revokeObjectURL(a.href) }
  function importBackup(event: React.ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const incoming = JSON.parse(String(reader.result)); if (Array.isArray(incoming)) setNotes((prev) => [...prev, ...incoming.filter((n) => n.id && n.model).map((n) => ({ ...n, id: uid() }))]) } catch { alert('Arquivo de backup inválido.') } }; reader.readAsText(file) }

  if (screen === 'models') return <ModelPicker onBack={() => setScreen('home')} onChoose={createNote} />
  if (screen === 'editor' && active) return <Editor note={active} onBack={() => setScreen('home')} onUpdate={updateNote} onDuplicate={() => duplicate(active)} onDelete={() => remove(active)} />

  return <div className="app-shell">
    <header className="topbar"><div className="brand-mark"><div className="brand-icon"><PenLine /></div><div><span className="brand-name">NoteFlow</span><span className="brand-tag">seu espaço para ideias</span></div></div><div className="top-actions"><button className="icon-button" aria-label="Alternar tema" onClick={() => setDark(!dark)}>{dark ? <Lightbulb /> : <Settings />}</button><button className="avatar">N</button></div></header>
    <main className="content">
      {screen === 'home' ? <>
        <section className="welcome"><div><p className="eyebrow">BOM DIA, NICOLE</p><h1>O que vamos criar<br /><em>hoje?</em></h1></div><div className="cloud-status"><CloudOff /> <span>Salvo no dispositivo</span></div></section>
        <button className="new-note-hero" onClick={() => setScreen('models')}><span className="plus-circle"><Plus /></span><span><strong>Nova anotação</strong><small>Escolha um dos 10 estilos</small></span><ChevronRight /></button>
        <div className="section-heading"><div><h2>Notas recentes</h2><p>{visible.length ? `${visible.length} ${visible.length === 1 ? 'anotação' : 'anotações'} no total` : 'Comece a registrar suas ideias'}</p></div><div className="heading-actions"><button className={view === 'grid' ? 'active-view' : ''} onClick={() => setView('grid')} aria-label="Visualização em grade"><Grid2X2 /></button><button className={view === 'list' ? 'active-view' : ''} onClick={() => setView('list')} aria-label="Visualização em lista"><List /></button><button className="text-action" onClick={() => setScreen('all')}>Ver todas <ChevronRight /></button></div></div>
        {favorites.length > 0 && <section className="favorite-strip"><div className="subhead"><span><Star /> Favoritas</span><button onClick={() => setScreen('all')}>Ver todas</button></div><div className="note-row">{favorites.slice(0, 3).map((n) => <NoteCard key={n.id} note={n} onOpen={(x) => { setActive(x); setScreen('editor') }} compact />)}</div></section>}
        {visible.length === 0 ? <EmptyState onCreate={() => setScreen('models')} /> : <div className={`notes-${view}`}>{visible.slice(0, 8).map((n) => <NoteCard key={n.id} note={n} onOpen={(x) => { setActive(x); setScreen('editor') }} />)}</div>}
      </> : <AllNotes notes={screen === 'trash' ? trashNotes : visible} trash={screen === 'trash'} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} onBack={() => setScreen('home')} onOpen={(n) => { setActive(n); setScreen('editor') }} onRestore={(n) => setNotes((p) => p.map((x) => x.id === n.id ? { ...x, deleted: false } : x))} onDelete={(n) => setNotes((p) => p.filter((x) => x.id !== n.id))} onExport={exportBackup} onImport={importBackup} />}
    </main>
    <nav className="bottom-nav"><button className={screen === 'home' ? 'selected' : ''} onClick={() => setScreen('home')}><BookOpen /><span>Início</span></button><button onClick={() => setScreen('all')}><Search /><span>Buscar</span></button><button className="nav-create" onClick={() => setScreen('models')}><Plus /></button><button onClick={() => setScreen('all')}><Archive /><span>Notas</span></button><button onClick={() => setScreen('trash')}><Trash2 /><span>Lixeira</span></button></nav>
  </div>
}

function ModelPicker({ onBack, onChoose }: { onBack: () => void; onChoose: (model: ModelId) => void }) { return <div className="picker-page"><header className="picker-header"><button className="icon-button" onClick={onBack} aria-label="Voltar"><ArrowLeft /></button><div className="mini-brand"><div className="brand-icon"><PenLine /></div><span>NoteFlow</span></div><span className="step-count">01 / 01</span></header><div className="picker-intro"><p className="eyebrow">COMECE DO SEU JEITO</p><h1>Como você quer<br /><em>fazer sua anotação?</em></h1><p>Escolha um estilo. Você poderá mudar e organizar tudo depois.</p></div><div className="model-grid">{models.map((m, i) => { const Icon = m.icon; return <button key={m.id} className={`model-card tone-${m.tone}`} onClick={() => onChoose(m.id)}><div className="model-top"><span className="model-number">0{i + 1}</span><span className="model-icon"><Icon /></span><ChevronRight /></div><div className="model-preview">{m.preview.split('\n').map((line, idx) => <div key={idx}>{line}</div>)}</div><div className="model-info"><strong>{m.name}</strong><span>{m.description}</span></div></button> })}</div></div> }

function NoteCard({ note, onOpen, compact }: { note: Note; onOpen: (n: Note) => void; compact?: boolean }) { const m = modelMap[note.model]; const Icon = m.icon; return <button className={`note-card ${compact ? 'compact' : ''} tone-${m.tone}`} onClick={() => onOpen(note)}><div className="note-card-head"><span className="note-type"><Icon /> {m.name}</span><span>{note.favorite ? <Star fill="currentColor" /> : <MoreHorizontal />}</span></div><strong>{note.title || 'Sem título'}</strong><p>{note.content || (note.model === 'tasks' ? 'Sua lista de tarefas' : 'Comece a escrever uma nova ideia...')}</p><div className="note-card-foot"><span>{new Date(note.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>{note.pinned && <Pin />}</div></button> }

function EmptyState({ onCreate }: { onCreate: () => void }) { return <div className="empty-state"><div className="empty-illustration"><PenLine /></div><h3>Seu espaço está pronto</h3><p>Escolha um modelo e transforme a primeira ideia em algo incrível.</p><button className="primary-button" onClick={onCreate}><Plus /> Criar primeira anotação</button></div> }

function AllNotes({ notes, trash, search, setSearch, filter, setFilter, onBack, onOpen, onRestore, onDelete, onExport, onImport }: { notes: Note[]; trash: boolean; search: string; setSearch: (s: string) => void; filter: ModelId | 'all'; setFilter: (f: ModelId | 'all') => void; onBack: () => void; onOpen: (n: Note) => void; onRestore: (n: Note) => void; onDelete: (n: Note) => void; onExport: () => void; onImport: (e: React.ChangeEvent<HTMLInputElement>) => void }) { return <section className="all-page"><div className="page-heading"><button className="icon-button" onClick={onBack}><ArrowLeft /></button><div><p className="eyebrow">BIBLIOTECA</p><h1>{trash ? 'Lixeira' : 'Todas as notas'}</h1></div><button className="icon-button"><Menu /></button></div>{!trash && <div className="search-box"><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nas suas notas..." /></div>}{!trash && <div className="filter-scroll"><button className={filter === 'all' ? 'filter-active' : ''} onClick={() => setFilter('all')}>Todas</button>{models.map((m) => <button key={m.id} className={filter === m.id ? 'filter-active' : ''} onClick={() => setFilter(m.id)}>{m.name}</button>)}</div>}<div className="library-meta"><span>{notes.length} {notes.length === 1 ? 'nota' : 'notas'}</span>{!trash && <div className="backup-actions"><button onClick={onExport}><Download /> Backup</button><label><Upload /> Importar<input type="file" accept="application/json" onChange={onImport} /></label></div>}</div><div className="library-list">{notes.length ? notes.map((n) => <NoteCard key={n.id} note={n} onOpen={trash ? () => {} : onOpen} />) : <EmptyState onCreate={() => {}} />}</div>{trash && notes.map((n) => <div key={n.id} className="trash-actions"><span>{n.title || 'Nota sem título'}</span><button onClick={() => onRestore(n)}><RotateCcw /> Restaurar</button><button onClick={() => onDelete(n)}><Trash2 /> Excluir</button></div>)}</section> }

function Editor({ note, onBack, onUpdate, onDuplicate, onDelete }: { note: Note; onBack: () => void; onUpdate: (p: Partial<Note>) => void; onDuplicate: () => void; onDelete: () => void }) { const m = modelMap[note.model]; const Icon = m.icon; const canvasRef = useRef<HTMLCanvasElement>(null); const [color, setColor] = useState('#6f5cf4'); const [width, setWidth] = useState(4); const [drawing, setDrawing] = useState(false); function start(e: React.PointerEvent) { const c = canvasRef.current; if (!c) return; c.setPointerCapture(e.pointerId); const ctx = c.getContext('2d')!; const r = c.getBoundingClientRect(); ctx.beginPath(); ctx.moveTo(e.clientX - r.left, e.clientY - r.top); setDrawing(true) } function move(e: React.PointerEvent) { if (!drawing) return; const c = canvasRef.current; if (!c) return; const ctx = c.getContext('2d')!; const r = c.getBoundingClientRect(); ctx.lineTo(e.clientX - r.left, e.clientY - r.top); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke() } function end() { setDrawing(false); const c = canvasRef.current; if (c) onUpdate({ drawing: c.toDataURL() }) } return <div className={`editor-page editor-${note.model}`}><header className="editor-header"><button className="icon-button" onClick={onBack}><ArrowLeft /></button><div className="editor-model"><span className="model-icon"><Icon /></span><span>{m.name}</span></div><div className="editor-actions"><button className="icon-button" onClick={() => onUpdate({ favorite: !note.favorite })}>{note.favorite ? <Star fill="currentColor" /> : <Star />}</button><button className="icon-button" onClick={onDelete}><Trash2 /></button><button className="icon-button"><MoreHorizontal /></button></div></header><div className="editor-body"><input className="title-input" value={note.title} onChange={(e) => onUpdate({ title: e.target.value })} placeholder="Dê um título à sua ideia" />{note.model === 'drawing' ? <><canvas ref={canvasRef} className="drawing-canvas" width={900} height={620} onPointerDown={start} onPointerMove={move} onPointerUp={end} /> <div className="drawing-tools"><div>{['#6f5cf4', '#ef6b5b', '#2b9a78', '#222222'].map((c) => <button key={c} style={{ background: c }} className={color === c ? 'color-selected' : ''} onClick={() => setColor(c)} aria-label="Escolher cor" />)}</div><label>Traço <input type="range" min="1" max="18" value={width} onChange={(e) => setWidth(+e.target.value)} /></label><button onClick={() => { const c = canvasRef.current; c?.getContext('2d')?.clearRect(0, 0, 900, 620) }}><Trash2 /> Limpar</button></div></> : note.model === 'tasks' ? <TaskEditor note={note} onUpdate={onUpdate} /> : <textarea className="content-input" value={note.content} onChange={(e) => onUpdate({ content: e.target.value })} placeholder={note.model === 'quick' ? 'Escreva algo rápido...' : 'Comece a escrever aqui...'} />}{note.model === 'reminder' && <div className="reminder-options"><Bell /> <input type="datetime-local" /> <span>Adicionar lembrete</span></div>}{note.model === 'categories' && <div className="category-select"><Folder /> <select value={note.category || ''} onChange={(e) => onUpdate({ category: e.target.value })}><option value="">Escolher categoria</option><option>Trabalho</option><option>Estudos</option><option>Pessoal</option><option>Projetos</option></select></div>}{note.model === 'images' && <label className="image-upload"><ImageIcon /> Adicionar uma imagem<input type="file" accept="image/*" /></label>}</div><footer className="editor-footer"><span><Check /> Salvo automaticamente</span><div><button onClick={() => onUpdate({ pinned: !note.pinned })}><Pin /> {note.pinned ? 'Fixada' : 'Fixar'}</button><button onClick={onDuplicate}><Copy /> Duplicar</button><button onClick={() => navigator.clipboard?.writeText(note.content)}><Clipboard /> Copiar</button></div></footer></div> }

function TaskEditor({ note, onUpdate }: { note: Note; onUpdate: (p: Partial<Note>) => void }) { const tasks = note.tasks || []; return <div className="task-editor">{tasks.map((task, i) => <div className="task-row" key={i}><input type="checkbox" checked={task.done} onChange={(e) => onUpdate({ tasks: tasks.map((t, idx) => idx === i ? { ...t, done: e.target.checked } : t) })} /><input value={task.text} onChange={(e) => onUpdate({ tasks: tasks.map((t, idx) => idx === i ? { ...t, text: e.target.value } : t) })} placeholder="Adicionar tarefa..." /></div>)}<button onClick={() => onUpdate({ tasks: [...tasks, { text: '', done: false }] })}><Plus /> Adicionar tarefa</button></div> }
