import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, saveConfig, ConfigError } from "../src/config.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "wamcp-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("loadConfig", () => {
  it("erra com ConfigError se config.json não existe", () => {
    expect(() => loadConfig(dir)).toThrow(ConfigError);
  });

  it("carrega config válido", () => {
    mkdirSync(join(dir, "data"));
    writeFileSync(
      join(dir, "data/config.json"),
      JSON.stringify({
        groupId: "123@g.us",
        groupName: "Teste",
        botJid: "5511999@s.whatsapp.net",
        createdAt: "2026-04-17T00:00:00Z",
      }),
    );
    const cfg = loadConfig(dir);
    expect(cfg.groupId).toBe("123@g.us");
    expect(cfg.groupName).toBe("Teste");
  });

  it("erra com ConfigError se schema inválido", () => {
    mkdirSync(join(dir, "data"));
    writeFileSync(join(dir, "data/config.json"), JSON.stringify({ foo: "bar" }));
    expect(() => loadConfig(dir)).toThrow(ConfigError);
  });
});

describe("saveConfig", () => {
  it("salva e lê de volta", () => {
    const cfg = {
      groupId: "123@g.us",
      groupName: "Teste",
      botJid: "5511999@s.whatsapp.net",
      createdAt: new Date("2026-04-17T00:00:00Z").toISOString(),
    };
    saveConfig(dir, cfg);
    expect(loadConfig(dir)).toEqual(cfg);
  });
});
