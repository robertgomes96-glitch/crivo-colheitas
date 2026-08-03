import { supabase, supabaseConfigurado } from "../lib/supabase";

const OPERACAO_KEY = "crivo_colheitas_operacao_ativa";
const CACHE_KEY = "crivo_colheitas_carregamentos_cache";
const FILA_KEY = "crivo_colheitas_carregamentos_fila";
const MIGRACAO_KEY = "crivo_colheitas_carregamentos_migrados_v2";

export type TipoCarregamento =
  | "saida"
  | "faltou-pouco"
  | "meia-carga"
  | "quantidade";

export type QuantidadeCarregamento = {
  bazuca?: number;
  graneleiro?: number;
  kg?: number;
  sacos?: number;
};

export type Carregamento = {
  id: string;
  placa: string;
  grupoId: string;
  grupoNome: string;
  areaId: string;
  areaNome: string;
  operadorNome: string;
  tipo: TipoCarregamento;
  criadoEm: string;
  areaOrigemId?: string;
  areaOrigemNome?: string;
  areaDestinoId?: string;
  areaDestinoNome?: string;
  quantidadeOrigem?: QuantidadeCarregamento;
  quantidadeDestino?: QuantidadeCarregamento;
  observacao?: string;
  pendenteSincronizacao?: boolean;
};

function lerLista(chave: string): Carregamento[] {
  const salvo = localStorage.getItem(chave);
  if (!salvo) return [];

  try {
    const valor = JSON.parse(salvo) as unknown;
    return Array.isArray(valor) ? (valor as Carregamento[]) : [];
  } catch {
    return [];
  }
}

function salvarLista(chave: string, registros: Carregamento[]): void {
  localStorage.setItem(chave, JSON.stringify(registros));
}

function mesclarPorId(
  primeira: Carregamento[],
  segunda: Carregamento[],
): Carregamento[] {
  const mapa = new Map<string, Carregamento>();

  primeira.forEach((item) => {
    if (item.id) mapa.set(item.id, item);
  });

  segunda.forEach((item) => {
    if (!item.id) return;

    mapa.set(item.id, {
      ...mapa.get(item.id),
      ...item,
    });
  });

  return Array.from(mapa.values()).sort(
    (a, b) =>
      new Date(b.criadoEm).getTime() -
      new Date(a.criadoEm).getTime(),
  );
}

function migrarRegistrosAntigos(): void {
  if (localStorage.getItem(MIGRACAO_KEY) === "ok") return;

  const salvo = localStorage.getItem(OPERACAO_KEY);
  if (!salvo) {
    localStorage.setItem(MIGRACAO_KEY, "ok");
    return;
  }

  try {
    const operacao = JSON.parse(salvo) as {
      registros?: Carregamento[];
    };

    const antigos = Array.isArray(operacao.registros)
      ? operacao.registros
      : [];

    if (antigos.length > 0) {
      const cacheAtual = lerLista(CACHE_KEY);
      const filaAtual = lerLista(FILA_KEY);

      salvarLista(CACHE_KEY, mesclarPorId(cacheAtual, antigos));

      const pendentes = antigos.filter(
        (item) => item.pendenteSincronizacao === true,
      );

      salvarLista(FILA_KEY, mesclarPorId(filaAtual, pendentes));
    }

    /*
     * Mantém a propriedade registros por compatibilidade com a tela atual,
     * mas ela deixa de ser a fonte oficial do histórico.
     */
    localStorage.setItem(MIGRACAO_KEY, "ok");
  } catch {
    localStorage.setItem(MIGRACAO_KEY, "ok");
  }
}

function paraLocal(item: Record<string, unknown>): Carregamento {
  return {
    id: String(item.id ?? ""),
    placa: String(item.placa ?? ""),
    grupoId: String(item.grupo_id ?? "sem-grupo"),
    grupoNome: String(item.grupo_nome ?? "Sem grupo"),
    areaId: String(item.area_id ?? ""),
    areaNome: String(item.area_nome ?? ""),
    operadorNome: String(item.operador_nome ?? "Escritório"),
    tipo: (item.tipo ?? "saida") as TipoCarregamento,
    criadoEm: String(item.criado_em ?? new Date().toISOString()),
    areaOrigemId: item.area_origem_id
      ? String(item.area_origem_id)
      : undefined,
    areaOrigemNome: item.area_origem_nome
      ? String(item.area_origem_nome)
      : undefined,
    areaDestinoId: item.area_destino_id
      ? String(item.area_destino_id)
      : undefined,
    areaDestinoNome: item.area_destino_nome
      ? String(item.area_destino_nome)
      : undefined,
    quantidadeOrigem:
      typeof item.quantidade_origem === "object" &&
      item.quantidade_origem !== null
        ? (item.quantidade_origem as QuantidadeCarregamento)
        : undefined,
    quantidadeDestino:
      typeof item.quantidade_destino === "object" &&
      item.quantidade_destino !== null
        ? (item.quantidade_destino as QuantidadeCarregamento)
        : undefined,
    observacao: item.observacao
      ? String(item.observacao)
      : undefined,
    pendenteSincronizacao: false,
  };
}

