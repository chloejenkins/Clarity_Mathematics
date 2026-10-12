// A stand-in for the Drizzle `db` so route handlers can run without Postgres.
//
// Every query builder chain (`db.select().from(t).where(...).limit(1)` etc.)
// is a thenable: when the handler awaits it, it resolves to the next result
// queued with `fakeDb.queue(...)`, in the order the handler awaits queries.
// Unqueued awaits resolve to `[]`. Each top-level call (select / insert /
// update / delete) is recorded in `fakeDb.calls` so tests can assert that a
// rejected request never wrote anything, and every `.values(...)` / `.set(...)`
// argument is recorded in `fakeDb.payloads` so tests can check what was written.

type Op = "select" | "insert" | "update" | "delete";

export interface FakeDb {
  db: Record<Op, (...args: unknown[]) => unknown>;
  calls: Op[];
  payloads: unknown[];
  queue: (...results: unknown[]) => void;
  reset: () => void;
  writes: () => Op[];
}

export function createFakeDb(): FakeDb {
  const pending: unknown[] = [];
  const calls: Op[] = [];
  const payloads: unknown[] = [];

  function chain(): unknown {
    const proxy: unknown = new Proxy(() => {}, {
      get(_target, prop) {
        if (prop === "then") {
          const result = pending.length > 0 ? pending.shift() : [];
          return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject);
        }
        if (prop === "values" || prop === "set") {
          return (payload: unknown) => {
            payloads.push(payload);
            return proxy;
          };
        }
        return () => proxy;
      },
    });
    return proxy;
  }

  const op = (name: Op) => () => {
    calls.push(name);
    return chain();
  };

  return {
    db: { select: op("select"), insert: op("insert"), update: op("update"), delete: op("delete") },
    calls,
    payloads,
    queue: (...results) => pending.push(...results),
    reset: () => {
      pending.length = 0;
      calls.length = 0;
      payloads.length = 0;
    },
    writes: () => calls.filter((c) => c !== "select"),
  };
}

/**
 * Shared instance; test files wire it in with `vi.mock("@workspace/db", ...)`.
 * Kept on globalThis so it survives `vi.resetModules()`, which re-evaluates
 * this module but not the already-built `@workspace/db` mock.
 */
const g = globalThis as { __fakeDb?: FakeDb };
export const fakeDb: FakeDb = (g.__fakeDb ??= createFakeDb());
