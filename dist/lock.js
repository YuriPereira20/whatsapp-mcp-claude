import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
export class LockError extends Error {
    constructor(message) {
        super(message);
        this.name = "LockError";
    }
}
function lockPath(rootDir) {
    return join(rootDir, "data", ".lock");
}
function isPidAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
export function acquireLock(rootDir) {
    const path = lockPath(rootDir);
    if (existsSync(path)) {
        const existing = Number(readFileSync(path, "utf8").trim());
        if (Number.isFinite(existing) && isPidAlive(existing)) {
            throw new LockError(`Outra sessão do whatsapp-mcp já está rodando (PID ${existing}). Feche-a antes.`);
        }
    }
    writeFileSync(path, String(process.pid));
}
export function releaseLock(rootDir) {
    const path = lockPath(rootDir);
    if (existsSync(path)) {
        try {
            unlinkSync(path);
        }
        catch {
            // best-effort
        }
    }
}
//# sourceMappingURL=lock.js.map