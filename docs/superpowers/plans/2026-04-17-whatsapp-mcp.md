# WhatsApp MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MCP server local (stdio) que dá ao Claude Code as tools `send_status` e `ask_question` contra um único grupo WhatsApp, usando Baileys.

**Architecture:** Node/TS, dois entry points (`mcp` servidor stdio e `setup` wizard one-shot). Núcleo = pequenos módulos puros (matcher, markdown, config, lock) envolvendo um wrapper fino de Baileys. Tools MCP consomem o wrapper por interface injetável.

**Tech Stack:** Node ≥ 20, TypeScript (ESM, NodeNext), `@modelcontextprotocol/sdk`, `@whiskeysockets/baileys`, `qrcode-terminal`, `zod`, `vitest`.

**Root do projeto:** `/home/yuripsoares/Documentos/mcp/whatsapp controler`. Todos os paths abaixo são relativos a essa pasta. Todos os comandos assumem `cd "/home/yuripsoares/Documentos/mcp/whatsapp controler"`.

---

## File structure

```
whatsapp controler/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .gitignore
├── README.md
├── src/
│   ├── index.ts                 # entry MCP server (stdio)
│   ├── setup.ts                 # entry wizard (QR + escolha de grupo)
│   ├── config.ts                # load/validate ./data/config.json
│   ├── lock.ts                  # lockfile single-flight
│   ├── mcp/
│   │   ├── server.ts            # monta MCP Server, registra tools
│   │   ├── errors.ts            # classes de erro tipadas
│   │   └── tools/
│   │       ├── send-status.ts
│   │       └── ask-question.ts
│   └── whatsapp/
│       ├── client.ts            # interface WhatsAppClient + BaileysClient
│       ├── matcher.ts           # pure: reply/mention matcher
│       └── markdown.ts          # pure: md → WA formatting
├── test/
│   ├── matcher.test.ts
│   ├── markdown.test.ts
│   ├── config.test.ts
│   ├── lock.test.ts
│   ├── send-status.test.ts
│   └── ask-question.test.ts
├── scripts/
│   └── smoke.ts                 # E2E manual: envia status + faz pergunta
└── data/                        # runtime, gitignored
```

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "whatsapp-mcp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "whatsapp-mcp": "./dist/index.js",
    "whatsapp-mcp-setup": "./dist/setup.js"
  },
  "scripts": {
    "build": "tsc",
    "mcp": "tsx src/index.ts",
    "setup": "tsx src/setup.ts",
    "smoke": "tsx scripts/smoke.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "engines": {
    "node": ">=20"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@whiskeysockets/baileys": "^6.7.0",
    "qrcode-terminal": "^0.12.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.0",
    "@types/qrcode-terminal": "^0.12.2",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0",
    "vitest": "^1.5.0"
  }
}
```

- [ ] **Step 2: Criar `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": false,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

- [ ] **Step 3: Criar `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    testTimeout: 10_000,
  },
});
```

- [ ] **Step 4: Criar `.gitignore`**

```
node_modules/
dist/
data/
*.log
.DS_Store
```

- [ ] **Step 5: Instalar dependências e checar**

Rodar: `npm install`
Expected: sucesso, cria `node_modules/` e `package-lock.json`.

Rodar: `npx tsc --noEmit`
Expected: sucesso sem erros (sem código ainda, tsc só valida config).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore
git commit -m "chore: scaffold Node/TS project with MCP + Baileys deps"
```

---

## Task 2: `matcher.ts` (pure, TDD)

Módulo puro que decide se uma msg recebida é a resposta da pergunta.

**Files:**
- Create: `src/whatsapp/matcher.ts`
- Test: `test/matcher.test.ts`

- [ ] **Step 1: Escrever o teste falhando**

Criar `test/matcher.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { matchesQuestion, type IncomingMessage } from "../src/whatsapp/matcher.js";

const question = {
  messageId: "Q1",
  sentAt: new Date("2026-04-17T12:00:00Z"),
  botJid: "5511999999999@s.whatsapp.net",
  groupJid: "12345@g.us",
};

function msg(partial: Partial<IncomingMessage>): IncomingMessage {
  return {
    messageId: "M1",
    chatJid: "12345@g.us",
    senderJid: "5511888888888@s.whatsapp.net",
    text: "",
    quotedMessageId: undefined,
    mentions: [],
    timestamp: new Date("2026-04-17T12:05:00Z"),
    ...partial,
  };
}

