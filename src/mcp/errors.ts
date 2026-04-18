export type ToolErrorCode =
  | "NOT_CONNECTED"
  | "GROUP_UNREACHABLE"
  | "TIMEOUT"
  | "ALREADY_WAITING"
  | "INVALID_INPUT";

export class ToolError extends Error {
  constructor(
    public readonly code: ToolErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ToolError";
  }

  toJSON(): { code: ToolErrorCode; message: string } {
    return { code: this.code, message: this.message };
  }
}
