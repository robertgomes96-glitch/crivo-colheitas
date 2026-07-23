import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import "./Operadores.css";
import { excluirOperadorSincronizado } from "../../services/cadastrosService";

type OperadoresPageProps = {
  onVoltar: () => void;
};

export type CargoOperador =
  | "operador"
  | "encarregado"
  | "escritorio"
  | "gerente";

type Operador = {
  id: string;
  nome: string;
  pin: string;
  cargo: CargoOperador;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
};

type FormularioOperador = {
  nome: string;
  pin: string;
  cargo: CargoOperador;
};

const OPERADORES_KEY = "crivo_colheitas_operadores";

const NOMES_CARGOS: Record<CargoOperador, string> = {
  operador: "Operador",
  encarregado: "Encarregado",
  escritorio: "Escritório",
  gerente: "Gerente",
};

function criarId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function limparPin(valor: string) {
  return valor.replace(/\D/g, "").slice(0, 4);
}

function cargoValido(valor: unknown): valor is CargoOperador {
  return (
    valor === "operador" ||
    valor === "encarregado" ||
    valor === "escritorio" ||
    valor === "gerente"
  );
}

function carregarOperadores(): Operador[] {
  const salvo = localStorage.getItem(OPERADORES_KEY);

  if (!salvo) return [];

  try {
    const convertido = JSON.parse(salvo) as unknown;

    if (!Array.isArray(convertido)) return [];

    const operadoresNormalizados = convertido
      .filter((item) => typeof item === "object" && item !== null)
      .map((item) => {
        const operador = item as Partial<Operador>;

        if (
          typeof operador.id !== "string" ||
          typeof operador.nome !== "string" ||
          typeof operador.pin !== "string" ||
          typeof operador.ativo !== "boolean"
        ) {
          return null;
        }

        return {
          id: operador.id,
          nome: operador.nome,
          pin: operador.pin,
          cargo: cargoValido(operador.cargo) ? operador.cargo : "operador",
          ativo: operador.ativo,
          criadoEm: operador.criadoEm ?? new Date().toISOString(),
          atualizadoEm: operador.atualizadoEm ?? new Date().toISOString(),
        } satisfies Operador;
      })
      .filter((item): item is Operador => item !== null)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    localStorage.setItem(
      OPERADORES_KEY,
      JSON.stringify(operadoresNormalizados),
    );

    return operadoresNormalizados;
  } catch {
    localStorage.removeItem(OPERADORES_KEY);
    return [];
  }
}

