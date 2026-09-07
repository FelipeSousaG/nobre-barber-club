# Nobre Barber Club

Aplicação full-stack de barbearia com experiência editorial, lookbook, agenda sem colisões, cadastro por e-mail e senha, conta do cliente e painel administrativo.

## Arquitetura

| Camada | Implementação |
|---|---|
| Interface | React, Vinext/Next e CSS editorial responsivo |
| Backend | Route Handlers executados em Cloudflare Worker |
| Banco | Cloudflare D1 com migrações Drizzle |
| Autenticação | Credenciais próprias, PBKDF2-SHA-256 e sessões opacas |
| Autorização | Papéis `client` e `admin` verificados no servidor |

## Estrutura

```text
app/                     páginas e APIs
app/api/auth/            cadastro, login, logout e recuperação
app/conta/               área do cliente
app/admin/               painel administrativo
db/schema.ts             modelo relacional
drizzle/                 migrações imutáveis
lib/password.ts          derivação e verificação de senha
lib/server/auth.ts       sessões e identidade da aplicação
tests/                   regras, segurança, validação e banco
SECURITY.md              revisão de segurança
```

## Executar localmente

Requisitos: Node.js 22.13 ou superior e npm.

```bash
npm run install:ci
cp .env.example .env
npm run db:local:apply
npm run dev
```

No Windows PowerShell, use `npm ci`, `Copy-Item .env.example .env`, `npx wrangler d1 migrations apply nobre-barber-local --local` e `npx vite`.

Gere valores diferentes, aleatórios e com pelo menos 32 caracteres para `CSRF_SECRET` e `ADMIN_SETUP_SECRET`. O `.env` nunca deve ser versionado.

## Primeiro administrador

1. Mantenha o Site privado.
2. Configure `ADMIN_SETUP_SECRET` no ambiente do servidor.
3. Abra `/configurar-admin`.
4. Informe os dados, uma senha de pelo menos 12 caracteres e o código do ambiente.
5. Depois da criação, o banco bloqueia novas configurações iniciais.
6. Remova ou rotacione `ADMIN_SETUP_SECRET` depois do bootstrap.

Clientes usam `/cadastro` e `/entrar`. Administradores usam o mesmo `/entrar`; o servidor redireciona o papel `admin` para `/admin`.

## Recuperação de senha

O backend cria token aleatório de uso único, armazena apenas seu SHA-256 e expira em 30 minutos. O envio usa a API HTTP do Resend. Configure:

```env
APP_ORIGIN=https://seu-dominio.com.br
RESEND_API_KEY=re_...
MAIL_FROM=Nobre Barber Club <conta@seu-dominio.com.br>
```

Sem essas configurações, o endpoint mantém resposta genérica para não revelar contas, mas nenhum e-mail é enviado.

## Banco

As tabelas principais são `users`, `sessions`, `password_reset_tokens`, `barbers`, `services`, `appointments`, `schedule_slots`, `audit_logs` e `rate_limits`. A restrição única `(barber_id, slot_start)` impede duas reservas simultâneas para o mesmo profissional.

## Verificação

```bash
npm run lint
npm test
npm run build
```

## Personalização

| Informação | Arquivo |
|---|---|
| Marca, endereço e contatos | `lib/business.ts` |
| Serviços, barbeiros e lookbook | `lib/catalog.ts` |
| Cores e responsividade | `app/globals.css` |
| Regras da agenda | `lib/booking-rules.ts` |
| Modelo do banco | `db/schema.ts` |

## Limites operacionais

- Faturamento é calculado por serviços concluídos; não existe gateway de pagamento ou conciliação financeira.
- Recuperação exige uma conta de envio e domínio remetente configurado.
- A empresa precisa aprovar política de privacidade, retenção, exclusão e resposta a incidente antes de produção.
- O Site deve continuar privado até o proprietário criar o primeiro administrador e substituir os dados demonstrativos.
