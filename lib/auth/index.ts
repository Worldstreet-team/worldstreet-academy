// Types
export type {
  AuthUser,
  AuthTokens,
  AuthResponse,
  LoginCredentials,
  RegisterCredentials,
  ResetPasswordPayload,
  ChangePasswordPayload,
  AuthSession,
} from "./types"

export type { LocalUser } from "./sync"

// Server actions (Clerk-based)
export {
  logoutAction,
  logoutAllAction,
  getCurrentUser,
  verifyAuth,
  isAuthenticated,
  getAccessToken,
} from "./actions"

// User sync functions
export {
  syncUserToLocal,
  getLocalUserByAuthId,
  getLocalUserById,
} from "./sync"
