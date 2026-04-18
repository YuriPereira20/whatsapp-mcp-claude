import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { createSendStatus, SendStatusInput } from "./tools/send-status.js";
import { createAskQuestion, AskQuestionInput } from "./tools/ask-question.js";
import { ToolError } from "./errors.js";
import { zodToJsonSchema } from "./zod-to-jsonschema.js";
export function buildMcpServer(client, groupJid) {
    const server = new Server({ name: "whatsapp-mcp", version: "0.1.0" }, { capabilities: { tools: {} } });
    const sendStatus = createSendStatus(client, groupJid);
    const askQuestion = createAskQuestion(client, groupJid);
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [
            {
                name: "send_status",
                description: "Envia uma mensagem de status ao grupo WhatsApp configurado. Use pra reportar progresso da task.",
                inputSchema: zodToJsonSchema(SendStatusInput),
            },
            {
                name: "ask_question",
                description: "Envia uma pergunta ao grupo e bloqueia até alguém responder (via reply ou @mention do bot) ou o timeout expirar.",
                inputSchema: zodToJsonSchema(AskQuestionInput),
            },
        ],
    }));
    server.setRequestHandler(CallToolRequestSchema, async (req) => {
        const { name, arguments: args } = req.params;
        try {
            const handler = name === "send_status"
                ? sendStatus
                : name === "ask_question"
                    ? askQuestion
                    : null;
            if (!handler) {
                throw new ToolError("INVALID_INPUT", `tool desconhecida: ${name}`);
            }
            const result = await handler(args ?? {});
            return {
                content: [{ type: "text", text: JSON.stringify(result) }],
            };
        }
        catch (e) {
            if (e instanceof ToolError) {
                return {
                    isError: true,
                    content: [{ type: "text", text: JSON.stringify(e.toJSON()) }],
                };
            }
            throw e;
        }
    });
    return server;
}
//# sourceMappingURL=server.js.map