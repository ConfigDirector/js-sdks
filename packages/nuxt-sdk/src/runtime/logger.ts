import { DefaultConsoleLogger } from "@shared/logger";
import type { ConfigDirectorLoggingLevel, ConfigDirectorLogMessageDecorator } from "@shared/types";

class LogMessageDecorator implements ConfigDirectorLogMessageDecorator {
  decorateMessage(message: string): string {
    return `[ConfigDirector:nuxt-sdk] ${message}`;
  }
}

// Nitro intercepts console.debug during request handling and filters it via consola's default log level.
// Using console.log ensures debug messages are visible in the server terminal.
class NuxtConsoleLogger extends DefaultConsoleLogger {
  override debug(message: string, ...args: any): void {
    this.log(console.log, "debug", message, ...args);
  }
}

export const createDefaultLogger = (
  level?: ConfigDirectorLoggingLevel,
  messageDecorator?: ConfigDirectorLogMessageDecorator,
) => {
  return new NuxtConsoleLogger(level ?? "warn", messageDecorator ?? new LogMessageDecorator());
};
