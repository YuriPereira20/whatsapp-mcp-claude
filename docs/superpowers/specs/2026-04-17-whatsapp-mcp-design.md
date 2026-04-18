# WhatsApp MCP — Design

**Data**: 2026-04-17
**Autor**: yuripsoares
**Status**: Draft (pendente revisão do usuário)

## Objetivo

MCP server local (stdio) que permite ao Claude Code, durante uma task, enviar
updates de status e fazer perguntas bloqueantes a um grupo WhatsApp específico.
A resposta no grupo chega de volta como resultado da tool call, como se tivesse
sido digitada no próprio Claude.

## Escopo

### Dentro

- Autenticação inicial via QR code (wizard one-shot).
- Um único grupo alvo configurado (whitelist rígida por ID).
- Duas tools MCP: `send_status` e `ask_question`.
- `ask_question` bloqueia até reply/quote da msg da pergunta OU @mention do bot
  depois do timestamp da pergunta.
- Detecção e filtragem de msgs: só processa msgs do grupo alvo durante uma tool
  call ativa.
- Single-flight: apenas uma sessão do MCP rodando por vez (lockfile).
- Persistência local de sessão Baileys + config do grupo.

### Fora (YAGNI)

- Hospedagem remota (Railway, HTTP/SSE). Decisão: rodar local stdio.
- Múltiplos grupos.
- Múltiplas sessões do Claude Code em paralelo (a segunda recebe erro
  `ALREADY_WAITING`).
- Queue de mensagens fora de sessão (msgs recebidas quando Claude não está
  rodando são ignoradas).
- Envio/recepção de mídia, reações, edições, stickers.
- Auto-resposta "Claude offline" ou qualquer comportamento fora de tool call.
- Claude Agent SDK autônomo 24/7.
- Integração com WhatsApp Business Cloud API oficial.

## Contexto de uso

O usuário roda Claude Code localmente. Durante uma task longa ou que exige
decisões, o Claude pode:

1. Relatar progresso ao grupo (`send_status`).
2. Pedir decisão/input e esperar (`ask_question`).

Fora do grupo configurado, o bot não vê nem responde nada. Dentro do grupo, só
reage durante uma tool call ativa.

## Decisões de design (resumo do brainstorm)

| Dimensão | Decisão |
|---|---|
| Cliente Claude | Claude Code (CLI local) |
| Transporte MCP | stdio |
| Semântica de resposta | Reply/quote da msg da pergunta OU @mention do bot após a pergunta |
| Timeout | Configurável por chamada, default 30 min, máx 240 min |
| Visibilidade fora de tool call | Nenhuma — msgs ignoradas completamente |
| Concorrência | 1 sessão por vez; segunda recebe erro explícito |
| Hosting | Local (stdio), não Railway |
| Config inicial | Setup wizard separado |
| Biblioteca WA | Baileys (`@whiskeysockets/baileys`) |

## Arquitetura

```
Claude Code ─── stdio (JSON-RPC) ───► whatsapp-mcp (Node/TS)
                                        │
                                        ├── MCP Server (@mcp/sdk stdio)
                                        │     ├── tool: send_status
                                        │     └── tool: ask_question
                                        │
                                        └── WhatsApp client (Baileys wrapper)
                                              │
                                              └── WebSocket → WA servers → Grupo alvo

./data/
  ├── auth/         (sessão Baileys multi-device persistida)
  ├── config.json   (group_id + metadata)
  └── .lock         (lockfile single-flight)
```

Dois executáveis no mesmo pacote:

- **`setup`** — wizard one-shot. Imprime QR via `qrcode-terminal`, usuário
  escaneia, lista grupos (id + nome + participantes count), usuário digita o
  número do grupo, salva `./data/auth/` e `./data/config.json`.
- **`mcp`** — servidor stdio. Entry point do MCP. Lê config, adquire lock,
  reconecta Baileys com sessão salva, expõe tools. Libera lock e fecha conexão
  ao receber SIGTERM/SIGINT.

## Componentes

### `src/mcp/server.ts`

Inicializa `Server` do `@modelcontextprotocol/sdk`, registra as duas tools,
conecta transport stdio.

### `src/mcp/tools/send-status.ts`

