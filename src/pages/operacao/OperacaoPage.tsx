import { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase, supabaseConfigurado } from "../../lib/supabase";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FolderOpen,
  MapPinned,
  RefreshCcw,
  Truck,
  UserRound,
  Wheat,
  X,
} from "lucide-react";
import "./OperacaoPage.css";

type OperacaoPageProps = { onVoltar: () => void };
type Grupo = { id: string; nome: string };
type Area = { id: string; nome: string; grupoId?: string; ativa?: boolean };
type Sessao = { tipo: "admin" | "operador"; nome: string };
type EtapaOperacao = "grupos" | "areas" | "trabalho";
type ModoIncompleto = "faltou-pouco" | "meia-carga" | "quantidade";
type ModalTroca = null | "situacao" | "placa" | "quantidade-origem" | "completar-faltou-pouco";

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
  pendenteSincronizacao?: boolean;
};

type CargaPendente = {
  id: string;
  tipo: ModoIncompleto;
  placa: string;
  grupoOrigemId: string;
  grupoOrigemNome: string;
  areaOrigemId: string;
  areaOrigemNome: string;
  grupoDestinoId: string;
  grupoDestinoNome: string;
  areaDestinoId: string;
  areaDestinoNome: string;
  quantidadeOrigem?: QuantidadeCarga;
};

type OperacaoAtiva = {
  id: string;
  grupoId: string;
  grupoNome: string;
  areaId: string;
  areaNome: string;
  operadorNome: string;
  iniciadaEm: string;
  registros: RegistroOperacao[];
  cargaPendente?: CargaPendente | null;
};

type TrocaEmAndamento = {
  tipo: ModoIncompleto;
  placa: string;
  grupoOrigemId: string;
  grupoOrigemNome: string;
  areaOrigemId: string;
  areaOrigemNome: string;
  quantidadeOrigem?: QuantidadeCarga;
};

type DadosAreas = { grupos: Grupo[]; areas: Area[] };

type PlacaCadastrada = {
  placa: string;
  apelido?: string;
};

const OPERACAO_KEY = "crivo_colheitas_operacao_ativa";
const SESSAO_KEY = "crivo_colheitas_sessao";
const PLACAS_KEY = "crivo_colheitas_placas";

function criarId() {
  return uuidv4();
}

function normalizarTexto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

function carregarSessao(): Sessao | null {
  const salva = localStorage.getItem(SESSAO_KEY);
  if (!salva) return null;
  try { return JSON.parse(salva) as Sessao; } catch { return null; }
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
  itens.forEach((item) => { if (!mapa.has(item.id)) mapa.set(item.id, item); });
  return Array.from(mapa.values());
}

function carregarDadosAreas(): DadosAreas {
  const gruposEncontrados: Grupo[] = [];
  const areasEncontradas: Area[] = [];
  const chaves = new Set(["crivo_colheitas_grupos", "crivo_colheitas_areas", "crivo_areas_grupos", "crivo_areas", "grupos", "areas"]);
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
    } catch { /* ignora */ }
  });
  return {
    grupos: removerDuplicadosPorId(gruposEncontrados).filter((g) => normalizarTexto(g.nome)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    areas: removerDuplicadosPorId(areasEncontradas).filter((a) => a.ativa !== false && normalizarTexto(a.nome)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  };
}

function carregarApelidosPlacas() {
  const salvo = localStorage.getItem(PLACAS_KEY);
  const apelidos = new Map<string, string>();

  if (!salvo) return apelidos;

  try {
    const placas = JSON.parse(salvo) as unknown;

    if (!Array.isArray(placas)) return apelidos;

    placas.forEach((item) => {
      if (typeof item !== "object" || item === null) return;

      const placa = item as Partial<PlacaCadastrada>;
      const numero = limparPlaca(placa.placa ?? "");
      const apelido = normalizarTexto(placa.apelido);

      if (numero.length === 7 && apelido) {
        apelidos.set(numero, apelido);
      }
    });
  } catch {
    return apelidos;
  }

  return apelidos;
}

function carregarOperacao(): OperacaoAtiva | null {
  const salva = localStorage.getItem(OPERACAO_KEY);
  if (!salva) return null;
  try {
    const valor = JSON.parse(salva) as Partial<OperacaoAtiva>;
    if (!valor.areaId || !valor.areaNome) return null;
    return {
      id: valor.id ?? criarId(),
      grupoId: valor.grupoId ?? "sem-grupo",
      grupoNome: valor.grupoNome ?? "Sem grupo",
      areaId: valor.areaId,
      areaNome: valor.areaNome,
      operadorNome: valor.operadorNome ?? "Escritório",
      iniciadaEm: valor.iniciadaEm ?? new Date().toISOString(),
      registros: Array.isArray(valor.registros) ? valor.registros : [],
      cargaPendente: valor.cargaPendente ?? null,
    };
  } catch {
    localStorage.removeItem(OPERACAO_KEY);
    return null;
  }
}

function formatarHorario(dataIso: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(dataIso));
}

