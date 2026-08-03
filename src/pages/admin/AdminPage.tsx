import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ClipboardList,
  Clock3,
  ListChecks,
  LogOut,
  MapPinned,
  RadioTower,
  RefreshCcw,
  Tractor,
  Users,
  Wheat,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  listarOcorrencias,
  resolverOcorrencia,
  type Ocorrencia,
} from "../../services/ocorrenciasService";
import {
  listarStatusOperadores,
  type StatusOperador,
} from "../../services/statusOperadoresService";
import "./AdminPage.css";

export type AdminTela =
  | "dashboard"
  | "operacao"
  | "relatorios"
  | "areas"
  | "placas"
  | "operadores"
  | "carregamentos";

type AdminPageProps = {
  onSair: () => void;
  onAbrirTela: (tela: AdminTela) => void;
};

function tempoDesde(valor?: string) {
  if (!valor) return "Nunca";

  const data = new Date(valor);
  const agora = Date.now();
  const diferenca = Math.max(0, agora - data.getTime());
  const minutos = Math.floor(diferenca / 60_000);

  if (minutos < 1) return "Agora";
  if (minutos === 1) return "Há 1 minuto";
  if (minutos < 60) return `Há ${minutos} minutos`;

  const horas = Math.floor(minutos / 60);
  if (horas === 1) return "Há 1 hora";
  if (horas < 24) return `Há ${horas} horas`;

  const dias = Math.floor(horas / 24);
  return dias === 1 ? "Há 1 dia" : `Há ${dias} dias`;
}

function estaOnline(status: StatusOperador) {
  const data = new Date(status.atualizadoEm).getTime();
  return status.online && Date.now() - data <= 2 * 60_000;
}

function tipoCarregamentoLegivel(tipo?: StatusOperador["ultimoTipo"]) {
  if (!tipo) return "—";

  const nomes = {
    saida: "Saída",
    "faltou-pouco": "Faltou pouco",
    "meia-carga": "Meia carga",
    quantidade: "Quantidade",
  } as const;

  return nomes[tipo];
}

