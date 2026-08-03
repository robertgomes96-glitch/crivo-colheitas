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
import { obterDeviceId } from "./services/deviceService";
import { marcarEsteAparelhoInativo } from "./services/statusOperadoresService";

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

function App() {
  const [sessao, setSessao] = useState<Sessao | null>(carregarSessao);
  const [telaAdmin, setTelaAdmin] = useState<AdminTela>("dashboard");
  const [versaoCadastros, setVersaoCadastros] = useState(0);

  useEffect(() => {
    /*
     * Garante que cada navegador/tablet tenha uma identidade própria.
     */
    obterDeviceId();

    const atualizarCadastros = () =>
      setVersaoCadastros((atual) => atual + 1);

    window.addEventListener(
      "crivo:cadastros-sincronizados",
      atualizarCadastros,
    );

    const parar = iniciarSincronizacaoAutomatica((erro) => {
      console.warn(
        "Sincronização indisponível. Os dados continuam salvos localmente.",
        erro,
      );
    });

    return () => {
      parar();

      window.removeEventListener(
        "crivo:cadastros-sincronizados",
        atualizarCadastros,
      );
    };
  }, []);

  function entrarComoAdmin() {
    const novaSessao: Sessao = {
      tipo: "admin",
      nome: "Escritório",
      cargo: "escritorio",
    };

    localStorage.setItem(SESSAO_KEY, JSON.stringify(novaSessao));
    setSessao(novaSessao);
    setTelaAdmin("dashboard");
  }

  function entrarComoOperador(nome: string, cargo: CargoOperador) {
    const novaSessao: Sessao = {
      tipo: "operador",
      nome,
      cargo,
    };

    localStorage.setItem(SESSAO_KEY, JSON.stringify(novaSessao));
    setSessao(novaSessao);
  }

  function sair() {
    if (sessao?.tipo === "operador") {
      void marcarEsteAparelhoInativo().catch((erro) =>
        console.warn("Não foi possível marcar o operador como inativo.", erro),
      );
    }

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
        key={`login-${versaoCadastros}`}
        onLoginAdmin={entrarComoAdmin}
        onLoginOperador={entrarComoOperador}
      />
    );
  }

  let paginaAtual;

  if (sessao.tipo === "admin") {
    if (telaAdmin === "operacao") {
      /*
       * Sem key variável: uma sincronização não desmonta a operação.
       */
      paginaAtual = <OperacaoPage onVoltar={voltarDashboard} />;
    } else if (telaAdmin === "areas") {
      paginaAtual = (
        <AreasPage
          key={`areas-${versaoCadastros}`}
          onVoltar={voltarDashboard}
        />
      );
    } else if (telaAdmin === "placas") {
      paginaAtual = (
        <PlacasPage
          key={`placas-${versaoCadastros}`}
          onVoltar={voltarDashboard}
        />
      );
    } else if (telaAdmin === "operadores") {
      paginaAtual = (
        <OperadoresPage
          key={`operadores-${versaoCadastros}`}
          onVoltar={voltarDashboard}
        />
      );
    } else if (telaAdmin === "relatorios") {
      paginaAtual = <RelatoriosPage onVoltar={voltarDashboard} />;
    } else if (telaAdmin === "carregamentos") {
      paginaAtual = <CarregamentosPage onVoltar={voltarDashboard} />;
    } else {
      paginaAtual = (
        <AdminPage
          onSair={sair}
          onAbrirTela={setTelaAdmin}
        />
      );
    }
  } else {
    /*
     * A tela do operador nunca é remontada por uma sincronização.
     */
    paginaAtual = <OperacaoPage onVoltar={sair} />;
  }

  return (
    <>
      <StatusSincronizacao />
      {paginaAtual}
    </>
  );
}

export default App;
