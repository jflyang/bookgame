import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pino from "pino";

const require = createRequire(import.meta.url);
const pinoPrettyPath = require.resolve("pino-pretty");

const level = process.env.LOG_LEVEL ?? "debug";
const __dirname = dirname(fileURLToPath(import.meta.url));
const logDir = join(__dirname, "../../logs");

const targets: pino.TransportTargetOptions[] = [
  {
    target: pinoPrettyPath,
    options: { colorize: true, translateTime: "SYS:HH:MM:ss" },
    level: "debug",
  },
  {
    target: "pino/file",
    options: { destination: `${logDir}/app.log`, mkdir: true },
    level: "info",
  },
];

export const logger = process.env.NODE_ENV === "production"
  ? pino({ level, transport: { targets } })
  : pino({ level, transport: { targets } });

export function createModuleLogger(module: string) {
  return logger.child({ module });
}
