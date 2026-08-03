import { supabase, supabaseConfigurado } from "../lib/supabase";
import {
  contarCarregamentosPendentes,
  listarCarregamentosLocais,
  type TipoCarregamento,
} from "./carregamentosService";
import { contarCargasAguardandoLocais } from "./cargasAguardandoService";

const SESSAO_KEY = "crivo_colheitas_sessao";
const OPERACAO_KEY = "crivo_colheitas_operacao_ativa";
const HYDRATED_KEY = "crivo_colheitas_supabase_hidratado";

type SessaoLocal = {
  tipo?: "admin" | "operador";
  nome?: string;
};

type OperacaoLocal = {
  grupoId?: string;
  grupoNome?: string;
  areaId?: string;
  areaNome?: string;
  cargaPendente?: unknown;
};

export type StatusOperador = {
  deviceId: string;
  operadorNome: string;
  grupoId?: string;
  grupoNome?: string;
  areaId?: string;
  areaNome?: string;
  emOperacao: boolean;
  online: boolean;
  pendentesSincronizacao: number;
  cargasAguardando: number;
  ultimaAtividade?: string;
  ultimaSincronizacao?: string;
  ultimaAreaId?: string;
  ultimaAreaNome?: string;
  ultimaPlaca?: string;
  ultimoTipo?: TipoCarregamento;
  ultimoLancamentoEm?: string;
  atualizadoEm: string;
};

function lerJson<T>(chave: string): T | null {
  const salvo = localStorage.getItem(chave);
  if (!salvo) return null;

  try {
    return JSON.parse(salvo) as T;
  } catch {
    return null;
  }
}

