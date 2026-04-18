export function matchesQuestion(msg, q) {
    if (msg.chatJid !== q.groupJid)
        return false;
    if (msg.quotedMessageId === q.messageId)
        return true;
    if (msg.mentions.includes(q.botJid) && msg.timestamp > q.sentAt)
        return true;
    return false;
}
//# sourceMappingURL=matcher.js.map