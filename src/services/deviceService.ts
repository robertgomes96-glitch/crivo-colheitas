import { v4 as uuidv4 } from "uuid";

const DEVICE_ID_KEY = "crivo_colheitas_device_id";
const DEVICE_NAME_KEY = "crivo_colheitas_device_name";

export function obterDeviceId(): string {
  const existente = localStorage.getItem(DEVICE_ID_KEY);

  if (existente) return existente;

  const novo = uuidv4();
  localStorage.setItem(DEVICE_ID_KEY, novo);
  return novo;
}

export function obterNomeDispositivo(): string {
  const existente = localStorage.getItem(DEVICE_NAME_KEY);
  if (existente) return existente;

  const nomePadrao = `Aparelho ${obterDeviceId().slice(0, 6).toUpperCase()}`;
  localStorage.setItem(DEVICE_NAME_KEY, nomePadrao);
  return nomePadrao;
}

export function definirNomeDispositivo(nome: string): void {
  const normalizado = nome.trim();

  if (!normalizado) {
    localStorage.removeItem(DEVICE_NAME_KEY);
    return;
  }

  localStorage.setItem(DEVICE_NAME_KEY, normalizado);
}