function formatarHorario(valor?: string) {
  if (!valor) return "—";

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";

  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AdminPage({ onSair, onAbrirTela }: AdminPageProps) {
  const [statusOperadores, setStatusOperadores] = useState<StatusOperador[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [carregandoCentral, setCarregandoCentral] = useState(true);
  const [erroCentral, setErroCentral] = useState("");
  const [resolvendoOcorrencia, setResolvendoOcorrencia] = useState<string | null>(null);

  const carregarCentral = useCallback(async () => {
    setErroCentral("");

    try {
      const [status, listaOcorrencias] = await Promise.all([
        listarStatusOperadores(),
        listarOcorrencias(),
      ]);

      setStatusOperadores(status);
      setOcorrencias(listaOcorrencias);
    } catch (erro) {
      console.error("Falha ao carregar Central de Operações:", erro);
      setErroCentral("Não foi possível atualizar a Central de Operações.");
    } finally {
      setCarregandoCentral(false);
    }
  }, []);

  useEffect(() => {
    void carregarCentral();

    const intervalo = window.setInterval(
      () => void carregarCentral(),
      20_000,
    );

    return () => window.clearInterval(intervalo);
  }, [carregarCentral]);

  const ocorrenciasPendentes = useMemo(
    () => ocorrencias.filter((item) => item.status === "pendente"),
    [ocorrencias],
  );

  const operadoresOnline = useMemo(
    () => statusOperadores.filter(estaOnline),
    [statusOperadores],
  );

  async function marcarOcorrenciaResolvida(ocorrencia: Ocorrencia) {
    const observacao = window.prompt(
      "Observação da resolução (opcional):",
      "",
    );

    if (observacao === null) return;

    setResolvendoOcorrencia(ocorrencia.id);
    setErroCentral("");

    try {
      const atualizada = await resolverOcorrencia(
        ocorrencia,
        "Escritório",
        observacao,
      );

      setOcorrencias((atuais) =>
        atuais.map((item) =>
          item.id === atualizada.id ? atualizada : item,
        ),
      );
    } catch (erro) {
      console.error(erro);
      setErroCentral("Não foi possível resolver a ocorrência.");
    } finally {
      setResolvendoOcorrencia(null);
    }
  }

  const operadoresOrdenados = useMemo(
    () =>
      [...statusOperadores].sort((a, b) => {
        const onlineA = estaOnline(a) ? 1 : 0;
        const onlineB = estaOnline(b) ? 1 : 0;

        return (
          onlineB - onlineA ||
          new Date(b.atualizadoEm).getTime() -
            new Date(a.atualizadoEm).getTime()
        );
      }),
    [statusOperadores],
  );

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div className="admin-brand">
          <div className="admin-logo">
            <Wheat size={30} />
          </div>

          <div>
            <p className="admin-brand-small">Crivo</p>
            <h1>Colheitas</h1>
          </div>
        </div>

        <button type="button" className="logout-button" onClick={onSair}>
          <LogOut size={22} />
          Sair
        </button>
      </header>

      <section className="admin-content">
        <section className="central-operacoes">
          <div className="central-cabecalho">
            <div>
              <p className="central-etiqueta">Acompanhamento</p>
              <h2>Central de Operações</h2>
              <span>
                Veja onde está o serviço e se os aparelhos estão sincronizando.
              </span>
            </div>

            <button
              type="button"
              className="central-atualizar"
              onClick={() => void carregarCentral()}
              disabled={carregandoCentral}
            >
              <RefreshCcw size={18} />
              Atualizar
            </button>
          </div>

          <div className="central-resumo">
            <article className={ocorrenciasPendentes.length > 0 ? "alerta" : ""}>
              <AlertTriangle size={23} />
              <div>
                <span>Ocorrências pendentes</span>
                <strong>{ocorrenciasPendentes.length}</strong>
              </div>
            </article>

            <article>
              <Wifi size={23} />
              <div>
                <span>Operadores online</span>
                <strong>{operadoresOnline.length}</strong>
              </div>
            </article>

            <article>
              <MapPinned size={23} />
              <div>
                <span>Áreas em operação</span>
                <strong>
                  {
                    new Set(
                      operadoresOnline
                        .filter((item) => item.emOperacao && item.areaId)
                        .map((item) => item.areaId),
                    ).size
                  }
                </strong>
              </div>
            </article>

            <article>
              <Clock3 size={23} />
              <div>
                <span>Lançamentos pendentes</span>
                <strong>
                  {statusOperadores.reduce(
                    (total, item) =>
                      total + item.pendentesSincronizacao,
                    0,
                  )}
                </strong>
              </div>
            </article>
          </div>

          {erroCentral && (
            <div className="central-mensagem erro">{erroCentral}</div>
          )}

          <div className="central-colunas">
            <section className="central-painel">
              <header>
                <div>
                  <h3>Operadores e áreas atuais</h3>
                  <p>Atualização automática a cada 20 segundos.</p>
                </div>
              </header>

              {operadoresOrdenados.length === 0 ? (
                <div className="central-vazio">
                  {carregandoCentral
                    ? "Carregando operadores..."
                    : "Nenhum operador enviou status ainda."}
                </div>
              ) : (
                <div className="operadores-status-lista">
                  {operadoresOrdenados.map((item) => {
                    const online = estaOnline(item);

                    return (
                      <article
                        className={`operador-status-card ${
                          online ? "online" : "offline"
                        }`}
                        key={item.deviceId}
                      >
                        <div className="operador-status-principal">
                          <div
                            className={`operador-status-indicador ${
                              online ? "online" : "offline"
                            }`}
                          >
                            {online ? (
                              <Wifi size={18} />
                            ) : (
                              <WifiOff size={18} />
                            )}
                          </div>

                          <div>
                            <strong>{item.operadorNome}</strong>
                            <span>
                              {item.emOperacao && item.areaNome
                                ? `Área atual: ${item.areaNome}`
                                : item.ultimaAreaNome
                                  ? `Última área: ${item.ultimaAreaNome}`
                                  : "Nenhuma área registrada"}
                            </span>
                          </div>
                        </div>

                        <div className="operador-status-detalhes">
                          <span>
                            Última placa:
                            <strong>{item.ultimaPlaca ?? "—"}</strong>
                          </span>

                          <span>
                            Último lançamento:
                            <strong>
                              {tipoCarregamentoLegivel(item.ultimoTipo)}
                            </strong>
                          </span>

                          <span>
                            Horário da última carga:
                            <strong>
                              {formatarHorario(item.ultimoLancamentoEm)}
                            </strong>
                          </span>

                          <span>
                            Última sincronização:
                            <strong>
                              {tempoDesde(item.ultimaSincronizacao)}
                            </strong>
                          </span>

                          <span>
                            Pendentes:
                            <strong>{item.pendentesSincronizacao}</strong>
                          </span>

                          <span>
                            Cargas aguardando:
                            <strong>{item.cargasAguardando}</strong>
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="central-painel ocorrencias-painel">
              <header>
                <div>
                  <h3>Ocorrências recentes</h3>
                  <p>Problemas informados pelos operadores.</p>
                </div>
              </header>

              {ocorrenciasPendentes.length === 0 ? (
                <div className="central-vazio">
                  Nenhuma ocorrência pendente.
                </div>
              ) : (
                <div className="ocorrencias-resumo-lista">
                  {ocorrenciasPendentes.slice(0, 5).map((item) => (
                    <article key={item.id}>
                      <div>
                        <strong>{item.titulo}</strong>
                        <span>
                          {item.operadorNome}
                          {item.areaNome ? ` — ${item.areaNome}` : ""}
                        </span>
                        {item.descricao && <small>{item.descricao}</small>}
                      </div>

                      <div className="ocorrencia-resumo-acoes">
                        <time>{tempoDesde(item.criadoEm)}</time>
                        <button
                          type="button"
                          onClick={() => void marcarOcorrenciaResolvida(item)}
                          disabled={resolvendoOcorrencia === item.id}
                        >
                          {resolvendoOcorrencia === item.id
                            ? "Resolvendo..."
                            : "Marcar resolvida"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>

        <div className="admin-title admin-title-menu">
          <h2>Ferramentas do escritório</h2>
          <p>Escolha uma opção para continuar.</p>
        </div>

        <div className="admin-grid">
          <button
            type="button"
            className="admin-card admin-card-operacao"
            onClick={() => onAbrirTela("operacao")}
          >
            <RadioTower size={46} />
            <strong>Operação</strong>
            <span>Iniciar e controlar a colheita</span>
          </button>

          <button
            type="button"
            className="admin-card admin-card-carregamentos"
            onClick={() => onAbrirTela("carregamentos")}
          >
            <ListChecks size={42} />
            <strong>Carregamentos</strong>
            <span>Editar e excluir lançamentos</span>
          </button>

          <button
            type="button"
            className="admin-card"
            onClick={() => onAbrirTela("relatorios")}
          >
            <ClipboardList size={42} />
            <strong>Relatórios</strong>
            <span>Consultar e editar registros</span>
          </button>

          <button
            type="button"
            className="admin-card"
            onClick={() => onAbrirTela("areas")}
          >
            <MapPinned size={42} />
            <strong>Áreas</strong>
            <span>Cadastrar áreas e talhões</span>
          </button>

          <button
            type="button"
            className="admin-card"
            onClick={() => onAbrirTela("placas")}
          >
            <Tractor size={42} />
            <strong>Placas</strong>
            <span>Adicionar apelidos às placas</span>
          </button>

          <button
            type="button"
            className="admin-card"
            onClick={() => onAbrirTela("operadores")}
          >
            <Users size={42} />
            <strong>Operadores</strong>
            <span>Cadastrar nomes e PINs</span>
          </button>
        </div>
      </section>
    </main>
  );
}

export default AdminPage;
