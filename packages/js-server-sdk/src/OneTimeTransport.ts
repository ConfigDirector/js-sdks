import type { TransportOptions } from "./types";
import { PollingTransport } from "./PollingTransport";

export class OneTimeTransport extends PollingTransport {
  constructor(options: TransportOptions) {
    super(options);
    this.pollingIntervalSeconds = 0;
  }
}
