import type { TelemetryWorkerClosedEvent, TelemetryWorkerEvent, TelemetryWorkerLoggingEvent } from "./types";
import { ClientTelemetryEventCollector } from "@js-client-core/telemetry";
import { defaultUrlFactory } from "@shared/url";
import { generateValueId } from "./value-id-generator";
import type { ConfigDirectorLogger, ConfigDirectorLoggingLevel } from "@shared/types";

let collector: ClientTelemetryEventCollector | undefined = undefined;
const buildLogEvent = (
  level: ConfigDirectorLoggingLevel,
  message: string,
  ...args: any
): TelemetryWorkerLoggingEvent => {
  return { type: "Log", payload: { level, message, args } };
};

const postLogMessage = (event: TelemetryWorkerLoggingEvent) => {
  try {
    self.postMessage(event);
  } catch {
    // Some log arguments could fail to serialize in which case we'll post only the message without args
    self.postMessage(buildLogEvent(event.payload.level, event.payload.message));
  }
};

const loggerProxy: ConfigDirectorLogger = {
  debug: function (message: string, ...args: any): void {
    postLogMessage(buildLogEvent("debug", message, args));
  },
  info: function (message: string, ...args: any): void {
    postLogMessage(buildLogEvent("info", message, args));
  },
  warn: function (message: string, ...args: any): void {
    postLogMessage(buildLogEvent("warn", message, args));
  },
  error: function (message: string, ...args: any): void {
    postLogMessage(buildLogEvent("error", message, args));
  },
};

addEventListener("message", (message: MessageEvent<TelemetryWorkerEvent>) => {
  const event = message.data;
  if (event.type != "Initialize" && !collector) {
    loggerProxy.info(`[TelemetryWorker] Ignoring ${event.type} because no collector is configured`);
    return;
  }
  loggerProxy.debug(`[TelemetryWorker] Received '${event.type}' event:`, event);

  switch (event.type) {
    case "Initialize":
      collector = new ClientTelemetryEventCollector({
        ...event.payload,
        baseUrl: defaultUrlFactory(event.payload.baseUrl),
        urlFactory: defaultUrlFactory,
        valueIdGenerator: generateValueId,
        logger: loggerProxy,
      });
      break;
    case "EvaluatedConfigEvent":
      collector?.evaluatedConfig(event.payload);
      break;
    case "UpdateContext":
      collector?.updateContext(event.payload.context);
      break;
    case "Flush":
      collector?.forceFlush();
      break;
    case "Close":
      (collector?.close() ?? Promise.resolve()).then(() => {
        const closedMessage: TelemetryWorkerClosedEvent = { type: "Closed" };
        self.postMessage(closedMessage);
        self.close();
      });
      break;
  }
});

export {};
