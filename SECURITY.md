# Revisão de segurança

Revisão feita após a troca para autenticação própria. O sistema considera visitante anônimo, cliente autenticado e administrador.

## Controles implementados

| VULNERABILIDADE | RISCO | PROTEÇÃO IMPLEMENTADA | ARQUIVO RESPONSÁVEL |
|---|---|---|---|
| Senha em texto puro | Crítico | PBKDF2-HMAC-SHA-256 com 600 mil iterações, salt aleatório por senha e comparação sem saída antecipada | `lib/password.ts` |
| Roubo de sessão | Alto | Token aleatório de 256 bits; banco guarda somente SHA-256; cookie `HttpOnly`, `SameSite=Lax`, `Secure` em HTTPS e validade de 7 dias | `lib/server/auth.ts` |
| Session fixation | Alto | Um token novo é criado após cada login; troca e recuperação de senha encerram todas as sessões | `lib/server/auth.ts`, `app/api/auth/**` |
| Brute force / credential stuffing | Alto | Limites persistentes por combinação IP/conta e por conta; verificação falsa consome custo semelhante para conta inexistente | `lib/server/security.ts`, `app/api/auth/login/route.ts` |
| Enumeração de contas | Médio | Login e recuperação usam respostas genéricas; recuperação não confirma se o e-mail existe | `app/api/auth/**` |
| Reset token vazado | Alto | Token de 256 bits, uso único, expiração de 30 minutos e somente hash no banco | `lib/server/auth.ts` |
| CSRF | Alto | Token HMAC vinculado ao usuário, expiração, verificação de origem e `SameSite`; obrigatório em ações autenticadas | `lib/security-core.ts`, `lib/server/security.ts` |
| XSS | Alto | Escape do React, validação de entrada e CSP com nonce, `strict-dynamic` e `object-src 'none'` | `proxy.ts`, `lib/validators.ts` |
| SQL Injection | Alto | Prepared statements com `bind`; nenhum fragmento SQL é criado com entrada do cliente | `lib/server/**` |
| IDOR | Alto | Consultas do cliente exigem `user_id`; APIs administrativas verificam papel no servidor | `lib/server/appointments.ts`, `lib/server/security.ts` |
| Escalada de privilégio | Crítico | Primeiro admin exige segredo do ambiente e deixa de funcionar após o bootstrap; papel é validado no servidor em cada página/API | `lib/server/auth.ts`, `app/api/auth/setup-admin`, `app/api/admin/**` |
| Dupla reserva | Alto | Operação em batch e índice único por barbeiro/slot no banco | `db/schema.ts`, `lib/server/appointments.ts` |
| Manipulação de preço | Alto | Serviço, duração e preço são recarregados do banco no servidor | `lib/server/appointments.ts` |
| Exposição de dados | Alto | Cliente recebe apenas seus dados; painel exige administrador; respostas não incluem hash ou token | `app/api/**` |
| CORS / origem aberta | Médio | Sem wildcard CORS e mutações same-origin | `lib/server/security.ts` |
| Clickjacking e sniffing | Médio | `frame-ancestors 'none'`, `DENY` e `nosniff` | `proxy.ts` |
| Segredos versionados | Crítico | `.env` ignorado; somente exemplos sem credenciais; produção usa ambiente do Site | `.gitignore`, `.env.example` |
| Vazamento em logs | Alto | Eventos não registram senha, cookie, token, telefone ou e-mail; falhas retornam mensagem genérica | `lib/server/security.ts`, `lib/server/data.ts` |
| Payload abusivo | Médio | Limite de corpo e limites Zod por campo | `lib/server/security.ts`, `lib/validators.ts` |

## OWASP Top 10

| Categoria | Situação |
|---|---|
| A01 Broken Access Control | Ownership e papel administrativo verificados no servidor |
| A02 Cryptographic Failures | Derivação forte, salts, tokens de alta entropia, hashes e HTTPS |
| A03 Injection | Validação server-side e prepared statements |
| A04 Insecure Design | Bootstrap único, reserva decidida pelo banco e falha fechada sem segredos |
| A05 Security Misconfiguration | CSP, HSTS, framing, MIME, referrer e permissions policy |
| A06 Vulnerable Components | Lockfile fixo e auditoria de dependências |
| A07 Authentication Failures | Rate limit, erro genérico, sessões expiradas e logout server-side |
| A08 Data Integrity Failures | Migrações versionadas e ações administrativas auditadas |
| A09 Logging Failures | Auditoria operacional sem credenciais ou PII desnecessária |
| A10 SSRF | Nenhuma URL fornecida pelo usuário é buscada pelo servidor |

## Riscos residuais

- Não há MFA; uma conta administrativa depende de senha forte e proteção do e-mail.
- Rate limiting no D1 reduz abuso, mas não substitui WAF para tráfego hostil em grande escala.
- Recuperação só funciona quando o provedor de e-mail e o domínio remetente forem configurados.
- Não há verificação inicial de e-mail no cadastro; a empresa deve adicioná-la antes de uma operação com maior risco ou dados mais sensíveis.
- Exclusão/exportação LGPD e retenção automatizada ainda não possuem interface.
- O painel calcula receita de atendimentos, não confirma pagamentos.

## Operação segura

1. Faça o bootstrap do administrador enquanto o Site estiver privado.
2. Remova ou rotacione `ADMIN_SETUP_SECRET` depois do primeiro administrador.
3. Use senha administrativa única e gerenciador de senhas.
4. Configure o e-mail de recuperação antes de tornar o Site público.
5. Não reescreva migrações publicadas; sempre acrescente uma nova.
6. Revise auditoria, dependências e contas administrativas periodicamente.
