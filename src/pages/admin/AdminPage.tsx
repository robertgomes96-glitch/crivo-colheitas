import {
  ClipboardList,
  MapPinned,
  Tractor,
  Users,
  LogOut,
  Wheat,
  RadioTower,
  ListChecks,
} from "lucide-react";
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

function AdminPage({ onSair, onAbrirTela }: AdminPageProps) {
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
        <div className="admin-title">
          <h2>Painel do escritório</h2>
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
