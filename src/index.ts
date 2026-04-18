#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig, ConfigError } from "./config.js";
import { acquireLock, releaseLock, LockError } from "./lock.js";
import { BaileysClient } from "./whatsapp/baileys-client.js";
import { buildMcpServer } from "./mcp/server.js";
import { resolveHome } from "./paths.js";

const ROOT = resolveHome();

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
