import { supabase, supabaseConfigurado } from "../lib/supabase";
import {
  sincronizarFilaCarregamentos,
} from "./carregamentosService";
import { sincronizarFilaOcorrencias } from "./ocorrenciasService";
import { atualizarStatusDesteAparelho } from "./statusOperadoresService";
import { sincronizarFilaCargasAguardando } from "./cargasAguardandoService";

const AREAS_KEY = "crivo_colheitas_areas";
const GRUPOS_KEY = "crivo_colheitas_grupos";
const PLACAS_KEY = "crivo_colheitas_placas";
const OPERADORES_KEY = "crivo_colheitas_operadores";
const HYDRATED_KEY = "crivo_colheitas_supabase_hidratado";
const INTERVALO_SINCRONIZACAO_MS = 60_000;

type JsonRecord = Record<string, unknown>;

type StatusSincronizacao =
  | "sincronizando"
  | "sucesso"
  | "erro";

type DetalhesStatusSincronizacao = {
  status: StatusSincronizacao;
  mensagem?: string;
  data?: string;
};

type OpcoesSincronizacao = {
  silenciosa?: boolean;
};

function emitirStatusSincronizacao(
  detalhes: DetalhesStatusSincronizacao,
) {
  window.dispatchEvent(
    new CustomEvent("crivo:sync-status", {
      detail: detalhes,
    }),
  );
}

function lerLista(chave: string): JsonRecord[] {
  const salvo = localStorage.getItem(chave);

  if (!salvo) return [];

  try {
    const valor = JSON.parse(salvo) as unknown;

    return Array.isArray(valor)
      ? valor.filter(
          (item): item is JsonRecord =>
            typeof item === "object" && item !== null,
        )
      : [];
  } catch {
    return [];
  }
}

function salvarLista(chave: string, itens: JsonRecord[]) {
  localStorage.setItem(chave, JSON.stringify(itens));
}

function mesclarPorId(local: JsonRecord[], remoto: JsonRecord[]) {
  const mapa = new Map<string, JsonRecord>();

  remoto.forEach((item) => {
    const id = String(item.id ?? "");
    if (id) mapa.set(id, item);
  });

  local.forEach((item) => {
    const id = String(item.id ?? "");

    if (id) {
      mapa.set(id, {
        ...mapa.get(id),
        ...item,
      });
    }
  });

  return Array.from(mapa.values());
}

function grupoParaBanco(item: JsonRecord) {
  return {
    id: item.id,
    nome: item.nome,
    ativo: item.ativo ?? true,
  };
}

function grupoParaLocal(item: JsonRecord) {
  return {
    id: item.id,
    nome: item.nome,
  };
}

function areaParaBanco(item: JsonRecord) {
  return {
    id: item.id,
    nome: item.nome,
    grupo_id: item.grupoId || null,
    ativa: item.ativa ?? true,
  };
}

function areaParaLocal(item: JsonRecord) {
  return {
    id: item.id,
    nome: item.nome,
    grupoId: item.grupo_id ?? "",
    ativa: item.ativa ?? true,
  };
}

function placaParaBanco(item: JsonRecord) {
  return {
    id: item.id,
    placa: item.placa,
    apelido: item.apelido || null,
    ativa: item.ativa ?? true,
  };
}

function placaParaLocal(item: JsonRecord) {
  return {
    id: item.id,
    placa: item.placa,
    apelido: item.apelido ?? "",
    ativa: item.ativa ?? true,
    criadoEm: item.criado_em ?? new Date().toISOString(),
    atualizadoEm:
      item.atualizado_em ??
      item.criado_em ??
      new Date().toISOString(),
    usos: item.usos ?? 0,
  };
}

function operadorParaBanco(item: JsonRecord) {
  return {
    id: item.id,
    nome: item.nome,
    pin: item.pin,
    cargo: item.cargo ?? "operador",
    ativo: item.ativo ?? true,
  };
}

function operadorParaLocal(item: JsonRecord) {
  return {
    id: item.id,
    nome: item.nome,
    pin: item.pin,
    cargo: item.cargo ?? "operador",
    ativo: item.ativo ?? true,
    criadoEm: item.criado_em ?? new Date().toISOString(),
    atualizadoEm:
      item.atualizado_em ??
      item.criado_em ??
      new Date().toISOString(),
  };
}