function OperadoresPage({ onVoltar }: OperadoresPageProps) {
  const [operadores, setOperadores] = useState<Operador[]>(carregarOperadores);
  const [busca, setBusca] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [operadorEmEdicao, setOperadorEmEdicao] = useState<string | null>(null);
  const [mostrarPins, setMostrarPins] = useState(false);
  const [formulario, setFormulario] = useState<FormularioOperador>({
    nome: "",
    pin: "",
    cargo: "operador",
  });

  const operadoresFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    if (!termo) return operadores;

    return operadores.filter(
      (operador) =>
        operador.nome.toLowerCase().includes(termo) ||
        NOMES_CARGOS[operador.cargo].toLowerCase().includes(termo),
    );
  }, [busca, operadores]);

  const ativos = operadores.filter((operador) => operador.ativo).length;

  function salvarOperadores(novosOperadores: Operador[]) {
    const ordenados = [...novosOperadores].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR"),
    );

    localStorage.setItem(OPERADORES_KEY, JSON.stringify(ordenados));
    setOperadores(ordenados);
  }

  function abrirNovoOperador() {
    setOperadorEmEdicao(null);
    setFormulario({ nome: "", pin: "", cargo: "operador" });
    setMostrarFormulario(true);
  }

  function iniciarEdicao(operador: Operador) {
    setOperadorEmEdicao(operador.id);
    setFormulario({
      nome: operador.nome,
      pin: operador.pin,
      cargo: operador.cargo,
    });
    setMostrarFormulario(true);
  }

  function fecharFormulario() {
    setMostrarFormulario(false);
    setOperadorEmEdicao(null);
    setFormulario({ nome: "", pin: "", cargo: "operador" });
  }

  function salvarFormulario(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    const nome = formulario.nome.trim();
    const pin = limparPin(formulario.pin);

    if (nome.length < 2) {
      window.alert("Informe o nome do operador.");
      return;
    }

    if (pin.length !== 4) {
      window.alert("O PIN precisa ter exatamente 4 números.");
      return;
    }

    if (pin === "2510") {
      window.alert("O PIN 2510 é reservado para o administrador.");
      return;
    }

    const nomeDuplicado = operadores.some(
      (operador) =>
        operador.id !== operadorEmEdicao &&
        operador.nome.toLowerCase() === nome.toLowerCase(),
    );

    if (nomeDuplicado) {
      window.alert("Já existe uma pessoa cadastrada com esse nome.");
      return;
    }

    const pinDuplicado = operadores.some(
      (operador) =>
        operador.id !== operadorEmEdicao && operador.pin === pin,
    );

    if (pinDuplicado) {
      window.alert("Esse PIN já está sendo usado por outra pessoa.");
      return;
    }

    const agora = new Date().toISOString();

    if (operadorEmEdicao) {
      salvarOperadores(
        operadores.map((operador) =>
          operador.id === operadorEmEdicao
            ? {
                ...operador,
                nome,
                pin,
                cargo: formulario.cargo,
                atualizadoEm: agora,
              }
            : operador,
        ),
      );
    } else {
      salvarOperadores([
        ...operadores,
        {
          id: criarId(),
          nome,
          pin,
          cargo: formulario.cargo,
          ativo: true,
          criadoEm: agora,
          atualizadoEm: agora,
        },
      ]);
    }

    fecharFormulario();
  }

  function alternarStatus(id: string) {
    salvarOperadores(
      operadores.map((operador) =>
        operador.id === id
          ? {
              ...operador,
              ativo: !operador.ativo,
              atualizadoEm: new Date().toISOString(),
            }
          : operador,
      ),
    );
  }

  async function excluirOperador(operador: Operador) {
    const confirmou = window.confirm(
      `Deseja excluir ${operador.nome} do sistema?`,
    );

    if (!confirmou) return;

    try {
      await excluirOperadorSincronizado(operador.id);
      salvarOperadores(
        operadores.filter((item) => item.id !== operador.id),
      );
    } catch (erro) {
      console.error(erro);
      window.alert(
        erro instanceof Error
          ? erro.message
          : "Não foi possível excluir o operador.",
      );
    }
  }

  return (
    <main className="operadores-page">
      <header className="operadores-header">
        <button type="button" className="operadores-voltar" onClick={onVoltar}>
          <ArrowLeft size={23} />
          Voltar
        </button>

        <div className="operadores-titulo">
          <Users size={30} />
          <div>
            <p>Crivo Colheitas</p>
            <h1>Operadores</h1>
          </div>
        </div>
      </header>

      <section className="operadores-container">
        <div className="operadores-cabecalho">
          <div>
            <p className="operadores-etiqueta">Controle de acesso</p>
            <h2>Equipe da colheita</h2>
            <span>
              Cadastre cada pessoa com PIN e cargo dentro do sistema.
            </span>
          </div>

          <button
            type="button"
            className="novo-operador-button"
            onClick={mostrarFormulario ? fecharFormulario : abrirNovoOperador}
          >
            {mostrarFormulario ? <X size={20} /> : <Plus size={20} />}
            {mostrarFormulario ? "Cancelar" : "Novo cadastro"}
          </button>
        </div>

        <section className="operadores-resumo">
          <article>
            <span>Total cadastrado</span>
            <strong>{operadores.length}</strong>
          </article>

          <article>
            <span>Ativos</span>
            <strong>{ativos}</strong>
          </article>

          <article>
            <span>Inativos</span>
            <strong>{operadores.length - ativos}</strong>
          </article>
        </section>

        {mostrarFormulario && (
          <form className="operador-formulario" onSubmit={salvarFormulario}>
            <div className="operador-formulario-titulo">
              <UserRound size={25} />
              <div>
                <strong>
                  {operadorEmEdicao ? "Editar cadastro" : "Novo cadastro"}
                </strong>
                <span>O PIN será usado para entrar no aplicativo.</span>
              </div>
            </div>

            <div className="operador-campos operador-campos-com-cargo">
              <div>
                <label htmlFor="operador-nome">Nome</label>
                <input
                  id="operador-nome"
                  type="text"
                  value={formulario.nome}
                  onChange={(evento) =>
                    setFormulario((atual) => ({
                      ...atual,
                      nome: evento.target.value,
                    }))
                  }
                  placeholder="Ex.: João"
                  maxLength={60}
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="operador-pin">PIN de acesso</label>
                <input
                  id="operador-pin"
                  type="password"
                  inputMode="numeric"
                  value={formulario.pin}
                  onChange={(evento) =>
                    setFormulario((atual) => ({
                      ...atual,
                      pin: limparPin(evento.target.value),
                    }))
                  }
                  placeholder="••••"
                  maxLength={4}
                />
              </div>

              <div>
                <label htmlFor="operador-cargo">Cargo</label>
                <select
                  id="operador-cargo"
                  value={formulario.cargo}
                  onChange={(evento) =>
                    setFormulario((atual) => ({
                      ...atual,
                      cargo: evento.target.value as CargoOperador,
                    }))
                  }
                >
                  <option value="operador">Operador</option>
                  <option value="encarregado">Encarregado</option>
                  <option value="escritorio">Escritório</option>
                  <option value="gerente">Gerente</option>
                </select>
              </div>

              <button type="submit">
                <Check size={20} />
                {operadorEmEdicao ? "Salvar" : "Cadastrar"}
              </button>
            </div>
          </form>
        )}

        {operadores.length > 0 && (
          <div className="operadores-filtros">
            <div className="operadores-busca">
              <Search size={21} />
              <input
                type="search"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Buscar por nome ou cargo"
              />
            </div>

            <button
              type="button"
              className="mostrar-pins-button"
              onClick={() => setMostrarPins((atual) => !atual)}
            >
              {mostrarPins ? <EyeOff size={19} /> : <Eye size={19} />}
              {mostrarPins ? "Ocultar PINs" : "Mostrar PINs"}
            </button>
          </div>
        )}

        {operadores.length === 0 ? (
          <div className="operadores-vazio">
            <Users size={46} />
            <h2>Ninguém cadastrado</h2>
            <p>
              Cadastre as pessoas que terão acesso ao aplicativo da colheita.
            </p>
          </div>
        ) : operadoresFiltrados.length === 0 ? (
          <div className="operadores-vazio operadores-vazio-menor">
            <Search size={40} />
            <h2>Nenhum cadastro encontrado</h2>
            <p>Confira o nome ou cargo digitado na busca.</p>
          </div>
        ) : (
          <div className="operadores-lista">
            {operadoresFiltrados.map((operador) => (
              <article
                className={`operador-card ${operador.ativo ? "" : "inativo"}`}
                key={operador.id}
              >
                <div className="operador-identidade">
                  <div className="operador-avatar">
                    <UserRound size={27} />
                  </div>

                  <div>
                    <strong>{operador.nome}</strong>
                    <span className="operador-cargo">
                      {NOMES_CARGOS[operador.cargo]}
                    </span>
                    <span>PIN: {mostrarPins ? operador.pin : "••••"}</span>
                  </div>
                </div>

                <div className="operador-card-acoes">
                  <div
                    className={`operador-status ${
                      operador.ativo ? "ativo" : "desativado"
                    }`}
                  >
                    <ShieldCheck size={17} />
                    {operador.ativo ? "Ativo" : "Inativo"}
                  </div>

                  <button
                    type="button"
                    className="operador-editar"
                    onClick={() => iniciarEdicao(operador)}
                  >
                    <Pencil size={18} />
                    Editar
                  </button>

                  <button
                    type="button"
                    className="operador-alternar"
                    onClick={() => alternarStatus(operador.id)}
                  >
                    {operador.ativo ? "Desativar" : "Ativar"}
                  </button>

                  <button
                    type="button"
                    className="operador-excluir"
                    onClick={() => excluirOperador(operador)}
                    aria-label={`Excluir ${operador.nome}`}
                    title="Excluir cadastro"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default OperadoresPage;