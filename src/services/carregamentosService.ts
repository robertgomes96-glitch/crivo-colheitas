import { supabase, supabaseConfigurado } from "../lib/supabase";

const OPERACAO_KEY = "crivo_colheitas_operacao_ativa";

export type TipoCarregamento =
  | "saida"
  | "faltou-pouco"
  | "meia-carga"
  | "quantidade";

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
  quantidadeOrigem?: Record<string, number>;
  quantidadeDestino?: Record<string, number>;
  observacao?: string;
};

type OperacaoLocal = {
  registros?: Carregamento[];
  [key: string]: unknown;
};

function lerOperacaoLocal(): OperacaoLocal | null {
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

function lerRegistrosLocais(): Carregamento[] {
  const registros = lerOperacaoLocal()?.registros;
  return Array.isArray(registros) ? registros : [];
}

function salvarRegistrosLocais(
  registros: Carregamento[],
  avisarAplicacao = true,
) {
  const operacao = lerOperacaoLocal();

  /*
   * Não cria uma operação fictícia quando ainda não existe uma operação ativa.
   * Apenas atualiza o histórico local quando a operação já existe.
   */
  if (operacao) {
    localStorage.setItem(
      OPERACAO_KEY,
      JSON.stringify({
        ...operacao,
        registros,
      }),
    );
  }

  /*
   * Listar dados não pode emitir este evento, pois o App mudava a key da página
   * e remontava a tela continuamente. O evento fica apenas para edição/exclusão.
   */
  if (avisarAplicacao) {
    window.dispatchEvent(new Event("crivo:supabase-sincronizado"));
  }
}

function mesclarPorId(
  locais: Carregamento[],
  remotos: Carregamento[],
): Carregamento[] {
  const mapa = new Map<string, Carregamento>();

  remotos.forEach((item) => {
    if (item.id) mapa.set(item.id, item);
  });

  locais.forEach((item) => {
    if (item.id) {
      mapa.set(item.id, {
        ...mapa.get(item.id),
        ...item,
      });
    }
  });

  return Array.from(mapa.values()).sort(
    (a, b) =>
      new Date(b.criadoEm).getTime() -
      new Date(a.criadoEm).getTime(),
  );
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
        ? (item.quantidade_origem as Record<string, number>)
        : undefined,
    quantidadeDestino:
      typeof item.quantidade_destino === "object" &&
      item.quantidade_destino !== null
        ? (item.quantidade_destino as Record<string, number>)
        : undefined,
    observacao: item.observacao
      ? String(item.observacao)
      : undefined,
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

export async function listarCarregamentos(): Promise<Carregamento[]> {
  const locais = lerRegistrosLocais();

  if (!supabaseConfigurado || !supabase || !navigator.onLine) {
    return mesclarPorId(locais, []);
  }

  const { data, error } = await supabase
    .from("carregamentos")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) throw error;

  const remotos = (data ?? []).map((item) =>
    paraLocal(item as Record<string, unknown>),
  );

  const mesclados = mesclarPorId(locais, remotos);

  /*
   * Atualiza o local sem disparar evento de remontagem da página.
   */
  salvarRegistrosLocais(mesclados, false);

  return mesclados;
}

export async function editarCarregamento(
  carregamento: Carregamento,
) {
  const atualizado: Carregamento = {
    ...carregamento,
    placa: carregamento.placa.trim().toUpperCase(),
  };

  if (supabaseConfigurado && supabase && navigator.onLine) {
    const { error } = await supabase
      .from("carregamentos")
      .upsert(paraBanco(atualizado), { onConflict: "id" });

    if (error) throw error;
  }

  const atuais = lerRegistrosLocais();
  const atualizados = atuais.some(
    (item) => item.id === atualizado.id,
  )
    ? atuais.map((item) =>
        item.id === atualizado.id ? atualizado : item,
      )
    : [atualizado, ...atuais];

  salvarRegistrosLocais(
    mesclarPorId(atualizados, []),
  );
}

export async function excluirCarregamentos(ids: string[]) {
  const idsValidos = [...new Set(ids.filter(Boolean))];
  if (idsValidos.length === 0) return;

  /*
   * Primeiro exclui do banco. Só depois remove do navegador.
   * Assim, se o Supabase recusar, o registro local não é perdido.
   */
  if (supabaseConfigurado && supabase && navigator.onLine) {
    const { error } = await supabase
      .from("carregamentos")
      .delete()
      .in("id", idsValidos);

    if (error) throw error;
  }

  const conjunto = new Set(idsValidos);
  const atualizados = lerRegistrosLocais().filter(
    (item) => !conjunto.has(item.id),
  );

  salvarRegistrosLocais(atualizados);
}

export async function excluirTodosCarregamentos() {
  if (supabaseConfigurado && supabase && navigator.onLine) {
    const { error } = await supabase
      .from("carregamentos")
      .delete()
      .not("id", "is", null);

    if (error) throw error;
  }

  salvarRegistrosLocais([]);
  }
