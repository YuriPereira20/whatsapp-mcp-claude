import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
export const ConfigSchema = z.object({
    groupId: z.string().regex(/@g\.us$/, "groupId precisa terminar em @g.us"),
    groupName: z.string().min(1),
    botJid: z.string().regex(/@s\.whatsapp\.net$/, "botJid precisa terminar em @s.whatsapp.net"),
    createdAt: z.string(),
});
export class ConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = "ConfigError";
    }
}
function configPath(rootDir) {
    return join(rootDir, "data", "config.json");
}
export function loadConfig(rootDir) {
    const path = configPath(rootDir);
    if (!existsSync(path)) {
        throw new ConfigError(`Config não encontrado em ${path}. Rode 'npm run setup' primeiro.`);
    }
    let raw;
    try {
        raw = JSON.parse(readFileSync(path, "utf8"));
    }
    catch (e) {
        throw new ConfigError(`Config JSON inválido em ${path}: ${e.message}`);
    }
    const parsed = ConfigSchema.safeParse(raw);
    if (!parsed.success) {
        throw new ConfigError(`Config inválido em ${path}: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
    }
    return parsed.data;
}
export function saveConfig(rootDir, cfg) {
    const dataDir = join(rootDir, "data");
    if (!existsSync(dataDir))
        mkdirSync(dataDir, { recursive: true });
    writeFileSync(configPath(rootDir), JSON.stringify(cfg, null, 2));
}
//# sourceMappingURL=config.js.map