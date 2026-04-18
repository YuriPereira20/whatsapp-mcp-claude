import { homedir } from "node:os";
import { join } from "node:path";
export function resolveHome() {
    return process.env.WHATSAPP_MCP_HOME ?? join(homedir(), ".whatsapp-mcp");
}
//# sourceMappingURL=paths.js.map