#!/usr/bin/env node
import qrcode from "qrcode-terminal";
import { createInterface } from "node:readline/promises";
import makeWASocket, {
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import { join } from "node:path";
import { saveConfig } from "./config.js";
import { resolveHome } from "./paths.js";

const ROOT = resolveHome();

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

  console.log(`\n✅ Salvo em ${ROOT}/data/config.json`);
  console.log(`   Grupo: ${chosen.subject} (${chosen.id})`);
  console.log(`   Bot JID: ${normalizedBotJid}\n`);
  console.log("Feche esse setup com Ctrl+C. Pronto pra usar como MCP.");
}

main().catch((e) => {
  console.error("setup falhou:", e);
  process.exit(1);
});
