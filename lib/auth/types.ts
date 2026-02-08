export type AuthUser = {
  userId: string
  email: string
  firstName: string
  lastName: string
  role: "user" | "instructor" | "admin"
  isVerified: boolean
  createdAt: string
}

export type AuthTokens = {
  accessToken: string
  refreshToken: string
}

export type AuthResponse<T = unknown> = {
  success: boolean
  message: string
  data?: T
}

export type LoginCredentials = {
  email: string
  password: string
}

export type RegisterCredentials = {
  email: string
  password: string
  firstName: string
  lastName: string
}

export type ResetPasswordPayload = {
  token: string
  newPassword: string
}

export type ChangePasswordPayload = {
  currentPassword: string
  newPassword: string
}

export type AuthSession = {
  user: AuthUser
  tokens: AuthTokens
}
