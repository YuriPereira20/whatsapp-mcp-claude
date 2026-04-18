export function silentLogger() {
    const l = {
        level: "silent",
        child: () => l,
        trace: () => { },
        debug: () => { },
        info: () => { },
        warn: () => { },
        error: () => { },
        fatal: () => { },
    };
    return l;
}
//# sourceMappingURL=silent-logger.js.map