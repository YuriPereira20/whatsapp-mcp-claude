export function silentLogger(): any {
  const l: any = {
    level: "silent",
    child: () => l,
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    fatal: () => {},
  };
  return l;
}
