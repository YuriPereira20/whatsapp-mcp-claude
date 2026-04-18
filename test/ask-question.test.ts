import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAskQuestion } from "../src/mcp/tools/ask-question.js";
import { ToolError } from "../src/mcp/errors.js";
import type { WhatsAppClient, MessageHandler } from "../src/whatsapp/client.js";
import type { IncomingMessage } from "../src/whatsapp/matcher.js";

function setup() {
  let handler: MessageHandler | null = null;
  const client: WhatsAppClient = {
    connect: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue({
      messageId: "Q1",
      sentAt: new Date("2026-04-17T12:00:00Z"),
    }),
    onMessage: vi.fn((h: MessageHandler) => {
      handler = h;
      return () => {
        handler = null;
      };
    }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    botJid: vi.fn().mockReturnValue("5511999@s.whatsapp.net"),
  };
  const ask = createAskQuestion(client, "123@g.us");
  const fireIncoming = (m: Partial<IncomingMessage>) => {
    if (!handler) throw new Error("no handler subscribed yet");
    handler({
      messageId: "IN1",
      chatJid: "123@g.us",
      senderJid: "5511888@s.whatsapp.net",
      senderName: "Yuri",
      text: "",
      quotedMessageId: undefined,
      mentions: [],
      timestamp: new Date("2026-04-17T12:05:00Z"),
      ...m,
    });
  };
  return { client, ask, fireIncoming };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ask_question", () => {
  it("resolve quando msg chega com reply à pergunta", async () => {
    const { ask, fireIncoming } = setup();
    const promise = ask({ question: "qual?", timeout_minutes: 5 });
    await vi.advanceTimersByTimeAsync(0);
    fireIncoming({ text: "a resposta", quotedMessageId: "Q1" });
    const res = await promise;
    expect(res).toMatchObject({
      ok: true,
      answer: "a resposta",
      answered_by: "Yuri",
      method: "reply",
    });
  });

  it("resolve com @mention posterior à pergunta", async () => {
    const { ask, fireIncoming } = setup();
    const promise = ask({ question: "qual?", timeout_minutes: 5 });
    await vi.advanceTimersByTimeAsync(0);
    fireIncoming({
      text: "@bot escolhe A",
      mentions: ["5511999@s.whatsapp.net"],
      timestamp: new Date("2026-04-17T12:10:00Z"),
    });
    const res = await promise;
    expect(res.method).toBe("mention");
  });

  it("ignora msg não relacionada", async () => {
    const { ask, fireIncoming } = setup();
    const promise = ask({ question: "qual?", timeout_minutes: 5 });
    await vi.advanceTimersByTimeAsync(0);
    fireIncoming({ text: "oi pessoal" });
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1);
    await expect(promise).rejects.toThrow(ToolError);
  });

  it("timeout retorna ToolError TIMEOUT", async () => {
    const { ask } = setup();
    const promise = ask({ question: "qual?", timeout_minutes: 1 });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000 + 1);
    await expect(promise).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("2ª chamada concurrent retorna ALREADY_WAITING", async () => {
    const { ask, fireIncoming } = setup();
    const first = ask({ question: "A?", timeout_minutes: 5 });
    await vi.advanceTimersByTimeAsync(0);
    await expect(
      ask({ question: "B?", timeout_minutes: 5 }),
    ).rejects.toMatchObject({ code: "ALREADY_WAITING" });
    fireIncoming({ text: "x", quotedMessageId: "Q1" });
    await first;
  });

  it("valida timeout_minutes acima do máximo", async () => {
    const { ask } = setup();
    await expect(
      ask({ question: "a", timeout_minutes: 9999 }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("usa default 30 min se não passar timeout", async () => {
    const { ask, fireIncoming } = setup();
    const promise = ask({ question: "qual?" });
    await vi.advanceTimersByTimeAsync(29 * 60 * 1000);
    fireIncoming({ text: "ok", quotedMessageId: "Q1" });
    await expect(promise).resolves.toMatchObject({ ok: true });
  });
});
