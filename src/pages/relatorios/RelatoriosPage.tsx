import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Filter,
  FolderOpen,
  MapPinned,
  RefreshCcw,
  Search,
  Truck,
  Wheat,
  X,
} from "lucide-react";
import "./RelatoriosPage.css";

type RelatoriosPageProps = {
  onVoltar: () => void;
};

type Grupo = {
  id: string;
  nome: string;
};

type Area = {
  id: string;
  nome: string;
  grupoId?: string;
  ativa?: boolean;
};

type QuantidadeCarga = {
  bazuca: number;
  graneleiro: number;
  kg: number;
  sacos: number;
};

type RegistroOperacao = {
  id: string;
  grupoId: string;
  grupoNome: string;
  areaId: string;
  areaNome: string;
  operadorNome: string;
  placa: string;
  criadoEm: string;
  tipo?: "saida" | "faltou-pouco" | "meia-carga" | "quantidade";
  areaOrigemId?: string;
  areaOrigemNome?: string;
  areaDestinoId?: string;
  areaDestinoNome?: string;
  quantidadeOrigem?: QuantidadeCarga;
  quantidadeDestino?: QuantidadeCarga;
  observacao?: string;
};

type OperacaoAtiva = {
  registros?: RegistroOperacao[];
};

type DadosAreas = {
  grupos: Grupo[];
  areas: Area[];
};

type PeriodoRapido = "hoje" | "ontem" | "sete-dias" | "tudo";

type ParticipacaoArea = {
  chave: string;
  registroId: string;
  placa: string;
  criadoEm: string;
  operadorNome: string;
  areaId: string;
  areaNome: string;
  grupoId: string;
  grupoNome: string;
  tipo: "completa" | "origem" | "destino";
  tituloStatus: string;
  descricaoStatus: string;
  cargaDividida: boolean;
};

const OPERACAO_KEY = "crivo_colheitas_operacao_ativa";

function normalizarTexto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

