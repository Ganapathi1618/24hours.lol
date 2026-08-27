/** Minimal PostgREST-shaped stub: enough of the builder to exercise lib/settle. */
type Row = Record<string, unknown>;

export class FakeDb {
  tables: Record<string, Row[]> = { hours: [], bids: [] };
  /** Runs immediately before an `update` is applied, to simulate a racing writer. */
  beforeUpdate: (() => void) | null = null;
  /** Forces the next insert into `hours` to raise a unique violation. */
  failNextHoursInsert = false;

  from(table: string) {
    return new FakeQuery(this, table);
  }
}

type Op = 'select' | 'insert' | 'update' | null;

class FakeQuery implements PromiseLike<{ data: Row[] | null; error: { message: string; code?: string } | null }> {
  private op: Op = null;
  private payload: Row | null = null;
  private eqs: Array<[string, unknown]> = [];
  private neqs: Array<[string, unknown]> = [];
  private ins: Array<[string, unknown[]]> = [];

  constructor(private db: FakeDb, private table: string) {}

  select(_columns?: string): this {
    if (this.op === null) this.op = 'select';
    return this;
  }
  insert(payload: Row): this {
    this.op = 'insert';
    this.payload = payload;
    return this;
  }
  update(payload: Row): this {
    this.op = 'update';
    this.payload = payload;
    return this;
  }
  eq(column: string, value: unknown): this {
    this.eqs.push([column, value]);
    return this;
  }
  neq(column: string, value: unknown): this {
    this.neqs.push([column, value]);
    return this;
  }
  in(column: string, values: unknown[]): this {
    this.ins.push([column, values]);
    return this;
  }
  limit(_n: number): this {
    return this;
  }
  order(): this {
    return this;
  }

  private matches(row: Row): boolean {
    // PostgREST compares numerics loosely across string/number representations.
    const same = (a: unknown, b: unknown) =>
      typeof a === 'number' || typeof b === 'number' ? Number(a) === Number(b) : a === b;
    return (
      this.eqs.every(([col, value]) => same(row[col], value)) &&
      this.neqs.every(([col, value]) => !same(row[col], value)) &&
      this.ins.every(([col, values]) => values.some((value) => same(row[col], value)))
    );
  }

  private run() {
    const rows = this.db.tables[this.table] ?? [];

    if (this.op === 'insert') {
      if (this.table === 'hours' && this.db.failNextHoursInsert) {
        this.db.failNextHoursInsert = false;
        return { data: null, error: { message: 'duplicate key', code: '23505' } };
      }
      const row = { id: `${this.table}-${rows.length + 1}`, ...this.payload };
      rows.push(row);
      return { data: [row], error: null };
    }

    if (this.op === 'update') {
      this.db.beforeUpdate?.();
      const current = this.db.tables[this.table] ?? [];
      const hit = current.filter((row) => this.matches(row));
      for (const row of hit) Object.assign(row, this.payload);
      return { data: hit, error: null };
    }

    // PostgREST hands back decoded JSON, never a live reference to storage.
    return { data: rows.filter((row) => this.matches(row)).map((row) => ({ ...row })), error: null };
  }

  async maybeSingle() {
    const { data, error } = this.run();
    return { data: data && data.length > 0 ? data[0] : null, error };
  }

  then<R1 = { data: Row[] | null; error: null }, R2 = never>(
    onfulfilled?: ((value: { data: Row[] | null; error: { message: string; code?: string } | null }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}
