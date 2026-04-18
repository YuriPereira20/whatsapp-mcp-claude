import { z } from "zod";
import { matchesQuestion } from "../../whatsapp/matcher.js";
import { markdownToWhatsApp } from "../../whatsapp/markdown.js";
import { ToolError } from "../errors.js";
export const AskQuestionInput = z.object({
    question: z.string().min(1),
    timeout_minutes: z.number().int().positive().max(240).optional(),
});
export function createAskQuestion(client, groupJid) {
    let waiting = false;
    return async (input) => {
        const parsed = AskQuestionInput.safeParse(input);
        if (!parsed.success) {
            throw new ToolError("INVALID_INPUT", parsed.error.issues.map((i) => i.message).join("; "));
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
        }
        catch (e) {
            waiting = false;
            throw new ToolError("NOT_CONNECTED", `falha ao enviar pergunta: ${e.message}`);
        }
        const botJid = client.botJid();
        const pending = {
            messageId: sendRes.messageId,
            sentAt: sendRes.sentAt,
            botJid,
            groupJid,
        };
        return new Promise((resolve, reject) => {
            const unsubscribe = client.onMessage((msg) => {
                if (!matchesQuestion(msg, pending))
                    return;
                cleanup();
                resolve({
                    ok: true,
                    answer: msg.text,
                    answered_by: msg.senderName ?? msg.senderJid,
                    answered_at: msg.timestamp.toISOString(),
                    method: msg.quotedMessageId === pending.messageId ? "reply" : "mention",
                });
            });
            const timer = setTimeout(() => {
                cleanup();
                reject(new ToolError("TIMEOUT", `ninguém respondeu em ${timeoutMin} min`));
            }, timeoutMin * 60 * 1000);
            function cleanup() {
                clearTimeout(timer);
                unsubscribe();
                waiting = false;
            }
        });
    };
}
//# sourceMappingURL=ask-question.js.map