import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, CalendarDays, CheckCircle2, ChevronDown, ChevronRight,
  Download, FolderOpen, RefreshCcw, Search, Truck, Wheat, XCircle,
} from "lucide-react";
import "./RelatoriosPage.css";
import { listarCarregamentos, type Carregamento } from "../../services/carregamentosService";

type Props = { onVoltar: () => void };
type Periodo = "hoje" | "ontem" | "sete" | "trinta" | "tudo";
type LinhaArea = { grupoId: string; grupoNome: string; areaId: string; areaNome: string; registros: Carregamento[] };
type GrupoCadastro = { id: string; nome: string };
type AreaCadastro = { id: string; nome: string; grupoId?: string; ativa?: boolean };

function normalizarNome(v: string) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ");
}

function lerCadastros() {
  try {
    const grupos = JSON.parse(localStorage.getItem("crivo_colheitas_grupos") || "[]") as GrupoCadastro[];
    const areas = JSON.parse(localStorage.getItem("crivo_colheitas_areas") || "[]") as AreaCadastro[];
    return { grupos, areas: areas.filter(a => a.ativa !== false) };
  } catch {
    return { grupos: [] as GrupoCadastro[], areas: [] as AreaCadastro[] };
  }
}

function encaixarNaAreaCadastrada(r: Carregamento, cadastros: ReturnType<typeof lerCadastros>): Carregamento {
  let area = cadastros.areas.find(a => a.id === r.areaId);

  if (!area) {
    const grupoNomeRegistro = normalizarNome(r.grupoNome);
    const candidatas = cadastros.areas.filter(a => {
      if (normalizarNome(a.nome) !== normalizarNome(r.areaNome)) return false;
      if (!grupoNomeRegistro) return true;
      const g = cadastros.grupos.find(grupo => grupo.id === a.grupoId);
      return Boolean(g && normalizarNome(g.nome) === grupoNomeRegistro);
    });

    if (candidatas.length === 1) area = candidatas[0];

    if (!area) {
      const mesmoNome = cadastros.areas.filter(a => normalizarNome(a.nome) === normalizarNome(r.areaNome));
      if (mesmoNome.length === 1) area = mesmoNome[0];
    }
  }

  if (!area) return r;

  const grupo = cadastros.grupos.find(g => g.id === area!.grupoId);
  return {
    ...r,
    areaId: area.id,
    areaNome: area.nome,
    grupoId: grupo?.id || area.grupoId || "sem-grupo",
    grupoNome: grupo?.nome || "Sem grupo",
  };
}

