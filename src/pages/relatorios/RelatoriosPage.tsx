import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, CalendarDays, CheckCircle2, ChevronDown, ChevronRight,
  Download, FolderOpen, RefreshCcw, Search, Truck, Wheat, XCircle,
} from "lucide-react";
import "./RelatoriosPage.css";
import {
  listarCarregamentos,
  type Carregamento,
  type QuantidadeCarregamento,
} from "../../services/carregamentosService";

type Props = { onVoltar: () => void };
type Periodo = "hoje" | "ontem" | "sete" | "trinta" | "tudo";
type GrupoCadastro = { id: string; nome: string };
type AreaCadastro = { id: string; nome: string; grupoId?: string; ativa?: boolean };
type SituacaoParticipacao = "completa" | "incompleta" | "complemento";

type Participacao = {
  chave: string;
  registroId: string;
  placa: string;
  operadorNome: string;
  criadoEm: string;
  grupoId: string;
  grupoNome: string;
  areaId: string;
  areaNome: string;
  situacao: SituacaoParticipacao;
  detalhe: string;
  quantidade: string;
};

type LinhaArea = {
  grupoId: string;
  grupoNome: string;
  areaId: string;
  areaNome: string;
  registros: Participacao[];
};

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

function resolverArea(
  areaId: string | undefined,
  areaNome: string | undefined,
  cadastros: ReturnType<typeof lerCadastros>,
  grupoPreferidoId?: string,
  grupoPreferidoNome?: string,
) {
  let area = areaId ? cadastros.areas.find(a => a.id === areaId) : undefined;

  if (!area && areaNome) {
    const mesmoNome = cadastros.areas.filter(a => normalizarNome(a.nome) === normalizarNome(areaNome));

    if (grupoPreferidoId) {
      area = mesmoNome.find(a => a.grupoId === grupoPreferidoId);
    }

    if (!area && grupoPreferidoNome) {
      area = mesmoNome.find(a => {
        const g = cadastros.grupos.find(grupo => grupo.id === a.grupoId);
        return Boolean(g && normalizarNome(g.nome) === normalizarNome(grupoPreferidoNome));
      });
    }

    if (!area && mesmoNome.length === 1) area = mesmoNome[0];
  }

  if (area) {
    const grupo = cadastros.grupos.find(g => g.id === area!.grupoId);
    return {
      areaId: area.id,
      areaNome: area.nome,
      grupoId: grupo?.id || area.grupoId || grupoPreferidoId || "sem-grupo",
      grupoNome: grupo?.nome || grupoPreferidoNome || "Sem grupo",
    };
  }

  return {
    areaId: areaId || areaNome || "sem-area",
    areaNome: areaNome || "Sem área",
    grupoId: grupoPreferidoId || "sem-grupo",
    grupoNome: grupoPreferidoNome || "Sem grupo",
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

function textoQuantidade(q?: QuantidadeCarregamento) {
  if (!q) return "";
  const partes: string[] = [];
  const bazuca = Number(q.bazuca) || 0;
  const graneleiro = Number(q.graneleiro) || 0;
  const kg = Number(q.kg) || 0;
  const sacos = Number(q.sacos) || 0;

  if (bazuca > 0) partes.push(`${bazuca.toLocaleString("pt-BR")} ${bazuca === 1 ? "bazuca" : "bazucas"}`);
  if (graneleiro > 0) partes.push(`${graneleiro.toLocaleString("pt-BR")} ${graneleiro === 1 ? "graneleiro" : "graneleiros"}`);
  if (kg > 0) partes.push(`${kg.toLocaleString("pt-BR")} kg`);
  if (sacos > 0) partes.push(`${sacos.toLocaleString("pt-BR")} ${sacos === 1 ? "saco" : "sacos"}`);

  return partes.join(" + ");
}

function observacaoTemQuantidade(obs?: string) {
  return Boolean(obs && /\b(kg|quilo|quilos|saco|sacos|bazuca|bazucas|graneleiro|graneleiros)\b/i.test(obs));
}

function criarParticipacoes(r: Carregamento, cadastros: ReturnType<typeof lerCadastros>): Participacao[] {
  const principal = resolverArea(r.areaId, r.areaNome, cadastros, r.grupoId, r.grupoNome);

  if (r.tipo === "saida") {
    return [{
      chave: `${r.id}-completa`, registroId: r.id, placa: r.placa,
      operadorNome: r.operadorNome, criadoEm: r.criadoEm,
      ...principal, situacao: "completa", detalhe: "Carga completa nesta área.", quantidade: "",
    }];
  }

  const origem = resolverArea(
    r.areaOrigemId || r.areaId,
    r.areaOrigemNome || r.areaNome,
    cadastros,
    undefined,
    undefined,
  );
  const destino = resolverArea(
    r.areaDestinoId || r.areaId,
    r.areaDestinoNome || r.areaNome,
    cadastros,
    r.grupoId,
    r.grupoNome,
  );

  const qtdOrigem = textoQuantidade(r.quantidadeOrigem);
  const qtdDestino = textoQuantidade(r.quantidadeDestino);
  const obsComQuantidade = observacaoTemQuantidade(r.observacao) ? r.observacao!.trim() : "";

  let detalheOrigem: string;
  let detalheDestino: string;

  if (obsComQuantidade) {
    detalheOrigem = obsComQuantidade;
    detalheDestino = obsComQuantidade;
  } else if (r.tipo === "meia-carga") {
    detalheOrigem = `Aproximadamente meia carga saiu desta área; restante completado em ${destino.areaNome}.`;
    detalheDestino = `Veio com aproximadamente meia carga de ${origem.areaNome}; restante completado nesta área.`;
  } else {
    detalheOrigem = qtdOrigem
      ? `${qtdOrigem} nesta área; restante completado em ${destino.areaNome}.`
      : `Carga saiu incompleta desta área e foi completada em ${destino.areaNome}.`;

    detalheDestino = qtdOrigem
      ? `Veio de ${origem.areaNome} com aproximadamente ${qtdOrigem}; restante completado nesta área.`
      : `Veio incompleta de ${origem.areaNome} e foi completada nesta área.`;

    if (qtdDestino) {
      detalheDestino = `Veio incompleta de ${origem.areaNome}; recebeu ${qtdDestino} nesta área e completou a carga.`;
    }
  }

  const participacoes: Participacao[] = [{
    chave: `${r.id}-origem`, registroId: r.id, placa: r.placa,
    operadorNome: r.operadorNome, criadoEm: r.criadoEm,
    ...origem, situacao: "incompleta", detalhe: detalheOrigem,
    quantidade: obsComQuantidade ? "" : (qtdOrigem || (r.tipo === "meia-carga" ? "~ meia carga" : "")),
  }];

  const mesmaArea = origem.areaId === destino.areaId && origem.grupoId === destino.grupoId;
  if (!mesmaArea) {
    participacoes.push({
      chave: `${r.id}-destino`, registroId: r.id, placa: r.placa,
      operadorNome: r.operadorNome, criadoEm: r.criadoEm,
      ...destino, situacao: "complemento", detalhe: detalheDestino,
      quantidade: obsComQuantidade ? "" : (qtdDestino || qtdOrigem || (r.tipo === "meia-carga" ? "~ meia carga" : "")),
    });
  }

  return participacoes;
}

function status(p: Participacao) {
  if (p.situacao === "completa") return { nome:"Completa", classe:"completa" };
  if (p.situacao === "complemento") return { nome:"Complemento", classe:"complemento" };
  return { nome:"Incompleta", classe:"incompleta" };
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
    const novosCadastros = lerCadastros();
    setCadastros(novosCadastros);
    try { setRegistros(await listarCarregamentos()); } finally { setCarregando(false); }
  }
  useEffect(() => { void carregar(); }, []);

  const participacoes = useMemo(
    () => registros.flatMap(r => criarParticipacoes(r, cadastros)),
    [registros, cadastros],
  );
  const basePeriodo = useMemo(() => participacoes.filter(r => noPeriodo(r.criadoEm, periodo)), [participacoes, periodo]);
  const grupos = useMemo(() => Array.from(new Map(basePeriodo.map(r => [r.grupoId, { id:r.grupoId, nome:r.grupoNome }])).values()).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR")), [basePeriodo]);
  const areas = useMemo(() => Array.from(new Map(basePeriodo.filter(r => !grupo || r.grupoId === grupo).map(r => [`${r.grupoId}|${r.areaId}`, { id:r.areaId, nome:r.areaNome, grupoId:r.grupoId, grupoNome:r.grupoNome }])).values()).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR")), [basePeriodo, grupo]);

  const filtrados = useMemo(() => basePeriodo.filter(r => {
    return (!grupo || r.grupoId === grupo) && (!area || `${r.grupoId}|${r.areaId}` === area) && (!placa || limparPlaca(r.placa).includes(limparPlaca(placa)));
  }), [basePeriodo, grupo, area, placa]);

  const linhas = useMemo(() => {
    const mapa = new Map<string, LinhaArea>();
    filtrados.forEach(r => {
      const chave = `${r.grupoId}|${r.areaId}`;
      if (!mapa.has(chave)) mapa.set(chave, { grupoId:r.grupoId, grupoNome:r.grupoNome, areaId:r.areaId, areaNome:r.areaNome, registros:[] });
      mapa.get(chave)!.registros.push(r);
    });
    return Array.from(mapa.values()).sort((a,b) => a.grupoNome.localeCompare(b.grupoNome,"pt-BR") || a.areaNome.localeCompare(b.areaNome,"pt-BR"));
  }, [filtrados]);

  const idsVisiveis = new Set(filtrados.map(r => r.registroId));
  const completas = new Set(filtrados.filter(r=>r.situacao === "completa").map(r=>r.registroId)).size;
  const incompletas = new Set(filtrados.filter(r=>r.situacao !== "completa").map(r=>r.registroId)).size;
  const placasUnicas = new Set(filtrados.map(r=>limparPlaca(r.placa))).size;

  function alternar(chave:string) { setAbertas(a => { const n = new Set(a); n.has(chave) ? n.delete(chave) : n.add(chave); return n; }); }

  function exportarExcel() {
    const cab = ["Data/Hora","Grupo","Área","Placa","Operador","Situação","Quantidade","Detalhe"];
    const rows = filtrados.map(r => [dataHora(r.criadoEm), r.grupoNome, r.areaNome, formatarPlaca(r.placa), r.operadorNome, status(r).nome, r.quantidade, r.detalhe]);
    const tabela = [cab, ...rows].map(row => `<Row>${row.map(c=>`<Cell><Data ss:Type="String">${xml(c)}</Data></Cell>`).join("")}</Row>`).join("");
    const conteudo = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Carregamentos"><Table>${tabela}</Table></Worksheet></Workbook>`;
    const blob = new Blob([conteudo], { type:"application/vnd.ms-excel;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download=`crivo-carregamentos-${new Date().toISOString().slice(0,10)}.xls`; a.click(); URL.revokeObjectURL(url);
  }

  return <main className="relatorios-page">
    <header className="relatorios-header"><div className="relatorios-brand"><button className="relatorios-voltar" onClick={onVoltar}><ArrowLeft size={22}/></button><div className="relatorios-logo"><Wheat size={26}/></div><div><p>Crivo Colheitas</p><h1>Relatórios</h1></div></div><button className="relatorios-atualizar" onClick={()=>void carregar()}><RefreshCcw size={18}/>Atualizar</button></header>
    <section className="relatorios-container">
      <div className="relatorios-titulo"><div><h2>Relatórios de Carregamentos</h2><p>Consulte por grupo e área. Cargas divididas aparecem em todas as áreas que participaram da viagem.</p></div><button className="exportar-excel" onClick={exportarExcel} disabled={!filtrados.length}><Download size={19}/>Exportar Excel</button></div>

      <section className="filtros-novos">
        <div className="filtro-periodo"><label><CalendarDays size={17}/>Período</label><div>{([['hoje','Hoje'],['ontem','Ontem'],['sete','7 dias'],['trinta','30 dias'],['tudo','Todo período']] as [Periodo,string][]).map(([v,n])=><button key={v} className={periodo===v?'ativo':''} onClick={()=>setPeriodo(v)}>{n}</button>)}</div></div>
        <label>Grupo<select value={grupo} onChange={e=>{setGrupo(e.target.value);setArea("");}}><option value="">Todos os grupos</option>{grupos.map(g=><option key={g.id} value={g.id}>{g.nome}</option>)}</select></label>
        <label>Área<select value={area} onChange={e=>setArea(e.target.value)}><option value="">Todas as áreas</option>{areas.map(a=><option key={`${a.grupoId}|${a.id}`} value={`${a.grupoId}|${a.id}`}>{a.nome}{!grupo ? ` — ${a.grupoNome}` : ''}</option>)}</select></label>
        <label>Placa<div className="input-placa"><Search size={17}/><input value={placa} onChange={e=>setPlaca(e.target.value)} placeholder="Digite a placa"/></div></label>
      </section>

      <section className="resumo-novo"><article><Truck/><div><span>Total de carregamentos</span><strong>{idsVisiveis.size}</strong></div></article><article><CheckCircle2/><div><span>Cargas completas</span><strong>{completas}</strong></div></article><article className="alerta"><XCircle/><div><span>Cargas divididas</span><strong>{incompletas}</strong></div></article><article><Truck/><div><span>Placas únicas</span><strong>{placasUnicas}</strong></div></article></section>

      <section className="tabela-relatorio">
        <div className="tabela-cab"><span>Grupo / Área</span><span>Participações</span><span>Completas</span><span>Divididas</span><span>Último carregamento</span><span></span></div>
        {carregando ? <div className="rel-vazio">Carregando...</div> : linhas.length===0 ? <div className="rel-vazio">Nenhum carregamento encontrado.</div> : linhas.map(l=>{ const chave=`${l.grupoId}|${l.areaId}`; const aberto=abertas.has(chave); const comp=l.registros.filter(r=>r.situacao==='completa').length; const inc=l.registros.length-comp; const ultimo=[...l.registros].sort((a,b)=>+new Date(b.criadoEm)-+new Date(a.criadoEm))[0]; return <div className="area-bloco" key={chave}>
          <button className="area-resumo" onClick={()=>alternar(chave)}><span className="nome-area"><FolderOpen size={18}/><b>{l.grupoNome}</b><em>›</em><strong>{l.areaNome}</strong></span><span>{l.registros.length}</span><span>{comp}</span><span className={inc?'numero-alerta':''}>{inc}</span><span>{dataHora(ultimo.criadoEm)}</span><span>{aberto?<ChevronDown/>:<ChevronRight/>}</span></button>
          {aberto && <div className="detalhes-area"><div className="detalhes-cab"><span>Data/Hora</span><span>Placa</span><span>Operador</span><span>Situação</span><span>Quantidade / detalhe</span></div>{[...l.registros].sort((a,b)=>+new Date(b.criadoEm)-+new Date(a.criadoEm)).map(r=><div className="detalhe-linha" key={r.chave}><span>{dataHora(r.criadoEm)}</span><strong>{formatarPlaca(r.placa)}</strong><span>{r.operadorNome}</span><span><i className={`status ${status(r).classe}`}>{status(r).nome}</i></span><span>{r.quantidade && <b className="quantidade-destaque">{r.quantidade} · </b>}{r.detalhe}</span></div>)}</div>}
        </div>})}
      </section>
    </section>
  </main>;
}
