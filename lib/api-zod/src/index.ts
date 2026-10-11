export * from "./generated/api";
export * from "./generated/types";

// Orval emits a Zod schema (generated/api) and a TypeScript interface
// (generated/types) under the same name for some request/response bodies.
// Prefer the Zod schemas, which is what the api-server imports.
export {
  CreateAssignmentBody,
  CreateSessionBody,
  CreateVideoBody,
  ExchangeMobileAuthorizationCodeBody,
  ExchangeMobileAuthorizationCodeResponse,
  GetCurrentAuthUserResponse,
  MobileLogoutResponse,
  SendMessageBody,
  UpdateAssignmentBody,
  UpdateSessionBody,
} from "./generated/api";
