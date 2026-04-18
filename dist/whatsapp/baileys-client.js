import makeWASocket, { DisconnectReason, useMultiFileAuthState, } from "@whiskeysockets/baileys";
import { join } from "node:path";
export class BaileysClient {
    opts;
    sock;
    handlers = new Set();
    _botJid;
    connectedPromise;
    constructor(opts) {
        this.opts = opts;
    }
    async connect() {
        if (this.connectedPromise)
            return this.connectedPromise;
        this.connectedPromise = this._connect();
        return this.connectedPromise;
    }
    async _connect() {
        const authDir = join(this.opts.rootDir, "data", "auth");
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        this.sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: { level: "silent" },
        });
        this.sock.ev.on("creds.update", saveCreds);
        this.sock.ev.on("messages.upsert", ({ messages, type }) => {
            if (type !== "notify")
                return;
            for (const raw of messages) {
                const mapped = mapIncoming(raw);
                if (mapped) {
                    for (const h of this.handlers)
                        h(mapped);
                }
            }
        });
        await new Promise((resolve, reject) => {
            if (!this.sock)
                return reject(new Error("socket não inicializado"));
            this.sock.ev.on("connection.update", (u) => {
                if (u.qr && this.opts.onQr)
                    this.opts.onQr(u.qr);
                if (u.connection === "open") {
                    this._botJid = this.sock.user?.id;
                    resolve();
                }
                else if (u.connection === "close") {
                    const err = u.lastDisconnect?.error?.output?.statusCode;
                    if (err === DisconnectReason.loggedOut) {
                        reject(new Error("Sessão WhatsApp expirou — rode 'npm run setup'."));
                    }
                }
            });
        });
    }
    async sendMessage(jid, text) {
        if (!this.sock)
            throw new Error("não conectado");
        const res = await this.sock.sendMessage(jid, { text });
        if (!res?.key?.id)
            throw new Error("falha ao enviar msg: sem message id");
        return {
            messageId: res.key.id,
            sentAt: new Date(),
        };
    }
    onMessage(handler) {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }
    async disconnect() {
        try {
            await this.sock?.logout();
        }
        catch {
            // best-effort
        }
        this.sock?.end(undefined);
    }
    botJid() {
        if (!this._botJid)
            throw new Error("botJid não disponível (não conectado)");
        return this._botJid.replace(/:\d+@/, "@");
    }
}
function mapIncoming(m) {
    if (!m.key?.id || !m.key?.remoteJid)
        return null;
    const text = m.message?.conversation ??
        m.message?.extendedTextMessage?.text ??
        "";
    const quotedMessageId = m.message?.extendedTextMessage?.contextInfo?.stanzaId ?? undefined;
    const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
    const senderJid = (m.key.participant ?? m.key.remoteJid);
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
//# sourceMappingURL=baileys-client.js.map