function paraBanco(item: Carregamento) {
  return {
    id: item.id,
    placa: item.placa,
    grupo_id: item.grupoId || null,
    grupo_nome: item.grupoNome || null,
    area_id: item.areaId || null,
    area_nome: item.areaNome || null,
    operador_nome: item.operadorNome || null,
    tipo: item.tipo,
    area_origem_id: item.areaOrigemId ?? null,
    area_origem_nome: item.areaOrigemNome ?? null,
    area_destino_id: item.areaDestinoId ?? null,
    area_destino_nome: item.areaDestinoNome ?? null,
    quantidade_origem: item.quantidadeOrigem ?? null,
    quantidade_destino: item.quantidadeDestino ?? null,
    observacao: item.observacao ?? null,
    criado_em: item.criadoEm,
  };
}

async function enviarFilaPendente(): Promise<void> {
  if (!supabaseConfigurado || !supabase || !navigator.onLine) return;

  const fila = lerLista(FILA_KEY);
  if (fila.length === 0) return;

  const { error } = await supabase
    .from("carregamentos")
    .upsert(fila.map(paraBanco), { onConflict: "id" });

  if (error) throw error;

  const idsEnviados = new Set(fila.map((item) => item.id));

  const cacheAtualizado = lerLista(CACHE_KEY).map((item) =>
    idsEnviados.has(item.id)
      ? { ...item, pendenteSincronizacao: false }
      : item,
  );

  salvarLista(CACHE_KEY, cacheAtualizado);
  salvarLista(FILA_KEY, []);

  window.dispatchEvent(
    new CustomEvent("crivo:fila-atualizada", {
      detail: { pendentes: 0 },
    }),
  );
}

export function contarCarregamentosPendentes(): number {
  migrarRegistrosAntigos();
  return lerLista(FILA_KEY).length;
}

export function listarCarregamentosLocais(): Carregamento[] {
  migrarRegistrosAntigos();
  return lerLista(CACHE_KEY);
}

export async function salvarCarregamento(
  carregamento: Carregamento,
): Promise<void> {
  migrarRegistrosAntigos();

  const normalizado: Carregamento = {
    ...carregamento,
    placa: carregamento.placa.trim().toUpperCase(),
    pendenteSincronizacao: true,
  };

  const cache = mesclarPorId(lerLista(CACHE_KEY), [normalizado]);
  const fila = mesclarPorId(lerLista(FILA_KEY), [normalizado]);

  /*
   * Primeiro salva em dois locais independentes da tela:
   * cache do histórico e fila de envio.
   */
  salvarLista(CACHE_KEY, cache);
  salvarLista(FILA_KEY, fila);

  window.dispatchEvent(
    new CustomEvent("crivo:fila-atualizada", {
      detail: { pendentes: fila.length },
    }),
  );

  if (!supabaseConfigurado || !supabase || !navigator.onLine) return;

  await enviarFilaPendente();

  window.dispatchEvent(new Event("crivo:supabase-sincronizado"));
}

export async function listarCarregamentos(): Promise<Carregamento[]> {
  migrarRegistrosAntigos();

  if (!supabaseConfigurado || !supabase || !navigator.onLine) {
    return lerLista(CACHE_KEY);
  }

  await enviarFilaPendente();

  const { data, error } = await supabase
    .from("carregamentos")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) throw error;

  const remotos = (data ?? []).map((item) =>
    paraLocal(item as Record<string, unknown>),
  );

  const mesclados = mesclarPorId(lerLista(CACHE_KEY), remotos);
  salvarLista(CACHE_KEY, mesclados);

  return mesclados;
}

export async function editarCarregamento(
  carregamento: Carregamento,
): Promise<void> {
  await salvarCarregamento(carregamento);
}

export async function excluirCarregamentos(
  ids: string[],
): Promise<void> {
  migrarRegistrosAntigos();

  const idsValidos = [...new Set(ids.filter(Boolean))];
  if (idsValidos.length === 0) return;

  /*
   * Exclusão de registro já compartilhado exige internet.
   * Isso evita apagar só localmente e o item reaparecer depois.
   */
  if (!supabaseConfigurado || !supabase || !navigator.onLine) {
    throw new Error(
      "É necessário estar conectado para excluir carregamentos.",
    );
  }

  const { error } = await supabase
    .from("carregamentos")
    .delete()
    .in("id", idsValidos);

  if (error) throw error;

  const conjunto = new Set(idsValidos);

  salvarLista(
    CACHE_KEY,
    lerLista(CACHE_KEY).filter((item) => !conjunto.has(item.id)),
  );

  salvarLista(
    FILA_KEY,
    lerLista(FILA_KEY).filter((item) => !conjunto.has(item.id)),
  );

  window.dispatchEvent(new Event("crivo:supabase-sincronizado"));
}

export async function excluirTodosCarregamentos(): Promise<void> {
  if (!supabaseConfigurado || !supabase || !navigator.onLine) {
    throw new Error(
      "É necessário estar conectado para apagar todos os carregamentos.",
    );
  }

  const { error } = await supabase
    .from("carregamentos")
    .delete()
    .not("id", "is", null);

  if (error) throw error;

  salvarLista(CACHE_KEY, []);
  salvarLista(FILA_KEY, []);

  window.dispatchEvent(new Event("crivo:supabase-sincronizado"));
}

export async function sincronizarFilaCarregamentos(): Promise<void> {
  migrarRegistrosAntigos();
  await enviarFilaPendente();
}
