import type {
  ConfigDirectorLogMessageDecorator,
  ConfigDirectorLoggingLevel,
  ConfigDirectorLogger,
} from "@js-browser-client/index";
import { createDefaultLogger as createJsSdkLogger } from "@js-browser-client/index";

class LogMessageDecorator implements ConfigDirectorLogMessageDecorator {
  decorateMessage(message: string): string {
    return `[ConfigDirector:nextjs-sdk] ${message}`;
  }
}

export const createConsoleLogger = (level: ConfigDirectorLoggingLevel): ConfigDirectorLogger => {
  return createJsSdkLogger(level, new LogMessageDecorator());
};
