import { type ConfigDirectorLogMessageDecorator, type ConfigDirectorLoggingLevel } from "./types";
import { DefaultConsoleLogger } from "../../shared/src/logger";
export { DefaultConsoleLogger } from "../../shared/src/logger";

class LogMessageDecorator implements ConfigDirectorLogMessageDecorator {
  decorateMessage(message: string): string {
    return `[ConfigDirector:js-client-sdk] ${message}`;
  }
}

export const createDefaultLogger = (
  level?: ConfigDirectorLoggingLevel,
  messageDecorator?: ConfigDirectorLogMessageDecorator,
) => {
  return new DefaultConsoleLogger(level ?? "warn", messageDecorator ?? new LogMessageDecorator());
};
