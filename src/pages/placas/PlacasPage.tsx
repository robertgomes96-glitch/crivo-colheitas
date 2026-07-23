import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import "./PlacasPage.css";
import { excluirPlacaSincronizada } from "../../services/cadastrosService";

type PlacasPageProps = {
  onVoltar: () => void;
};

type RegistroOperacao = {
  placa?: string;
};

type OperacaoSalva = {
  registros?: RegistroOperacao[];
};

type PlacaCadastrada = {
  id: string;
  placa: string;
  apelido: string;
  ativa: boolean;
  criadaEm: string;
  atualizadaEm: string;
};

const PLACAS_KEY = "crivo_colheitas_placas";
const OPERACAO_KEY = "crivo_colheitas_operacao_ativa";

function criarId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function limparPlaca(valor: string) {
  return valor.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}

function carregarPlacasSalvas(): PlacaCadastrada[] {
  const salvo = localStorage.getItem(PLACAS_KEY);
  if (!salvo) return [];

  try {
    const convertido = JSON.parse(salvo) as unknown;
    if (!Array.isArray(convertido)) return [];

    return convertido.filter((item): item is PlacaCadastrada => {
      if (typeof item !== "object" || item === null) return false;
      const placa = item as Partial<PlacaCadastrada>;

      return (
        typeof placa.id === "string" &&
        typeof placa.placa === "string" &&
        typeof placa.apelido === "string" &&
        typeof placa.ativa === "boolean"
      );
    });
  } catch {
    localStorage.removeItem(PLACAS_KEY);
    return [];
  }
}

function carregarPlacasDaOperacao() {
  const salvo = localStorage.getItem(OPERACAO_KEY);
  if (!salvo) return [];

  try {
    const operacao = JSON.parse(salvo) as OperacaoSalva;
    if (!Array.isArray(operacao.registros)) return [];

    const placas = new Set<string>();

    operacao.registros.forEach((registro) => {
      const placa = limparPlaca(registro.placa ?? "");
      if (placa.length === 7) placas.add(placa);
    });

    return Array.from(placas);
  } catch {
    return [];
  }
}

function carregarPlacas(): PlacaCadastrada[] {
  const agora = new Date().toISOString();
  const cadastradas = carregarPlacasSalvas();
  const mapa = new Map(cadastradas.map((placa) => [placa.placa, placa]));

  carregarPlacasDaOperacao().forEach((placa) => {
    if (!mapa.has(placa)) {
      mapa.set(placa, {
        id: criarId(),
        placa,
        apelido: "",
        ativa: true,
        criadaEm: agora,
        atualizadaEm: agora,
      });
    }
  });

  const resultado = Array.from(mapa.values()).sort((a, b) =>
    a.placa.localeCompare(b.placa, "pt-BR"),
  );

  localStorage.setItem(PLACAS_KEY, JSON.stringify(resultado));
  return resultado;
}

