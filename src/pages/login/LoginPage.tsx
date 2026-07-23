import { useMemo, useState } from "react";
import { Delete, UserRound, Wheat } from "lucide-react";
import "./LoginPage.css";

const ADMIN_PIN = "2510";
const OPERADORES_KEY = "crivo_colheitas_operadores";

type CargoOperador =
  | "operador"
  | "encarregado"
  | "escritorio"
  | "gerente";

type Operador = {
  id: string;
  nome: string;
  pin: string;
  cargo?: CargoOperador;
  ativo: boolean;
};

type LoginPageProps = {
  onLoginAdmin: () => void;
  onLoginOperador: (nome: string, cargo: CargoOperador) => void;
};

const NOMES_CARGOS: Record<CargoOperador, string> = {
  operador: "Operador",
  encarregado: "Encarregado",
  escritorio: "Escritório",
  gerente: "Gerente",
};

function carregarOperadores(): Operador[] {
  const salvo = localStorage.getItem(OPERADORES_KEY);

  if (!salvo) return [];

  try {
    const convertido = JSON.parse(salvo) as unknown;

    if (!Array.isArray(convertido)) return [];

    return convertido.filter((item): item is Operador => {
      if (typeof item !== "object" || item === null) return false;

      const operador = item as Partial<Operador>;

      return (
        typeof operador.id === "string" &&
        typeof operador.nome === "string" &&
        typeof operador.pin === "string" &&
        typeof operador.ativo === "boolean"
      );
    });
  } catch {
    return [];
  }
}

function LoginPage({
  onLoginAdmin,
  onLoginOperador,
}: LoginPageProps) {
  const [pin, setPin] = useState("");
  const [mensagem, setMensagem] = useState("");

  const operadorReconhecido = useMemo(() => {
    if (pin.length !== 4 || pin === ADMIN_PIN) return null;

    return (
      carregarOperadores().find(
        (operador) => operador.pin === pin && operador.ativo,
      ) ?? null
    );
  }, [pin]);

  function adicionarNumero(numero: string) {
    if (pin.length >= 4) return;

    setPin((pinAtual) => pinAtual + numero);
    setMensagem("");
  }

  function apagarNumero() {
    setPin((pinAtual) => pinAtual.slice(0, -1));
    setMensagem("");
  }

  function entrar() {
    if (pin.length !== 4) {
      setMensagem("Digite os 4 números do PIN.");
      return;
    }

    if (pin === ADMIN_PIN) {
      onLoginAdmin();
      return;
    }

    const operador = carregarOperadores().find(
      (item) => item.pin === pin,
    );

    if (!operador) {
      setMensagem("PIN inválido.");
      setPin("");
      return;
    }

    if (!operador.ativo) {
      setMensagem("Este acesso está desativado.");
      setPin("");
      return;
    }

    onLoginOperador(
      operador.nome,
      operador.cargo ?? "operador",
    );
  }

  const numeros = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-logo">
          <Wheat size={42} strokeWidth={2.2} />
        </div>

        <h1>Crivo Colheitas</h1>
        <p className="login-subtitle">Digite seu PIN para entrar</p>

        <div className="pin-dots">
          {[0, 1, 2, 3].map((posicao) => (
            <span
              key={posicao}
              className={posicao < pin.length ? "pin-dot filled" : "pin-dot"}
            />
          ))}
        </div>

        <div className="login-identificacao">
          {pin === ADMIN_PIN ? (
            <>
              <UserRound size={21} />
              <div>
                <strong>Escritório</strong>
                <span>Administrador</span>
              </div>
            </>
          ) : operadorReconhecido ? (
            <>
              <UserRound size={21} />
              <div>
                <strong>{operadorReconhecido.nome}</strong>
                <span>
                  {NOMES_CARGOS[
                    operadorReconhecido.cargo ?? "operador"
                  ]}
                </span>
              </div>
            </>
          ) : (
            <span className="login-identificacao-vazia">
              Digite o PIN completo
            </span>
          )}
        </div>

        <div className="numeric-keyboard">
          {numeros.map((numero) => (
            <button
              type="button"
              key={numero}
              className="number-button"
              onClick={() => adicionarNumero(numero)}
            >
              {numero}
            </button>
          ))}

          <button
            type="button"
            className="number-button delete-button"
            onClick={apagarNumero}
            aria-label="Apagar último número"
          >
            <Delete size={28} />
          </button>

          <button
            type="button"
            className="number-button"
            onClick={() => adicionarNumero("0")}
          >
            0
          </button>

          <button
            type="button"
            className="enter-button"
            onClick={entrar}
            disabled={pin.length !== 4}
          >
            Entrar
          </button>
        </div>

        {mensagem && <p className="login-message">{mensagem}</p>}
      </section>
    </main>
  );
}

export default LoginPage;
