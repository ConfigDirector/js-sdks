import type {
  ConfigDirectorLogMessageDecorator,
  ConfigDirectorLogger} from "@js-browser-client/index";
import {
  type ConfigDirectorLoggingLevel,
  createDefaultLogger as createJsSdkLogger,
} from "@js-browser-client/index";

class MessageDecorator implements ConfigDirectorLogMessageDecorator {
  decorateMessage(message: string): string {
    return `[ConfigDirector:vue-sdk] ${message}`;
  }
}

export const createConsoleLogger = (level: ConfigDirectorLoggingLevel): ConfigDirectorLogger => {
  return createJsSdkLogger(level, new MessageDecorator());
};
