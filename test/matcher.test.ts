import { describe, it, expect } from "vitest";
import { matchesQuestion, type IncomingMessage } from "../src/whatsapp/matcher.js";

const question = {
  messageId: "Q1",
  sentAt: new Date("2026-04-17T12:00:00Z"),
  botJid: "5511999999999@s.whatsapp.net",
  groupJid: "12345@g.us",
};

function msg(partial: Partial<IncomingMessage>): IncomingMessage {
  return {
    messageId: "M1",
    chatJid: "12345@g.us",
    senderJid: "5511888888888@s.whatsapp.net",
    text: "",
    quotedMessageId: undefined,
    mentions: [],
    timestamp: new Date("2026-04-17T12:05:00Z"),
    ...partial,
  };
}

describe("matchesQuestion", () => {
  it("casa reply direto à pergunta", () => {
    expect(matchesQuestion(msg({ quotedMessageId: "Q1" }), question)).toBe(true);
  });

  it("não casa reply a outra msg", () => {
    expect(matchesQuestion(msg({ quotedMessageId: "OTHER" }), question)).toBe(false);
  });

  it("casa @mention do bot posterior à pergunta", () => {
    expect(
      matchesQuestion(
        msg({ mentions: [question.botJid], timestamp: new Date("2026-04-17T12:10:00Z") }),
        question,
      ),
    ).toBe(true);
  });

  it("não casa @mention do bot ANTERIOR à pergunta", () => {
    expect(
      matchesQuestion(
        msg({ mentions: [question.botJid], timestamp: new Date("2026-04-17T11:59:00Z") }),
        question,
      ),
    ).toBe(false);
  });

  it("não casa @mention de outra pessoa", () => {
    expect(
      matchesQuestion(
        msg({ mentions: ["5511777777777@s.whatsapp.net"] }),
        question,
      ),
    ).toBe(false);
  });

  it("não casa msg de outro chat", () => {
    expect(
      matchesQuestion(msg({ chatJid: "99999@g.us", quotedMessageId: "Q1" }), question),
    ).toBe(false);
  });

  it("casa @mention com múltiplos JIDs incluindo o bot", () => {
    expect(
      matchesQuestion(
        msg({
          mentions: ["5511777777777@s.whatsapp.net", question.botJid],
          timestamp: new Date("2026-04-17T12:10:00Z"),
        }),
        question,
      ),
    ).toBe(true);
  });

  it("não casa msg sem quoted nem mention", () => {
    expect(matchesQuestion(msg({ text: "oi" }), question)).toBe(false);
  });
});
