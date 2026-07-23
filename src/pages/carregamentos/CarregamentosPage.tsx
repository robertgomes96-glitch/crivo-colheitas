import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Edit3,
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
  type Carregamento,
  type TipoCarregamento,
} from "../../services/carregamentosService";
import "./CarregamentosPage.css";

type Props = {
  onVoltar: () => void;
};

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
  if (Number.isNaN(data.getTime())) return "";
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
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

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
      setRegistros((atuais) =>
        atuais.filter((item) => !ids.includes(item.id)),
      );
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

  async function salvarEdicao() {
    if (!editando) return;

    if (!editando.placa.trim() || !editando.areaNome.trim()) {
      setErro("Informe pelo menos a placa e a área.");
      return;
    }

    setSalvando(true);
    setErro("");

    try {
      await editarCarregamento({
        ...editando,
        placa: editando.placa.trim().toUpperCase(),
        criadoEm: new Date(editando.criadoEm).toISOString(),
      });

      setRegistros((atuais) =>
        atuais
          .map((item) => (item.id === editando.id ? editando : item))
          .sort(
            (a, b) =>
              new Date(b.criadoEm).getTime() -
              new Date(a.criadoEm).getTime(),
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

          <button
            type="button"
            className="cargas-apagar-tudo"
            onClick={() => void apagarTudo()}
            disabled={salvando || registros.length === 0}
          >
            <Trash2 size={18} />
            Apagar tudo
          </button>
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
                      <td>
                        <strong>{registro.placa}</strong>
                      </td>
                      <td>{registro.operadorNome}</td>
                      <td>{registro.grupoNome}</td>
                      <td>{registro.areaNome}</td>
                      <td>{tipoLegivel(registro.tipo)}</td>
                      <td>
                        <div className="cargas-acoes">
                          <button
                            type="button"
                            title="Editar"
                            onClick={() => setEditando({ ...registro })}
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

      {editando && (
        <div className="cargas-modal-overlay">
          <div className="cargas-modal">
            <button
              type="button"
              className="cargas-modal-fechar"
              onClick={() => setEditando(null)}
            >
              <X size={21} />
            </button>

            <p className="cargas-etiqueta">Editar carregamento</p>
            <h2>{editando.placa}</h2>

            <div className="cargas-form-grid">
              <label>
                Placa
                <input
                  value={editando.placa}
                  maxLength={7}
                  onChange={(evento) =>
                    setEditando({
                      ...editando,
                      placa: evento.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, ""),
                    })
                  }
                />
              </label>

              <label>
                Operador
                <input
                  value={editando.operadorNome}
                  onChange={(evento) =>
                    setEditando({
                      ...editando,
                      operadorNome: evento.target.value,
                    })
                  }
                />
              </label>

              <label>
                Grupo
                <input
                  value={editando.grupoNome}
                  onChange={(evento) =>
                    setEditando({
                      ...editando,
                      grupoNome: evento.target.value,
                    })
                  }
                />
              </label>

              <label>
                Área
                <input
                  value={editando.areaNome}
                  onChange={(evento) =>
                    setEditando({
                      ...editando,
                      areaNome: evento.target.value,
                    })
                  }
                />
              </label>

              <label>
                Tipo
                <select
                  value={editando.tipo}
                  onChange={(evento) =>
                    setEditando({
                      ...editando,
                      tipo: evento.target.value as TipoCarregamento,
                    })
                  }
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
                  value={paraInputData(editando.criadoEm)}
                  onChange={(evento) =>
                    setEditando({
                      ...editando,
                      criadoEm: evento.target.value,
                    })
                  }
                />
              </label>

              <label className="cargas-form-observacao">
                Observação
                <textarea
                  value={editando.observacao ?? ""}
                  onChange={(evento) =>
                    setEditando({
                      ...editando,
                      observacao: evento.target.value,
                    })
                  }
                />
              </label>
            </div>

            <button
              type="button"
              className="cargas-salvar"
              onClick={() => void salvarEdicao()}
              disabled={salvando}
            >
              <Check size={20} />
              {salvando ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}