export class ConfigDirectorReactContextError extends Error {
  public override readonly name: string = "ConfigDirectorReactContextError";

  constructor(message: string) {
    super(message);

    Object.setPrototypeOf(this, ConfigDirectorReactContextError.prototype);
  }
}
