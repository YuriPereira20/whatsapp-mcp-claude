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
