import type {
  ConfigDirectorLogMessageDecorator,
  ConfigDirectorLoggingLevel,
} from "@js-client-core/index";
import { createDefaultLogger } from "@js-client-core/index";

class MessageDecorator implements ConfigDirectorLogMessageDecorator {
  decorateMessage(message: string): string {
    return `[ConfigDirector:react-native-sdk] ${message}`;
  }
}

export const createConsoleLogger = (level?: ConfigDirectorLoggingLevel) =>
  createDefaultLogger(level, new MessageDecorator());