function limparPlaca(valor: string) {
  return valor.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function formatarPlaca(placa: string) {
  const limpa = limparPlaca(placa);
  return limpa.length === 7 ? `${limpa.slice(0, 3)}-${limpa.slice(3)}` : limpa;
}

function formatarDataHora(dataIso: string) {
  const data = new Date(dataIso);

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

function textoQuantidade(q?: QuantidadeCarga) {
  if (!q) return "";

  const partes: string[] = [];

  if ((Number(q.bazuca) || 0) > 0) {
    const valor = Number(q.bazuca);
    partes.push(
      `${valor.toLocaleString("pt-BR")} ${valor === 1 ? "bazuca" : "bazucas"}`,
    );
  }

  if ((Number(q.graneleiro) || 0) > 0) {
    const valor = Number(q.graneleiro);
    partes.push(
      `${valor.toLocaleString("pt-BR")} ${
        valor === 1 ? "graneleiro" : "graneleiros"
      }`,
    );
  }

  if ((Number(q.kg) || 0) > 0) {
    partes.push(`${Number(q.kg).toLocaleString("pt-BR")} kg`);
  }

  if ((Number(q.sacos) || 0) > 0) {
    const valor = Number(q.sacos);
    partes.push(
      `${valor.toLocaleString("pt-BR")} ${valor === 1 ? "saco" : "sacos"}`,
    );
  }

  return partes.join(" + ");
}

function extrairGrupos(valor: unknown): Grupo[] {
  if (Array.isArray(valor)) {
    return valor.filter((item): item is Grupo => {
      if (typeof item !== "object" || item === null) return false;
      const grupo = item as Partial<Grupo>;
      return typeof grupo.id === "string" && typeof grupo.nome === "string";
    });
  }

  if (typeof valor === "object" && valor !== null) {
    const objeto = valor as Record<string, unknown>;
    if (Array.isArray(objeto.grupos)) return extrairGrupos(objeto.grupos);
  }

  return [];
}

function extrairAreas(valor: unknown): Area[] {
  if (Array.isArray(valor)) {
    return valor.filter((item): item is Area => {
      if (typeof item !== "object" || item === null) return false;
      const area = item as Partial<Area>;
      return typeof area.id === "string" && typeof area.nome === "string";
    });
  }

  if (typeof valor === "object" && valor !== null) {
    const objeto = valor as Record<string, unknown>;
    if (Array.isArray(objeto.areas)) return extrairAreas(objeto.areas);
  }

  return [];
}

function removerDuplicadosPorId<T extends { id: string }>(itens: T[]) {
  const mapa = new Map<string, T>();

  itens.forEach((item) => {
    if (!mapa.has(item.id)) mapa.set(item.id, item);
  });

  return Array.from(mapa.values());
}

function carregarDadosAreas(): DadosAreas {
  const gruposEncontrados: Grupo[] = [];
  const areasEncontradas: Area[] = [];

  const chaves = new Set([
    "crivo_colheitas_grupos",
    "crivo_colheitas_areas",
    "crivo_areas_grupos",
    "crivo_areas",
    "grupos",
    "areas",
  ]);

  for (let i = 0; i < localStorage.length; i += 1) {
    const chave = localStorage.key(i);
    if (chave) chaves.add(chave);
  }

  chaves.forEach((chave) => {
    const salvo = localStorage.getItem(chave);
    if (!salvo) return;

    try {
      const convertido: unknown = JSON.parse(salvo);
      gruposEncontrados.push(...extrairGrupos(convertido));
      areasEncontradas.push(...extrairAreas(convertido));
    } catch {
      // Ignora conteúdos que não sejam JSON válido.
    }
  });

  return {
    grupos: removerDuplicadosPorId(gruposEncontrados)
      .filter((grupo) => normalizarTexto(grupo.nome))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    areas: removerDuplicadosPorId(areasEncontradas)
      .filter((area) => area.ativa !== false && normalizarTexto(area.nome))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  };
}

function carregarRegistros(): RegistroOperacao[] {
  const salvo = localStorage.getItem(OPERACAO_KEY);
  if (!salvo) return [];

  try {
    const operacao = JSON.parse(salvo) as OperacaoAtiva;
    return Array.isArray(operacao.registros) ? operacao.registros : [];
  } catch {
    return [];
  }
}

function inicioDoDia(data: Date) {
  const copia = new Date(data);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function fimDoDia(data: Date) {
  const copia = new Date(data);
  copia.setHours(23, 59, 59, 999);
  return copia;
}

function estaNoPeriodo(dataIso: string, periodo: PeriodoRapido) {
  if (periodo === "tudo") return true;

  const registro = new Date(dataIso);
  const agora = new Date();

  if (periodo === "hoje") {
    return registro >= inicioDoDia(agora) && registro <= fimDoDia(agora);
  }

  if (periodo === "ontem") {
    const ontem = new Date(agora);
    ontem.setDate(ontem.getDate() - 1);
    return registro >= inicioDoDia(ontem) && registro <= fimDoDia(ontem);
  }

  const seteDiasAtras = inicioDoDia(agora);
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 6);

  return registro >= seteDiasAtras && registro <= fimDoDia(agora);
}

function criarParticipacoes(registro: RegistroOperacao): ParticipacaoArea[] {
  const tipo = registro.tipo ?? "saida";

  if (tipo === "saida") {
    return [
      {
        chave: `${registro.id}-completa`,
        registroId: registro.id,
        placa: registro.placa,
        criadoEm: registro.criadoEm,
        operadorNome: registro.operadorNome,
        areaId: registro.areaId,
        areaNome: registro.areaNome,
        grupoId: registro.grupoId,
        grupoNome: registro.grupoNome,
        tipo: "completa",
        tituloStatus: "Carga completa",
        descricaoStatus: "Carregamento completo nesta área.",
        cargaDividida: false,
      },
    ];
  }

  const origemId = registro.areaOrigemId ?? registro.areaId;
  const origemNome = registro.areaOrigemNome ?? registro.areaNome;
  const destinoId = registro.areaDestinoId ?? registro.areaId;
  const destinoNome = registro.areaDestinoNome ?? registro.areaNome;

  const quantidadeOrigem = textoQuantidade(registro.quantidadeOrigem);
  const quantidadeDestino = textoQuantidade(registro.quantidadeDestino);

  let descricaoOrigem = "";
  let descricaoDestino = "";

  if (tipo === "faltou-pouco") {
    descricaoOrigem = quantidadeDestino
      ? `Carga incompleta. Completou a carga com ${quantidadeDestino} em ${destinoNome}.`
      : `Carga incompleta. Foi completada em ${destinoNome}.`;

    descricaoDestino = quantidadeDestino
      ? `Veio incompleta de ${origemNome}. Completou a carga com ${quantidadeDestino} nesta área.`
      : `Veio incompleta de ${origemNome} e foi completada nesta área.`;
  } else if (tipo === "meia-carga") {
    descricaoOrigem = `Carga incompleta. Aproximadamente meia carga saiu de ${origemNome} e foi completada em ${destinoNome}.`;
    descricaoDestino = `Veio com aproximadamente meia carga de ${origemNome} e foi completada nesta área.`;
  } else {
    descricaoOrigem = quantidadeOrigem
      ? `Carga incompleta. ${quantidadeOrigem} foram carregados em ${origemNome}; a carga foi completada em ${destinoNome}.`
      : `Carga incompleta em ${origemNome}. A carga foi completada em ${destinoNome}.`;

    descricaoDestino = quantidadeOrigem
      ? `Veio de ${origemNome}, onde recebeu ${quantidadeOrigem}. O restante da carga foi completado nesta área.`
      : `Veio incompleta de ${origemNome} e foi completada nesta área.`;
  }

  return [
    {
      chave: `${registro.id}-origem`,
      registroId: registro.id,
      placa: registro.placa,
      criadoEm: registro.criadoEm,
      operadorNome: registro.operadorNome,
      areaId: origemId,
      areaNome: origemNome,
      grupoId: registro.grupoId,
      grupoNome: registro.grupoNome,
      tipo: "origem",
      tituloStatus: "Carga incompleta",
      descricaoStatus: descricaoOrigem,
      cargaDividida: true,
    },
    {
      chave: `${registro.id}-destino`,
      registroId: registro.id,
      placa: registro.placa,
      criadoEm: registro.criadoEm,
      operadorNome: registro.operadorNome,
      areaId: destinoId,
      areaNome: destinoNome,
      grupoId: registro.grupoId,
      grupoNome: registro.grupoNome,
      tipo: "destino",
      tituloStatus: "Carga completada",
      descricaoStatus: descricaoDestino,
      cargaDividida: true,
    },
  ];
}

function RelatoriosPage({ onVoltar }: RelatoriosPageProps) {
  const [dadosAreas, setDadosAreas] = useState<DadosAreas>(carregarDadosAreas);
  const [registros, setRegistros] = useState<RegistroOperacao[]>(carregarRegistros);
  const [periodo, setPeriodo] = useState<PeriodoRapido>("hoje");
  const [areasSelecionadas, setAreasSelecionadas] = useState<Set<string>>(
    new Set(),
  );
  const [buscaPlaca, setBuscaPlaca] = useState("");
  const [filtrosAbertos, setFiltrosAbertos] = useState(true);

  const gruposComAreas = useMemo(() => {
    const normais = dadosAreas.grupos.filter((grupo) =>
      dadosAreas.areas.some((area) => area.grupoId === grupo.id),
    );

    if (dadosAreas.areas.some((area) => !area.grupoId)) {
      return [...normais, { id: "sem-grupo", nome: "Sem grupo" }];
    }

    return normais;
  }, [dadosAreas]);

  const participacoes = useMemo(
    () => registros.flatMap(criarParticipacoes),
    [registros],
  );

  const participacoesFiltradas = useMemo(() => {
    const placa = limparPlaca(buscaPlaca);

    return participacoes
      .filter((item) => estaNoPeriodo(item.criadoEm, periodo))
      .filter(
        (item) =>
          areasSelecionadas.size === 0 || areasSelecionadas.has(item.areaId),
      )
      .filter((item) => !placa || limparPlaca(item.placa).includes(placa))
      .sort(
        (a, b) =>
          new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime(),
      );
  }, [participacoes, periodo, areasSelecionadas, buscaPlaca]);

  const areasComRegistros = useMemo(() => {
    const ids = new Set(participacoesFiltradas.map((item) => item.areaId));

    return dadosAreas.areas
      .filter((area) => ids.has(area.id))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [dadosAreas.areas, participacoesFiltradas]);

  const totalCarregamentos = useMemo(
    () =>
      new Set(participacoesFiltradas.map((item) => item.registroId)).size,
    [participacoesFiltradas],
  );

  const totalDivididas = useMemo(
    () =>
      new Set(
        participacoesFiltradas
          .filter((item) => item.cargaDividida)
          .map((item) => item.registroId),
      ).size,
    [participacoesFiltradas],
  );

  function atualizarTudo() {
    setDadosAreas(carregarDadosAreas());
    setRegistros(carregarRegistros());
  }

  function alternarArea(areaId: string) {
    setAreasSelecionadas((atual) => {
      const proximo = new Set(atual);

      if (proximo.has(areaId)) {
        proximo.delete(areaId);
      } else {
        proximo.add(areaId);
      }

      return proximo;
    });
  }

  function selecionarGrupo(grupoId: string) {
    const ids = dadosAreas.areas
      .filter((area) =>
        grupoId === "sem-grupo" ? !area.grupoId : area.grupoId === grupoId,
      )
      .map((area) => area.id);

    setAreasSelecionadas((atual) => {
      const proximo = new Set(atual);
      const grupoTodoSelecionado = ids.every((id) => proximo.has(id));

      ids.forEach((id) => {
        if (grupoTodoSelecionado) {
          proximo.delete(id);
        } else {
          proximo.add(id);
        }
      });

      return proximo;
    });
  }

  function selecionarTodas() {
    setAreasSelecionadas(new Set(dadosAreas.areas.map((area) => area.id)));
  }

  function limparAreas() {
    setAreasSelecionadas(new Set());
  }

  function rotuloPeriodo() {
    if (periodo === "hoje") return "Hoje";
    if (periodo === "ontem") return "Ontem";
    if (periodo === "sete-dias") return "Últimos 7 dias";
    return "Todo o período";
  }

  return (
    <main className="relatorios-page">
      <header className="relatorios-header">
        <div className="relatorios-brand">
          <button
            type="button"
            className="relatorios-voltar"
            onClick={onVoltar}
            aria-label="Voltar"
          >
            <ArrowLeft size={23} />
          </button>

          <div className="relatorios-logo">
            <Wheat size={28} />
          </div>

          <div>
            <p>Crivo Colheitas</p>
            <h1>Relatórios</h1>
          </div>
        </div>

        <button
          type="button"
          className="relatorios-atualizar"
          onClick={atualizarTudo}
        >
          <RefreshCcw size={18} />
          Atualizar
        </button>
      </header>

      <section className="relatorios-container">
        <section className="relatorios-intro">
          <div>
            <p className="relatorios-etiqueta">Escritório</p>
            <h2>Carregamentos por área</h2>
            <span>
              Selecione uma área, várias áreas ou um grupo inteiro.
            </span>
          </div>

          <button
            type="button"
            className="botao-filtros"
            onClick={() => setFiltrosAbertos((aberto) => !aberto)}
          >
            <Filter size={19} />
            Filtros
            {filtrosAbertos ? (
              <ChevronUp size={19} />
            ) : (
              <ChevronDown size={19} />
            )}
          </button>
        </section>

        {filtrosAbertos && (
          <section className="painel-filtros">
            <div className="filtro-bloco">
              <div className="filtro-titulo">
                <CalendarDays size={19} />
                <strong>Período</strong>
              </div>

              <div className="periodos-grid">
                {(
                  [
                    ["hoje", "Hoje"],
                    ["ontem", "Ontem"],
                    ["sete-dias", "7 dias"],
                    ["tudo", "Tudo"],
                  ] as Array<[PeriodoRapido, string]>
                ).map(([valor, label]) => (
                  <button
                    type="button"
                    key={valor}
                    className={periodo === valor ? "ativo" : ""}
                    onClick={() => setPeriodo(valor)}
                  >
                    {periodo === valor && <Check size={16} />}
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filtro-bloco">
              <div className="filtro-titulo">
                <Search size={19} />
                <strong>Placa</strong>
              </div>

              <div className="busca-placa">
                <input
                  type="text"
                  value={buscaPlaca}
                  onChange={(evento) =>
                    setBuscaPlaca(limparPlaca(evento.target.value))
                  }
                  placeholder="Buscar placa"
                  maxLength={7}
                />

                {buscaPlaca && (
                  <button
                    type="button"
                    onClick={() => setBuscaPlaca("")}
                    aria-label="Limpar busca"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>

            <div className="filtro-bloco filtro-areas">
              <div className="filtro-areas-cabecalho">
                <div className="filtro-titulo">
                  <MapPinned size={19} />
                  <strong>Áreas</strong>
                </div>

                <div className="filtro-areas-acoes">
                  <button type="button" onClick={selecionarTodas}>
                    Selecionar todas
                  </button>
                  <button type="button" onClick={limparAreas}>
                    Limpar
                  </button>
                </div>
              </div>

              <p className="filtro-ajuda">
                Nenhuma área marcada significa mostrar todas.
              </p>

              <div className="grupos-filtro">
                {gruposComAreas.map((grupo) => {
                  const areasGrupo = dadosAreas.areas.filter((area) =>
                    grupo.id === "sem-grupo"
                      ? !area.grupoId
                      : area.grupoId === grupo.id,
                  );

                  const todasSelecionadas =
                    areasGrupo.length > 0 &&
                    areasGrupo.every((area) =>
                      areasSelecionadas.has(area.id),
                    );

                  return (
                    <article className="grupo-filtro-card" key={grupo.id}>
                      <button
                        type="button"
                        className={`grupo-filtro-titulo ${
                          todasSelecionadas ? "selecionado" : ""
                        }`}
                        onClick={() => selecionarGrupo(grupo.id)}
                      >
                        <FolderOpen size={19} />
                        <strong>{grupo.nome}</strong>
                        <span>
                          {todasSelecionadas
                            ? "Grupo selecionado"
                            : "Selecionar grupo"}
                        </span>
                      </button>

                      <div className="areas-filtro-grid">
                        {areasGrupo.map((area) => {
                          const selecionada = areasSelecionadas.has(area.id);

                          return (
                            <button
                              type="button"
                              key={area.id}
                              className={selecionada ? "selecionada" : ""}
                              onClick={() => alternarArea(area.id)}
                            >
                              <span className="area-check">
                                {selecionada && <Check size={15} />}
                              </span>
                              {area.nome}
                            </button>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <section className="resumo-relatorio">
          <article>
            <span>Período</span>
            <strong>{rotuloPeriodo()}</strong>
          </article>

          <article>
            <span>Áreas exibidas</span>
            <strong>
              {areasSelecionadas.size === 0
                ? "Todas"
                : areasSelecionadas.size}
            </strong>
          </article>

          <article>
            <span>Carregamentos</span>
            <strong>{totalCarregamentos}</strong>
          </article>

          <article>
            <span>Cargas divididas</span>
            <strong>{totalDivididas}</strong>
          </article>
        </section>

        {participacoesFiltradas.length === 0 ? (
          <section className="relatorio-vazio">
            <Truck size={42} />
            <h3>Nenhum carregamento encontrado</h3>
            <p>Altere o período ou a seleção de áreas.</p>
          </section>
        ) : (
          <section className="areas-relatorio-lista">
            {areasComRegistros.map((area) => {
              const itens = participacoesFiltradas.filter(
                (item) => item.areaId === area.id,
              );

              const completas = itens.filter(
                (item) => item.tipo === "completa",
              ).length;

              const incompletas = itens.filter(
                (item) => item.tipo === "origem",
              ).length;

              const complementos = itens.filter(
                (item) => item.tipo === "destino",
              ).length;

              return (
                <article className="area-relatorio-card" key={area.id}>
                  <header className="area-relatorio-cabecalho">
                    <div>
                      <p>Área</p>
                      <h3>{area.nome}</h3>
                    </div>

                    <div className="area-contadores">
                      <span>
                        <strong>{itens.length}</strong> registros
                      </span>
                      <span>
                        <strong>{completas}</strong> completas
                      </span>
                      {incompletas > 0 && (
                        <span className="alerta">
                          <strong>{incompletas}</strong> incompletas
                        </span>
                      )}
                      {complementos > 0 && (
                        <span className="complemento">
                          <strong>{complementos}</strong> complementos
                        </span>
                      )}
                    </div>
                  </header>

                  <div className="carregamentos-lista">
                    {itens.map((item) => (
                      <div
                        className={`carregamento-item ${
                          item.cargaDividida ? "dividido" : ""
                        }`}
                        key={item.chave}
                      >
                        <div className="carregamento-icone">
                          <Truck size={23} />
                        </div>

                        <div className="carregamento-principal">
                          <div className="carregamento-linha">
                            <strong>{formatarPlaca(item.placa)}</strong>

                            <span
                              className={`status-carga status-${item.tipo}`}
                            >
                              {item.tituloStatus}
                            </span>
                          </div>

                          <p>{item.descricaoStatus}</p>

                          <div className="carregamento-rodape">
                            <span>{formatarDataHora(item.criadoEm)}</span>
                            <span>Operador: {item.operadorNome}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </section>
    </main>
  );
}

export default RelatoriosPage;
