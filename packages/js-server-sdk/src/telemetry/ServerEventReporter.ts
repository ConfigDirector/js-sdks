import { isDroppedEventsEmpty, isEventListEmpty } from "@shared/telemetry/utils";
import type { ConfigDirectorLogger } from "../types";
import type { EventReport, EventReporter, EventReporterPayload, ReporterResponse } from "./types";
import { fetchWithTimeout } from "@shared/fetchWithTimeout";
import {type UrlLike } from "@shared/url";

export type EventReporterOptions = {
  sdkKey: string;
  logger: ConfigDirectorLogger;
  baseUrl: UrlLike;
};

export class ServerEventReporter implements EventReporter {
  private readonly sdkKey: string;
  private readonly logger: ConfigDirectorLogger;
  private readonly url: URL;
  private executeRequests = true;

  constructor(options: EventReporterOptions) {
    this.sdkKey = options.sdkKey;
    this.logger = options.logger;
    this.url = new URL("server/telemetry/v1", options.baseUrl.toString());
  }

  public async report({
    discreteEvents,
    aggregatedEvents,
    droppedEvents,
  }: EventReporterPayload): Promise<ReporterResponse> {
    if (!this.executeRequests) {
      return { success: false, fatalError: true };
    }

    const eventReport: EventReport = {
      serverSdkKey: this.sdkKey,
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
      this.logger.warn(`[EventReporter] Error attempting to send telemetry data: ${error}`, { error });
      return { success: false, fatalError: false };
    }
  }

  private isStatusFatal(status: number | undefined): boolean {
    return !!status && status >= 400 && status < 500;
  }
}
