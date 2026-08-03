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
    (x, y) => new Date(y.criadoEm).getTime() - new Date(x.criadoEm).getTime(),
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
  };
}

export function criarOcorrenciaBase(
  dados: Omit<Ocorrencia, "deviceId" | "dispositivoNome" | "status" | "criadoEm" | "pendenteSincronizacao">,
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