function limparPlaca(v: string) { return v.toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function formatarPlaca(v: string) { const p = limparPlaca(v); return p.length === 7 ? `${p.slice(0,3)}-${p.slice(3)}` : p; }
function dataHora(v: string) { const d = new Date(v); return d.toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }); }
function noPeriodo(v: string, p: Periodo) {
  if (p === "tudo") return true;
  const d = new Date(v); const hoje = new Date(); hoje.setHours(0,0,0,0);
  const inicio = new Date(hoje);
  if (p === "ontem") { inicio.setDate(inicio.getDate()-1); const fim = new Date(inicio); fim.setHours(23,59,59,999); return d >= inicio && d <= fim; }
  if (p === "sete") inicio.setDate(inicio.getDate()-6);
  if (p === "trinta") inicio.setDate(inicio.getDate()-29);
  return d >= inicio;
}
function status(r: Carregamento) {
  if (r.tipo === "saida") return { nome:"Completa", classe:"completa" };
  return { nome:"Incompleta", classe:"incompleta" };
}
function detalhe(r: Carregamento) {
  if (r.tipo === "saida") return "Carga completa nesta área.";
  const origem = r.areaOrigemNome || r.areaNome;
  const destino = r.areaDestinoNome;
  if (destino && destino !== origem) return `Carga iniciada em ${origem} e completada em ${destino}.`;
  return r.observacao || "Carga registrada como incompleta/dividida.";
}
function xml(v: unknown) { return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

export default function RelatoriosPage({ onVoltar }: Props) {
  const [registros, setRegistros] = useState<Carregamento[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>("tudo");
  const [grupo, setGrupo] = useState("");
  const [area, setArea] = useState("");
  const [placa, setPlaca] = useState("");
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [cadastros, setCadastros] = useState(lerCadastros);

  async function carregar() {
    setCarregando(true);
    setCadastros(lerCadastros());
    try { setRegistros(await listarCarregamentos()); } finally { setCarregando(false); }
  }
  useEffect(() => { void carregar(); }, []);

  const registrosEncaixados = useMemo(
    () => registros.map(r => encaixarNaAreaCadastrada(r, cadastros)),
    [registros, cadastros],
  );
  const basePeriodo = useMemo(() => registrosEncaixados.filter(r => noPeriodo(r.criadoEm, periodo)), [registrosEncaixados, periodo]);
  const grupos = useMemo(() => Array.from(new Map(basePeriodo.map(r => [r.grupoId || r.grupoNome, { id:r.grupoId || r.grupoNome, nome:r.grupoNome || "Sem grupo" }])).values()).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR")), [basePeriodo]);
  const areas = useMemo(() => Array.from(new Map(basePeriodo.filter(r => !grupo || (r.grupoId || r.grupoNome) === grupo).map(r => [`${r.grupoId}|${r.areaId}`, { id:r.areaId, nome:r.areaNome, grupoId:r.grupoId, grupoNome:r.grupoNome }])).values()).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR")), [basePeriodo, grupo]);

  const filtrados = useMemo(() => basePeriodo.filter(r => {
    const gid = r.grupoId || r.grupoNome;
    return (!grupo || gid === grupo) && (!area || `${gid}|${r.areaId}` === area) && (!placa || limparPlaca(r.placa).includes(limparPlaca(placa)));
  }), [basePeriodo, grupo, area, placa]);

  const linhas = useMemo(() => {
    const mapa = new Map<string, LinhaArea>();
    filtrados.forEach(r => {
      const gid = r.grupoId || r.grupoNome || "sem-grupo"; const aid = r.areaId || r.areaNome; const chave = `${gid}|${aid}`;
      if (!mapa.has(chave)) mapa.set(chave, { grupoId:gid, grupoNome:r.grupoNome || "Sem grupo", areaId:aid, areaNome:r.areaNome || "Sem área", registros:[] });
      mapa.get(chave)!.registros.push(r);
    });
    return Array.from(mapa.values()).sort((a,b) => a.grupoNome.localeCompare(b.grupoNome,"pt-BR") || a.areaNome.localeCompare(b.areaNome,"pt-BR"));
  }, [filtrados]);

  const completas = filtrados.filter(r=>r.tipo === "saida").length;
  const incompletas = filtrados.length - completas;
  const placasUnicas = new Set(filtrados.map(r=>limparPlaca(r.placa))).size;

  function alternar(chave:string) { setAbertas(a => { const n = new Set(a); n.has(chave) ? n.delete(chave) : n.add(chave); return n; }); }

  function exportarExcel() {
    const cab = ["Data/Hora","Grupo","Área","Placa","Operador","Situação","Área origem","Área complemento","Observação"];
    const rows = filtrados.map(r => [dataHora(r.criadoEm), r.grupoNome, r.areaNome, formatarPlaca(r.placa), r.operadorNome, status(r).nome, r.areaOrigemNome || "", r.areaDestinoNome || "", r.observacao || detalhe(r)]);
    const tabela = [cab, ...rows].map(row => `<Row>${row.map(c=>`<Cell><Data ss:Type="String">${xml(c)}</Data></Cell>`).join("")}</Row>`).join("");
    const conteudo = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Carregamentos"><Table>${tabela}</Table></Worksheet></Workbook>`;
    const blob = new Blob([conteudo], { type:"application/vnd.ms-excel;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download=`crivo-carregamentos-${new Date().toISOString().slice(0,10)}.xls`; a.click(); URL.revokeObjectURL(url);
  }

  return <main className="relatorios-page">
    <header className="relatorios-header"><div className="relatorios-brand"><button className="relatorios-voltar" onClick={onVoltar}><ArrowLeft size={22}/></button><div className="relatorios-logo"><Wheat size={26}/></div><div><p>Crivo Colheitas</p><h1>Relatórios</h1></div></div><button className="relatorios-atualizar" onClick={()=>void carregar()}><RefreshCcw size={18}/>Atualizar</button></header>
    <section className="relatorios-container">
      <div className="relatorios-titulo"><div><h2>Relatórios de Carregamentos</h2><p>Consulte por grupo e área. Clique em uma área para ver todos os carregamentos.</p></div><button className="exportar-excel" onClick={exportarExcel} disabled={!filtrados.length}><Download size={19}/>Exportar Excel</button></div>

      <section className="filtros-novos">
        <div className="filtro-periodo"><label><CalendarDays size={17}/>Período</label><div>{([['hoje','Hoje'],['ontem','Ontem'],['sete','7 dias'],['trinta','30 dias'],['tudo','Todo período']] as [Periodo,string][]).map(([v,n])=><button key={v} className={periodo===v?'ativo':''} onClick={()=>setPeriodo(v)}>{n}</button>)}</div></div>
        <label>Grupo<select value={grupo} onChange={e=>{setGrupo(e.target.value);setArea("");}}><option value="">Todos os grupos</option>{grupos.map(g=><option key={g.id} value={g.id}>{g.nome}</option>)}</select></label>
        <label>Área<select value={area} onChange={e=>setArea(e.target.value)}><option value="">Todas as áreas</option>{areas.map(a=><option key={`${a.grupoId}|${a.id}`} value={`${a.grupoId}|${a.id}`}>{a.nome}{!grupo ? ` — ${a.grupoNome}` : ''}</option>)}</select></label>
        <label>Placa<div className="input-placa"><Search size={17}/><input value={placa} onChange={e=>setPlaca(e.target.value)} placeholder="Digite a placa"/></div></label>
      </section>

      <section className="resumo-novo"><article><Truck/><div><span>Total de carregamentos</span><strong>{filtrados.length}</strong></div></article><article><CheckCircle2/><div><span>Cargas completas</span><strong>{completas}</strong></div></article><article className="alerta"><XCircle/><div><span>Cargas incompletas</span><strong>{incompletas}</strong></div></article><article><Truck/><div><span>Placas únicas</span><strong>{placasUnicas}</strong></div></article></section>

      <section className="tabela-relatorio">
        <div className="tabela-cab"><span>Grupo / Área</span><span>Carregamentos</span><span>Completas</span><span>Incompletas</span><span>Último carregamento</span><span></span></div>
        {carregando ? <div className="rel-vazio">Carregando...</div> : linhas.length===0 ? <div className="rel-vazio">Nenhum carregamento encontrado.</div> : linhas.map(l=>{ const chave=`${l.grupoId}|${l.areaId}`; const aberto=abertas.has(chave); const comp=l.registros.filter(r=>r.tipo==='saida').length; const inc=l.registros.length-comp; const ultimo=[...l.registros].sort((a,b)=>+new Date(b.criadoEm)-+new Date(a.criadoEm))[0]; return <div className="area-bloco" key={chave}>
          <button className="area-resumo" onClick={()=>alternar(chave)}><span className="nome-area"><FolderOpen size={18}/><b>{l.grupoNome}</b><em>›</em><strong>{l.areaNome}</strong></span><span>{l.registros.length}</span><span>{comp}</span><span className={inc?'numero-alerta':''}>{inc}</span><span>{dataHora(ultimo.criadoEm)}</span><span>{aberto?<ChevronDown/>:<ChevronRight/>}</span></button>
          {aberto && <div className="detalhes-area"><div className="detalhes-cab"><span>Data/Hora</span><span>Placa</span><span>Operador</span><span>Situação</span><span>Detalhe</span></div>{[...l.registros].sort((a,b)=>+new Date(b.criadoEm)-+new Date(a.criadoEm)).map(r=><div className="detalhe-linha" key={r.id}><span>{dataHora(r.criadoEm)}</span><strong>{formatarPlaca(r.placa)}</strong><span>{r.operadorNome}</span><span><i className={`status ${status(r).classe}`}>{status(r).nome}</i></span><span>{detalhe(r)}</span></div>)}</div>}
        </div>})}
      </section>
    </section>
  </main>;
}
