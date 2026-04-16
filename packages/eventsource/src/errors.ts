export class StreamClosedError extends Error {
  public override readonly name: string = "StreamClosedError";

  constructor(message: string) {
    super(message);

    Object.setPrototypeOf(this, StreamClosedError.prototype);
  }
}

export class MissingResponseBodyError extends Error {
  public override readonly name: string = "MissingResponseBodyError";

  constructor(message: string) {
    super(message);

    Object.setPrototypeOf(this, MissingResponseBodyError.prototype);
  }
}

export class InvalidOptionError extends Error {
  public override readonly name: string = "InvalidOptionError";

  constructor(message: string) {
    super(message);

    Object.setPrototypeOf(this, InvalidOptionError.prototype);
  }
}

export class ValueOutOfRangeError extends Error {
  public override readonly name: string = "ValueOutOfRangeError";

  constructor(message: string) {
    super(message);

    Object.setPrototypeOf(this, ValueOutOfRangeError.prototype);
  }
}
