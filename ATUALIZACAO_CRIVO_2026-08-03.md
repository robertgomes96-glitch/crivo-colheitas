# Atualização Crivo Colheitas — 03/08/2026

## Implementado

- Operação ativa isolada por aparelho; sincronização não troca mais a área de outro tablet.
- Fila independente de carregamentos para preservar lançamentos offline.
- Sugestões de placas filtradas pelo operador logado.
- Botão **Destravar** que limpa somente a operação/tela daquele aparelho.
- Botão **Reportar problema**, com fila offline e envio ao Supabase.
- Central de Operações na home do escritório:
  - ocorrências pendentes;
  - operadores online;
  - área atual;
  - última atividade;
  - última sincronização;
  - lançamentos pendentes;
  - cargas em andamento.
- Ocorrências podem ser marcadas como resolvidas pelo escritório.
- Inclusão manual de carregamento com placa, operador, grupo, área, tipo, data, hora e observação.

## Banco de dados

Esta versão utiliza as tabelas já criadas:

- `ocorrencias`
- `status_operadores`
- `cargas_aguardando`

## Instalação

1. Preserve o seu arquivo `.env` atual.
2. Substitua os arquivos do projeto pelos desta versão.
3. Execute `npm install`.
4. Execute `npm run build`.
5. Teste localmente com `npm run dev`.
6. Depois publique com `git add .`, `git commit` e `git push`.

## Observação

O arquivo `.env` não foi incluído no pacote por segurança.
