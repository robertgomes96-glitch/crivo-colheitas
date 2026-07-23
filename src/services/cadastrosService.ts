import { supabase, supabaseConfigurado } from "../lib/supabase";

async function exigirSupabase() {
  if (!supabaseConfigurado || !supabase) {
    throw new Error("Supabase não está configurado.");
  }

  if (!navigator.onLine) {
    throw new Error(
      "Sem internet. Conecte o aparelho para excluir sem o cadastro voltar na sincronização.",
    );
  }

  return supabase;
}

export async function excluirAreaSincronizada(areaId: string) {
  const cliente = await exigirSupabase();

  const { error } = await cliente
    .from("areas")
    .delete()
    .eq("id", areaId);

  if (error) throw error;
}

export async function excluirGrupoSincronizado(grupoId: string) {
  const cliente = await exigirSupabase();

  /*
   * Primeiro solta as áreas do grupo no banco.
   * Isso evita erro de chave estrangeira ao excluir o grupo.
   */
  const { error: erroAreas } = await cliente
    .from("areas")
    .update({ grupo_id: null })
    .eq("grupo_id", grupoId);

  if (erroAreas) throw erroAreas;

  const { error: erroGrupo } = await cliente
    .from("grupos")
    .delete()
    .eq("id", grupoId);

  if (erroGrupo) throw erroGrupo;
}

export async function excluirPlacaSincronizada(placaId: string) {
  const cliente = await exigirSupabase();

  const { error } = await cliente
    .from("placas")
    .delete()
    .eq("id", placaId);

  if (error) throw error;
}

export async function excluirOperadorSincronizado(operadorId: string) {
  const cliente = await exigirSupabase();

  const { error } = await cliente
    .from("operadores")
    .delete()
    .eq("id", operadorId);

  if (error) throw error;
}