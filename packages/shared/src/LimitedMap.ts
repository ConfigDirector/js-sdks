export class LimitedMap<K, V> extends Map<K, V> {
  private readonly limit: number;
  private _droppedCount: number = 0;

  constructor(limit: number, entries?: [K, V][]) {
    super(entries);
    this.limit = limit;
    this.enforceLimit();
  }

  public override set(key: K, value: V): this {
    super.set(key, value);
    this.enforceLimit();
    return this;
  }

  public get droppedCount(): number {
    return this._droppedCount;
  }

  public clearAndReset() {
    this.clear();
    this._droppedCount = 0;
  }

  private enforceLimit() {
    while (this.size > this.limit) {
      const oldestKey = this.keys().next().value;
      if (oldestKey !== undefined) {
        this.delete(oldestKey);
        this._droppedCount += 1;
      }
    }
  }
}
