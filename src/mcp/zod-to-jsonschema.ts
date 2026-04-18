import { z, type ZodTypeAny } from "zod";

/**
 * Converte um schema Zod num JSON Schema plano suficiente pra descrever
 * input de tool MCP. Suporta apenas o subconjunto usado aqui: object com
 * string/number/optional.
 */
export function zodToJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  if (!(schema instanceof z.ZodObject)) {
    throw new Error("zodToJsonSchema suporta apenas ZodObject no topo");
  }
  const shape = schema.shape as Record<string, ZodTypeAny>;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, field] of Object.entries(shape)) {
    const { type, isOptional } = describeField(field);
    properties[key] = type;
    if (!isOptional) required.push(key);
  }
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

function describeField(field: ZodTypeAny): {
  type: Record<string, unknown>;
  isOptional: boolean;
} {
  let isOptional = false;
  let inner = field;
  if (inner instanceof z.ZodOptional) {
    isOptional = true;
    inner = inner.unwrap();
  }
  if (inner instanceof z.ZodString) return { type: { type: "string" }, isOptional };
  if (inner instanceof z.ZodNumber) return { type: { type: "number" }, isOptional };
  if (inner instanceof z.ZodBoolean) return { type: { type: "boolean" }, isOptional };
  throw new Error(`zodToJsonSchema: tipo não suportado ${inner.constructor.name}`);
}
