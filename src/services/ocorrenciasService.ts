import { supabase, supabaseConfigurado } from "../lib/supabase";
import { obterDeviceId, obterNomeDispositivo } from "./deviceService";

const CACHE_KEY = "crivo_colheitas_ocorrencias_cache";
const FILA_KEY = "crivo_colheitas_ocorrencias_fila";

export type TipoOcorrencia =
  | "esqueci-carga"
  | "placa-errada"
  | "area-errada"
  | "troca-caminhoes"
  | "carga-dividida"
  | "outro";

export type Ocorrencia = {
  id: string;
  deviceId: string;
  dispositivoNome: string;
  operadorNome: string;
  tipo: TipoOcorrencia;
  titulo: string;
  descricao?: string;
  grupoId?: string;
  grupoNome?: string;
  areaId?: string;
  areaNome?: string;
  placa1?: string;
  placa2?: string;
  status: "pendente" | "resolvida";
  criadoEm: string;
  resolvidoEm?: string;
  resolvidoPor?: string;
  observacaoResolucao?: string;
  pendenteSincronizacao?: boolean;
};

function lerLista(chave: string): Ocorrencia[] {
  const salvo = localStorage.getItem(chave);
  if (!salvo) return [];

  try {
    const valor = JSON.parse(salvo) as unknown;
    return Array.isArray(valor) ? (valor as Ocorrencia[]) : [];
  } catch {
    return [];
  }
}

function salvarLista(chave: string, itens: Ocorrencia[]) {
  localStorage.setItem(chave, JSON.stringify(itens));
}

function mesclarPorId(a: Ocorrencia[], b: Ocorrencia[]) {
  const mapa = new Map<string, Ocorrencia>();

  [...a, ...b].forEach((item) => {
    if (item.id) mapa.set(item.id, { ...mapa.get(item.id), ...item });
  });

  return Array.from(mapa.values()).sort(
    (x, y) =>
      new Date(y.criadoEm).getTime() - new Date(x.criadoEm).getTime(),
  );
}

function paraBanco(item: Ocorrencia) {
  return {
    id: item.id,
    device_id: item.deviceId,
    operador_nome: item.operadorNome,
    tipo: item.tipo,
    titulo: item.titulo,
    descricao: item.descricao ?? null,
    grupo_id: item.grupoId || null,
    grupo_nome: item.grupoNome || null,
    area_id: item.areaId || null,
    area_nome: item.areaNome || null,
    placa_1: item.placa1 ?? null,
    placa_2: item.placa2 ?? null,
    status: item.status,
    criado_em: item.criadoEm,
    resolvido_em: item.resolvidoEm ?? null,
    resolvido_por: item.resolvidoPor ?? null,
    observacao_resolucao: item.observacaoResolucao ?? null,
  };
}

function paraLocal(item: Record<string, unknown>): Ocorrencia {
  return {
    id: String(item.id ?? ""),
    deviceId: String(item.device_id ?? ""),
    dispositivoNome: "",
    operadorNome: String(item.operador_nome ?? "Desconhecido"),
    tipo: String(item.tipo ?? "outro") as TipoOcorrencia,
    titulo: String(item.titulo ?? "Ocorrência"),
    descricao: item.descricao ? String(item.descricao) : undefined,
    grupoId: item.grupo_id ? String(item.grupo_id) : undefined,
    grupoNome: item.grupo_nome ? String(item.grupo_nome) : undefined,
    areaId: item.area_id ? String(item.area_id) : undefined,
    areaNome: item.area_nome ? String(item.area_nome) : undefined,
    placa1: item.placa_1 ? String(item.placa_1) : undefined,
    placa2: item.placa_2 ? String(item.placa_2) : undefined,
    status: String(item.status ?? "pendente") as "pendente" | "resolvida",
    criadoEm: String(item.criado_em ?? new Date().toISOString()),
    resolvidoEm: item.resolvido_em
      ? String(item.resolvido_em)
      : undefined,
    resolvidoPor: item.resolvido_por
      ? String(item.resolvido_por)
      : undefined,
    observacaoResolucao: item.observacao_resolucao
      ? String(item.observacao_resolucao)
      : undefined,
    pendenteSincronizacao: false,
  };
}

export function criarOcorrenciaBase(
  dados: Omit<
    Ocorrencia,
    | "deviceId"
    | "dispositivoNome"
    | "status"
    | "criadoEm"
    | "pendenteSincronizacao"
  >,
): Ocorrencia {
  return {
    ...dados,
    deviceId: obterDeviceId(),
    dispositivoNome: obterNomeDispositivo(),
    status: "pendente",
    criadoEm: new Date().toISOString(),
    pendenteSincronizacao: true,
  };
}

export async function salvarOcorrencia(ocorrencia: Ocorrencia) {
  salvarLista(CACHE_KEY, mesclarPorId(lerLista(CACHE_KEY), [ocorrencia]));
  salvarLista(FILA_KEY, mesclarPorId(lerLista(FILA_KEY), [ocorrencia]));
  await sincronizarFilaOcorrencias();
}

export async function sincronizarFilaOcorrencias() {
  if (!supabaseConfigurado || !supabase || !navigator.onLine) return;

  const fila = lerLista(FILA_KEY);
  if (fila.length === 0) return;

  const { error } = await supabase
    .from("ocorrencias")
    .upsert(fila.map(paraBanco), { onConflict: "id" });

  if (error) throw error;

  const ids = new Set(fila.map((item) => item.id));

  salvarLista(
    CACHE_KEY,
    lerLista(CACHE_KEY).map((item) =>
      ids.has(item.id) ? { ...item, pendenteSincronizacao: false } : item,
    ),
  );

  salvarLista(FILA_KEY, []);
}

export async function listarOcorrencias(): Promise<Ocorrencia[]> {
  if (!supabaseConfigurado || !supabase || !navigator.onLine) {
    return lerLista(CACHE_KEY);
  }

  await sincronizarFilaOcorrencias();

  const { data, error } = await supabase
    .from("ocorrencias")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) throw error;

  const remotas = (data ?? []).map((item) =>
    paraLocal(item as Record<string, unknown>),
  );

  const mescladas = mesclarPorId(lerLista(CACHE_KEY), remotas);
  salvarLista(CACHE_KEY, mescladas);

  return mescladas;
}

export async function resolverOcorrencia(
  ocorrencia: Ocorrencia,
  resolvidoPor: string,
  observacaoResolucao = "",
): Promise<Ocorrencia> {
  if (!supabaseConfigurado || !supabase || !navigator.onLine) {
    throw new Error("É necessário estar online para resolver a ocorrência.");
  }

  const atualizada: Ocorrencia = {
    ...ocorrencia,
    status: "resolvida",
    resolvidoEm: new Date().toISOString(),
    resolvidoPor,
    observacaoResolucao: observacaoResolucao.trim() || undefined,
    pendenteSincronizacao: false,
  };

  const { error } = await supabase
    .from("ocorrencias")
    .update(paraBanco(atualizada))
    .eq("id", ocorrencia.id);

  if (error) throw error;

  salvarLista(
    CACHE_KEY,
    mesclarPorId(lerLista(CACHE_KEY), [atualizada]),
  );

  return atualizada;
}
