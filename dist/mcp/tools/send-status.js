import { z } from "zod";
import { markdownToWhatsApp } from "../../whatsapp/markdown.js";
import { ToolError } from "../errors.js";
export const SendStatusInput = z.object({
    message: z.string().min(1, "message não pode ser vazio"),
});
export function createSendStatus(client, groupJid) {
    return async (input) => {
        const parsed = SendStatusInput.safeParse(input);
        if (!parsed.success) {
            throw new ToolError("INVALID_INPUT", parsed.error.issues.map((i) => i.message).join("; "));
        }
        const text = markdownToWhatsApp(parsed.data.message);
        try {
            const res = await client.sendMessage(groupJid, text);
            return { ok: true, message_id: res.messageId, sent_at: res.sentAt.toISOString() };
        }
        catch (e) {
            throw new ToolError("NOT_CONNECTED", `falha ao enviar: ${e.message}`);
        }
    };
}
//# sourceMappingURL=send-status.js.map