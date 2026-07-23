import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Edit3,
  FolderPlus,
  Layers3,
  MapPinned,
  Plus,
  Power,
  Trash2,
  X,
} from "lucide-react";
import "./AreasPage.css";
import {
  excluirAreaSincronizada,
  excluirGrupoSincronizado,
} from "../../services/cadastrosService";

type Area = {
  id: string;
  nome: string;
  grupoId: string;
  ativa: boolean;
};

type GrupoArea = {
  id: string;
  nome: string;
};

type AreasPageProps = {
  onVoltar: () => void;
};

type ModalAberto = "area" | "grupo" | null;

const AREAS_STORAGE_KEY = "crivo_colheitas_areas";
const GRUPOS_STORAGE_KEY = "crivo_colheitas_grupos";

function gerarId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function carregarAreas(): Area[] {
  const dados = localStorage.getItem(AREAS_STORAGE_KEY);

  if (!dados) return [];

  try {
    const areasSalvas = JSON.parse(dados) as Partial<Area>[];

    /*
      Esta conversão mantém funcionando as áreas que você
      já tinha cadastrado antes de existir o recurso de grupos.
    */
    return areasSalvas
      .filter((area) => area.id && area.nome)
      .map((area) => ({
        id: area.id as string,
        nome: area.nome as string,
        grupoId: area.grupoId ?? "",
        ativa: area.ativa ?? true,
      }));
  } catch {
    localStorage.removeItem(AREAS_STORAGE_KEY);
    return [];
  }
}

function carregarGrupos(): GrupoArea[] {
  const dados = localStorage.getItem(GRUPOS_STORAGE_KEY);

  if (!dados) return [];

  try {
    return JSON.parse(dados) as GrupoArea[];
  } catch {
    localStorage.removeItem(GRUPOS_STORAGE_KEY);
    return [];
  }
}

