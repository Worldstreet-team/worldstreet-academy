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

// Server actions
export {
  registerAction,
  loginAction,
  logoutAction,
  logoutAllAction,
  getCurrentUser,
  verifyAuth,
  forgotPasswordAction,
  resetPasswordAction,
  changePasswordAction,
  resendVerificationAction,
  refreshTokensAction,
  isAuthenticated,
  getAccessToken,
} from "./actions"

// User sync functions
export {
  syncUserToLocal,
  getLocalUserByAuthId,
  getLocalUserById,
} from "./sync"

// Redirect helper
export { buildLoginRedirectUrl } from "./redirect"

// Service (server-side only)
export * as authService from "./service"
