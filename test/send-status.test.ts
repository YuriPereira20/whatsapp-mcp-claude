import { describe, it, expect, vi } from "vitest";
import { createSendStatus } from "../src/mcp/tools/send-status.js";
import { ToolError } from "../src/mcp/errors.js";
import type { WhatsAppClient } from "../src/whatsapp/client.js";

function fakeClient(overrides: Partial<WhatsAppClient> = {}): WhatsAppClient {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue({
      messageId: "OUT1",
      sentAt: new Date("2026-04-17T12:00:00Z"),
    }),
    onMessage: vi.fn().mockReturnValue(() => {}),
    disconnect: vi.fn().mockResolvedValue(undefined),
    botJid: vi.fn().mockReturnValue("5511999@s.whatsapp.net"),
    ...overrides,
  };
}

describe("send_status", () => {
  it("envia texto e retorna message_id + sent_at", async () => {
    const client = fakeClient();
    const sendStatus = createSendStatus(client, "123@g.us");
    const res = await sendStatus({ message: "olá" });
    expect(client.sendMessage).toHaveBeenCalledWith("123@g.us", "olá");
    expect(res).toEqual({
      ok: true,
      message_id: "OUT1",
      sent_at: "2026-04-17T12:00:00.000Z",
    });
  });

  it("converte markdown no texto", async () => {
    const client = fakeClient();
    const sendStatus = createSendStatus(client, "123@g.us");
    await sendStatus({ message: "olá **mundo**" });
    expect(client.sendMessage).toHaveBeenCalledWith("123@g.us", "olá *mundo*");
  });

  it("transforma erro de envio em ToolError NOT_CONNECTED", async () => {
    const client = fakeClient({
      sendMessage: vi.fn().mockRejectedValue(new Error("socket closed")),
    });
    const sendStatus = createSendStatus(client, "123@g.us");
    await expect(sendStatus({ message: "x" })).rejects.toThrow(ToolError);
  });

  it("valida input vazio", async () => {
    const client = fakeClient();
    const sendStatus = createSendStatus(client, "123@g.us");
    await expect(sendStatus({ message: "" })).rejects.toThrow(ToolError);
  });
});
