import { supabase, supabaseConfigurado } from "../lib/supabase";
import { obterDeviceId } from "./deviceService";

const CACHE_KEY = "crivo_colheitas_cargas_aguardando_cache";
const FILA_KEY = "crivo_colheitas_cargas_aguardando_fila";

export type TipoCargaAguardando =
  | "faltou-pouco"
  | "meia-carga"
  | "quantidade";

export type QuantidadeCargaAguardando = {
  bazuca: number;
  graneleiro: number;
  kg: number;
  sacos: number;
};

export type CargaAguardando = {
  id: string;
  deviceId: string;
  operadorNome: string;
  placa: string;
  tipo: TipoCargaAguardando;
  grupoOrigemId: string;
  grupoOrigemNome: string;
  areaOrigemId: string;
  areaOrigemNome: string;
  grupoDestinoId: string;
  grupoDestinoNome: string;
  areaDestinoId: string;
  areaDestinoNome: string;
  quantidadeOrigem?: QuantidadeCargaAguardando;
  iniciadaEm: string;
  pausadaEm?: string;
  finalizadaEm?: string;
  status: "aguardando" | "finalizada" | "cancelada";
  observacao?: string;
  pendenteSincronizacao?: boolean;
};

function lerLista(chave: string): CargaAguardando[] {
  const salvo = localStorage.getItem(chave);
  if (!salvo) return [];

  try {
    const valor = JSON.parse(salvo) as unknown;
    return Array.isArray(valor) ? (valor as CargaAguardando[]) : [];
  } catch {
    return [];
  }
}

function salvarLista(chave: string, itens: CargaAguardando[]): void {
  localStorage.setItem(chave, JSON.stringify(itens));
}

function mesclarPorId(
  primeira: CargaAguardando[],
  segunda: CargaAguardando[],
): CargaAguardando[] {
  const mapa = new Map<string, CargaAguardando>();

  primeira.forEach((item) => {
    if (item.id) mapa.set(item.id, item);
  });

  segunda.forEach((item) => {
    if (!item.id) return;
    mapa.set(item.id, { ...mapa.get(item.id), ...item });
  });

  return Array.from(mapa.values()).sort(
    (a, b) =>
      new Date(b.pausadaEm ?? b.iniciadaEm).getTime() -
      new Date(a.pausadaEm ?? a.iniciadaEm).getTime(),
  );
}

function normalizarOperador(nome: string): string {
  return nome.trim().toLocaleLowerCase("pt-BR");
}

function paraBanco(item: CargaAguardando) {
  return {
    id: item.id,
    device_id: item.deviceId,
    operador_nome: item.operadorNome,
    placa: item.placa,
    tipo: item.tipo,
    grupo_origem_id: item.grupoOrigemId || null,
    grupo_origem_nome: item.grupoOrigemNome || null,
    area_origem_id: item.areaOrigemId || null,
    area_origem_nome: item.areaOrigemNome || null,
    grupo_destino_id: item.grupoDestinoId || null,
    grupo_destino_nome: item.grupoDestinoNome || null,
    area_destino_id: item.areaDestinoId || null,
    area_destino_nome: item.areaDestinoNome || null,
    quantidade_origem: item.quantidadeOrigem ?? null,
    iniciada_em: item.iniciadaEm,
    pausada_em: item.pausadaEm ?? null,
    finalizada_em: item.finalizadaEm ?? null,
    status: item.status,
    observacao: item.observacao ?? null,
    atualizado_em: new Date().toISOString(),
  };
}

function paraLocal(item: Record<string, unknown>): CargaAguardando {
  return {
    id: String(item.id ?? ""),
    deviceId: String(item.device_id ?? ""),
    operadorNome: String(item.operador_nome ?? ""),
    placa: String(item.placa ?? ""),
    tipo: String(item.tipo ?? "meia-carga") as TipoCargaAguardando,
    grupoOrigemId: String(item.grupo_origem_id ?? "sem-grupo"),
    grupoOrigemNome: String(item.grupo_origem_nome ?? "Sem grupo"),
    areaOrigemId: String(item.area_origem_id ?? ""),
    areaOrigemNome: String(item.area_origem_nome ?? ""),
    grupoDestinoId: String(item.grupo_destino_id ?? "sem-grupo"),
    grupoDestinoNome: String(item.grupo_destino_nome ?? "Sem grupo"),
    areaDestinoId: String(item.area_destino_id ?? ""),
    areaDestinoNome: String(item.area_destino_nome ?? ""),
    quantidadeOrigem:
      typeof item.quantidade_origem === "object" &&
      item.quantidade_origem !== null
        ? (item.quantidade_origem as QuantidadeCargaAguardando)
        : undefined,
    iniciadaEm: String(item.iniciada_em ?? new Date().toISOString()),
    pausadaEm: item.pausada_em ? String(item.pausada_em) : undefined,
    finalizadaEm: item.finalizada_em
      ? String(item.finalizada_em)
      : undefined,
    status: String(item.status ?? "aguardando") as CargaAguardando["status"],
    observacao: item.observacao ? String(item.observacao) : undefined,
    pendenteSincronizacao: false,
  };
}

