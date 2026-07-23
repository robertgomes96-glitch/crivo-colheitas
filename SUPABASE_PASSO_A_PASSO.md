# Conectar o Crivo Colheitas ao Supabase

## 1. Liberar as tabelas para esta primeira versão

No Supabase, abra **SQL Editor > New query**, copie o conteúdo de:

`supabase/01_policies_app_inicial.sql`

Clique em **Run**.

> Esta é uma política inicial para colocar o sistema em funcionamento. Depois do teste em campo, o acesso dos operadores será endurecido.

## 2. Pegar URL e chave pública

No Supabase, abra **Project Settings > Data API** (ou **API**).

Copie:

- Project URL
- chave `anon` / `publishable`

## 3. Criar o arquivo `.env`

Na raiz do projeto, copie `.env.example` para `.env` e preencha:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
```

Nunca coloque a chave `service_role` no aplicativo.

## 4. Instalar e iniciar

```bash
npm install
npm run dev
```

## 5. Como ficou o funcionamento

- O app continua salvando localmente, portanto não para durante queda de internet.
- A cada 5 segundos, quando houver conexão, grupos, áreas, placas, operadores e carregamentos são sincronizados com o Supabase.
- Ao abrir em outro aparelho, os dados do Supabase são trazidos para o aparelho.
- A carga pendente e a tela atual continuam locais para não atrapalhar a operação.

## Primeiro teste

1. Abra o app no computador.
2. Cadastre uma placa nova.
3. Aguarde 5 segundos.
4. Confira a tabela `placas` no Supabase.
5. Registre uma saída.
6. Confira a tabela `carregamentos`.
