import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireLock, releaseLock, LockError } from "../src/lock.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "wamcp-lock-"));
  mkdirSync(join(dir, "data"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("acquireLock", () => {
  it("cria lockfile com PID atual", () => {
    acquireLock(dir);
    expect(existsSync(join(dir, "data/.lock"))).toBe(true);
    releaseLock(dir);
  });

  it("falha se lockfile existe com PID vivo", () => {
    writeFileSync(join(dir, "data/.lock"), String(process.pid));
    expect(() => acquireLock(dir)).toThrow(LockError);
  });

  it("rouba lockfile se PID está morto", () => {
    writeFileSync(join(dir, "data/.lock"), "999999");
    expect(() => acquireLock(dir)).not.toThrow();
    releaseLock(dir);
  });
});

describe("releaseLock", () => {
  it("remove o lockfile", () => {
    acquireLock(dir);
    releaseLock(dir);
    expect(existsSync(join(dir, "data/.lock"))).toBe(false);
  });
});
