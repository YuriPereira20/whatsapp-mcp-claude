export class ToolError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = "ToolError";
    }
    toJSON() {
        return { code: this.code, message: this.message };
    }
}
//# sourceMappingURL=errors.js.map