export function contarCargasAguardandoLocais(
  operadorNome?: string,
): number {
  const operador = operadorNome
    ? normalizarOperador(operadorNome)
    : null;

  return lerLista(CACHE_KEY).filter(
    (item) =>
      item.status === "aguardando" &&
      (!operador || normalizarOperador(item.operadorNome) === operador),
  ).length;
}

export async function salvarCargaAguardando(
  carga: Omit<CargaAguardando, "deviceId" | "status" | "pendenteSincronizacao">,
): Promise<CargaAguardando> {
  const normalizada: CargaAguardando = {
    ...carga,
    deviceId: obterDeviceId(),
    placa: carga.placa.trim().toUpperCase(),
    status: "aguardando",
    pausadaEm: carga.pausadaEm ?? new Date().toISOString(),
    pendenteSincronizacao: true,
  };

  salvarLista(
    CACHE_KEY,
    mesclarPorId(lerLista(CACHE_KEY), [normalizada]),
  );
  salvarLista(
    FILA_KEY,
    mesclarPorId(lerLista(FILA_KEY), [normalizada]),
  );

  if (supabaseConfigurado && supabase && navigator.onLine) {
    await sincronizarFilaCargasAguardando();
  }

  return normalizada;
}

export async function concluirCargaAguardando(
  id: string,
): Promise<void> {
  const existente = lerLista(CACHE_KEY).find((item) => item.id === id);
  if (!existente) return;

  const concluida: CargaAguardando = {
    ...existente,
    status: "finalizada",
    finalizadaEm: new Date().toISOString(),
    pendenteSincronizacao: true,
  };

  salvarLista(
    CACHE_KEY,
    mesclarPorId(lerLista(CACHE_KEY), [concluida]),
  );
  salvarLista(
    FILA_KEY,
    mesclarPorId(lerLista(FILA_KEY), [concluida]),
  );

  if (supabaseConfigurado && supabase && navigator.onLine) {
    await sincronizarFilaCargasAguardando();
  }
}

export async function listarCargasAguardando(
  operadorNome: string,
): Promise<CargaAguardando[]> {
  const operadorNormalizado = normalizarOperador(operadorNome);

  if (supabaseConfigurado && supabase && navigator.onLine) {
    await sincronizarFilaCargasAguardando();

    const { data, error } = await supabase
      .from("cargas_aguardando")
      .select("*")
      .eq("status", "aguardando")
      .order("pausada_em", { ascending: false });

    if (error) throw error;

    const remotas = (data ?? []).map((item) =>
      paraLocal(item as Record<string, unknown>),
    );

    salvarLista(
      CACHE_KEY,
      mesclarPorId(lerLista(CACHE_KEY), remotas),
    );
  }

  return lerLista(CACHE_KEY)
    .filter(
      (item) =>
        item.status === "aguardando" &&
        normalizarOperador(item.operadorNome) === operadorNormalizado,
    )
    .sort(
      (a, b) =>
        new Date(b.pausadaEm ?? b.iniciadaEm).getTime() -
        new Date(a.pausadaEm ?? a.iniciadaEm).getTime(),
    );
}

export async function sincronizarFilaCargasAguardando(): Promise<void> {
  if (!supabaseConfigurado || !supabase || !navigator.onLine) return;

  const fila = lerLista(FILA_KEY);
  if (fila.length === 0) return;

  const { error } = await supabase
    .from("cargas_aguardando")
    .upsert(fila.map(paraBanco), { onConflict: "id" });

  if (error) throw error;

  const ids = new Set(fila.map((item) => item.id));
  salvarLista(
    CACHE_KEY,
    lerLista(CACHE_KEY).map((item) =>
      ids.has(item.id)
        ? { ...item, pendenteSincronizacao: false }
        : item,
    ),
  );
  salvarLista(FILA_KEY, []);
}
