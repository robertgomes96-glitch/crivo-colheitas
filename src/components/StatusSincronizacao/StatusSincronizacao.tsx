import {
  useEffect,
  useState,
} from "react";
import "./StatusSincronizacao.css";

const HYDRATED_KEY =
  "crivo_colheitas_supabase_hidratado";

type EstadoSincronizacao =
  | "sincronizando"
  | "sucesso"
  | "erro";

type DetalhesSincronizacao = {
  status: EstadoSincronizacao;
  mensagem?: string;
  data?: string;
};

function formatarData(
  valor: string | null,
) {
  if (!valor) {
    return "Ainda não sincronizado";
  }

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return "Horário indisponível";
  }

  return data.toLocaleString(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    },
  );
}

export default function StatusSincronizacao() {
  const [online, setOnline] =
    useState(navigator.onLine);

  const [
    estadoSincronizacao,
    setEstadoSincronizacao,
  ] = useState<EstadoSincronizacao>(
    "sucesso",
  );

  const [
    ultimaSincronizacao,
    setUltimaSincronizacao,
  ] = useState<string | null>(
    localStorage.getItem(
      HYDRATED_KEY,
    ),
  );

  useEffect(() => {
    const ficouOnline = () => {
      setOnline(true);
      setEstadoSincronizacao(
        "sincronizando",
      );
    };

    const ficouOffline = () => {
      setOnline(false);
    };

    const receberStatus = (
      evento: Event,
    ) => {
      const eventoPersonalizado =
        evento as CustomEvent<DetalhesSincronizacao>;

      const detalhes =
        eventoPersonalizado.detail;

      if (!detalhes) return;

      setEstadoSincronizacao(
        detalhes.status,
      );

      if (detalhes.data) {
        setUltimaSincronizacao(
          detalhes.data,
        );
      } else {
        setUltimaSincronizacao(
          localStorage.getItem(
            HYDRATED_KEY,
          ),
        );
      }
    };

    window.addEventListener(
      "online",
      ficouOnline,
    );

    window.addEventListener(
      "offline",
      ficouOffline,
    );

    window.addEventListener(
      "crivo:sync-status",
      receberStatus,
    );

    return () => {
      window.removeEventListener(
        "online",
        ficouOnline,
      );

      window.removeEventListener(
        "offline",
        ficouOffline,
      );

      window.removeEventListener(
        "crivo:sync-status",
        receberStatus,
      );
    };
  }, []);

  let titulo = "Tudo sincronizado";
  let classeEstado = "online";

  if (!online) {
    titulo = "Sem internet";
    classeEstado = "offline";
  } else if (
    estadoSincronizacao ===
    "sincronizando"
  ) {
    titulo = "Sincronizando...";
    classeEstado = "sincronizando";
  } else if (
    estadoSincronizacao === "erro"
  ) {
    titulo = "Erro ao sincronizar";
    classeEstado = "erro";
  }

  return (
    <div
      className={`status-sync ${classeEstado}`}
    >
      <strong>
        {estadoSincronizacao ===
          "sincronizando" &&
          online && (
            <span
              className="status-sync-spinner"
              aria-hidden="true"
            />
          )}

        {titulo}
      </strong>

      <span>
        Última sincronização:{" "}
        {formatarData(
          ultimaSincronizacao,
        )}
      </span>
    </div>
  );
}