async function sincronizarTabela(
  tabela: string,
  chaveLocal: string,
  paraBanco: (item: JsonRecord) => JsonRecord,
  paraLocal: (item: JsonRecord) => JsonRecord,
) {
  if (!supabase) return;

  const locais = lerLista(chaveLocal);

  const { data: remotos, error: erroLeitura } = await supabase
    .from(tabela)
    .select("*");

  if (erroLeitura) throw erroLeitura;

  const remotosLocais = (remotos ?? []).map((item) =>
    paraLocal(item as JsonRecord),
  );

  const mesclados = mesclarPorId(locais, remotosLocais);
  salvarLista(chaveLocal, mesclados);

  if (mesclados.length > 0) {
    const { error } = await supabase
      .from(tabela)
      .upsert(mesclados.map(paraBanco), { onConflict: "id" });

    if (error) throw error;
  }
}

export async function sincronizarComSupabase(
  opcoes: OpcoesSincronizacao = {},
) {
  if (!supabaseConfigurado || !supabase) {
    return {
      conectado: false,
      mensagem: "Supabase ainda não configurado.",
    };
  }

  if (!navigator.onLine) {
    return {
      conectado: false,
      mensagem: "Sem internet. Dados mantidos no aparelho.",
    };
  }

  const silenciosa = opcoes.silenciosa === true;

  if (!silenciosa) {
    emitirStatusSincronizacao({
      status: "sincronizando",
      mensagem: "Enviando e recebendo dados...",
    });
  }

  /*
   * A operação ativa NÃO entra nesta lista.
   * Área atual, modais e cargas em andamento pertencem somente ao aparelho.
   */
  const chavesCompartilhadas = [
    GRUPOS_KEY,
    AREAS_KEY,
    PLACAS_KEY,
    OPERADORES_KEY,
  ];

  const antes = chavesCompartilhadas
    .map((chave) => localStorage.getItem(chave) ?? "")
    .join("|");

  try {
    await sincronizarTabela(
      "grupos",
      GRUPOS_KEY,
      grupoParaBanco,
      grupoParaLocal,
    );

    await sincronizarTabela(
      "areas",
      AREAS_KEY,
      areaParaBanco,
      areaParaLocal,
    );

    await sincronizarTabela(
      "placas",
      PLACAS_KEY,
      placaParaBanco,
      placaParaLocal,
    );

    await sincronizarTabela(
      "operadores",
      OPERADORES_KEY,
      operadorParaBanco,
      operadorParaLocal,
    );

    /*
     * Envia somente a fila independente de carregamentos.
     * Nunca substitui a operação ativa do aparelho.
     */
    await sincronizarFilaCarregamentos();
    await sincronizarFilaOcorrencias();
    await sincronizarFilaCargasAguardando();

    const dataSincronizacao = new Date().toISOString();
    localStorage.setItem(HYDRATED_KEY, dataSincronizacao);

    await atualizarStatusDesteAparelho({
      ultimaSincronizacao: dataSincronizacao,
    });

    const depois = chavesCompartilhadas
      .map((chave) => localStorage.getItem(chave) ?? "")
      .join("|");

    if (antes !== depois) {
      window.dispatchEvent(
        new Event("crivo:cadastros-sincronizados"),
      );
    }

    emitirStatusSincronizacao({
      status: "sucesso",
      mensagem: "Todos os dados foram sincronizados.",
      data: dataSincronizacao,
    });

    return {
      conectado: true,
      mensagem: "Dados sincronizados.",
    };
  } catch (erro) {
    emitirStatusSincronizacao({
      status: "erro",
      mensagem: "Não foi possível sincronizar.",
    });

    throw erro;
  }
}

export function iniciarSincronizacaoAutomatica(
  onErro?: (erro: unknown) => void,
) {
  let executando = false;
  let encerrado = false;

  const executar = async (silenciosa = false) => {
    if (
      encerrado ||
      executando ||
      !navigator.onLine ||
      !supabaseConfigurado
    ) {
      return;
    }

    executando = true;

    try {
      await sincronizarComSupabase({ silenciosa });
    } catch (erro) {
      onErro?.(erro);
    } finally {
      executando = false;
    }
  };

  void executar(false);

  const intervalo = window.setInterval(
    () => void executar(true),
    INTERVALO_SINCRONIZACAO_MS,
  );

  const aoFicarOnline = () => void executar(false);

  window.addEventListener("online", aoFicarOnline);

  return () => {
    encerrado = true;
    window.clearInterval(intervalo);
    window.removeEventListener("online", aoFicarOnline);
  };
}
