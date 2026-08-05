import { SignUp } from "@clerk/nextjs"

export default function RegisterPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background">
      <SignUp
        forceRedirectUrl="/dashboard"
        signInUrl="/login"
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg border border-border rounded-lg",
            headerTitle: "text-foreground",
            headerSubtitle: "text-muted-foreground",
            socialButtonsBlockButton: "border-border",
            formButtonPrimary: "bg-primary hover:bg-primary/90",
          },
        }}
      />
    </div>
  )
}
