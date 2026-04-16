import { DefaultConsoleLogger } from "@shared/logger";
import type { ConfigDirectorLoggingLevel, ConfigDirectorLogMessageDecorator } from "@shared/types";

class LogMessageDecorator implements ConfigDirectorLogMessageDecorator {
  decorateMessage(message: string): string {
    return `[ConfigDirector:js-server-sdk] ${message}`;
  }
}

export const createDefaultLogger = (
  level?: ConfigDirectorLoggingLevel,
  messageDecorator?: ConfigDirectorLogMessageDecorator,
) => {
  return new DefaultConsoleLogger(level ?? "warn", messageDecorator ?? new LogMessageDecorator());
};
