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
# 1. Clonar e instalar
git clone https://github.com/YuriPereira20/whatsapp-mcp-claude.git ~/.local/share/whatsapp-mcp-claude
cd ~/.local/share/whatsapp-mcp-claude
npm install
npm link   # expõe 'whatsapp-mcp' e 'whatsapp-mcp-setup' no PATH global

# 2. Rodar o wizard (uma vez)
whatsapp-mcp-setup
# → mostra QR no terminal
# → escaneia com o WhatsApp do chip dedicado
# → lista seus grupos
# → digita o número do grupo alvo
# → salva sessão e config em ~/.whatsapp-mcp/data/
# → fecha com Ctrl+C
```

Estado (sessão + config) fica em `~/.whatsapp-mcp/` por padrão. Pra usar outra localização, setar a env var `WHATSAPP_MCP_HOME=/outro/lugar` antes de rodar setup/server.

## Configurar no Claude Code

Adicione em `~/.claude/settings.json` (global) ou `.mcp.json` do projeto:

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "whatsapp-mcp"
    }
  }
}
```

Sem cwd, sem caminho absoluto — o binário fica no PATH depois do `npm install -g`.

## Instalação alternativa (sem link global)

Se preferir sem `npm link`, aponte o Claude Code pro binário absoluto:

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "node",
      "args": ["<CAMINHO-ABSOLUTO>/dist/index.js"]
    }
  }
}
```

E rode setup como `node <CAMINHO-ABSOLUTO>/dist/setup.js`.

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

- **"Config não encontrado"** → rode `whatsapp-mcp-setup` (ou `npm run setup` se for install local).
- **"Sessão WhatsApp expirou"** → apague `~/.whatsapp-mcp/data/auth/` e rode setup de novo.
- **"Outra sessão rodando"** → lockfile em `~/.whatsapp-mcp/data/.lock` diz qual PID. Mate o processo ou apague o lockfile se for zumbi.
