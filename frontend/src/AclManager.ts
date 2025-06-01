import { useUserStore } from '@/stores/user.ts'
import config from '@/config/config.ts'

export default class AclManager {
  public static hasPermission(routeMustBeLogged: boolean): {
    isAllow: boolean
    redirectRouteName?: string
    params?: object
  } {
    const userStore = useUserStore()
    let user = userStore.getUser()
    let jwt = userStore.getDecodeJwt()
    let redirectRouteName = ''
    const params = undefined

    console.log('ACL Check:', user, jwt, routeMustBeLogged)

    if (jwt) {
      if (jwt.exp < Date.now() / 1000) {
        userStore.clear()
        return {
          isAllow: false,
          redirectRouteName: 'login-page',
          params,
        }
      }
    }

    if (!user) {
      if (!routeMustBeLogged) {
        return {
          isAllow: true,
          redirectRouteName: '',
          params,
        }
      }
      routeMustBeLogged = false
      redirectRouteName = 'login-page'
    } else {
      if (routeMustBeLogged) {
        return {
          isAllow: true,
          redirectRouteName: '',
          params,
        }
      }
      routeMustBeLogged = false
      redirectRouteName = 'index-page'
    }
    return {
      isAllow: routeMustBeLogged,
      redirectRouteName,
      params,
    }
  }
}
