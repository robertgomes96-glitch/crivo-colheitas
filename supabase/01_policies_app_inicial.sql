-- Fase inicial do Crivo Colheitas.
-- Garante compatibilidade com a estrutura usada pelo aplicativo nesta primeira fase.
alter table public.operadores add column if not exists pin text;
alter table public.operadores add column if not exists cargo text not null default 'operador';
alter table public.operadores alter column pin drop not null;

-- Permite ao frontend usar a chave anon com RLS habilitado.
-- Depois que o app estiver estável, vamos restringir por cargo e RPC.

alter table public.grupos enable row level security;
alter table public.areas enable row level security;
alter table public.placas enable row level security;
alter table public.operadores enable row level security;
alter table public.carregamentos enable row level security;

-- Remove policies antigas com os mesmos nomes para permitir reexecução.
drop policy if exists "app_grupos_select" on public.grupos;
drop policy if exists "app_grupos_insert" on public.grupos;
drop policy if exists "app_grupos_update" on public.grupos;
drop policy if exists "app_grupos_delete" on public.grupos;
create policy "app_grupos_select" on public.grupos for select to anon, authenticated using (true);
create policy "app_grupos_insert" on public.grupos for insert to anon, authenticated with check (true);
create policy "app_grupos_update" on public.grupos for update to anon, authenticated using (true) with check (true);
create policy "app_grupos_delete" on public.grupos for delete to anon, authenticated using (true);

drop policy if exists "app_areas_select" on public.areas;
drop policy if exists "app_areas_insert" on public.areas;
drop policy if exists "app_areas_update" on public.areas;
drop policy if exists "app_areas_delete" on public.areas;
create policy "app_areas_select" on public.areas for select to anon, authenticated using (true);
create policy "app_areas_insert" on public.areas for insert to anon, authenticated with check (true);
create policy "app_areas_update" on public.areas for update to anon, authenticated using (true) with check (true);
create policy "app_areas_delete" on public.areas for delete to anon, authenticated using (true);

drop policy if exists "app_placas_select" on public.placas;
drop policy if exists "app_placas_insert" on public.placas;
drop policy if exists "app_placas_update" on public.placas;
drop policy if exists "app_placas_delete" on public.placas;
create policy "app_placas_select" on public.placas for select to anon, authenticated using (true);
create policy "app_placas_insert" on public.placas for insert to anon, authenticated with check (true);
create policy "app_placas_update" on public.placas for update to anon, authenticated using (true) with check (true);
create policy "app_placas_delete" on public.placas for delete to anon, authenticated using (true);

drop policy if exists "app_operadores_select" on public.operadores;
drop policy if exists "app_operadores_insert" on public.operadores;
drop policy if exists "app_operadores_update" on public.operadores;
drop policy if exists "app_operadores_delete" on public.operadores;
create policy "app_operadores_select" on public.operadores for select to anon, authenticated using (true);
create policy "app_operadores_insert" on public.operadores for insert to anon, authenticated with check (true);
create policy "app_operadores_update" on public.operadores for update to anon, authenticated using (true) with check (true);
create policy "app_operadores_delete" on public.operadores for delete to anon, authenticated using (true);

drop policy if exists "app_carregamentos_select" on public.carregamentos;
drop policy if exists "app_carregamentos_insert" on public.carregamentos;
drop policy if exists "app_carregamentos_update" on public.carregamentos;
drop policy if exists "app_carregamentos_delete" on public.carregamentos;
create policy "app_carregamentos_select" on public.carregamentos for select to anon, authenticated using (true);
create policy "app_carregamentos_insert" on public.carregamentos for insert to anon, authenticated with check (true);
create policy "app_carregamentos_update" on public.carregamentos for update to anon, authenticated using (true) with check (true);
create policy "app_carregamentos_delete" on public.carregamentos for delete to anon, authenticated using (true);
