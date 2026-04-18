import { describe, it, expect } from "vitest";
import { markdownToWhatsApp } from "../src/whatsapp/markdown.js";

describe("markdownToWhatsApp", () => {
  it("converte bold **x** em *x*", () => {
    expect(markdownToWhatsApp("olá **mundo**")).toBe("olá *mundo*");
  });

  it("converte italic _x_ mantendo _x_", () => {
    expect(markdownToWhatsApp("_assim_")).toBe("_assim_");
  });

  it("converte italic *x* (single) em _x_", () => {
    expect(markdownToWhatsApp("palavra *itálica* aqui")).toBe("palavra _itálica_ aqui");
  });

  it("preserva inline code", () => {
    expect(markdownToWhatsApp("use `npm install`")).toBe("use `npm install`");
  });

  it("code fence com linguagem vira fence sem linguagem", () => {
    const input = "```ts\nconst x = 1;\n```";
    const expected = "```\nconst x = 1;\n```";
    expect(markdownToWhatsApp(input)).toBe(expected);
  });

  it("header # vira *X* com quebra", () => {
    expect(markdownToWhatsApp("# Título\ncorpo")).toBe("*Título*\n\ncorpo");
  });

  it("header ## vira *X* com quebra", () => {
    expect(markdownToWhatsApp("## Sub\ncorpo")).toBe("*Sub*\n\ncorpo");
  });

  it("link [x](url) vira 'x (url)'", () => {
    expect(markdownToWhatsApp("veja [docs](https://ex.com)")).toBe(
      "veja docs (https://ex.com)",
    );
  });

  it("preserva texto simples sem marks", () => {
    expect(markdownToWhatsApp("oi tudo bem")).toBe("oi tudo bem");
  });

  it("não mexe em bold DENTRO de code fence", () => {
    const input = "```\n**nao mexe**\n```";
    expect(markdownToWhatsApp(input)).toBe("```\n**nao mexe**\n```");
  });
});