function PlacasPage({ onVoltar }: PlacasPageProps) {
  const [placas, setPlacas] = useState<PlacaCadastrada[]>(carregarPlacas);
  const [busca, setBusca] = useState("");
  const [mostrarCadastro, setMostrarCadastro] = useState(false);
  const [novaPlaca, setNovaPlaca] = useState("");
  const [novoApelido, setNovoApelido] = useState("");
  const [placaEmEdicao, setPlacaEmEdicao] = useState<string | null>(null);
  const [apelidoEmEdicao, setApelidoEmEdicao] = useState("");

  const placasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return placas;

    return placas.filter(
      (item) =>
        item.placa.toLowerCase().includes(termo) ||
        item.apelido.toLowerCase().includes(termo),
    );
  }, [busca, placas]);

  const quantidadeSemApelido = placas.filter(
    (item) => !item.apelido.trim(),
  ).length;

  function salvarPlacas(novasPlacas: PlacaCadastrada[]) {
    const ordenadas = [...novasPlacas].sort((a, b) =>
      a.placa.localeCompare(b.placa, "pt-BR"),
    );

    localStorage.setItem(PLACAS_KEY, JSON.stringify(ordenadas));
    setPlacas(ordenadas);
  }

  function cadastrarPlaca(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    const placa = limparPlaca(novaPlaca);
    const apelido = novoApelido.trim();

    if (placa.length !== 7) {
      window.alert("Digite uma placa válida com 7 caracteres.");
      return;
    }

    if (placas.some((item) => item.placa === placa)) {
      window.alert("Essa placa já está cadastrada.");
      return;
    }

    const agora = new Date().toISOString();

    salvarPlacas([
      ...placas,
      {
        id: criarId(),
        placa,
        apelido,
        ativa: true,
        criadaEm: agora,
        atualizadaEm: agora,
      },
    ]);

    setNovaPlaca("");
    setNovoApelido("");
    setMostrarCadastro(false);
  }

  function iniciarEdicao(item: PlacaCadastrada) {
    setPlacaEmEdicao(item.id);
    setApelidoEmEdicao(item.apelido);
  }

  function cancelarEdicao() {
    setPlacaEmEdicao(null);
    setApelidoEmEdicao("");
  }

  function salvarApelido(id: string) {
    salvarPlacas(
      placas.map((item) =>
        item.id === id
          ? {
              ...item,
              apelido: apelidoEmEdicao.trim(),
              atualizadaEm: new Date().toISOString(),
            }
          : item,
      ),
    );

    cancelarEdicao();
  }

  function alternarStatus(id: string) {
    salvarPlacas(
      placas.map((item) =>
        item.id === id
          ? {
              ...item,
              ativa: !item.ativa,
              atualizadaEm: new Date().toISOString(),
            }
          : item,
      ),
    );
  }

  async function excluirPlaca(item: PlacaCadastrada) {
    const confirmou = window.confirm(
      `Deseja realmente excluir a placa "${item.placa}"?`,
    );

    if (!confirmou) return;

    try {
      await excluirPlacaSincronizada(item.id);
      salvarPlacas(placas.filter((placa) => placa.id !== item.id));
    } catch (erro) {
      console.error(erro);
      window.alert(
        erro instanceof Error
          ? erro.message
          : "Não foi possível excluir a placa.",
      );
    }
  }

  return (
    <main className="placas-page">
      <header className="placas-header">
        <button type="button" className="placas-voltar" onClick={onVoltar}>
          <ArrowLeft size={23} />
          Voltar
        </button>

        <div className="placas-titulo">
          <Truck size={30} />
          <div>
            <p>Crivo Colheitas</p>
            <h1>Placas</h1>
          </div>
        </div>
      </header>

      <section className="placas-container">
        <div className="placas-cabecalho">
          <div>
            <p className="placas-etiqueta">Frota utilizada</p>
            <h2>Caminhões registrados</h2>
            <span>As placas usadas na operação aparecem aqui automaticamente.</span>
          </div>

          <button
            type="button"
            className="placas-nova-button"
            onClick={() => setMostrarCadastro((atual) => !atual)}
          >
            {mostrarCadastro ? <X size={20} /> : <Plus size={20} />}
            {mostrarCadastro ? "Cancelar" : "Nova placa"}
          </button>
        </div>

        <section className="placas-resumo">
          <article>
            <span>Total de placas</span>
            <strong>{placas.length}</strong>
          </article>
          <article>
            <span>Sem apelido</span>
            <strong>{quantidadeSemApelido}</strong>
          </article>
          <article>
            <span>Ativas</span>
            <strong>{placas.filter((item) => item.ativa).length}</strong>
          </article>
        </section>

        {mostrarCadastro && (
          <form className="placas-cadastro" onSubmit={cadastrarPlaca}>
            <div>
              <label htmlFor="nova-placa">Placa</label>
              <input
                id="nova-placa"
                type="text"
                value={novaPlaca}
                onChange={(evento) =>
                  setNovaPlaca(limparPlaca(evento.target.value))
                }
                placeholder="ABC1D23"
                maxLength={7}
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="novo-apelido">Apelido opcional</label>
              <input
                id="novo-apelido"
                type="text"
                value={novoApelido}
                onChange={(evento) => setNovoApelido(evento.target.value)}
                placeholder="Ex.: João do bitrem"
                maxLength={60}
              />
            </div>

            <button type="submit">
              <Check size={20} />
              Salvar placa
            </button>
          </form>
        )}

        {placas.length > 0 && (
          <div className="placas-busca">
            <Search size={21} />
            <input
              type="search"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar por placa ou apelido"
            />
          </div>
        )}

        {placas.length === 0 ? (
          <div className="placas-vazio">
            <Truck size={46} />
            <h2>Nenhuma placa registrada</h2>
            <p>
              Assim que os operadores registrarem saídas, as placas aparecerão
              automaticamente aqui para o escritório colocar os apelidos.
            </p>
          </div>
        ) : placasFiltradas.length === 0 ? (
          <div className="placas-vazio placas-vazio-menor">
            <Search size={40} />
            <h2>Nenhuma placa encontrada</h2>
            <p>Confira a busca ou tente outro apelido.</p>
          </div>
        ) : (
          <div className="placas-lista">
            {placasFiltradas.map((item) => {
              const editando = placaEmEdicao === item.id;

              return (
                <article
                  className={`placa-card ${item.ativa ? "" : "inativa"}`}
                  key={item.id}
                >
                  <div className="placa-identificacao">
                    <div className="placa-icone">
                      <Truck size={26} />
                    </div>

                    <div>
                      <strong>{item.placa}</strong>
                      {!editando && (
                        <span>
                          {item.apelido.trim() || "Apelido ainda não informado"}
                        </span>
                      )}
                    </div>
                  </div>

                  {editando ? (
                    <div className="placa-edicao">
                      <input
                        type="text"
                        value={apelidoEmEdicao}
                        onChange={(evento) =>
                          setApelidoEmEdicao(evento.target.value)
                        }
                        placeholder="Digite o apelido"
                        maxLength={60}
                        autoFocus
                      />

                      <button
                        type="button"
                        className="placa-salvar"
                        onClick={() => salvarApelido(item.id)}
                      >
                        <Check size={18} />
                        Salvar
                      </button>

                      <button
                        type="button"
                        className="placa-cancelar"
                        onClick={cancelarEdicao}
                        aria-label="Cancelar edição"
                      >
                        <X size={19} />
                      </button>
                    </div>
                  ) : (
                    <div className="placa-acoes">
                      <button
                        type="button"
                        className="placa-editar"
                        onClick={() => iniciarEdicao(item)}
                      >
                        <Pencil size={18} />
                        {item.apelido.trim()
                          ? "Editar apelido"
                          : "Adicionar apelido"}
                      </button>

                      <button
                        type="button"
                        className={`placa-status ${
                          item.ativa ? "ativa" : "desativada"
                        }`}
                        onClick={() => alternarStatus(item.id)}
                      >
                        {item.ativa ? "Ativa" : "Inativa"}
                      </button>

                      <button
                        type="button"
                        className="placa-excluir"
                        onClick={() => excluirPlaca(item)}
                        aria-label={`Excluir ${item.placa}`}
                        title="Excluir placa"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

export default PlacasPage;