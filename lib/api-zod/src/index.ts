export * from "./generated/api";
// The generated TypeScript interfaces share names with the Zod schemas above
// (e.g. `CreateSessionBody`), so a second `export *` would be ambiguous. Expose
// them under a `types` namespace, plus the ones the server imports by name.
export type * as types from "./generated/types";
export type { AuthUser } from "./generated/types";
