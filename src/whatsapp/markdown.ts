export function markdownToWhatsApp(md: string): string {
  // Extrai code fences pra não processar conteúdo dentro deles.
  const fences: string[] = [];
  const FENCE_PLACEHOLDER = (i: number) => `\u0000FENCE${i}\u0000`;
  let work = md.replace(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g, (_m, body) => {
    const idx = fences.length;
    fences.push("```\n" + body + "```");
    return FENCE_PLACEHOLDER(idx);
  });

  // Inline code também preservado.
  const codes: string[] = [];
  const CODE_PLACEHOLDER = (i: number) => `\u0001CODE${i}\u0001`;
  work = work.replace(/`([^`\n]+)`/g, (_m, body) => {
    const idx = codes.length;
    codes.push("`" + body + "`");
    return CODE_PLACEHOLDER(idx);
  });

  // Headers: # a ###### → *texto* + linha em branco depois.
  // Replace with placeholder first to avoid interfering with italic conversion
  const headers: string[] = [];
  const HEADER_PLACEHOLDER = (i: number) => `\u0002HEADER${i}\u0002`;
  work = work.replace(/^#{1,6}\s+(.+)$/gm, (_m, title) => {
    const idx = headers.length;
    headers.push("*" + title + "*");
    return HEADER_PLACEHOLDER(idx);
  });

  // Bold: **x** → *x* (also use placeholder to avoid italic conversion)
  const bolds: string[] = [];
  const BOLD_PLACEHOLDER = (i: number) => `\u0003BOLD${i}\u0003`;
  work = work.replace(/\*\*([^\n*]+)\*\*/g, (_m, body) => {
    const idx = bolds.length;
    bolds.push("*" + body + "*");
    return BOLD_PLACEHOLDER(idx);
  });

  // Italic single-star: *x* → _x_ (now only matches original markdown single-stars)
  work = work.replace(/(?<!\*)\*([^\n*]+)\*(?!\*)/g, "_$1_");

  // Links: [texto](url) → texto (url)
  work = work.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");

  // Restaurar headers (with proper newline handling).
  work = work.replace(/\u0002HEADER(\d+)\u0002/g, (_m, i) => headers[Number(i)] + "\n");

  // Restaurar bolds.
  work = work.replace(/\u0003BOLD(\d+)\u0003/g, (_m, i) => bolds[Number(i)]);

  // Restaurar inline code.
  work = work.replace(/\u0001CODE(\d+)\u0001/g, (_m, i) => codes[Number(i)]);

  // Restaurar code fences.
  work = work.replace(/\u0000FENCE(\d+)\u0000/g, (_m, i) => fences[Number(i)]);

  return work;
}
