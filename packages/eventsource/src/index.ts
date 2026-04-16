import { EventSourceClient } from "./EventSourceClient";
import { type EventSourceClientOptions } from "./types";

export const createEventSourceClient = (options: EventSourceClientOptions) => {
  return new EventSourceClient(options);
};