Handler da tool `send_status`. Valida input, chama
`whatsapp.sendMessage(groupId, formatted)`, retorna
`{ ok, message_id, sent_at }`.

### `src/mcp/tools/ask-question.ts`

Handler da tool `ask_question`. Adquire um "waiting lock" em memória (recusa
2º concurrent com `ALREADY_WAITING`), envia mensagem formatada, registra o
`message_id` enviado, subscribe no listener de mensagens do wrapper, `await`
numa Promise que resolve quando matcher casar ou timeout expirar.

### `src/whatsapp/client.ts`

Wrapper fino em torno de Baileys. Interface:

```ts
interface WhatsAppClient {
  connect(): Promise<void>;
  sendMessage(jid: string, text: string): Promise<{ messageId: string; sentAt: Date }>;
  onMessage(handler: (msg: IncomingMessage) => void): Unsubscribe;
  disconnect(): Promise<void>;
  botJid(): string;   // JID do próprio bot
}

interface IncomingMessage {
  messageId: string;
  chatJid: string;
  senderJid: string;
  senderName?: string;
  text: string;
  quotedMessageId?: string;   // se é reply
  mentions: string[];         // JIDs mencionados
  timestamp: Date;
}
```

A interface existe pra facilitar mocks no teste. Baileys é detalhe de
implementação, isolado neste arquivo.

### `src/whatsapp/matcher.ts`

Função pura:

```ts
function matchesQuestion(
  msg: IncomingMessage,
  question: { messageId: string; sentAt: Date; botJid: string; groupJid: string },
): boolean
```

Retorna `true` se:

- `msg.chatJid === question.groupJid` **E**
- `msg.quotedMessageId === question.messageId` (reply direto), **OU**
- `question.botJid ∈ msg.mentions` **E** `msg.timestamp > question.sentAt`
  (@mention posterior à pergunta).

### `src/whatsapp/markdown.ts`

Conversão md → WhatsApp formatting:

- `**bold**` → `*bold*`
- `*italic*` ou `_italic_` → `_italic_`
- `` `code` `` preservado
- Code fences ` ```lang\n...\n``` ` → ` ```\n...\n``` `
- Headers `#`, `##` → `*...*` (negrito) + quebra
- Listas preservadas
- Links `[texto](url)` → `texto (url)`

Função pura, totalmente testável.

### `src/config.ts`

Lê e valida `./data/config.json`. Schema:

```json
{
  "groupId": "123456789@g.us",
  "groupName": "Nome do Grupo",
  "botJid": "55...@s.whatsapp.net",
  "createdAt": "2026-04-17T..."
}
```

