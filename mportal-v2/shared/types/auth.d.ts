declare module '#auth-utils' {
  interface User {
    id: number
    email: string
    firstname: string
    lastname: string
  }

  interface UserSession {
    loggedInAt?: string
  }

  interface SecureSessionData {
    sessionVersion: number
  }
}

export {}
