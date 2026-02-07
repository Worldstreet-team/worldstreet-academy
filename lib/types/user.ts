export type Role = "USER" | "INSTRUCTOR" | "ADMIN"

export type User = {
  id: string
  username: string
  email: string
  bio: string | null
  avatarUrl: string | null
  role: Role
  verified: boolean
  createdAt: string
}
