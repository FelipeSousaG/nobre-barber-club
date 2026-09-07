# Diagnóstico da evolução

## MANTER

| Elemento anterior | Motivo |
|---|---|
| Fotografia escura e profissional | Já sustentava a percepção premium e foi reaproveitada em novos recortes editoriais |
| Contraste alto e hierarquia clara | A leitura e a conversão eram boas; a nova paleta preserva essa força |
| Ações de agenda e WhatsApp | Eram importantes para conversão e continuam presentes |
| Conteúdo de serviços, equipe, prova social e visita | A informação era necessária; mudou a forma de contar |
| Boas intenções de responsividade e acessibilidade | Foram levadas para a arquitetura React e aprofundadas |

## MELHORAR

| Elemento anterior | Evolução aplicada |
|---|---|
| Galeria regular | Virou lookbook filtrável com ficha técnica, profissional, tempo, preço e ação contextual |
| Equipe em cards | Virou dossiê de artistas, repertório, avaliação, experiência e agenda própria |
| Lista de serviços | Virou menu editorial numerado com tempo, propósito e preço claro |
| Formulário de agenda | Virou escolha progressiva, disponibilidade real, resumo vivo e confirmação transacional |
| Mobile comprimido | Ganhou composição própria: navegação em edição, imagens alternadas e controles de toque |
| Depoimentos em cards | Viraram citações editoriais com índice e dados de recorrência |

## SUBSTITUIR

| Elemento anterior | Problema | Substituição |
|---|---|---|
| Sequência hero/sobre/cards/equipe/galeria | Silhueta reconhecível como template premium | Narrativa em capítulos conectados, com ritmo de revista |
| Cards idênticos e arredondados | Baixa identidade e pouca relação com o ofício | Linhas de pauta, fichas, carimbos, tickets e assimetria |
| Agendamento por mensagem montada no navegador | Não criava reserva nem impedia colisões | API autenticada + D1 + slots únicos por barbeiro |
| Dados e configuração apenas no JavaScript | Manipuláveis pelo cliente e não persistentes | Validação, preço, agenda e autorização no servidor |
| Ausência de conta | Sem histórico ou continuidade | Perfil real, dashboard, histórico e cancelamento |
| Ausência de administração | Operação impossível fora do código | Painel inicial protegido por allowlist server-side |

## Direção artística

**The Grooming Ledger** combina caderno de alfaiataria, editorial de moda masculina e a linguagem técnica da barbearia. Marfim, tinta, oxblood e azul aparecem como papel, carimbo e barber pole reinterpretado. O layout usa capítulos, números de edição, recortes verticais, margens assimétricas e um ticket de reserva funcional. Não depende do logo para ser reconhecível.

## Decisões de produto

- A primeira tela comunica marca, cidade, agenda, reputação e ação sem introdução genérica.
- O visitante pode explorar um look antes de escolher serviço e profissional.
- Todas as ações de “quero este corte” e “agendar com este profissional” preservam contexto.
- A agenda pode ser explorada sem login; autenticação só é exigida ao confirmar.
- O sistema possui autenticação própria para não exigir conta em outra plataforma; isso aumenta a responsabilidade operacional com senhas, e-mail e sessões.
- Administração e cliente compartilham o mesmo banco, mas têm superfícies e autorizações separadas.
