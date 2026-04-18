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

export { BaileysClient } from "./baileys-client.js";
