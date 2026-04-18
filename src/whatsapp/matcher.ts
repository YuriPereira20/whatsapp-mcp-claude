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