Falha explícita com mensagem amigável se arquivo não existir ("rode
`npm run setup` primeiro").

### `src/lock.ts`

Lockfile em `./data/.lock` com PID. Ao iniciar: checa se existe e se PID tá
vivo; se sim, aborta com erro. Se PID morto, limpa e adquire. Libera em
shutdown.

## Fluxo de dados — ask_question

```
1. Claude chama ask_question(question="X?", timeout_minutes=30)
2. MCP: se já tem waiting lock → retorna ALREADY_WAITING
3. MCP: waitingLock = true
4. MCP: client.sendMessage(groupId, "❓ X?") → { messageId, sentAt }
5. MCP: cria Promise com timer de 30min
6. MCP: subscribe no onMessage
7. Para cada msg recebida:
     se matchesQuestion(msg, { messageId, sentAt, botJid, groupJid }):
       resolve(Promise, { answer: msg.text, answered_by: msg.senderName, ... })
       unsubscribe
     senão: ignora
8. Se timer expira antes: reject(TIMEOUT), unsubscribe
9. Finally: waitingLock = false
10. Retorna resultado ao Claude
```

## Erros e edge cases

| Cenário | Comportamento |
|---|---|
| Sessão WA expirou/deslogou | Tool retorna `NOT_CONNECTED` com instrução de rodar `setup` de novo |
| Bot kickado do grupo | Tool retorna `GROUP_UNREACHABLE` |
| `ask_question` timeout | Erro `TIMEOUT`; **não** envia msg de "expirou" ao grupo |
| Segundo MCP tenta subir | Lockfile bloqueia; erro claro "Outra sessão rodando em PID X" |
| Msg fora do grupo configurado | Ignorada silenciosamente |
| Msg no grupo mas sem ask_question aberto | Ignorada |
| Rate limit WA (burst) | Fila interna, throttle mínimo 1s entre msgs |
| Baileys reconecta transparente | Tool call aguarda até ~30s de reconexão antes de errar |
| `config.json` ausente | Erro amigável pedindo rodar `setup` |
| Grupo configurado não existe mais | `GROUP_UNREACHABLE` na primeira tentativa de envio |

## Formato de mensagens no grupo

- `send_status`: texto puro, sem prefixo automático (Claude decide se quer
  emoji 📌 / ✅ / ⚠️).
- `ask_question`: prefixo `❓` + texto. Prefixo serve como sinal visual claro de
  "responde com reply".

## Testes

Abordagem pragmática, não TDD pesado (projeto pequeno, UX direta).

- **Unit**
  - `matcher.ts`: reply certo, reply errado, mention pré-pergunta, mention
    pós-pergunta, chat errado, mention com múltiplos JIDs.
  - `markdown.ts`: cada regra de conversão, entradas combinadas, edge cases
    (markdown aninhado, code com backticks).
  - `config.ts`: schema válido, inválido, ausente.
- **Integração com mock**
  - Mock de `WhatsAppClient`. Testes de `send_status` e `ask_question`
    cobrindo: sucesso, timeout, ALREADY_WAITING, disconnect no meio.
- **E2E manual**
  - Script `npm run smoke`: envia status, faz pergunta com timeout 30s, requer
    você responder. Documentado no README.
- **Sem E2E automatizado contra WhatsApp real no CI** (QR não automatizável).

## Estrutura de arquivos

```
whatsapp-mcp/
├── package.json
├── tsconfig.json
├── .gitignore                   # ./data/, node_modules/, dist/
├── README.md                    # setup + uso + config do Claude Code
├── src/
│   ├── index.ts                 # entry do MCP server (stdio)
│   ├── setup.ts                 # entry do wizard
│   ├── mcp/
│   │   ├── server.ts
│   │   ├── tools/
│   │   │   ├── send-status.ts
│   │   │   └── ask-question.ts
│   │   └── errors.ts
│   ├── whatsapp/
│   │   ├── client.ts            # wrapper Baileys
│   │   ├── matcher.ts           # pure, testável
│   │   └── markdown.ts          # pure, testável
│   ├── config.ts
│   └── lock.ts
├── test/
│   ├── matcher.test.ts
│   ├── markdown.test.ts
│   ├── config.test.ts
│   └── tools.integration.test.ts
└── data/                        # runtime, gitignored
    ├── auth/
    ├── config.json
    └── .lock
```

## Setup pra usuário (UX)

```bash
# 1. Clonar e instalar
git clone ... && cd whatsapp-mcp
npm install

# 2. Rodar wizard (uma vez)
npm run setup
# → imprime QR no terminal
# → você escaneia com o WhatsApp do chip dedicado
# → lista "1) Grupo X (23 membros)  2) Grupo Y (5 membros) ..."
# → digita o número
# → salva config e fecha

# 3. Configurar no Claude Code
# adicionar em ~/.claude/settings.json ou .mcp.json do projeto:
{
  "mcpServers": {
    "whatsapp": {
      "command": "node",
      "args": ["/caminho/para/whatsapp-mcp/dist/index.js"]
    }
  }
}

# 4. Usar
# Claude Code agora tem as tools send_status e ask_question disponíveis.
```

## Aviso de ToS

Baileys é uma biblioteca não-oficial. Usar contra WhatsApp é tecnicamente
contra o ToS e o número usado pode ser banido. README deve conter aviso
explícito: **usar chip dedicado, não pessoal**.

## Dependências principais

- `@modelcontextprotocol/sdk` — MCP server
- `@whiskeysockets/baileys` — WhatsApp client
- `qrcode-terminal` — QR no terminal do setup
- `zod` — validação de input das tools e schema do config
- `typescript`, `tsx`, `vitest` (dev)

## Stack & runtime

- Node.js LTS (≥ 20)
- TypeScript, compilado pra `dist/`
- Sem bundler (Node ESM nativo)