function normalizarNomeOperador(nome: string): string {
  return nome
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function chaveStatusOperador(nome: string): string {
  return `operador-${normalizarNomeOperador(nome) || "sem-nome"}`;
}

function paraLocal(item: Record<string, unknown>): StatusOperador {
  return {
    deviceId: String(item.device_id ?? ""),
    operadorNome: String(item.operador_nome ?? "Desconhecido"),
    grupoId: item.grupo_id ? String(item.grupo_id) : undefined,
    grupoNome: item.grupo_nome ? String(item.grupo_nome) : undefined,
    areaId: item.area_id ? String(item.area_id) : undefined,
    areaNome: item.area_nome ? String(item.area_nome) : undefined,
    emOperacao: Boolean(item.em_operacao),
    online: Boolean(item.online),
    pendentesSincronizacao:
      Number(item.pendentes_sincronizacao) || 0,
    cargasAguardando: Number(item.cargas_aguardando) || 0,
    ultimaAtividade: item.ultima_atividade
      ? String(item.ultima_atividade)
      : undefined,
    ultimaSincronizacao: item.ultima_sincronizacao
      ? String(item.ultima_sincronizacao)
      : undefined,
    ultimaAreaId: item.ultima_area_id
      ? String(item.ultima_area_id)
      : undefined,
    ultimaAreaNome: item.ultima_area_nome
      ? String(item.ultima_area_nome)
      : undefined,
    ultimaPlaca: item.ultima_placa
      ? String(item.ultima_placa)
      : undefined,
    ultimoTipo: item.ultimo_tipo
      ? (String(item.ultimo_tipo) as TipoCarregamento)
      : undefined,
    ultimoLancamentoEm: item.ultimo_lancamento_em
      ? String(item.ultimo_lancamento_em)
      : undefined,
    atualizadoEm: String(
      item.atualizado_em ?? new Date().toISOString(),
    ),
  };
}

export async function atualizarStatusDesteAparelho(
  opcoes: {
    ultimaAtividade?: string;
    ultimaSincronizacao?: string;
    online?: boolean;
  } = {},
): Promise<void> {
  if (!supabaseConfigurado || !supabase || !navigator.onLine) return;

  const sessao = lerJson<SessaoLocal>(SESSAO_KEY);
  if (!sessao?.nome || sessao.tipo !== "operador") return;

  const operacao = lerJson<OperacaoLocal>(OPERACAO_KEY);
  const agora = new Date().toISOString();
  const ultimaSincronizacao =
    opcoes.ultimaSincronizacao ??
    localStorage.getItem(HYDRATED_KEY) ??
    agora;

  const nomeOperadorNormalizado = sessao.nome
    .trim()
    .toLocaleLowerCase("pt-BR");

  const ultimoCarregamento = listarCarregamentosLocais()
    .filter(
      (item) =>
        item.operadorNome.trim().toLocaleLowerCase("pt-BR") ===
        nomeOperadorNormalizado,
    )
    .sort(
      (a, b) =>
        new Date(b.criadoEm).getTime() -
        new Date(a.criadoEm).getTime(),
    )[0];

  const { error } = await supabase
    .from("status_operadores")
    .upsert(
      {
        device_id: chaveStatusOperador(sessao.nome),
        operador_nome: sessao.nome,
        grupo_id: operacao?.grupoId || null,
        grupo_nome: operacao?.grupoNome || null,
        area_id: operacao?.areaId || null,
        area_nome: operacao?.areaNome || null,
        em_operacao: Boolean(operacao?.areaId),
        online: opcoes.online ?? true,
        pendentes_sincronizacao:
          contarCarregamentosPendentes(),
        cargas_aguardando:
          contarCargasAguardandoLocais(sessao.nome) +
          (operacao?.cargaPendente ? 1 : 0),
        ultima_atividade: opcoes.ultimaAtividade ?? agora,
        ultima_sincronizacao: ultimaSincronizacao,
        ultima_area_id:
          operacao?.areaId || ultimoCarregamento?.areaId || null,
        ultima_area_nome:
          operacao?.areaNome || ultimoCarregamento?.areaNome || null,
        ultima_placa: ultimoCarregamento?.placa || null,
        ultimo_tipo: ultimoCarregamento?.tipo || null,
        ultimo_lancamento_em: ultimoCarregamento?.criadoEm || null,
        atualizado_em: agora,
      },
      { onConflict: "device_id" },
    );

  if (error) throw error;
}

export async function marcarEsteAparelhoInativo(): Promise<void> {
  if (!supabaseConfigurado || !supabase || !navigator.onLine) return;

  const sessao = lerJson<SessaoLocal>(SESSAO_KEY);
  if (!sessao?.nome || sessao.tipo !== "operador") return;

  const agora = new Date().toISOString();

  const { error } = await supabase
    .from("status_operadores")
    .upsert(
      {
        device_id: chaveStatusOperador(sessao.nome),
        operador_nome: sessao.nome,
        em_operacao: false,
        online: false,
        pendentes_sincronizacao:
          contarCarregamentosPendentes(),
        cargas_aguardando: 0,
        ultima_atividade: agora,
        atualizado_em: agora,
      },
      { onConflict: "device_id" },
    );

  if (error) throw error;
}

export async function listarStatusOperadores(): Promise<StatusOperador[]> {
  if (!supabaseConfigurado || !supabase || !navigator.onLine) return [];

  const { data, error } = await supabase
    .from("status_operadores")
    .select("*")
    .order("atualizado_em", { ascending: false });

  if (error) throw error;

  const recebidos = (data ?? []).map((item) =>
    paraLocal(item as Record<string, unknown>),
  );

  /*
   * Versões antigas gravavam um registro por aparelho.
   * A Central agora exibe somente o status mais recente de cada operador,
   * evitando cartões repetidos durante a migração.
   */
  const porOperador = new Map<string, StatusOperador>();

  recebidos.forEach((status) => {
    const chave = normalizarNomeOperador(status.operadorNome);
    const existente = porOperador.get(chave);

    if (
      !existente ||
      new Date(status.atualizadoEm).getTime() >
        new Date(existente.atualizadoEm).getTime()
    ) {
      porOperador.set(chave, status);
    }
  });

  return Array.from(porOperador.values()).sort(
    (a, b) =>
      new Date(b.atualizadoEm).getTime() -
      new Date(a.atualizadoEm).getTime(),
  );
}
