import { useCallback, useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  ArrowLeft,
  Check,
  Edit3,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import {
  editarCarregamento,
  excluirCarregamentos,
  excluirTodosCarregamentos,
  listarCarregamentos,
  salvarCarregamento,
  type Carregamento,
  type TipoCarregamento,
} from "../../services/carregamentosService";
import "./CarregamentosPage.css";

type Props = {
  onVoltar: () => void;
};

type GrupoCadastro = { id: string; nome: string };
type AreaCadastro = { id: string; nome: string; grupoId?: string; ativa?: boolean };

function lerCadastros() {
  try {
    const grupos = JSON.parse(localStorage.getItem("crivo_colheitas_grupos") || "[]") as GrupoCadastro[];
    const areas = JSON.parse(localStorage.getItem("crivo_colheitas_areas") || "[]") as AreaCadastro[];
    return { grupos, areas: areas.filter((a) => a.ativa !== false) };
  } catch { return { grupos: [] as GrupoCadastro[], areas: [] as AreaCadastro[] }; }
}

const AGORA_LOCAL = () => {
  const data = new Date();
  const deslocamento = data.getTimezoneOffset() * 60000;
  return new Date(data.getTime() - deslocamento).toISOString().slice(0, 16);
};

function novoCarregamentoManual(): Carregamento {
  return {
    id: uuidv4(),
    placa: "",
    grupoId: "",
    grupoNome: "",
    areaId: "",
    areaNome: "",
    operadorNome: "Escritório",
    tipo: "saida",
    criadoEm: AGORA_LOCAL(),
    observacao: "Lançamento incluído manualmente pelo escritório.",
  };
}

function limparPlaca(valor: string) {
  return valor.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}

function formatarData(valor: string) {
  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) return "Data inválida";

  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function paraInputData(valor: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  const deslocamento = data.getTimezoneOffset() * 60000;
  return new Date(data.getTime() - deslocamento).toISOString().slice(0, 16);
}

function tipoLegivel(tipo: TipoCarregamento) {
  const nomes: Record<TipoCarregamento, string> = {
    saida: "Saída",
    "faltou-pouco": "Faltou pouco",
    "meia-carga": "Meia carga",
    quantidade: "Quantidade",
  };

  return nomes[tipo];
}

export default function CarregamentosPage({ onVoltar }: Props) {
  const [registros, setRegistros] = useState<Carregamento[]>([]);
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [editando, setEditando] = useState<Carregamento | null>(null);
  const [criando, setCriando] = useState<Carregamento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [cadastros, setCadastros] = useState(lerCadastros);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");

    try {
      setRegistros(await listarCarregamentos());
    } catch (falha) {
      console.error(falha);
      setErro("Não foi possível carregar os carregamentos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    setCadastros(lerCadastros());
  }, [carregar]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");

    if (!termo) return registros;

    return registros.filter((registro) =>
      [
        registro.placa,
        registro.operadorNome,
        registro.grupoNome,
        registro.areaNome,
        registro.observacao,
        tipoLegivel(registro.tipo),
      ]
        .filter(Boolean)
        .some((valor) =>
          String(valor).toLocaleLowerCase("pt-BR").includes(termo),
        ),
    );
  }, [busca, registros]);

  function alternarSelecao(id: string) {
    setSelecionados((atuais) => {
      const novos = new Set(atuais);
      if (novos.has(id)) novos.delete(id);
      else novos.add(id);
      return novos;
    });
  }

  function selecionarTodosVisiveis() {
    setSelecionados((atuais) => {
      const todosVisiveisSelecionados =
        filtrados.length > 0 && filtrados.every((item) => atuais.has(item.id));
      if (todosVisiveisSelecionados) return new Set();
      return new Set(filtrados.map((item) => item.id));
    });
  }

  async function excluir(ids: string[]) {
    if (ids.length === 0) return;

    const texto =
      ids.length === 1
        ? "Deseja excluir este carregamento definitivamente?"
        : `Deseja excluir ${ids.length} carregamentos definitivamente?`;

    if (!window.confirm(texto)) return;

    setSalvando(true);
    setErro("");

    try {
      await excluirCarregamentos(ids);
      setRegistros((atuais) => atuais.filter((item) => !ids.includes(item.id)));
      setSelecionados(new Set());
      setMensagem("Carregamento(s) excluído(s) com sucesso.");
      window.setTimeout(() => setMensagem(""), 2500);
    } catch (falha) {
      console.error(falha);
      setErro("Não foi possível excluir. Nenhum dado local foi removido.");
    } finally {
      setSalvando(false);
    }
  }

  function validar(carregamento: Carregamento) {
    if (limparPlaca(carregamento.placa).length !== 7) {
      setErro("Informe uma placa válida com 7 caracteres.");
      return false;
    }

    const areaCadastrada = cadastros.areas.find(
      (area) => area.id === carregamento.areaId,
    );

    if (!areaCadastrada) {
      setErro("Selecione uma área cadastrada. Não é permitido digitar a área manualmente.");
      return false;
    }

    if (!carregamento.operadorNome.trim()) {
      setErro("Informe o operador.");
      return false;
    }

    if (Number.isNaN(new Date(carregamento.criadoEm).getTime())) {
      setErro("Informe uma data e horário válidos.");
      return false;
    }

    return true;
  }

  async function salvarEdicao() {
    if (!editando || !validar(editando)) return;

    setSalvando(true);
    setErro("");

    const atualizado: Carregamento = {
      ...editando,
      placa: limparPlaca(editando.placa),
      criadoEm: new Date(editando.criadoEm).toISOString(),
    };

    try {
      await editarCarregamento(atualizado);
      setRegistros((atuais) =>
        atuais
          .map((item) => (item.id === atualizado.id ? atualizado : item))
          .sort(
            (a, b) =>
              new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime(),
          ),
      );
      setEditando(null);
      setMensagem("Carregamento atualizado.");
      window.setTimeout(() => setMensagem(""), 2500);
    } catch (falha) {
      console.error(falha);
      setErro("Não foi possível salvar a alteração.");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarManual() {
    if (!criando || !validar(criando)) return;

    setSalvando(true);
    setErro("");

    const novo: Carregamento = {
      ...criando,
      placa: limparPlaca(criando.placa),
      grupoId: criando.grupoId,
      grupoNome: criando.grupoNome,
      areaId: criando.areaId,
      areaNome: criando.areaNome,
      operadorNome: criando.operadorNome.trim(),
      criadoEm: new Date(criando.criadoEm).toISOString(),
      observacao:
        criando.observacao?.trim() ||
        "Lançamento incluído manualmente pelo escritório.",
    };

    try {
      await salvarCarregamento(novo);
      setRegistros((atuais) =>
        [novo, ...atuais].sort(
          (a, b) =>
            new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime(),
        ),
      );
      setCriando(null);
      setMensagem("Carregamento manual adicionado.");
      window.setTimeout(() => setMensagem(""), 2500);
    } catch (falha) {
      console.error(falha);
      setErro(
        "O carregamento ficou salvo no computador e será sincronizado quando possível.",
      );
    } finally {
      setSalvando(false);
    }
  }

  async function apagarTudo() {
    const confirmacao = window.prompt(
      'Esta ação apaga todos os carregamentos. Digite "APAGAR TUDO" para confirmar:',
    );

    if (confirmacao !== "APAGAR TUDO") return;

    setSalvando(true);
    setErro("");

    try {
      await excluirTodosCarregamentos();
      setRegistros([]);
      setSelecionados(new Set());
      setMensagem("Todos os carregamentos foram apagados.");
    } catch (falha) {
      console.error(falha);
      setErro("Não foi possível apagar todos os carregamentos.");
    } finally {
      setSalvando(false);
    }
  }

  const formulario = criando ?? editando;
  const modoCriacao = Boolean(criando);

  return (
    <main className="cargas-page">
      <header className="cargas-header">
        <div>
          <button type="button" onClick={onVoltar} className="cargas-voltar">
            <ArrowLeft size={22} />
          </button>
          <div>
            <p>Crivo Colheitas</p>
            <h1>Gerenciar carregamentos</h1>
          </div>
        </div>

        <button
          type="button"
          className="cargas-atualizar"
          onClick={() => void carregar()}
          disabled={carregando || salvando}
        >
          <RefreshCcw size={18} />
          Atualizar
        </button>
      </header>

      <section className="cargas-container">
        <section className="cargas-topo">
          <div>
            <h2>Carregamentos registrados</h2>
            <p>{registros.length} registro(s) no histórico.</p>
          </div>

          <div className="cargas-topo-acoes">
            <button
              type="button"
              className="cargas-adicionar"
              onClick={() => {
                setCadastros(lerCadastros());
                setCriando(novoCarregamentoManual());
              }}
              disabled={salvando}
            >
              <Plus size={18} />
              Adicionar carregamento
            </button>

            <button
              type="button"
              className="cargas-apagar-tudo"
              onClick={() => void apagarTudo()}
              disabled={salvando || registros.length === 0}
            >
              <Trash2 size={18} />
              Apagar tudo
            </button>
          </div>
        </section>

        <section className="cargas-filtros">
          <label>
            <Search size={19} />
            <input
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar placa, operador, grupo ou área"
            />
          </label>

          {selecionados.size > 0 && (
            <button
              type="button"
              className="cargas-excluir-selecionados"
              onClick={() => void excluir(Array.from(selecionados))}
              disabled={salvando}
            >
              <Trash2 size={18} />
              Excluir selecionados ({selecionados.size})
            </button>
          )}
        </section>

        {erro && <div className="cargas-mensagem erro">{erro}</div>}
        {mensagem && <div className="cargas-mensagem sucesso">{mensagem}</div>}

        <section className="cargas-tabela-card">
          {carregando ? (
            <div className="cargas-vazio">Carregando...</div>
          ) : filtrados.length === 0 ? (
            <div className="cargas-vazio">
              <Truck size={40} />
              <strong>Nenhum carregamento encontrado</strong>
            </div>
          ) : (
            <div className="cargas-tabela-wrapper">
              <table className="cargas-tabela">
                <thead>
                  <tr>
                    <th>
                      <button
                        type="button"
                        className="cargas-check"
                        onClick={selecionarTodosVisiveis}
                      >
                        {filtrados.every((item) => selecionados.has(item.id)) ? (
                          <Check size={17} />
                        ) : null}
                      </button>
                    </th>
                    <th>Data</th>
                    <th>Placa</th>
                    <th>Operador</th>
                    <th>Grupo</th>
                    <th>Área</th>
                    <th>Tipo</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((registro) => (
                    <tr key={registro.id}>
                      <td>
                        <button
                          type="button"
                          className={`cargas-check ${
                            selecionados.has(registro.id) ? "selecionado" : ""
                          }`}
                          onClick={() => alternarSelecao(registro.id)}
                        >
                          {selecionados.has(registro.id) && <Check size={17} />}
                        </button>
                      </td>
                      <td>{formatarData(registro.criadoEm)}</td>
                      <td><strong>{registro.placa}</strong></td>
                      <td>{registro.operadorNome}</td>
                      <td>{registro.grupoNome}</td>
                      <td>{registro.areaNome}</td>
                      <td>{tipoLegivel(registro.tipo)}</td>
                      <td>
                        <div className="cargas-acoes">
                          <button
                            type="button"
                            title="Editar"
                            onClick={() => {
                              const atuais = lerCadastros();
                              setCadastros(atuais);

                              const porId = atuais.areas.find((a) => a.id === registro.areaId);
                              const normalizar = (v: string) =>
                                v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
                              const porNome = atuais.areas.filter((a) => {
                                if (normalizar(a.nome) !== normalizar(registro.areaNome)) return false;
                                const g = atuais.grupos.find((grupo) => grupo.id === a.grupoId);
                                return !registro.grupoNome || !g || normalizar(g.nome) === normalizar(registro.grupoNome);
                              });
                              const areaCerta = porId ?? (porNome.length === 1 ? porNome[0] : undefined);

                              if (areaCerta) {
                                const grupoCerto = atuais.grupos.find((g) => g.id === areaCerta.grupoId);
                                setEditando({
                                  ...registro,
                                  areaId: areaCerta.id,
                                  areaNome: areaCerta.nome,
                                  grupoId: grupoCerto?.id || areaCerta.grupoId || "sem-grupo",
                                  grupoNome: grupoCerto?.nome || "Sem grupo",
                                });
                              } else {
                                setEditando({ ...registro });
                              }
                            }}
                          >
                            <Edit3 size={18} />
                          </button>
                          <button
                            type="button"
                            title="Excluir"
                            className="excluir"
                            onClick={() => void excluir([registro.id])}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

      {formulario && (
        <div className="cargas-modal-overlay">
          <div className="cargas-modal">
            <button
              type="button"
              className="cargas-modal-fechar"
              onClick={() => {
                setEditando(null);
                setCriando(null);
                setErro("");
              }}
            >
              <X size={21} />
            </button>

            <p className="cargas-etiqueta">
              {modoCriacao ? "Novo carregamento" : "Editar carregamento"}
            </p>
            <h2>{modoCriacao ? "Adicionar manualmente" : formulario.placa}</h2>

            <div className="cargas-form-grid">
              <label>
                Placa
                <input
                  value={formulario.placa}
                  maxLength={7}
                  placeholder="ABC1D23"
                  onChange={(evento) => {
                    const valor = limparPlaca(evento.target.value);
                    if (modoCriacao) setCriando({ ...formulario, placa: valor });
                    else setEditando({ ...formulario, placa: valor });
                  }}
                />
              </label>

              <label>
                Operador
                <input
                  value={formulario.operadorNome}
                  onChange={(evento) => {
                    const valor = evento.target.value;
                    if (modoCriacao) setCriando({ ...formulario, operadorNome: valor });
                    else setEditando({ ...formulario, operadorNome: valor });
                  }}
                />
              </label>

              <label>
                Área cadastrada
                <select
                  value={cadastros.areas.some((a) => a.id === formulario.areaId) ? formulario.areaId : ""}
                  onChange={(evento) => {
                    const areaSelecionada = cadastros.areas.find((a) => a.id === evento.target.value);
                    if (!areaSelecionada) return;
                    const grupoSelecionado = cadastros.grupos.find((g) => g.id === areaSelecionada.grupoId);
                    const atualizado = {
                      ...formulario,
                      areaId: areaSelecionada.id,
                      areaNome: areaSelecionada.nome,
                      grupoId: grupoSelecionado?.id || areaSelecionada.grupoId || "sem-grupo",
                      grupoNome: grupoSelecionado?.nome || "Sem grupo",
                    };
                    if (modoCriacao) setCriando(atualizado);
                    else setEditando(atualizado);
                  }}
                >
                  <option value="">Selecione a área</option>
                  {cadastros.grupos.map((grupo) => (
                    <optgroup key={grupo.id} label={grupo.nome}>
                      {cadastros.areas.filter((a) => a.grupoId === grupo.id).map((a) => (
                        <option key={a.id} value={a.id}>{a.nome}</option>
                      ))}
                    </optgroup>
                  ))}
                  {cadastros.areas.some((a) => !a.grupoId) && (
                    <optgroup label="Sem grupo">
                      {cadastros.areas.filter((a) => !a.grupoId).map((a) => (
                        <option key={a.id} value={a.id}>{a.nome}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>

              <label>
                Grupo
                <input value={formulario.grupoNome} readOnly />
              </label>

              <label>
                Tipo
                <select
                  value={formulario.tipo}
                  onChange={(evento) => {
                    const tipo = evento.target.value as TipoCarregamento;
                    if (modoCriacao) setCriando({ ...formulario, tipo });
                    else setEditando({ ...formulario, tipo });
                  }}
                >
                  <option value="saida">Saída</option>
                  <option value="faltou-pouco">Faltou pouco</option>
                  <option value="meia-carga">Meia carga</option>
                  <option value="quantidade">Quantidade</option>
                </select>
              </label>

              <label>
                Data e horário
                <input
                  type="datetime-local"
                  value={paraInputData(formulario.criadoEm)}
                  onChange={(evento) => {
                    const criadoEm = evento.target.value;
                    if (modoCriacao) setCriando({ ...formulario, criadoEm });
                    else setEditando({ ...formulario, criadoEm });
                  }}
                />
              </label>

              <label className="cargas-form-observacao">
                Observação
                <textarea
                  value={formulario.observacao ?? ""}
                  onChange={(evento) => {
                    const observacao = evento.target.value;
                    if (modoCriacao) setCriando({ ...formulario, observacao });
                    else setEditando({ ...formulario, observacao });
                  }}
                />
              </label>
            </div>

            <button
              type="button"
              className="cargas-salvar"
              onClick={() =>
                modoCriacao ? void salvarManual() : void salvarEdicao()
              }
              disabled={salvando}
            >
              <Check size={20} />
              {salvando
                ? "Salvando..."
                : modoCriacao
                  ? "Adicionar carregamento"
                  : "Salvar alterações"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
