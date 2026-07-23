import { supabase, supabaseConfigurado } from "../lib/supabase";

const AREAS_KEY = "crivo_colheitas_areas";
const GRUPOS_KEY = "crivo_colheitas_grupos";
const PLACAS_KEY = "crivo_colheitas_placas";
const OPERADORES_KEY = "crivo_colheitas_operadores";
const OPERACAO_KEY = "crivo_colheitas_operacao_ativa";
const HYDRATED_KEY = "crivo_colheitas_supabase_hidratado";

type JsonRecord = Record<string, unknown>;

type OperacaoLocal = {
  registros?: JsonRecord[];
  [key: string]: unknown;
};

type StatusSincronizacao =
  | "sincronizando"
  | "sucesso"
  | "erro";

type DetalhesStatusSincronizacao = {
  status: StatusSincronizacao;
  mensagem?: string;
  data?: string;
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

function salvarLista(
  chave: string,
  itens: JsonRecord[],
) {
  localStorage.setItem(
    chave,
    JSON.stringify(itens),
  );
}

function lerOperacao(): OperacaoLocal | null {
  const salvo = localStorage.getItem(OPERACAO_KEY);

  if (!salvo) return null;

  try {
    const valor = JSON.parse(salvo) as unknown;

    return typeof valor === "object" && valor !== null
      ? (valor as OperacaoLocal)
      : null;
  } catch {
    return null;
  }
}

function mesclarPorId(
  local: JsonRecord[],
  remoto: JsonRecord[],
) {
  const mapa = new Map<string, JsonRecord>();

  remoto.forEach((item) => {
    const id = String(item.id ?? "");

    if (id) {
      mapa.set(id, item);
    }
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
    criadoEm:
      item.criado_em ??
      new Date().toISOString(),
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
    criadoEm:
      item.criado_em ??
      new Date().toISOString(),
    atualizadoEm:
      item.atualizado_em ??
      item.criado_em ??
      new Date().toISOString(),
  };
}

function carregamentoParaBanco(
  item: JsonRecord,
) {
  return {
    id: item.id,
    placa: item.placa,
    grupo_id: item.grupoId ?? null,
    grupo_nome: item.grupoNome ?? null,
    area_id: item.areaId ?? null,
    area_nome: item.areaNome ?? null,
    operador_nome: item.operadorNome ?? null,
    tipo: item.tipo ?? "saida",
    area_origem_id:
      item.areaOrigemId ?? null,
    area_origem_nome:
      item.areaOrigemNome ?? null,
    area_destino_id:
      item.areaDestinoId ?? null,
    area_destino_nome:
      item.areaDestinoNome ?? null,
    quantidade_origem:
      item.quantidadeOrigem ?? null,
    quantidade_destino:
      item.quantidadeDestino ?? null,
    observacao: item.observacao ?? null,
    criado_em:
      item.criadoEm ??
      new Date().toISOString(),
  };
}

function carregamentoParaLocal(
  item: JsonRecord,
) {
  return {
    id: item.id,
    placa: item.placa,
    grupoId:
      item.grupo_id ?? "sem-grupo",
    grupoNome:
      item.grupo_nome ?? "Sem grupo",
    areaId: item.area_id ?? "",
    areaNome: item.area_nome ?? "",
    operadorNome:
      item.operador_nome ?? "Escritório",
    tipo: item.tipo ?? "saida",
    areaOrigemId:
      item.area_origem_id ?? undefined,
    areaOrigemNome:
      item.area_origem_nome ?? undefined,
    areaDestinoId:
      item.area_destino_id ?? undefined,
    areaDestinoNome:
      item.area_destino_nome ?? undefined,
    quantidadeOrigem:
      item.quantidade_origem ?? undefined,
    quantidadeDestino:
      item.quantidade_destino ?? undefined,
    observacao:
      item.observacao ?? undefined,
    pendenteSincronizacao: false,
    criadoEm:
      item.criado_em ??
      new Date().toISOString(),
  };
}

async function sincronizarTabela(
  tabela: string,
  chaveLocal: string,
  paraBanco: (
    item: JsonRecord,
  ) => JsonRecord,
  paraLocal: (
    item: JsonRecord,
  ) => JsonRecord,
) {
  if (!supabase) return;

  const locais = lerLista(chaveLocal);

  const {
    data: remotos,
    error: erroLeitura,
  } = await supabase
    .from(tabela)
    .select("*");

  if (erroLeitura) {
    throw erroLeitura;
  }

  const remotosLocais = (
    remotos ?? []
  ).map((item) =>
    paraLocal(item as JsonRecord),
  );

  const mesclados = mesclarPorId(
    locais,
    remotosLocais,
  );

  salvarLista(
    chaveLocal,
    mesclados,
  );

  if (mesclados.length > 0) {
    const { error } = await supabase
      .from(tabela)
      .upsert(
        mesclados.map(paraBanco),
        {
          onConflict: "id",
        },
      );

    if (error) {
      throw error;
    }
  }
}

async function sincronizarCarregamentos() {
  if (!supabase) return;

  const operacao = lerOperacao();

  const locais = Array.isArray(
    operacao?.registros,
  )
    ? operacao.registros
    : [];

  /*
   * Somente registros explicitamente marcados como pendentes
   * podem ser enviados ao Supabase.
   *
   * Registros antigos já sincronizados nunca são reenviados.
   * Isso impede que outro tablet ressuscite carregamentos apagados.
   */
  const pendentes = locais.filter(
    (item) =>
      item.pendenteSincronizacao === true,
  );

  if (pendentes.length > 0) {
    const { error: erroEnvio } = await supabase
      .from("carregamentos")
      .upsert(
        pendentes.map(
          carregamentoParaBanco,
        ),
        {
          onConflict: "id",
        },
      );

    if (erroEnvio) {
      throw erroEnvio;
    }
  }

  /*
   * Depois do envio dos pendentes, o Supabase passa a ser
   * a fonte oficial do histórico de carregamentos.
   */
  const {
    data: remotos,
    error: erroLeitura,
  } = await supabase
    .from("carregamentos")
    .select("*")
    .order("criado_em", {
      ascending: true,
    });

  if (erroLeitura) {
    throw erroLeitura;
  }

  const registrosRemotos = (
    remotos ?? []
  ).map((item) =>
    carregamentoParaLocal(
      item as JsonRecord,
    ),
  );

  if (operacao) {
    localStorage.setItem(
      OPERACAO_KEY,
      JSON.stringify({
        ...operacao,
        registros: registrosRemotos,
      }),
    );
  }
}

export async function sincronizarComSupabase() {
  if (
    !supabaseConfigurado ||
    !supabase
  ) {
    return {
      conectado: false,
      mensagem:
        "Supabase ainda não configurado.",
    };
  }

  emitirStatusSincronizacao({
    status: "sincronizando",
    mensagem:
      "Enviando e recebendo dados...",
  });

  const antes = [
    GRUPOS_KEY,
    AREAS_KEY,
    PLACAS_KEY,
    OPERADORES_KEY,
    OPERACAO_KEY,
  ]
    .map(
      (chave) =>
        localStorage.getItem(chave) ?? "",
    )
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

    await sincronizarCarregamentos();

    const dataSincronizacao =
      new Date().toISOString();

    localStorage.setItem(
      HYDRATED_KEY,
      dataSincronizacao,
    );

    const depois = [
      GRUPOS_KEY,
      AREAS_KEY,
      PLACAS_KEY,
      OPERADORES_KEY,
      OPERACAO_KEY,
    ]
      .map(
        (chave) =>
          localStorage.getItem(chave) ??
          "",
      )
      .join("|");

    /*
     * Este evento atualiza as páginas somente quando
     * os dados locais realmente mudaram.
     */
    if (antes !== depois) {
      window.dispatchEvent(
        new Event(
          "crivo:supabase-sincronizado",
        ),
      );
    }

    /*
     * Este evento atualiza apenas o indicador,
     * inclusive quando nenhum dado mudou.
     */
    emitirStatusSincronizacao({
      status: "sucesso",
      mensagem:
        "Todos os dados foram sincronizados.",
      data: dataSincronizacao,
    });

    return {
      conectado: true,
      mensagem:
        "Dados sincronizados.",
    };
  } catch (erro) {
    emitirStatusSincronizacao({
      status: "erro",
      mensagem:
        "Não foi possível sincronizar.",
    });

    throw erro;
  }
}

export function iniciarSincronizacaoAutomatica(
  onErro?: (erro: unknown) => void,
) {
  let executando = false;

  const executar = async () => {
    if (
      executando ||
      !navigator.onLine ||
      !supabaseConfigurado
    ) {
      return;
    }

    executando = true;

    try {
      await sincronizarComSupabase();
    } catch (erro) {
      onErro?.(erro);
    } finally {
      executando = false;
    }
  };

  void executar();

  const intervalo =
    window.setInterval(
      executar,
      5000,
    );

  window.addEventListener(
    "online",
    executar,
  );

  return () => {
    window.clearInterval(intervalo);

    window.removeEventListener(
      "online",
      executar,
    );
  };
}