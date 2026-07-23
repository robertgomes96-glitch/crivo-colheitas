import { useEffect, useState } from "react";
import LoginPage from "./pages/login/LoginPage";
import AdminPage, { type AdminTela } from "./pages/admin/AdminPage";
import AreasPage from "./pages/areas/AreasPage";
import PlacasPage from "./pages/placas/PlacasPage";
import OperadoresPage from "./pages/operadores/Operadores";
import RelatoriosPage from "./pages/relatorios/RelatoriosPage";
import OperacaoPage from "./pages/operacao/OperacaoPage";
import CarregamentosPage from "./pages/carregamentos/CarregamentosPage";
import StatusSincronizacao from "./components/StatusSincronizacao/StatusSincronizacao";
import { iniciarSincronizacaoAutomatica } from "./services/supabaseSync";

type CargoOperador =
  | "operador"
  | "encarregado"
  | "escritorio"
  | "gerente";

type Sessao = {
  tipo: "admin" | "operador";
  nome: string;
  cargo?: CargoOperador;
};

const SESSAO_KEY = "crivo_colheitas_sessao";

function carregarSessao(): Sessao | null {
  const sessaoSalva = localStorage.getItem(SESSAO_KEY);
  if (!sessaoSalva) return null;

  try {
    return JSON.parse(sessaoSalva) as Sessao;
  } catch {
    localStorage.removeItem(SESSAO_KEY);
    return null;
  }
}

function mensagemDoErro(erro: unknown): string {
  if (erro instanceof Error) {
    return erro.message;
  }

  if (
    typeof erro === "object" &&
    erro !== null &&
    "message" in erro
  ) {
    const mensagem = (erro as { message?: unknown }).message;

    if (mensagem) {
      return String(mensagem);
    }
  }

  try {
    return JSON.stringify(erro);
  } catch {
    return String(erro);
  }
}

function App() {
  const [sessao, setSessao] = useState<Sessao | null>(carregarSessao);
  const [telaAdmin, setTelaAdmin] = useState<AdminTela>("dashboard");
  const [versaoDados, setVersaoDados] = useState(0);

  useEffect(() => {
    const atualizarTelas = () =>
      setVersaoDados((atual) => atual + 1);

    window.addEventListener(
      "crivo:supabase-sincronizado",
      atualizarTelas,
    );

    const parar = iniciarSincronizacaoAutomatica((erro) => {
      const mensagem = mensagemDoErro(erro);

      console.error(
        "Falha ao sincronizar com o Supabase:",
        erro,
      );

      window.alert(
        `Erro de sincronização:\n\n${mensagem}`,
      );
    });

    return () => {
      parar();

      window.removeEventListener(
        "crivo:supabase-sincronizado",
        atualizarTelas,
      );
    };
  }, []);

  function entrarComoAdmin() {
    const novaSessao: Sessao = {
      tipo: "admin",
      nome: "Escritório",
      cargo: "escritorio",
    };

    localStorage.setItem(
      SESSAO_KEY,
      JSON.stringify(novaSessao),
    );

    setSessao(novaSessao);
    setTelaAdmin("dashboard");
  }

  function entrarComoOperador(
    nome: string,
    cargo: CargoOperador,
  ) {
    const novaSessao: Sessao = {
      tipo: "operador",
      nome,
      cargo,
    };

    localStorage.setItem(
      SESSAO_KEY,
      JSON.stringify(novaSessao),
    );

    setSessao(novaSessao);
  }

  function sair() {
    localStorage.removeItem(SESSAO_KEY);
    setSessao(null);
    setTelaAdmin("dashboard");
  }

  function voltarDashboard() {
    setTelaAdmin("dashboard");
  }

  if (!sessao) {
    return (
      <LoginPage
        key={`login-${versaoDados}`}
        onLoginAdmin={entrarComoAdmin}
        onLoginOperador={entrarComoOperador}
      />
    );
  }

  let paginaAtual;

  if (sessao.tipo === "admin") {
    if (telaAdmin === "operacao") {
      paginaAtual = (
        <OperacaoPage
          key={`operacao-admin-${versaoDados}`}
          onVoltar={voltarDashboard}
        />
      );
    } else if (telaAdmin === "areas") {
      paginaAtual = (
        <AreasPage
          key={`areas-${versaoDados}`}
          onVoltar={voltarDashboard}
        />
      );
    } else if (telaAdmin === "placas") {
      paginaAtual = (
        <PlacasPage
          key={`placas-${versaoDados}`}
          onVoltar={voltarDashboard}
        />
      );
    } else if (telaAdmin === "operadores") {
      paginaAtual = (
        <OperadoresPage
          key={`operadores-${versaoDados}`}
          onVoltar={voltarDashboard}
        />
      );
    } else if (telaAdmin === "relatorios") {
      paginaAtual = (
        <RelatoriosPage
          key={`relatorios-${versaoDados}`}
          onVoltar={voltarDashboard}
        />
      );
    } else if (telaAdmin === "carregamentos") {
      paginaAtual = (
        <CarregamentosPage
          onVoltar={voltarDashboard}
        />
      );
    } else {
      paginaAtual = (
        <AdminPage
          key={`admin-${versaoDados}`}
          onSair={sair}
          onAbrirTela={setTelaAdmin}
        />
      );
    }
  } else {
    paginaAtual = (
      <OperacaoPage
        key={`operacao-${versaoDados}`}
        onVoltar={sair}
      />
    );
  }

  return (
    <>
      <StatusSincronizacao />
      {paginaAtual}
    </>
  );
}

export default App;