describe("matchesQuestion", () => {
  it("casa reply direto à pergunta", () => {
    expect(matchesQuestion(msg({ quotedMessageId: "Q1" }), question)).toBe(true);
  });

  it("não casa reply a outra msg", () => {
    expect(matchesQuestion(msg({ quotedMessageId: "OTHER" }), question)).toBe(false);
  });

  it("casa @mention do bot posterior à pergunta", () => {
    expect(
      matchesQuestion(
        msg({ mentions: [question.botJid], timestamp: new Date("2026-04-17T12:10:00Z") }),
        question,
      ),
    ).toBe(true);
  });

  it("não casa @mention do bot ANTERIOR à pergunta", () => {
    expect(
      matchesQuestion(
        msg({ mentions: [question.botJid], timestamp: new Date("2026-04-17T11:59:00Z") }),
        question,
      ),
    ).toBe(false);
  });

  it("não casa @mention de outra pessoa", () => {
    expect(
      matchesQuestion(
        msg({ mentions: ["5511777777777@s.whatsapp.net"] }),
        question,
      ),
    ).toBe(false);
  });

  it("não casa msg de outro chat", () => {
    expect(
      matchesQuestion(msg({ chatJid: "99999@g.us", quotedMessageId: "Q1" }), question),
    ).toBe(false);
  });

  it("casa @mention com múltiplos JIDs incluindo o bot", () => {
    expect(
      matchesQuestion(
        msg({
          mentions: ["5511777777777@s.whatsapp.net", question.botJid],
          timestamp: new Date("2026-04-17T12:10:00Z"),
        }),
        question,
      ),
    ).toBe(true);
  });

  it("não casa msg sem quoted nem mention", () => {
    expect(matchesQuestion(msg({ text: "oi" }), question)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste pra confirmar falha**

Rodar: `npx vitest run test/matcher.test.ts`
Expected: FAIL — `Cannot find module '../src/whatsapp/matcher.js'`.

- [ ] **Step 3: Implementar `matcher.ts`**

Criar `src/whatsapp/matcher.ts`:

```ts
export interface IncomingMessage {
  messageId: string;
  chatJid: string;
  senderJid: string;
  senderName?: string;
  text: string;
  quotedMessageId?: string;
  mentions: string[];
  timestamp: Date;
}

export interface PendingQuestion {
  messageId: string;
  sentAt: Date;
  botJid: string;
  groupJid: string;
}

export function matchesQuestion(msg: IncomingMessage, q: PendingQuestion): boolean {
  if (msg.chatJid !== q.groupJid) return false;
  if (msg.quotedMessageId === q.messageId) return true;
  if (msg.mentions.includes(q.botJid) && msg.timestamp > q.sentAt) return true;
  return false;
}
```

- [ ] **Step 4: Rodar o teste pra confirmar passa**

Rodar: `npx vitest run test/matcher.test.ts`
Expected: PASS (8 testes).

- [ ] **Step 5: Commit**

```bash
git add src/whatsapp/matcher.ts test/matcher.test.ts
git commit -m "feat(matcher): add reply/mention matcher with tests"
```

---

## Task 3: `markdown.ts` (pure, TDD)

Conversão de markdown pra formatting do WhatsApp.

**Files:**
- Create: `src/whatsapp/markdown.ts`
- Test: `test/markdown.test.ts`

- [ ] **Step 1: Escrever o teste falhando**

Criar `test/markdown.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { markdownToWhatsApp } from "../src/whatsapp/markdown.js";

describe("markdownToWhatsApp", () => {
  it("converte bold **x** em *x*", () => {
    expect(markdownToWhatsApp("olá **mundo**")).toBe("olá *mundo*");
  });

  it("converte italic _x_ mantendo _x_", () => {
    expect(markdownToWhatsApp("_assim_")).toBe("_assim_");
  });

  it("converte italic *x* (single) em _x_", () => {
    expect(markdownToWhatsApp("palavra *itálica* aqui")).toBe("palavra _itálica_ aqui");
  });

  it("preserva inline code", () => {
    expect(markdownToWhatsApp("use `npm install`")).toBe("use `npm install`");
  });

  it("code fence com linguagem vira fence sem linguagem", () => {
    const input = "```ts\nconst x = 1;\n```";
    const expected = "```\nconst x = 1;\n```";
    expect(markdownToWhatsApp(input)).toBe(expected);
  });

  it("header # vira *X* com quebra", () => {
    expect(markdownToWhatsApp("# Título\ncorpo")).toBe("*Título*\n\ncorpo");
  });

  it("header ## vira *X* com quebra", () => {
    expect(markdownToWhatsApp("## Sub\ncorpo")).toBe("*Sub*\n\ncorpo");
  });

  it("link [x](url) vira 'x (url)'", () => {
    expect(markdownToWhatsApp("veja [docs](https://ex.com)")).toBe(
      "veja docs (https://ex.com)",
    );
  });

  it("preserva texto simples sem marks", () => {
    expect(markdownToWhatsApp("oi tudo bem")).toBe("oi tudo bem");
  });

  it("não mexe em bold DENTRO de code fence", () => {
    const input = "```\n**nao mexe**\n```";
    expect(markdownToWhatsApp(input)).toBe("```\n**nao mexe**\n```");
  });
});
```

- [ ] **Step 2: Rodar o teste pra confirmar falha**

Rodar: `npx vitest run test/markdown.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `markdown.ts`**

Criar `src/whatsapp/markdown.ts`:

```ts
export function markdownToWhatsApp(md: string): string {
  // Extrai code fences pra não processar conteúdo dentro deles.
  const fences: string[] = [];
  const FENCE_PLACEHOLDER = (i: number) => `\u0000FENCE${i}\u0000`;
  let work = md.replace(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g, (_m, body) => {
    const idx = fences.length;
    fences.push("```\n" + body + "```");
    return FENCE_PLACEHOLDER(idx);
  });

  // Inline code também preservado.
  const codes: string[] = [];
  const CODE_PLACEHOLDER = (i: number) => `\u0001CODE${i}\u0001`;
  work = work.replace(/`([^`\n]+)`/g, (_m, body) => {
    const idx = codes.length;
    codes.push("`" + body + "`");
    return CODE_PLACEHOLDER(idx);
  });

  // Headers: # a ###### → *texto* + linha em branco depois.
  work = work.replace(/^#{1,6}\s+(.+)$/gm, "*$1*\n");

  // Bold: **x** → *x*
  work = work.replace(/\*\*([^\n*]+)\*\*/g, "*$1*");

  // Italic single-star: *x* → _x_ (já processamos ** antes, então restam single)
  work = work.replace(/(^|[^*])\*([^\n*]+)\*(?!\*)/g, "$1_$2_");

  // Links: [texto](url) → texto (url)
  work = work.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");

  // Restaurar inline code.
  work = work.replace(/\u0001CODE(\d+)\u0001/g, (_m, i) => codes[Number(i)]);

  // Restaurar code fences.
  work = work.replace(/\u0000FENCE(\d+)\u0000/g, (_m, i) => fences[Number(i)]);

  return work;
}
```

- [ ] **Step 4: Rodar o teste pra confirmar passa**

Rodar: `npx vitest run test/markdown.test.ts`
Expected: PASS (10 testes).

- [ ] **Step 5: Commit**

```bash
git add src/whatsapp/markdown.ts test/markdown.test.ts
git commit -m "feat(markdown): md → whatsapp formatting with tests"
```

---

## Task 4: `config.ts` (load/validate com zod)

**Files:**
- Create: `src/config.ts`
- Test: `test/config.test.ts`

- [ ] **Step 1: Escrever o teste falhando**

Criar `test/config.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, saveConfig, ConfigError } from "../src/config.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "wamcp-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("loadConfig", () => {
  it("erra com ConfigError se config.json não existe", () => {
    expect(() => loadConfig(dir)).toThrow(ConfigError);
  });

  it("carrega config válido", () => {
    mkdirSync(join(dir, "data"));
    writeFileSync(
      join(dir, "data/config.json"),
      JSON.stringify({
        groupId: "123@g.us",
        groupName: "Teste",
        botJid: "5511999@s.whatsapp.net",
        createdAt: "2026-04-17T00:00:00Z",
      }),
    );
    const cfg = loadConfig(dir);
    expect(cfg.groupId).toBe("123@g.us");
    expect(cfg.groupName).toBe("Teste");
  });

  it("erra com ConfigError se schema inválido", () => {
    mkdirSync(join(dir, "data"));
    writeFileSync(join(dir, "data/config.json"), JSON.stringify({ foo: "bar" }));
    expect(() => loadConfig(dir)).toThrow(ConfigError);
  });
});

describe("saveConfig", () => {
  it("salva e lê de volta", () => {
    const cfg = {
      groupId: "123@g.us",
      groupName: "Teste",
      botJid: "5511999@s.whatsapp.net",
      createdAt: new Date("2026-04-17T00:00:00Z").toISOString(),
    };
    saveConfig(dir, cfg);
    expect(loadConfig(dir)).toEqual(cfg);
  });
});
```

- [ ] **Step 2: Rodar o teste pra confirmar falha**

Rodar: `npx vitest run test/config.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `config.ts`**

Criar `src/config.ts`:

```ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

export const ConfigSchema = z.object({
  groupId: z.string().regex(/@g\.us$/, "groupId precisa terminar em @g.us"),
  groupName: z.string().min(1),
  botJid: z.string().regex(/@s\.whatsapp\.net$/, "botJid precisa terminar em @s.whatsapp.net"),
  createdAt: z.string(),
});

export type Config = z.infer<typeof ConfigSchema>;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function configPath(rootDir: string): string {
  return join(rootDir, "data", "config.json");
}

export function loadConfig(rootDir: string): Config {
  const path = configPath(rootDir);
  if (!existsSync(path)) {
    throw new ConfigError(
      `Config não encontrado em ${path}. Rode 'npm run setup' primeiro.`,
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new ConfigError(`Config JSON inválido em ${path}: ${(e as Error).message}`);
  }
  const parsed = ConfigSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ConfigError(
      `Config inválido em ${path}: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  return parsed.data;
}

export function saveConfig(rootDir: string, cfg: Config): void {
  const dataDir = join(rootDir, "data");
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  writeFileSync(configPath(rootDir), JSON.stringify(cfg, null, 2));
}
```

- [ ] **Step 4: Rodar o teste pra confirmar passa**

Rodar: `npx vitest run test/config.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/config.ts test/config.test.ts
git commit -m "feat(config): load/save config with zod validation"
```

---

## Task 5: `lock.ts` (lockfile single-flight)

**Files:**
- Create: `src/lock.ts`
- Test: `test/lock.test.ts`

- [ ] **Step 1: Escrever o teste falhando**

Criar `test/lock.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireLock, releaseLock, LockError } from "../src/lock.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "wamcp-lock-"));
  mkdirSync(join(dir, "data"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("acquireLock", () => {
  it("cria lockfile com PID atual", () => {
    acquireLock(dir);
    expect(existsSync(join(dir, "data/.lock"))).toBe(true);
    releaseLock(dir);
  });

  it("falha se lockfile existe com PID vivo", () => {
    writeFileSync(join(dir, "data/.lock"), String(process.pid));
    expect(() => acquireLock(dir)).toThrow(LockError);
  });

  it("rouba lockfile se PID está morto", () => {
    // PID 999999 é quase certamente inexistente
    writeFileSync(join(dir, "data/.lock"), "999999");
    expect(() => acquireLock(dir)).not.toThrow();
    releaseLock(dir);
  });
});

describe("releaseLock", () => {
  it("remove o lockfile", () => {
    acquireLock(dir);
    releaseLock(dir);
    expect(existsSync(join(dir, "data/.lock"))).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste pra confirmar falha**

Rodar: `npx vitest run test/lock.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `lock.ts`**

Criar `src/lock.ts`:

```ts
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export class LockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LockError";
  }
}

function lockPath(rootDir: string): string {
  return join(rootDir, "data", ".lock");
}

function isPidAlive(pid: number): boolean {
  try {
    // signal 0 = verifica existência sem enviar sinal de verdade
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function acquireLock(rootDir: string): void {
  const path = lockPath(rootDir);
  if (existsSync(path)) {
    const existing = Number(readFileSync(path, "utf8").trim());
    if (Number.isFinite(existing) && isPidAlive(existing)) {
      throw new LockError(
        `Outra sessão do whatsapp-mcp já está rodando (PID ${existing}). Feche-a antes.`,
      );
    }
    // PID morto — rouba.
  }
  writeFileSync(path, String(process.pid));
}

export function releaseLock(rootDir: string): void {
  const path = lockPath(rootDir);
  if (existsSync(path)) {
    try {
      unlinkSync(path);
    } catch {
      // best-effort
    }
  }
}
```

- [ ] **Step 4: Rodar o teste pra confirmar passa**

Rodar: `npx vitest run test/lock.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lock.ts test/lock.test.ts
git commit -m "feat(lock): PID-aware lockfile for single-flight"
```

---

## Task 6: `mcp/errors.ts`

Classes de erro tipadas pra tools.

**Files:**
- Create: `src/mcp/errors.ts`

- [ ] **Step 1: Criar `src/mcp/errors.ts`**

```ts
export type ToolErrorCode =
  | "NOT_CONNECTED"
  | "GROUP_UNREACHABLE"
  | "TIMEOUT"
  | "ALREADY_WAITING"
  | "INVALID_INPUT";

export class ToolError extends Error {
  constructor(
    public readonly code: ToolErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ToolError";
  }

  toJSON(): { code: ToolErrorCode; message: string } {
    return { code: this.code, message: this.message };
  }
}
```

- [ ] **Step 2: Typecheck**

Rodar: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/mcp/errors.ts
git commit -m "feat(mcp): add ToolError with typed codes"
```

---

## Task 7: Interface `WhatsAppClient` + mock helper

Define o contrato do wrapper que as tools vão consumir. Implementação real de Baileys vem na Task 8.

**Files:**
- Create: `src/whatsapp/client.ts` (interface + tipos)

- [ ] **Step 1: Criar `src/whatsapp/client.ts` (só interface e tipos por enquanto)**

```ts
import type { IncomingMessage } from "./matcher.js";

export type { IncomingMessage } from "./matcher.js";

export type MessageHandler = (msg: IncomingMessage) => void;
export type Unsubscribe = () => void;

export interface SendResult {
  messageId: string;
  sentAt: Date;
}

export interface WhatsAppClient {
  connect(): Promise<void>;
  sendMessage(jid: string, text: string): Promise<SendResult>;
  onMessage(handler: MessageHandler): Unsubscribe;
  disconnect(): Promise<void>;
  botJid(): string;
}

// Implementação Baileys virá na task seguinte.
export { BaileysClient } from "./baileys-client.js";
```

- [ ] **Step 2: Commit parcial (stub sem BaileysClient ainda — vai quebrar, mas serve pra fazer o commit separar interface da impl)**

Não commitar ainda. Próxima task completa.

---

## Task 8: `BaileysClient` (implementação)

Wrapper concreto sobre Baileys.

**Files:**
- Create: `src/whatsapp/baileys-client.ts`

- [ ] **Step 1: Criar `src/whatsapp/baileys-client.ts`**

```ts
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
  type proto,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { join } from "node:path";
import type {
  WhatsAppClient,
  MessageHandler,
  Unsubscribe,
  SendResult,
} from "./client.js";
import type { IncomingMessage } from "./matcher.js";

export interface BaileysClientOptions {
  rootDir: string;
  /** Chamado quando um QR code novo precisa ser mostrado (apenas usado no setup). */
  onQr?: (qr: string) => void;
  /** Log level opcional. Default: sem log. */
  logger?: (level: string, msg: string) => void;
}

export class BaileysClient implements WhatsAppClient {
  private sock?: WASocket;
  private handlers = new Set<MessageHandler>();
  private _botJid?: string;
  private connectedPromise?: Promise<void>;

  constructor(private readonly opts: BaileysClientOptions) {}

  async connect(): Promise<void> {
    if (this.connectedPromise) return this.connectedPromise;
    this.connectedPromise = this._connect();
    return this.connectedPromise;
  }

  private async _connect(): Promise<void> {
    const authDir = join(this.opts.rootDir, "data", "auth");
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    this.sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      // Silencia logger interno de Baileys pra não poluir stdio do MCP.
      logger: { level: "silent" } as any,
    });

    this.sock.ev.on("creds.update", saveCreds);

    this.sock.ev.on("messages.upsert", ({ messages, type }) => {
      if (type !== "notify") return;
      for (const raw of messages) {
        const mapped = mapIncoming(raw);
        if (mapped) {
          for (const h of this.handlers) h(mapped);
        }
      }
    });

    await new Promise<void>((resolve, reject) => {
      if (!this.sock) return reject(new Error("socket não inicializado"));
      this.sock.ev.on("connection.update", (u) => {
        if (u.qr && this.opts.onQr) this.opts.onQr(u.qr);
        if (u.connection === "open") {
          this._botJid = this.sock!.user?.id;
          resolve();
        } else if (u.connection === "close") {
          const err = (u.lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
          if (err === DisconnectReason.loggedOut) {
            reject(new Error("Sessão WhatsApp expirou — rode 'npm run setup'."));
          }
          // reconect normal de Baileys trata sozinho; não reject aqui
        }
      });
    });
  }

  async sendMessage(jid: string, text: string): Promise<SendResult> {
    if (!this.sock) throw new Error("não conectado");
    const res = await this.sock.sendMessage(jid, { text });
    if (!res?.key?.id) throw new Error("falha ao enviar msg: sem message id");
    return {
      messageId: res.key.id,
      sentAt: new Date(),
    };
  }

  onMessage(handler: MessageHandler): Unsubscribe {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  async disconnect(): Promise<void> {
    try {
      await this.sock?.logout();
    } catch {
      // best-effort
    }
    this.sock?.end(undefined);
  }

  botJid(): string {
    if (!this._botJid) throw new Error("botJid não disponível (não conectado)");
    // Baileys retorna JID com device suffix tipo "5511999:12@s.whatsapp.net".
    // Normaliza pra remover o suffix.
    return this._botJid.replace(/:\d+@/, "@");
  }
}

function mapIncoming(m: proto.IWebMessageInfo): IncomingMessage | null {
  if (!m.key?.id || !m.key?.remoteJid) return null;
  const text =
    m.message?.conversation ??
    m.message?.extendedTextMessage?.text ??
    "";
  const quotedMessageId =
    m.message?.extendedTextMessage?.contextInfo?.stanzaId ?? undefined;
  const mentions =
    m.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
  const senderJid = (m.key.participant ?? m.key.remoteJid)!;
  const ts = typeof m.messageTimestamp === "number"
    ? m.messageTimestamp
    : Number(m.messageTimestamp ?? 0);
  return {
    messageId: m.key.id,
    chatJid: m.key.remoteJid,
    senderJid,
    senderName: m.pushName ?? undefined,
    text,
    quotedMessageId,
    mentions,
    timestamp: new Date(ts * 1000),
  };
}
```

- [ ] **Step 2: Adicionar dep `@hapi/boom`**

Rodar: `npm install @hapi/boom`
Expected: sucesso.

- [ ] **Step 3: Typecheck**

Rodar: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/whatsapp/client.ts src/whatsapp/baileys-client.ts package.json package-lock.json
git commit -m "feat(whatsapp): add WhatsAppClient interface + Baileys impl"
```

---

## Task 9: Tool `send_status` com testes (mocked client)

**Files:**
- Create: `src/mcp/tools/send-status.ts`
- Test: `test/send-status.test.ts`

- [ ] **Step 1: Escrever teste falhando**

Criar `test/send-status.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createSendStatus } from "../src/mcp/tools/send-status.js";
import { ToolError } from "../src/mcp/errors.js";
import type { WhatsAppClient } from "../src/whatsapp/client.js";

function fakeClient(overrides: Partial<WhatsAppClient> = {}): WhatsAppClient {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue({
      messageId: "OUT1",
      sentAt: new Date("2026-04-17T12:00:00Z"),
    }),
    onMessage: vi.fn().mockReturnValue(() => {}),
    disconnect: vi.fn().mockResolvedValue(undefined),
    botJid: vi.fn().mockReturnValue("5511999@s.whatsapp.net"),
    ...overrides,
  };
}

describe("send_status", () => {
  it("envia texto e retorna message_id + sent_at", async () => {
    const client = fakeClient();
    const sendStatus = createSendStatus(client, "123@g.us");
    const res = await sendStatus({ message: "olá" });
    expect(client.sendMessage).toHaveBeenCalledWith("123@g.us", "olá");
    expect(res).toEqual({
      ok: true,
      message_id: "OUT1",
      sent_at: "2026-04-17T12:00:00.000Z",
    });
  });

  it("converte markdown no texto", async () => {
    const client = fakeClient();
    const sendStatus = createSendStatus(client, "123@g.us");
    await sendStatus({ message: "olá **mundo**" });
    expect(client.sendMessage).toHaveBeenCalledWith("123@g.us", "olá *mundo*");
  });

  it("transforma erro de envio em ToolError NOT_CONNECTED", async () => {
    const client = fakeClient({
      sendMessage: vi.fn().mockRejectedValue(new Error("socket closed")),
    });
    const sendStatus = createSendStatus(client, "123@g.us");
    await expect(sendStatus({ message: "x" })).rejects.toThrow(ToolError);
  });

  it("valida input vazio", async () => {
    const client = fakeClient();
    const sendStatus = createSendStatus(client, "123@g.us");
    await expect(sendStatus({ message: "" })).rejects.toThrow(ToolError);
  });
});
```

- [ ] **Step 2: Rodar o teste pra confirmar falha**

Rodar: `npx vitest run test/send-status.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `send-status.ts`**

Criar `src/mcp/tools/send-status.ts`:

```ts
import { z } from "zod";
import type { WhatsAppClient } from "../../whatsapp/client.js";
import { markdownToWhatsApp } from "../../whatsapp/markdown.js";
import { ToolError } from "../errors.js";

export const SendStatusInput = z.object({
  message: z.string().min(1, "message não pode ser vazio"),
});
export type SendStatusInput = z.infer<typeof SendStatusInput>;

export interface SendStatusOutput {
  ok: true;
  message_id: string;
  sent_at: string;
}

export function createSendStatus(
  client: WhatsAppClient,
  groupJid: string,
): (input: unknown) => Promise<SendStatusOutput> {
  return async (input) => {
    const parsed = SendStatusInput.safeParse(input);
    if (!parsed.success) {
      throw new ToolError("INVALID_INPUT", parsed.error.issues.map((i) => i.message).join("; "));
    }
    const text = markdownToWhatsApp(parsed.data.message);
    try {
      const res = await client.sendMessage(groupJid, text);
      return { ok: true, message_id: res.messageId, sent_at: res.sentAt.toISOString() };
    } catch (e) {
      throw new ToolError("NOT_CONNECTED", `falha ao enviar: ${(e as Error).message}`);
    }
  };
}
```

- [ ] **Step 4: Rodar o teste pra confirmar passa**

Rodar: `npx vitest run test/send-status.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/mcp/tools/send-status.ts test/send-status.test.ts
git commit -m "feat(tools): add send_status tool with md formatting"
```

---

## Task 10: Tool `ask_question` com testes (mocked client)

A tool mais complexa. Testes usam promise + simulação de msg chegando.

**Files:**
- Create: `src/mcp/tools/ask-question.ts`
- Test: `test/ask-question.test.ts`

- [ ] **Step 1: Escrever teste falhando**

Criar `test/ask-question.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAskQuestion } from "../src/mcp/tools/ask-question.js";
import { ToolError } from "../src/mcp/errors.js";
import type { WhatsAppClient, MessageHandler } from "../src/whatsapp/client.js";
import type { IncomingMessage } from "../src/whatsapp/matcher.js";

function setup() {
  let handler: MessageHandler | null = null;
  const client: WhatsAppClient = {
    connect: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue({
      messageId: "Q1",
      sentAt: new Date("2026-04-17T12:00:00Z"),
    }),
    onMessage: vi.fn((h: MessageHandler) => {
      handler = h;
      return () => {
        handler = null;
      };
    }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    botJid: vi.fn().mockReturnValue("5511999@s.whatsapp.net"),
  };
  const ask = createAskQuestion(client, "123@g.us");
  const fireIncoming = (m: Partial<IncomingMessage>) => {
    if (!handler) throw new Error("no handler subscribed yet");
    handler({
      messageId: "IN1",
      chatJid: "123@g.us",
      senderJid: "5511888@s.whatsapp.net",
      senderName: "Yuri",
      text: "",
      quotedMessageId: undefined,
      mentions: [],
      timestamp: new Date("2026-04-17T12:05:00Z"),
      ...m,
    });
  };
  return { client, ask, fireIncoming };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ask_question", () => {
  it("resolve quando msg chega com reply à pergunta", async () => {
    const { ask, fireIncoming } = setup();
    const promise = ask({ question: "qual?", timeout_minutes: 5 });
    await vi.advanceTimersByTimeAsync(0);
    fireIncoming({ text: "a resposta", quotedMessageId: "Q1" });
    const res = await promise;
    expect(res).toMatchObject({
      ok: true,
      answer: "a resposta",
      answered_by: "Yuri",
      method: "reply",
    });
  });

  it("resolve com @mention posterior à pergunta", async () => {
    const { ask, fireIncoming } = setup();
    const promise = ask({ question: "qual?", timeout_minutes: 5 });
    await vi.advanceTimersByTimeAsync(0);
    fireIncoming({
      text: "@bot escolhe A",
      mentions: ["5511999@s.whatsapp.net"],
      timestamp: new Date("2026-04-17T12:10:00Z"),
    });
    const res = await promise;
    expect(res.method).toBe("mention");
  });

  it("ignora msg não relacionada", async () => {
    const { ask, fireIncoming } = setup();
    const promise = ask({ question: "qual?", timeout_minutes: 5 });
    await vi.advanceTimersByTimeAsync(0);
    fireIncoming({ text: "oi pessoal" });
    // avança até timeout
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1);
    await expect(promise).rejects.toThrow(ToolError);
  });

  it("timeout retorna ToolError TIMEOUT", async () => {
    const { ask } = setup();
    const promise = ask({ question: "qual?", timeout_minutes: 1 });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000 + 1);
    await expect(promise).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("2ª chamada concurrent retorna ALREADY_WAITING", async () => {
    const { ask, fireIncoming } = setup();
    const first = ask({ question: "A?", timeout_minutes: 5 });
    await vi.advanceTimersByTimeAsync(0);
    await expect(
      ask({ question: "B?", timeout_minutes: 5 }),
    ).rejects.toMatchObject({ code: "ALREADY_WAITING" });
    // libera o primeiro pra não vazar
    fireIncoming({ text: "x", quotedMessageId: "Q1" });
    await first;
  });

  it("valida timeout_minutes acima do máximo", async () => {
    const { ask } = setup();
    await expect(
      ask({ question: "a", timeout_minutes: 9999 }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("usa default 30 min se não passar timeout", async () => {
    const { ask, fireIncoming } = setup();
    const promise = ask({ question: "qual?" });
    await vi.advanceTimersByTimeAsync(29 * 60 * 1000);
    fireIncoming({ text: "ok", quotedMessageId: "Q1" });
    await expect(promise).resolves.toMatchObject({ ok: true });
  });
});
```

- [ ] **Step 2: Rodar o teste pra confirmar falha**

Rodar: `npx vitest run test/ask-question.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `ask-question.ts`**

Criar `src/mcp/tools/ask-question.ts`:

```ts
import { z } from "zod";
import type { WhatsAppClient } from "../../whatsapp/client.js";
import { matchesQuestion, type IncomingMessage } from "../../whatsapp/matcher.js";
import { markdownToWhatsApp } from "../../whatsapp/markdown.js";
import { ToolError } from "../errors.js";

export const AskQuestionInput = z.object({
  question: z.string().min(1),
  timeout_minutes: z.number().int().positive().max(240).optional(),
});
export type AskQuestionInput = z.infer<typeof AskQuestionInput>;

export interface AskQuestionOutput {
  ok: true;
  answer: string;
  answered_by: string;
  answered_at: string;
  method: "reply" | "mention";
}

export function createAskQuestion(
  client: WhatsAppClient,
  groupJid: string,
): (input: unknown) => Promise<AskQuestionOutput> {
  let waiting = false;

  return async (input) => {
    const parsed = AskQuestionInput.safeParse(input);
    if (!parsed.success) {
      throw new ToolError(
        "INVALID_INPUT",
        parsed.error.issues.map((i) => i.message).join("; "),
      );
    }
    if (waiting) {
      throw new ToolError("ALREADY_WAITING", "outra pergunta já está aguardando resposta");
    }
    waiting = true;

    const timeoutMin = parsed.data.timeout_minutes ?? 30;
    const text = `❓ ${markdownToWhatsApp(parsed.data.question)}`;

    let sendRes;
    try {
      sendRes = await client.sendMessage(groupJid, text);
    } catch (e) {
      waiting = false;
      throw new ToolError("NOT_CONNECTED", `falha ao enviar pergunta: ${(e as Error).message}`);
    }

    const botJid = client.botJid();
    const pending = {
      messageId: sendRes.messageId,
      sentAt: sendRes.sentAt,
      botJid,
      groupJid,
    };

    return new Promise<AskQuestionOutput>((resolve, reject) => {
      const unsubscribe = client.onMessage((msg: IncomingMessage) => {
        if (!matchesQuestion(msg, pending)) return;
        cleanup();
        resolve({
          ok: true,
          answer: msg.text,
          answered_by: msg.senderName ?? msg.senderJid,
          answered_at: msg.timestamp.toISOString(),
          method: msg.quotedMessageId === pending.messageId ? "reply" : "mention",
        });
      });

      const timer = setTimeout(
        () => {
          cleanup();
          reject(new ToolError("TIMEOUT", `ninguém respondeu em ${timeoutMin} min`));
        },
        timeoutMin * 60 * 1000,
      );

      function cleanup() {
        clearTimeout(timer);
        unsubscribe();
        waiting = false;
      }
    });
  };
}
```

- [ ] **Step 4: Rodar os testes pra confirmar passam**

Rodar: `npx vitest run test/ask-question.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Rodar TODOS os testes**

Rodar: `npx vitest run`
Expected: PASS — todos os 37 testes acumulados.

- [ ] **Step 6: Commit**

```bash
git add src/mcp/tools/ask-question.ts test/ask-question.test.ts
git commit -m "feat(tools): add ask_question with reply/mention matcher + timeout"
```

---

## Task 11: `mcp/server.ts` — monta servidor MCP e registra as duas tools

**Files:**
- Create: `src/mcp/server.ts`

- [ ] **Step 1: Criar `src/mcp/server.ts`**

```ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { WhatsAppClient } from "../whatsapp/client.js";
import { createSendStatus, SendStatusInput } from "./tools/send-status.js";
import { createAskQuestion, AskQuestionInput } from "./tools/ask-question.js";
import { ToolError } from "./errors.js";
import { zodToJsonSchema } from "./zod-to-jsonschema.js";

export function buildMcpServer(client: WhatsAppClient, groupJid: string): Server {
  const server = new Server(
    { name: "whatsapp-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  const sendStatus = createSendStatus(client, groupJid);
  const askQuestion = createAskQuestion(client, groupJid);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "send_status",
        description:
          "Envia uma mensagem de status ao grupo WhatsApp configurado. Use pra reportar progresso da task.",
        inputSchema: zodToJsonSchema(SendStatusInput),
      },
      {
        name: "ask_question",
        description:
          "Envia uma pergunta ao grupo e bloqueia até alguém responder (via reply ou @mention do bot) ou o timeout expirar.",
        inputSchema: zodToJsonSchema(AskQuestionInput),
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    try {
      const handler =
        name === "send_status"
          ? sendStatus
          : name === "ask_question"
            ? askQuestion
            : null;
      if (!handler) {
        throw new ToolError("INVALID_INPUT", `tool desconhecida: ${name}`);
      }
      const result = await handler(args ?? {});
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    } catch (e) {
      if (e instanceof ToolError) {
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify(e.toJSON()) }],
        };
      }
      throw e;
    }
  });

  return server;
}
```

- [ ] **Step 2: Criar helper `zod-to-jsonschema.ts`**

Criar `src/mcp/zod-to-jsonschema.ts`:

```ts
import { z, type ZodTypeAny } from "zod";

/**
 * Converte um schema Zod num JSON Schema plano suficiente pra descrever
 * input de tool MCP. Suporta apenas o subconjunto usado aqui: object com
 * string/number/optional.
 */
export function zodToJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  if (!(schema instanceof z.ZodObject)) {
    throw new Error("zodToJsonSchema suporta apenas ZodObject no topo");
  }
  const shape = schema.shape as Record<string, ZodTypeAny>;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, field] of Object.entries(shape)) {
    const { type, isOptional } = describeField(field);
    properties[key] = type;
    if (!isOptional) required.push(key);
  }
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

function describeField(field: ZodTypeAny): {
  type: Record<string, unknown>;
  isOptional: boolean;
} {
  let isOptional = false;
  let inner = field;
  if (inner instanceof z.ZodOptional) {
    isOptional = true;
    inner = inner.unwrap();
  }
  if (inner instanceof z.ZodString) return { type: { type: "string" }, isOptional };
  if (inner instanceof z.ZodNumber) return { type: { type: "number" }, isOptional };
  if (inner instanceof z.ZodBoolean) return { type: { type: "boolean" }, isOptional };
  throw new Error(`zodToJsonSchema: tipo não suportado ${inner.constructor.name}`);
}
```

- [ ] **Step 3: Typecheck**

Rodar: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/mcp/server.ts src/mcp/zod-to-jsonschema.ts
git commit -m "feat(mcp): build MCP server wiring send_status and ask_question"
```

---

## Task 12: `index.ts` — entry do MCP server (stdio)

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Criar `src/index.ts`**

```ts
#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig, ConfigError } from "./config.js";
import { acquireLock, releaseLock, LockError } from "./lock.js";
import { BaileysClient } from "./whatsapp/baileys-client.js";
import { buildMcpServer } from "./mcp/server.js";

const ROOT = process.cwd();

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig(ROOT);
  } catch (e) {
    if (e instanceof ConfigError) {
      console.error(e.message);
      process.exit(1);
    }
    throw e;
  }

  try {
    acquireLock(ROOT);
  } catch (e) {
    if (e instanceof LockError) {
      console.error(e.message);
      process.exit(1);
    }
    throw e;
  }

  const client = new BaileysClient({ rootDir: ROOT });

  const shutdown = async (code = 0) => {
    try {
      await client.disconnect();
    } catch {}
    releaseLock(ROOT);
    process.exit(code);
  };
  process.on("SIGINT", () => void shutdown(0));
  process.on("SIGTERM", () => void shutdown(0));
  process.on("uncaughtException", (err) => {
    console.error("uncaughtException:", err);
    void shutdown(1);
  });

  try {
    await client.connect();
  } catch (e) {
    console.error("falha ao conectar no WhatsApp:", (e as Error).message);
    await shutdown(1);
    return;
  }

  const server = buildMcpServer(client, config.groupId);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error(e);
  releaseLock(ROOT);
  process.exit(1);
});
```

- [ ] **Step 2: Typecheck**

Rodar: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: MCP server entry with lock, config, graceful shutdown"
```

---

## Task 13: `setup.ts` — wizard interativo

Fluxo: conecta Baileys → imprime QR até logar → lista grupos → usuário escolhe → salva config + sessão.

**Files:**
- Create: `src/setup.ts`

- [ ] **Step 1: Criar `src/setup.ts`**

```ts
#!/usr/bin/env node
import qrcode from "qrcode-terminal";
import { createInterface } from "node:readline/promises";
import makeWASocket, {
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import { join } from "node:path";
import { saveConfig } from "./config.js";

const ROOT = process.cwd();

interface GroupInfo {
  id: string;
  subject: string;
  participantsCount: number;
}

async function connectAndReady(): Promise<WASocket> {
  const authDir = join(ROOT, "data", "auth");
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: { level: "silent" } as any,
  });
  sock.ev.on("creds.update", saveCreds);

  await new Promise<void>((resolve, reject) => {
    sock.ev.on("connection.update", (u) => {
      if (u.qr) {
        console.log("\nEscaneie o QR abaixo com o WhatsApp do chip dedicado:\n");
        qrcode.generate(u.qr, { small: true });
      }
      if (u.connection === "open") resolve();
      if (u.connection === "close") {
        const code = (u.lastDisconnect?.error as any)?.output?.statusCode;
        if (code === 401) reject(new Error("autenticação falhou"));
      }
    });
  });

  return sock;
}

async function listGroups(sock: WASocket): Promise<GroupInfo[]> {
  const all = await sock.groupFetchAllParticipating();
  return Object.values(all)
    .map((g) => ({
      id: g.id,
      subject: g.subject ?? "(sem nome)",
      participantsCount: g.participants?.length ?? 0,
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject));
}

async function askUserForChoice(groups: GroupInfo[]): Promise<GroupInfo> {
  console.log("\nSeus grupos:\n");
  groups.forEach((g, i) => {
    console.log(`  ${i + 1}) ${g.subject}  (${g.participantsCount} membros)`);
  });
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  while (true) {
    const raw = (await rl.question("\nNúmero do grupo alvo: ")).trim();
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 1 && n <= groups.length) {
      rl.close();
      return groups[n - 1];
    }
    console.log("Entrada inválida. Tenta de novo.");
  }
}

async function main(): Promise<void> {
  console.log("=== WhatsApp MCP — Setup ===");
  const sock = await connectAndReady();
  console.log("\n✅ Conectado.\n");

  const botJid = sock.user?.id;
  if (!botJid) throw new Error("não consegui obter o JID do bot");
  const normalizedBotJid = botJid.replace(/:\d+@/, "@");

  const groups = await listGroups(sock);
  if (groups.length === 0) {
    console.error("Nenhum grupo encontrado. Entre num grupo antes e tente de novo.");
    await sock.logout();
    process.exit(1);
  }

  const chosen = await askUserForChoice(groups);

  saveConfig(ROOT, {
    groupId: chosen.id,
    groupName: chosen.subject,
    botJid: normalizedBotJid,
    createdAt: new Date().toISOString(),
  });

  console.log(`\n✅ Salvo em ./data/config.json`);
  console.log(`   Grupo: ${chosen.subject} (${chosen.id})`);
  console.log(`   Bot JID: ${normalizedBotJid}\n`);
  console.log("Feche esse setup com Ctrl+C. Pronto pra usar como MCP.");

  // não fecha o socket pra não deslogar; usuário fecha manualmente
}

main().catch((e) => {
  console.error("setup falhou:", e);
  process.exit(1);
});
```

- [ ] **Step 2: Typecheck**

Rodar: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/setup.ts
git commit -m "feat: setup wizard for QR auth and group selection"
```

---

## Task 14: Smoke test script

Script manual pra validar end-to-end que o bot realmente envia e recebe.

**Files:**
- Create: `scripts/smoke.ts`

- [ ] **Step 1: Criar `scripts/smoke.ts`**

```ts
#!/usr/bin/env node
import { loadConfig } from "../src/config.js";
import { BaileysClient } from "../src/whatsapp/baileys-client.js";
import { createSendStatus } from "../src/mcp/tools/send-status.js";
import { createAskQuestion } from "../src/mcp/tools/ask-question.js";

const ROOT = process.cwd();

async function main() {
  const config = loadConfig(ROOT);
  const client = new BaileysClient({ rootDir: ROOT });
  await client.connect();
  console.log("conectado.");

  const sendStatus = createSendStatus(client, config.groupId);
  const askQuestion = createAskQuestion(client, config.groupId);

  await sendStatus({ message: "🧪 smoke test iniciando" });
  console.log("status enviado.");

  console.log("fazendo pergunta com timeout de 2 min — responde no grupo!");
  try {
    const answer = await askQuestion({
      question: "Smoke test: responde qualquer coisa pra confirmar",
      timeout_minutes: 2,
    });
    console.log("resposta recebida:", answer);
  } catch (e) {
    console.error("pergunta falhou:", e);
  }

  await sendStatus({ message: "✅ smoke test concluído" });
  await client.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add scripts/smoke.ts
git commit -m "chore: add manual smoke test script"
```

---

## Task 15: README com setup + uso

**Files:**
- Create: `README.md`

- [ ] **Step 1: Criar `README.md`**

````markdown
# WhatsApp MCP

MCP server local que dá ao Claude Code duas tools contra um único grupo WhatsApp:

- `send_status(message)` — envia mensagem de status ao grupo
- `ask_question(question, timeout_minutes?)` — envia pergunta e **bloqueia** até alguém responder (por reply ou @mention do bot) ou o timeout expirar

## ⚠️ Aviso

Este projeto usa [Baileys](https://github.com/WhiskeySockets/Baileys), biblioteca **não-oficial** que simula WhatsApp Web. Usar contra WhatsApp é tecnicamente contra o ToS deles. Risco: o número usado pode ser **banido**.

**Use um chip/número dedicado, não o seu pessoal.**

## Requisitos

- Node.js ≥ 20
- Um número WhatsApp dedicado
- Um grupo WhatsApp onde esse número esteja

## Setup

```bash
# 1. Instalar
npm install
npm run build

# 2. Rodar o wizard (uma vez)
npm run setup
# → mostra QR no terminal
# → escaneia com o WhatsApp do chip dedicado
# → lista seus grupos
# → digita o número do grupo alvo
# → salva sessão em ./data/auth e config em ./data/config.json
# → fecha com Ctrl+C
```

## Configurar no Claude Code

Adicione em `~/.claude/settings.json` (global) ou `.mcp.json` do projeto:

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "node",
      "args": ["<CAMINHO-ABSOLUTO>/dist/index.js"],
      "cwd": "<CAMINHO-ABSOLUTO>"
    }
  }
}
```

Ou, pra rodar direto do TS sem build:

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "<CAMINHO-ABSOLUTO>"
    }
  }
}
```

## Uso

Num prompt do Claude Code, você pode pedir:

> "Manda um status pro WhatsApp dizendo que começou a task X. Quando tiver dúvida sobre a escolha da arquitetura, me pergunta no grupo."

E o Claude vai chamar `send_status` e `ask_question` automaticamente.

## Smoke test

Com o MCP **não rodando** (se não, lock conflita):

```bash
npm run smoke
```

Envia um status, faz uma pergunta com timeout 2min, aguarda resposta no grupo, envia status final.

## Comportamento

- Só age no grupo configurado. Tudo fora é ignorado.
- Só processa msgs durante uma tool call ativa — fora disso, msgs são ignoradas.
- Uma sessão do MCP por vez (lockfile).
- `ask_question` aceita como resposta: **reply à msg da pergunta**, ou **@mention do bot depois da pergunta**.
- Timeout default: 30 min. Máx 240 min.

## Desenvolvimento

```bash
npm test            # roda unit tests
npm run typecheck   # checa TS
```

## Troubleshooting

- **"Config não encontrado"** → rode `npm run setup`.
- **"Sessão WhatsApp expirou"** → apague `./data/auth/` e rode setup de novo.
- **"Outra sessão rodando"** → lockfile `./data/.lock` diz qual PID. Mate o processo ou apague o lockfile se for zumbi.
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup, usage, troubleshooting"
```

---

## Task 16: Build final + validação

- [ ] **Step 1: Build**

Rodar: `npm run build`
Expected: sem erros, cria `dist/` com os arquivos JS.

- [ ] **Step 2: Rodar todos os testes**

Rodar: `npm test`
Expected: PASS — todos os testes unit + integration.

- [ ] **Step 3: Typecheck**

Rodar: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 4: Verificar que `dist/index.js` é executável**

Rodar: `node dist/index.js`
Expected (sem config): `"Config não encontrado em ..." + exit 1`. Isso é sucesso — prova que o entry carrega.

- [ ] **Step 5: Commit do build se algo mudou (geralmente nada)**

```bash
git status   # deve estar limpo
```

---

## Notas finais

- **Após Task 13 (setup)**: você precisa ter um número e um grupo prontos pra testar. Isso é manual — o plano não automatiza.
- **Após Task 14 (smoke)**: primeiro teste real contra WhatsApp. Esperado: mensagem chega no grupo, você responde, smoke termina com sucesso.
- **Após Task 16 (build)**: o projeto está pronto pra ser adicionado ao Claude Code.

## Checklist final de cobertura do spec

- [x] Autenticação QR (Task 13 setup)
- [x] Grupo único whitelist (Task 9 e 10 usam `groupJid` fixo)
- [x] Tools `send_status` e `ask_question` (Tasks 9, 10)
- [x] Semântica reply/mention + timestamp (Task 2 matcher, Task 10 ask)
- [x] Timeout configurável default 30 máx 240 (Task 10)
- [x] Visibilidade zero fora de tool call (BaileysClient assina handlers só quando tool pede)
- [x] Single-flight via lock (Task 5)
- [x] Setup wizard separado (Task 13)
- [x] Markdown → WA (Task 3)
- [x] Erros tipados (Task 6, usados em 9, 10)
- [x] Estrutura de pastas conforme spec (Tasks 1-15)
- [x] Aviso de ToS no README (Task 15)
