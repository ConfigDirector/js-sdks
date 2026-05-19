export class ConfigDirectorNextContextError extends Error {
  public override readonly name: string = "ConfigDirectorNextContextError";

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ConfigDirectorNextContextError.prototype);
  }
}
