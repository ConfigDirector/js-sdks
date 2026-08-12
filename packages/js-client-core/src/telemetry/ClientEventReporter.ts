import { isDroppedEventsEmpty, isEventListEmpty } from "@shared/telemetry/utils";
import type { ConfigDirectorContext, ConfigDirectorLogger, IdentifyingSdkOptions } from "../types";
import type {
  AggregatedEventList,
  DiscreteEventList,
  DroppedEvents,
  EventReport,
  EventReporter,
  ReporterResponse,
} from "./types";
import { fetchWithTimeout } from "@shared/fetchWithTimeout";
import { isFetchErrorFatal } from "../errors";
import type { UrlFactory, UrlLike } from "@shared/url";

export type EventReporterOptions = {
  sdkKey: string;
  sdkIdentity: IdentifyingSdkOptions;
  logger: ConfigDirectorLogger;
  baseUrl: UrlLike;
  urlFactory: UrlFactory;
};

export class ClientEventReporter implements EventReporter {
  private readonly sdkKey: string;
  private readonly sdkIdentity: IdentifyingSdkOptions;
  private readonly logger: ConfigDirectorLogger;
  private readonly url: UrlLike;
  private executeRequests = true;

  constructor(options: EventReporterOptions) {
    this.sdkKey = options.sdkKey;
    this.logger = options.logger;
    this.sdkIdentity = options.sdkIdentity;
    this.url = options.urlFactory("client/telemetry/v1", options.baseUrl);
  }

  public async report({
    context,
    discreteEvents,
    aggregatedEvents,
    droppedEvents,
  }: {
    context?: ConfigDirectorContext | undefined;
    discreteEvents: DiscreteEventList;
    aggregatedEvents: AggregatedEventList;
    droppedEvents?: DroppedEvents;
  }): Promise<ReporterResponse> {
    if (!this.executeRequests) {
      return { success: false, fatalError: true };
    }

    const eventReport: EventReport = {
      clientSdkKey: this.sdkKey,
      metaContext: {
        sdkName: this.sdkIdentity.sdkName,
        sdkVersion: this.sdkIdentity.sdkVersion,
      },
      context,
      discreteEvents,
      aggregatedEvents,
      droppedEvents,
    };
    if (this.isReportEmpty(eventReport)) {
      return { success: true, fatalError: false };
    }

    const response = await this.sendReport(eventReport);
    if (response.fatalError) {
      this.executeRequests = false;
    }
    return response;
  }

  private isReportEmpty(eventReport: EventReport) {
    return (
      isEventListEmpty(eventReport.discreteEvents) &&
      isEventListEmpty(eventReport.aggregatedEvents) &&
      isDroppedEventsEmpty(eventReport.droppedEvents)
    );
  }

  private async sendReport(eventReport: EventReport): Promise<ReporterResponse> {
    try {
      const response = await fetchWithTimeout(
        5_000,
        this.url,
        {
          method: "POST",
          body: JSON.stringify(eventReport),
          keepalive: true,
        },
        this.logger,
      );

      const isFatalError = this.isStatusFatal(response.status);
      if (isFatalError) {
        this.logger.warn(
          `[EventReporter] Received a fatal status response (${response.status}) from the telemetry endpoint. No more telemetry data will be sent.`,
        );
      }
      return { success: response.ok, fatalError: isFatalError };
    } catch (error) {
      const isFatal = isFetchErrorFatal(error);
      this.logger.warn(`[EventReporter] Error attempting to send telemetry data: ${error}`, { error });
      return { success: false, fatalError: isFatal };
    }
  }

  private isStatusFatal(status: number | undefined): boolean {
    return !!status && status >= 400 && status < 500;
  }
}
