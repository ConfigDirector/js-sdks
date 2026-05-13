import { ConfigDirectorConnectionError } from "../errors";

export abstract class AbstractPollingTransport {
  protected fatalError = false;
  protected pollingInterval: ReturnType<typeof setInterval> | undefined;
  protected pollingIntervalSeconds: number = 60;

  protected clearPollingInterval() {
    clearInterval(this.pollingInterval);
  }

  protected schedulePollingInterval(callback: () => void) {
    clearInterval(this.pollingInterval);
    if (this.pollingIntervalSeconds <= 0) {
      return;
    }
    this.pollingInterval = setInterval(callback, this.pollingIntervalSeconds * 1_000);
  }

  protected async handleNonOkResponse(response: Response) {
    if (!response.ok) {
      if (this.isStatusFatal(response.status)) {
        this.fatalError = true;
        throw this.prepareFatalResponseStatusError(response.status, await response.text());
      } else {
        throw new ConfigDirectorConnectionError(
          `Connection failed with status: ${response.status}`,
          response.status,
        );
      }
    }
  }

  protected handleFetchError(fetchError: unknown) {
    if (this.isFetchErrorFatal(fetchError)) {
      this.fatalError = true;
      this.close();
      throw new ConfigDirectorConnectionError(
        `Connection failed with fatal error: ${fetchError}. This is an unrecoverable error, retry attempts will be ignored.`,
      );
    } else if (fetchError instanceof SyntaxError) {
      throw new ConfigDirectorConnectionError(`Failed to parse the response from the server: ${fetchError}`);
    } else {
      throw new ConfigDirectorConnectionError(`Connection failed with error: ${fetchError}.`);
    }
  }

  protected prepareFatalResponseStatusError(
    responseStatus: number,
    errorBody: string | undefined,
  ): ConfigDirectorConnectionError {
    const status = responseStatus ?? 0;
    const headline = `Connection failed with status: ${responseStatus ?? "unknown"}`;
    const serverBody = (errorBody?.trim()?.length ?? 0) > 0 ? ` (${errorBody})` : "";
    const message = `${headline}${serverBody}. This is an unrecoverable error, retry attempts will be ignored.`;
    return new ConfigDirectorConnectionError(message, status);
  }

  protected isStatusFatal(status: number | undefined): boolean {
    return !!status && status >= 400 && status < 500;
  }

  protected isFetchErrorFatal(fetchError: unknown): boolean {
    if ((fetchError as any)?.name === "NotAllowedError") {
      return true;
    } else if (fetchError instanceof TypeError) {
      return true;
    }
    return false;
  }

  public get isConnected(): boolean {
    return this.pollingInterval !== undefined;
  }

  public close() {
    clearInterval(this.pollingInterval);
    this.pollingInterval = undefined;
  }

  public abstract clear(): void;

  public dispose(): void {
    this.close();
    this.clear();
  }
}