function criarQuantidadeVazia(): QuantidadeCarga {
  return {
    bazuca: 0,
    graneleiro: 0,
    kg: 0,
    sacos: 0,
  };
}

function textoQuantidade(q?: QuantidadeCarga) {
  if (!q) return "";

  const partes: string[] = [];

  if (q.bazuca > 0) {
    partes.push(
      `${q.bazuca.toLocaleString("pt-BR")} ${
        q.bazuca === 1 ? "bazuca" : "bazucas"
      }`,
    );
  }

  if (q.graneleiro > 0) {
    partes.push(
      `${q.graneleiro.toLocaleString("pt-BR")} ${
        q.graneleiro === 1 ? "graneleiro" : "graneleiros"
      }`,
    );
  }

  if (q.kg > 0) {
    partes.push(`${q.kg.toLocaleString("pt-BR")} kg`);
  }

  if (q.sacos > 0) {
    partes.push(
      `${q.sacos.toLocaleString("pt-BR")} ${
        q.sacos === 1 ? "saco" : "sacos"
      }`,
    );
  }

  return partes.join(" + ");
}

function limparPlaca(valor: string) {
  return valor.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function OperacaoPage({ onVoltar }: OperacaoPageProps) {
  const sessao = carregarSessao();
  const [dadosAreas, setDadosAreas] = useState<DadosAreas>(carregarDadosAreas);
  const [operacao, setOperacao] = useState<OperacaoAtiva | null>(carregarOperacao);
  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState<string | null>(operacao?.grupoId ?? null);
  const [etapa, setEtapa] = useState<EtapaOperacao>(operacao ? "trabalho" : "grupos");
  const [placaDigitada, setPlacaDigitada] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [modalTroca, setModalTroca] = useState<ModalTroca>(null);
  const [modoIncompleto, setModoIncompleto] = useState<ModoIncompleto | null>(null);
  const [placaIncompleta, setPlacaIncompleta] = useState("");
  const [trocaEmAndamento, setTrocaEmAndamento] = useState<TrocaEmAndamento | null>(null);
  const [quantidades, setQuantidades] = useState<QuantidadeCarga>(criarQuantidadeVazia);
  const [destinoInicial, setDestinoInicial] = useState<"areas" | "grupos">("areas");

  const gruposComAreas = useMemo(() => {
    const normais = dadosAreas.grupos.filter((g) => dadosAreas.areas.some((a) => a.grupoId === g.id));
    return dadosAreas.areas.some((a) => !a.grupoId) ? [...normais, { id: "sem-grupo", nome: "Sem grupo" }] : normais;
  }, [dadosAreas]);

  const grupoSelecionado = useMemo(() => gruposComAreas.find((g) => g.id === grupoSelecionadoId), [gruposComAreas, grupoSelecionadoId]);
  const areasDoGrupoSelecionado = useMemo(() => {
    if (!grupoSelecionadoId) return [];
    return grupoSelecionadoId === "sem-grupo" ? dadosAreas.areas.filter((a) => !a.grupoId) : dadosAreas.areas.filter((a) => a.grupoId === grupoSelecionadoId);
  }, [dadosAreas.areas, grupoSelecionadoId]);

  const nomeOperadorAtual = sessao?.nome ?? "Escritório";

  const registrosOrdenados = useMemo(() => {
    return [...(operacao?.registros ?? [])].sort(
      (a, b) =>
        new Date(b.criadoEm).getTime() -
        new Date(a.criadoEm).getTime(),
    );
  }, [operacao?.registros]);

  const ultimosRegistros = useMemo(
    () => registrosOrdenados.slice(0, 5),
    [registrosOrdenados],
  );

  const ultimoRegistro = registrosOrdenados[0] ?? null;

  useEffect(() => {
    if (!operacao || operacao.operadorNome === nomeOperadorAtual) return;

    const operacaoAtualizada = {
      ...operacao,
      operadorNome: nomeOperadorAtual,
    };

    localStorage.setItem(OPERACAO_KEY, JSON.stringify(operacaoAtualizada));
    setOperacao(operacaoAtualizada);
  }, [nomeOperadorAtual, operacao]);

  const placasMaisUsadas = useMemo(() => {
    const contagem = new Map<
      string,
      { placa: string; quantidade: number; ultimoUso: number }
    >();

    operacao?.registros.forEach((registro) => {
      const placa = limparPlaca(registro.placa);
      if (placa.length !== 7) return;

      const existente = contagem.get(placa);

      contagem.set(placa, {
        placa,
        quantidade: (existente?.quantidade ?? 0) + 1,
        ultimoUso: Math.max(
          existente?.ultimoUso ?? 0,
          new Date(registro.criadoEm).getTime(),
        ),
      });
    });

    const apelidos = carregarApelidosPlacas();

    return Array.from(contagem.values())
      .sort(
        (a, b) =>
          b.quantidade - a.quantidade || b.ultimoUso - a.ultimoUso,
      )
      .slice(0, 6)
      .map((item) => ({
        ...item,
        apelido: apelidos.get(item.placa) ?? "",
      }));
  }, [operacao?.registros]);

  function salvarOperacao(nova: OperacaoAtiva) {
    localStorage.setItem(OPERACAO_KEY, JSON.stringify(nova));
    setOperacao(nova);
  }

  function selecionarGrupo(grupo: Grupo) {
    setGrupoSelecionadoId(grupo.id);
    setEtapa("areas");
  }

  function selecionarArea(area: Area) {
    const grupoNome = grupoSelecionado?.nome ?? gruposComAreas.find((g) => g.id === area.grupoId)?.nome ?? "Sem grupo";
    const grupoId = grupoSelecionadoId ?? area.grupoId ?? "sem-grupo";

    if (operacao && trocaEmAndamento) {
      const pendente: CargaPendente = {
        id: criarId(),
        tipo: trocaEmAndamento.tipo,
        placa: trocaEmAndamento.placa,
        grupoOrigemId: trocaEmAndamento.grupoOrigemId,
        grupoOrigemNome: trocaEmAndamento.grupoOrigemNome,
        areaOrigemId: trocaEmAndamento.areaOrigemId,
        areaOrigemNome: trocaEmAndamento.areaOrigemNome,
        grupoDestinoId: grupoId,
        grupoDestinoNome: grupoNome,
        areaDestinoId: area.id,
        areaDestinoNome: area.nome,
        quantidadeOrigem: trocaEmAndamento.quantidadeOrigem,
      };
      salvarOperacao({ ...operacao, grupoId, grupoNome, areaId: area.id, areaNome: area.nome, iniciadaEm: new Date().toISOString(), cargaPendente: pendente });
      setGrupoSelecionadoId(grupoId);
      setEtapa("trabalho");
      setTrocaEmAndamento(null);
      setPlacaDigitada("");
      if (pendente.tipo === "faltou-pouco") {
        setQuantidades(criarQuantidadeVazia());
        setModalTroca("completar-faltou-pouco");
      }
      return;
    }

    const nova: OperacaoAtiva = {
      id: operacao?.id ?? criarId(), grupoId, grupoNome, areaId: area.id, areaNome: area.nome,
      operadorNome: nomeOperadorAtual, iniciadaEm: new Date().toISOString(),
      registros: operacao?.registros ?? [], cargaPendente: operacao?.cargaPendente ?? null,
    };
    salvarOperacao(nova);
    setEtapa("trabalho");
    setPlacaDigitada("");
  }

  function abrirTroca(destino: "areas" | "grupos") {
    if (!operacao || operacao.cargaPendente) return;
    setDestinoInicial(destino);
    setModalTroca("situacao");
  }

  function escolherSituacao(tipo: "completos" | ModoIncompleto) {
    if (!operacao) return;
    if (tipo === "completos") {
      setModalTroca(null);
      setModoIncompleto(null);
      if (destinoInicial === "grupos") {
        setGrupoSelecionadoId(null);
        setEtapa("grupos");
      } else {
        setGrupoSelecionadoId(operacao.grupoId);
        setEtapa("areas");
      }
      return;
    }
    setModoIncompleto(tipo);
    setPlacaIncompleta("");
    setModalTroca("placa");
  }

  function confirmarPlacaIncompleta() {
    if (!operacao || !modoIncompleto) return;
    const placa = limparPlaca(placaIncompleta);
    if (placa.length < 7) return alert("Digite uma placa válida.");
    if (modoIncompleto === "quantidade") {
      setQuantidades(criarQuantidadeVazia());
      setModalTroca("quantidade-origem");
      return;
    }
    setTrocaEmAndamento({
      tipo: modoIncompleto, placa,
      grupoOrigemId: operacao.grupoId, grupoOrigemNome: operacao.grupoNome,
      areaOrigemId: operacao.areaId, areaOrigemNome: operacao.areaNome,
    });
    setModalTroca(null);
    setGrupoSelecionadoId(operacao.grupoId);
    setEtapa("areas");
  }

  function lerQuantidade(): QuantidadeCarga | null {
    const quantidadeNormalizada: QuantidadeCarga = {
      bazuca: Number(quantidades.bazuca) || 0,
      graneleiro: Number(quantidades.graneleiro) || 0,
      kg: Number(quantidades.kg) || 0,
      sacos: Number(quantidades.sacos) || 0,
    };

    const possuiQuantidade = Object.values(quantidadeNormalizada).some(
      (valor) => valor > 0,
    );

    return possuiQuantidade ? quantidadeNormalizada : null;
  }

  function alterarQuantidade(
    campo: keyof QuantidadeCarga,
    valor: string | number,
  ) {
    const numero =
      typeof valor === "number"
        ? valor
        : Number(String(valor).replace(",", "."));

    setQuantidades((atual) => ({
      ...atual,
      [campo]: Number.isFinite(numero) && numero >= 0 ? numero : 0,
    }));
  }

  function confirmarQuantidadeOrigem() {
    if (!operacao || !modoIncompleto) return;
    const placa = limparPlaca(placaIncompleta);
    const quantidade = lerQuantidade();
    if (!quantidade) return alert("Informe uma quantidade válida.");
    setTrocaEmAndamento({
      tipo: modoIncompleto, placa,
      grupoOrigemId: operacao.grupoId, grupoOrigemNome: operacao.grupoNome,
      areaOrigemId: operacao.areaId, areaOrigemNome: operacao.areaNome,
      quantidadeOrigem: quantidade,
    });
    setModalTroca(null);
    setGrupoSelecionadoId(operacao.grupoId);
    setEtapa("areas");
  }

  function registrarComplementoFaltouPouco() {
    if (!operacao?.cargaPendente) return;
    const quantidade = lerQuantidade();
    if (!quantidade) return alert("Informe quanto foi colocado nesta área.");
    const p = operacao.cargaPendente;
    const registro: RegistroOperacao = {
      id: criarId(), grupoId: p.grupoDestinoId, grupoNome: p.grupoDestinoNome,
      areaId: p.areaDestinoId, areaNome: p.areaDestinoNome,
      operadorNome: nomeOperadorAtual, placa: p.placa, criadoEm: new Date().toISOString(),
      tipo: "faltou-pouco", areaOrigemId: p.areaOrigemId, areaOrigemNome: p.areaOrigemNome,
      areaDestinoId: p.areaDestinoId, areaDestinoNome: p.areaDestinoNome,
      quantidadeDestino: quantidade,
      pendenteSincronizacao: true,
      observacao: `Carga completada com ${textoQuantidade(quantidade)} na área ${p.areaDestinoNome}.`,
    };
    salvarOperacao({ ...operacao, registros: [registro, ...operacao.registros], cargaPendente: null });
    setModalTroca(null);
    setMensagemSucesso(`${p.placa}: complemento registrado.`);
  }

  function finalizarCargaPendente() {
    if (!operacao?.cargaPendente) return;
    const p = operacao.cargaPendente;
    const registro: RegistroOperacao = {
      id: criarId(), grupoId: p.grupoDestinoId, grupoNome: p.grupoDestinoNome,
      areaId: p.areaDestinoId, areaNome: p.areaDestinoNome,
      operadorNome: nomeOperadorAtual, placa: p.placa, criadoEm: new Date().toISOString(),
      tipo: p.tipo === "meia-carga" ? "meia-carga" : "quantidade",
      areaOrigemId: p.areaOrigemId, areaOrigemNome: p.areaOrigemNome,
      areaDestinoId: p.areaDestinoId, areaDestinoNome: p.areaDestinoNome,
      quantidadeOrigem: p.quantidadeOrigem,
      pendenteSincronizacao: true,
      observacao: p.tipo === "meia-carga"
        ? `Aproximadamente meia carga em ${p.areaOrigemNome} e metade restante em ${p.areaDestinoNome}.`
        : `${textoQuantidade(p.quantidadeOrigem)} em ${p.areaOrigemNome}; restante completado em ${p.areaDestinoNome}.`,
    };
    salvarOperacao({ ...operacao, registros: [registro, ...operacao.registros], cargaPendente: null });
    setMensagemSucesso(`${p.placa}: carga finalizada.`);
  }

  function registrarSaida(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!operacao || operacao.cargaPendente) return;
    const placa = limparPlaca(placaDigitada);
    if (placa.length < 7) return alert("Digite uma placa válida.");
    const registro: RegistroOperacao = {
      id: criarId(), grupoId: operacao.grupoId, grupoNome: operacao.grupoNome,
      areaId: operacao.areaId, areaNome: operacao.areaNome,
      operadorNome: nomeOperadorAtual, placa, criadoEm: new Date().toISOString(), tipo: "saida",
      pendenteSincronizacao: true,
    };
    salvarOperacao({ ...operacao, registros: [registro, ...operacao.registros] });
    setPlacaDigitada("");
    setMensagemSucesso(`${placa} registrada com sucesso.`);
    window.setTimeout(() => setMensagemSucesso(""), 2500);
  }

  async function cancelarUltimoRegistro() {
    if (!operacao || !ultimoRegistro) return;

    if (
      !window.confirm(
        `Deseja cancelar o lançamento da placa ${ultimoRegistro.placa}?`,
      )
    ) {
      return;
    }

    /*
     * Registros ainda pendentes existem somente neste aparelho.
     * Nesse caso, basta removê-los do armazenamento local.
     */
    if (ultimoRegistro.pendenteSincronizacao) {
      salvarOperacao({
        ...operacao,
        registros: operacao.registros.filter(
          (registro) => registro.id !== ultimoRegistro.id,
        ),
      });
      return;
    }

    if (!navigator.onLine || !supabaseConfigurado || !supabase) {
      window.alert(
        "É necessário estar conectado para cancelar um lançamento já sincronizado.",
      );
      return;
    }

    const { error } = await supabase
      .from("carregamentos")
      .delete()
      .eq("id", ultimoRegistro.id);

    if (error) {
      console.error(error);
      window.alert(
        `Não foi possível cancelar o lançamento: ${error.message}`,
      );
      return;
    }

    salvarOperacao({
      ...operacao,
      registros: operacao.registros.filter(
        (registro) => registro.id !== ultimoRegistro.id,
      ),
    });

    window.dispatchEvent(
      new Event("crivo:supabase-sincronizado"),
    );
  }

  function QuantidadeEditor({
    titulo,
    botao,
    onConfirmar,
  }: {
    titulo: string;
    botao: string;
    onConfirmar: () => void;
  }) {
    const opcoesBazuca = [0.5, 1, 2, 3, 4];
    const opcoesGraneleiro = [0.5, 1, 1.5, 2];

    return (
      <div className="quantidade-editor">
        <h3>{titulo}</h3>

        <p className="quantidade-ajuda">
          Você pode informar mais de um tipo na mesma carga.
        </p>

        <div className="quantidades-combinadas">
          <section className="quantidade-bloco">
            <div className="quantidade-bloco-cabecalho">
              <strong>Bazuca</strong>
              <span>{quantidades.bazuca.toLocaleString("pt-BR")}</span>
            </div>

            <div className="valores-grid">
              {opcoesBazuca.map((valor) => (
                <button
                  type="button"
                  key={valor}
                  className={quantidades.bazuca === valor ? "ativo" : ""}
                  onClick={() => alterarQuantidade("bazuca", valor)}
                >
                  {String(valor).replace(".", ",")}
                </button>
              ))}
            </div>

            <input
              className="quantidade-input"
              type="number"
              min="0"
              step="0.5"
              value={quantidades.bazuca || ""}
              onChange={(evento) =>
                alterarQuantidade("bazuca", evento.target.value)
              }
              placeholder="Outra quantidade"
            />
          </section>

          <section className="quantidade-bloco">
            <div className="quantidade-bloco-cabecalho">
              <strong>Graneleiro</strong>
              <span>{quantidades.graneleiro.toLocaleString("pt-BR")}</span>
            </div>

            <div className="valores-grid">
              {opcoesGraneleiro.map((valor) => (
                <button
                  type="button"
                  key={valor}
                  className={quantidades.graneleiro === valor ? "ativo" : ""}
                  onClick={() => alterarQuantidade("graneleiro", valor)}
                >
                  {String(valor).replace(".", ",")}
                </button>
              ))}
            </div>

            <input
              className="quantidade-input"
              type="number"
              min="0"
              step="0.5"
              value={quantidades.graneleiro || ""}
              onChange={(evento) =>
                alterarQuantidade("graneleiro", evento.target.value)
              }
              placeholder="Outra quantidade"
            />
          </section>

          <section className="quantidade-bloco quantidade-bloco-simples">
            <div className="quantidade-bloco-cabecalho">
              <strong>Quilos</strong>
              <span>{quantidades.kg.toLocaleString("pt-BR")}</span>
            </div>

            <input
              className="quantidade-input"
              type="number"
              min="0"
              step="1"
              value={quantidades.kg || ""}
              onChange={(evento) =>
                alterarQuantidade("kg", evento.target.value)
              }
              placeholder="Ex.: 2850"
            />
          </section>

          <section className="quantidade-bloco quantidade-bloco-simples">
            <div className="quantidade-bloco-cabecalho">
              <strong>Sacos</strong>
              <span>{quantidades.sacos.toLocaleString("pt-BR")}</span>
            </div>

            <input
              className="quantidade-input"
              type="number"
              min="0"
              step="0.5"
              value={quantidades.sacos || ""}
              onChange={(evento) =>
                alterarQuantidade("sacos", evento.target.value)
              }
              placeholder="Ex.: 47"
            />
          </section>
        </div>

        {textoQuantidade(lerQuantidade() ?? undefined) && (
          <div className="quantidade-resumo">
            <span>Total informado</span>
            <strong>{textoQuantidade(lerQuantidade() ?? undefined)}</strong>
          </div>
        )}

        <button
          type="button"
          className="modal-confirmar"
          onClick={onConfirmar}
        >
          {botao}
        </button>
      </div>
    );
  }

  return (
    <main className="operacao-page">
      <header className="operacao-header">
        <div className="operacao-header-brand">
          <button type="button" className="operacao-voltar" onClick={onVoltar}><ArrowLeft size={23} /></button>
          <div className="operacao-logo"><Wheat size={28} /></div>
          <div><p>Crivo Colheitas</p><h1>Operação</h1></div>
        </div>
        {operacao && etapa === "trabalho" && <div className="operacao-online"><span />Em trabalho</div>}
      </header>

      <section className="operacao-container">
        {etapa === "grupos" && (
          <section className="selecao-operacao">
            <div className="selecao-cabecalho"><div><p className="operacao-etiqueta">Começar trabalho</p><h2>Escolha o grupo</h2><span>Primeiro selecione a região onde está a área da colheita.</span></div>
              <button type="button" className="botao-secundario" onClick={() => setDadosAreas(carregarDadosAreas())}><RefreshCcw size={19} />Atualizar</button>
            </div>
            <div className="grupos-operacao-grid">
              {gruposComAreas.map((grupo) => (
                <button type="button" className="grupo-operacao-card" key={grupo.id} onClick={() => selecionarGrupo(grupo)}>
                  <div className="grupo-operacao-icon"><FolderOpen size={31} /></div>
                  <div className="grupo-operacao-conteudo"><strong>{grupo.nome}</strong><span>Escolher áreas</span></div><ChevronRight size={25} />
                </button>
              ))}
            </div>
          </section>
        )}

        {etapa === "areas" && (
          <section className="selecao-operacao">
            <div className="selecao-cabecalho">
              <div><p className="operacao-etiqueta">{trocaEmAndamento ? `Caminhão ${trocaEmAndamento.placa}` : "Grupo selecionado"}</p><h2>{grupoSelecionado?.nome ?? "Escolha a área"}</h2><span>{trocaEmAndamento ? "Selecione a área onde a carga será completada." : "Toque na área onde o serviço será realizado."}</span></div>
              <div className="acoes-selecao">
                {!trocaEmAndamento && operacao && <button type="button" className="botao-secundario" onClick={() => setEtapa("trabalho")}><X size={19} />Cancelar</button>}
                <button type="button" className="botao-secundario" onClick={() => { setGrupoSelecionadoId(null); setEtapa("grupos"); }}><FolderOpen size={19} />Trocar grupo</button>
              </div>
            </div>
            <div className="areas-operacao-grid">
              {areasDoGrupoSelecionado.map((area) => (
                <button type="button" className="area-operacao-card" key={area.id} onClick={() => selecionarArea(area)}>
                  <div className="area-operacao-icon"><MapPinned size={30} /></div><strong>{area.nome}</strong><span>{trocaEmAndamento ? "Completar nesta área" : "Selecionar área"}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {operacao && etapa === "trabalho" && (
          <>
            <section className="operacao-area-ativa">
              <div><p>{operacao.grupoNome}</p><h2>{operacao.areaNome}</h2><div className="operacao-informacoes"><span><UserRound size={17} />{operacao.operadorNome}</span><span><Clock3 size={17} />Início {formatarHorario(operacao.iniciadaEm)}</span></div></div>
              <div className="operacao-area-acoes">
                <button type="button" className="trocar-area-button" onClick={() => abrirTroca("areas")} disabled={Boolean(operacao.cargaPendente)}><MapPinned size={18} />Trocar área</button>
                <button type="button" className="trocar-grupo-button" onClick={() => abrirTroca("grupos")} disabled={Boolean(operacao.cargaPendente)}><FolderOpen size={18} />Trocar grupo</button>
              </div>
            </section>

            {operacao.cargaPendente && operacao.cargaPendente.tipo !== "faltou-pouco" && (
              <section className="carga-pendente-card">
                <div><p className="operacao-etiqueta">Carga em andamento</p><h3>{operacao.cargaPendente.placa}</h3><span>{operacao.cargaPendente.areaOrigemNome} → {operacao.cargaPendente.areaDestinoNome}</span>
                  {operacao.cargaPendente.tipo === "meia-carga" ? <p>Aproximadamente meia carga veio da área anterior.</p> : <p>Registrado na área anterior: <strong>{textoQuantidade(operacao.cargaPendente.quantidadeOrigem)}</strong></p>}
                </div>
                <button type="button" onClick={finalizarCargaPendente}><CheckCircle2 size={22} />{operacao.cargaPendente.tipo === "meia-carga" ? "Carga completa" : "Finalizar carga"}</button>
              </section>
            )}

            <section className="operacao-resumo">
              <article><span>Saídas registradas</span><strong>{operacao.registros.length}</strong></article>
              <article><span>Última saída</span><strong>{ultimoRegistro ? formatarHorario(ultimoRegistro.criadoEm) : "--:--"}</strong></article>
              <article><span>Última placa</span><strong className="ultima-placa-resumo">{ultimoRegistro?.placa ?? "---"}</strong></article>
            </section>

            <section className="operacao-trabalho">
              <article className="registro-rapido-card">
                <div className="registro-rapido-cabecalho"><div><p className="operacao-etiqueta">Nova saída</p><h3>Digite a placa</h3><span>Informe a placa e confirme o lançamento.</span></div><div className="registro-truck-icon"><Truck size={34} /></div></div>
                <form className="registro-rapido-form" onSubmit={registrarSaida}>
                  <input type="text" value={placaDigitada} onChange={(e) => setPlacaDigitada(limparPlaca(e.target.value))} placeholder="ABC1D23" maxLength={7} autoComplete="off" disabled={Boolean(operacao.cargaPendente)} />
                  <button type="submit" disabled={Boolean(operacao.cargaPendente)}><CheckCircle2 size={24} />Registrar saída</button>
                </form>
                {placasMaisUsadas.length > 0 && !operacao.cargaPendente && (
                  <div className="placas-mais-usadas">
                    <div className="placas-mais-usadas-cabecalho">
                      <span>Placas mais usadas</span>
                      <small>Toque para preencher</small>
                    </div>

                    <div className="placas-mais-usadas-grid">
                      {placasMaisUsadas.map((item) => (
                        <button
                          type="button"
                          key={item.placa}
                          className={
                            placaDigitada === item.placa ? "selecionada" : ""
                          }
                          onClick={() => setPlacaDigitada(item.placa)}
                        >
                          <Truck size={18} />
                          <span>
                            <strong>{item.placa}</strong>
                            <small>
                              {item.apelido ||
                                `${item.quantidade} ${
                                  item.quantidade === 1 ? "saída" : "saídas"
                                }`}
                            </small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {mensagemSucesso && <div className="mensagem-sucesso"><CheckCircle2 size={21} />{mensagemSucesso}</div>}
              </article>

              <aside className="ultimos-lancamentos">
                <div className="historico-cabecalho"><div><p className="operacao-etiqueta">Histórico</p><h3>Últimas saídas</h3></div>{operacao.registros.length > 0 && <button type="button" className="cancelar-ultimo-button" onClick={cancelarUltimoRegistro}>Cancelar último</button>}</div>
                <div className="registros-operacao-lista">
                  {ultimosRegistros.map((r, i) => (
                    <div className="registro-operacao-item" key={r.id}>
                      <div className="registro-numero">
                        {operacao.registros.length - i}
                      </div>
                      <div className="registro-dados">
                        <strong>{r.placa}</strong>
                        <span>{r.observacao ?? r.areaNome}</span>
                      </div>
                      <time>{formatarHorario(r.criadoEm)}</time>
                    </div>
                  ))}
                </div>
              </aside>
            </section>
          </>
        )}
      </section>

      {modalTroca && (
        <div className="modal-overlay">
          <div className="modal-carga">
            <button type="button" className="modal-fechar" onClick={() => setModalTroca(null)}><X size={22} /></button>
            {modalTroca === "situacao" && <><p className="operacao-etiqueta">Trocar área</p><h2>Como ficou a carga?</h2><div className="situacao-grid">
              <button type="button" onClick={() => escolherSituacao("completos")}><strong>Todos completos</strong><span>Trocar normalmente</span></button>
              <button type="button" onClick={() => escolherSituacao("faltou-pouco")}><strong>Faltou pouco</strong><span>Informar quanto completou</span></button>
              <button type="button" onClick={() => escolherSituacao("meia-carga")}><strong>Meia carga</strong><span>Metade em cada área</span></button>
              <button type="button" onClick={() => escolherSituacao("quantidade")}><strong>Registrar quantidade</strong><span>Bazuca, graneleiro, kg ou sacos</span></button>
            </div></>}

            {modalTroca === "placa" && <><p className="operacao-etiqueta">Carga incompleta</p><h2>Qual caminhão?</h2><input className="placa-modal-input" value={placaIncompleta} onChange={(e) => setPlacaIncompleta(limparPlaca(e.target.value))} placeholder="ABC1D23" maxLength={7} autoFocus />
              {placasMaisUsadas.length > 0 && <div className="placas-recentes"><span>Placas mais usadas</span><div>{placasMaisUsadas.map((item) => <button type="button" key={item.placa} onClick={() => setPlacaIncompleta(item.placa)}>{item.placa}</button>)}</div></div>}
              <button type="button" className="modal-confirmar" onClick={confirmarPlacaIncompleta}>Continuar</button></>}

            {modalTroca === "quantidade-origem" && <QuantidadeEditor titulo={`Quanto ficou em ${operacao?.areaNome}?`} botao="Salvar e escolher próxima área" onConfirmar={confirmarQuantidadeOrigem} />}
            {modalTroca === "completar-faltou-pouco" && <><p className="operacao-etiqueta">Completar carga</p><h2>{operacao?.cargaPendente?.placa}</h2><p>Quanto foi colocado em <strong>{operacao?.areaNome}</strong>?</p><QuantidadeEditor titulo="Selecione a quantidade" botao="Confirmar carga completa" onConfirmar={registrarComplementoFaltouPouco} /></>}
          </div>
        </div>
      )}
    </main>
  );
}

export default OperacaoPage;