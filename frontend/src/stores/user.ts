import { defineStore } from 'pinia'
import type { UserSession } from '@/types/UserType.ts'
import type { ApplicationResponse, ApplicationSession } from '@/types/GlobalTypes.ts'
import { jwtDecode } from 'jwt-decode'
import config from '@/config/config.ts'
import Utils from '@/utils/Utils.ts'

export type UserStore = {
  user: UserSession | null;
  jwt: string
}

export const useUserStore = defineStore(config.api.jwt.name, {
  state: (): UserStore => ({
    user: null as UserSession | null,
    jwt: '' as string
  }),
  getters: {
    isLoggedIn: (state): boolean => state.user !== null,
  },
  actions: {
    async login(credentials: { login: string; password: string }): Promise<ApplicationResponse<{
      user: UserSession;
      jwt: string;
    }>> {
      const response = await Utils.postEncodedToBackend<{
        user: UserSession;
        jwt: string;
      }>('/auth/login', credentials)
      if (!response.success) {
        return response;
      }
      const { user, jwt } = response.data;
      this.setUser(user);
      this.setJwt(jwt);
      return response;
    },
    getDecodeJwt():ApplicationSession | null {
      const jwt = this.getJwt();
      if (!jwt) return null;
      return  jwtDecode(jwt) as ApplicationSession;
    },
    setUser(user: UserSession): void {
      this.user = user
    },
    getUser(): UserSession | null {
      return this.user
    },
    clear(): void {
      this.user = null
      this.jwt = ''
    },
    setJwt(token: string): void {
      this.jwt = token
    },
    getJwt(): string {
      return this.jwt
    },
    getState():UserStore  {
      return {
        user: this.user,
        jwt: this.jwt,
      }
    }
  },
  persist: true,
})