function AreasPage({ onVoltar }: AreasPageProps) {
  const [areas, setAreas] = useState<Area[]>(carregarAreas);
  const [grupos, setGrupos] = useState<GrupoArea[]>(carregarGrupos);

  const [modalAberto, setModalAberto] = useState<ModalAberto>(null);

  const [nomeArea, setNomeArea] = useState("");
  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState("");
  const [areaEditandoId, setAreaEditandoId] = useState<string | null>(null);

  const [nomeGrupo, setNomeGrupo] = useState("");
  const [grupoEditandoId, setGrupoEditandoId] = useState<string | null>(null);

  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    localStorage.setItem(AREAS_STORAGE_KEY, JSON.stringify(areas));
  }, [areas]);

  useEffect(() => {
    localStorage.setItem(GRUPOS_STORAGE_KEY, JSON.stringify(grupos));
  }, [grupos]);

  const gruposOrdenados = useMemo(() => {
    return [...grupos].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR"),
    );
  }, [grupos]);

  const areasSemGrupo = useMemo(() => {
    return areas
      .filter((area) => !area.grupoId)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [areas]);

  function areasDoGrupo(grupoId: string) {
    return areas
      .filter((area) => area.grupoId === grupoId)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  function fecharModal() {
    setModalAberto(null);

    setNomeArea("");
    setGrupoSelecionadoId("");
    setAreaEditandoId(null);

    setNomeGrupo("");
    setGrupoEditandoId(null);

    setMensagem("");
  }

  function abrirNovaArea(grupoId = "") {
    setNomeArea("");
    setGrupoSelecionadoId(grupoId);
    setAreaEditandoId(null);
    setMensagem("");
    setModalAberto("area");
  }

  function abrirEdicaoArea(area: Area) {
    setNomeArea(area.nome);
    setGrupoSelecionadoId(area.grupoId);
    setAreaEditandoId(area.id);
    setMensagem("");
    setModalAberto("area");
  }

  function abrirNovoGrupo() {
    setNomeGrupo("");
    setGrupoEditandoId(null);
    setMensagem("");
    setModalAberto("grupo");
  }

  function abrirEdicaoGrupo(grupo: GrupoArea) {
    setNomeGrupo(grupo.nome);
    setGrupoEditandoId(grupo.id);
    setMensagem("");
    setModalAberto("grupo");
  }

  function salvarArea() {
    const nomeTratado = nomeArea.trim();

    if (!nomeTratado) {
      setMensagem("Digite o nome da área.");
      return;
    }

    const areaJaExiste = areas.some(
      (area) =>
        area.nome.toLocaleLowerCase("pt-BR") ===
          nomeTratado.toLocaleLowerCase("pt-BR") &&
        area.id !== areaEditandoId,
    );

    if (areaJaExiste) {
      setMensagem("Já existe uma área com esse nome.");
      return;
    }

    if (areaEditandoId) {
      setAreas((areasAtuais) =>
        areasAtuais.map((area) =>
          area.id === areaEditandoId
            ? {
                ...area,
                nome: nomeTratado,
                grupoId: grupoSelecionadoId,
              }
            : area,
        ),
      );
    } else {
      const novaArea: Area = {
        id: gerarId(),
        nome: nomeTratado,
        grupoId: grupoSelecionadoId,
        ativa: true,
      };

      setAreas((areasAtuais) => [...areasAtuais, novaArea]);
    }

    fecharModal();
  }

  function salvarGrupo() {
    const nomeTratado = nomeGrupo.trim();

    if (!nomeTratado) {
      setMensagem("Digite o nome do grupo.");
      return;
    }

    const grupoJaExiste = grupos.some(
      (grupo) =>
        grupo.nome.toLocaleLowerCase("pt-BR") ===
          nomeTratado.toLocaleLowerCase("pt-BR") &&
        grupo.id !== grupoEditandoId,
    );

    if (grupoJaExiste) {
      setMensagem("Já existe um grupo com esse nome.");
      return;
    }

    if (grupoEditandoId) {
      setGrupos((gruposAtuais) =>
        gruposAtuais.map((grupo) =>
          grupo.id === grupoEditandoId
            ? {
                ...grupo,
                nome: nomeTratado,
              }
            : grupo,
        ),
      );
    } else {
      const novoGrupo: GrupoArea = {
        id: gerarId(),
        nome: nomeTratado,
      };

      setGrupos((gruposAtuais) => [...gruposAtuais, novoGrupo]);
    }

    fecharModal();
  }

  function alternarStatusArea(areaId: string) {
    setAreas((areasAtuais) =>
      areasAtuais.map((area) =>
        area.id === areaId
          ? {
              ...area,
              ativa: !area.ativa,
            }
          : area,
      ),
    );
  }

  async function excluirArea(area: Area) {
    const confirmou = window.confirm(
      `Deseja realmente excluir a área "${area.nome}"?`,
    );

    if (!confirmou) return;

    try {
      await excluirAreaSincronizada(area.id);

      setAreas((areasAtuais) =>
        areasAtuais.filter((item) => item.id !== area.id),
      );
    } catch (erro) {
      console.error(erro);
      window.alert(
        erro instanceof Error
          ? erro.message
          : "Não foi possível excluir a área.",
      );
    }
  }

  async function excluirGrupo(grupo: GrupoArea) {
    const quantidadeAreas = areas.filter(
      (area) => area.grupoId === grupo.id,
    ).length;

    const textoAreas =
      quantidadeAreas > 0
        ? `\n\nAs ${quantidadeAreas} área${
            quantidadeAreas > 1 ? "s" : ""
          } desse grupo não serão excluídas. Elas ficarão em "Sem grupo".`
        : "";

    const confirmou = window.confirm(
      `Deseja realmente excluir o grupo "${grupo.nome}"?${textoAreas}`,
    );

    if (!confirmou) return;

    try {
      await excluirGrupoSincronizado(grupo.id);

      /*
       * Depois que o banco confirma a exclusão,
       * as áreas do grupo ficam em "Sem grupo" também no aparelho.
       */
      setAreas((areasAtuais) =>
        areasAtuais.map((area) =>
          area.grupoId === grupo.id
            ? {
                ...area,
                grupoId: "",
              }
            : area,
        ),
      );

      setGrupos((gruposAtuais) =>
        gruposAtuais.filter((item) => item.id !== grupo.id),
      );
    } catch (erro) {
      console.error(erro);
      window.alert(
        erro instanceof Error
          ? erro.message
          : "Não foi possível excluir o grupo.",
      );
    }
  }

  function renderizarArea(area: Area) {
    return (
      <article
        key={area.id}
        className={area.ativa ? "area-card" : "area-card inactive"}
      >
        <div className="area-card-info">
          <span
            className={
              area.ativa ? "status-badge active" : "status-badge inactive"
            }
          >
            {area.ativa ? "Ativa" : "Inativa"}
          </span>

          <h3>{area.nome}</h3>
        </div>

        <div className="area-card-actions">
          <button
            type="button"
            className="icon-action"
            onClick={() => abrirEdicaoArea(area)}
            aria-label={`Editar ${area.nome}`}
            title="Editar área"
          >
            <Edit3 size={19} />
          </button>

          <button
            type="button"
            className="icon-action"
            onClick={() => alternarStatusArea(area.id)}
            aria-label={
              area.ativa
                ? `Desativar ${area.nome}`
                : `Ativar ${area.nome}`
            }
            title={area.ativa ? "Desativar área" : "Ativar área"}
          >
            <Power size={19} />
          </button>

          <button
            type="button"
            className="icon-action danger"
            onClick={() => excluirArea(area)}
            aria-label={`Excluir ${area.nome}`}
            title="Excluir área"
          >
            <Trash2 size={19} />
          </button>
        </div>
      </article>
    );
  }

  return (
    <main className="module-page">
      <header className="module-header">
        <button type="button" className="back-button" onClick={onVoltar}>
          <ArrowLeft size={23} />
          Voltar
        </button>

        <div className="module-title">
          <MapPinned size={29} />
          <h1>Áreas</h1>
        </div>
      </header>

      <section className="module-content areas-content">
        <div className="areas-topbar">
          <div>
            <h2>Áreas e grupos</h2>

            <p>
              {areas.length} área{areas.length !== 1 ? "s" : ""} em{" "}
              {grupos.length} grupo{grupos.length !== 1 ? "s" : ""}.
            </p>
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={abrirNovoGrupo}
            >
              <FolderPlus size={21} />
              Novo grupo
            </button>

            <button
              type="button"
              className="primary-action"
              onClick={() => abrirNovaArea()}
            >
              <Plus size={21} />
              Nova área
            </button>
          </div>
        </div>

        {grupos.length === 0 && areas.length === 0 ? (
          <div className="empty-state">
            <Layers3 size={48} />

            <h2>Nenhuma área cadastrada</h2>

            <p>
              Primeiro crie um grupo e depois cadastre as áreas dentro dele.
            </p>

            <div className="empty-state-actions">
              <button
                type="button"
                className="secondary-action"
                onClick={abrirNovoGrupo}
              >
                <FolderPlus size={21} />
                Criar primeiro grupo
              </button>

              <button
                type="button"
                className="primary-action"
                onClick={() => abrirNovaArea()}
              >
                <Plus size={21} />
                Criar área sem grupo
              </button>
            </div>
          </div>
        ) : (
          <div className="groups-list">
            {gruposOrdenados.map((grupo) => {
              const areasGrupo = areasDoGrupo(grupo.id);

              return (
                <section className="group-card" key={grupo.id}>
                  <header className="group-header">
                    <div className="group-title">
                      <div className="group-icon">
                        <Layers3 size={23} />
                      </div>

                      <div>
                        <h2>{grupo.nome}</h2>

                        <p>
                          {areasGrupo.length} área
                          {areasGrupo.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>

                    <div className="group-actions">
                      <button
                        type="button"
                        className="group-add-button"
                        onClick={() => abrirNovaArea(grupo.id)}
                      >
                        <Plus size={18} />
                        Adicionar área
                      </button>

                      <button
                        type="button"
                        className="icon-action"
                        onClick={() => abrirEdicaoGrupo(grupo)}
                        aria-label={`Editar grupo ${grupo.nome}`}
                        title="Editar grupo"
                      >
                        <Edit3 size={19} />
                      </button>

                      <button
                        type="button"
                        className="icon-action danger"
                        onClick={() => excluirGrupo(grupo)}
                        aria-label={`Excluir grupo ${grupo.nome}`}
                        title="Excluir grupo"
                      >
                        <Trash2 size={19} />
                      </button>
                    </div>
                  </header>

                  {areasGrupo.length === 0 ? (
                    <button
                      type="button"
                      className="empty-group"
                      onClick={() => abrirNovaArea(grupo.id)}
                    >
                      <Plus size={21} />
                      Esse grupo ainda não possui áreas. Clique para adicionar.
                    </button>
                  ) : (
                    <div className="areas-grid">
                      {areasGrupo.map(renderizarArea)}
                    </div>
                  )}
                </section>
              );
            })}

            {areasSemGrupo.length > 0 && (
              <section className="group-card ungrouped">
                <header className="group-header">
                  <div className="group-title">
                    <div className="group-icon">
                      <MapPinned size={23} />
                    </div>

                    <div>
                      <h2>Sem grupo</h2>

                      <p>
                        {areasSemGrupo.length} área
                        {areasSemGrupo.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="group-add-button"
                    onClick={() => abrirNovaArea()}
                  >
                    <Plus size={18} />
                    Adicionar área
                  </button>
                </header>

                <div className="areas-grid">
                  {areasSemGrupo.map(renderizarArea)}
                </div>
              </section>
            )}
          </div>
        )}
      </section>

      {modalAberto === "area" && (
        <div className="modal-overlay" role="presentation">
          <section
            className="area-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="area-modal-title"
          >
            <div className="area-modal-header">
              <div>
                <p>{areaEditandoId ? "Editar cadastro" : "Novo cadastro"}</p>

                <h2 id="area-modal-title">
                  {areaEditandoId ? "Editar área" : "Nova área"}
                </h2>
              </div>

              <button
                type="button"
                className="close-modal-button"
                onClick={fecharModal}
                aria-label="Fechar"
              >
                <X size={24} />
              </button>
            </div>

            <div className="form-field">
              <label className="field-label" htmlFor="nome-area">
                Nome da área
              </label>

              <input
                id="nome-area"
                className="area-input"
                type="text"
                value={nomeArea}
                onChange={(event) => {
                  setNomeArea(event.target.value);
                  setMensagem("");
                }}
                placeholder="Ex.: Baixada 1"
                autoFocus
                maxLength={60}
              />
            </div>

            <div className="form-field">
              <label className="field-label" htmlFor="grupo-area">
                Grupo da área
              </label>

              <select
                id="grupo-area"
                className="area-input area-select"
                value={grupoSelecionadoId}
                onChange={(event) => {
                  setGrupoSelecionadoId(event.target.value);
                  setMensagem("");
                }}
              >
                <option value="">Sem grupo</option>

                {gruposOrdenados.map((grupo) => (
                  <option key={grupo.id} value={grupo.id}>
                    {grupo.nome}
                  </option>
                ))}
              </select>

              {grupos.length === 0 && (
                <p className="field-help">
                  Nenhum grupo cadastrado. A área será salva em “Sem grupo”.
                </p>
              )}
            </div>

            {mensagem && <p className="form-message">{mensagem}</p>}

            <div className="modal-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={fecharModal}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="save-button"
                onClick={salvarArea}
              >
                <Check size={21} />
                Salvar área
              </button>
            </div>
          </section>
        </div>
      )}

      {modalAberto === "grupo" && (
        <div className="modal-overlay" role="presentation">
          <section
            className="area-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="grupo-modal-title"
          >
            <div className="area-modal-header">
              <div>
                <p>{grupoEditandoId ? "Editar cadastro" : "Novo cadastro"}</p>

                <h2 id="grupo-modal-title">
                  {grupoEditandoId ? "Editar grupo" : "Novo grupo"}
                </h2>
              </div>

              <button
                type="button"
                className="close-modal-button"
                onClick={fecharModal}
                aria-label="Fechar"
              >
                <X size={24} />
              </button>
            </div>

            <div className="form-field">
              <label className="field-label" htmlFor="nome-grupo">
                Nome do grupo
              </label>

              <input
                id="nome-grupo"
                className="area-input"
                type="text"
                value={nomeGrupo}
                onChange={(event) => {
                  setNomeGrupo(event.target.value);
                  setMensagem("");
                }}
                placeholder="Ex.: Mingu"
                autoFocus
                maxLength={60}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    salvarGrupo();
                  }
                }}
              />

              <p className="field-help">
                Exemplo: o grupo “Mingu” pode conter Boa Vista, Pedrinho e
                Francelina.
              </p>
            </div>

            {mensagem && <p className="form-message">{mensagem}</p>}

            <div className="modal-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={fecharModal}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="save-button"
                onClick={salvarGrupo}
              >
                <Check size={21} />
                Salvar grupo
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default AreasPage;