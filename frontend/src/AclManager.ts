import { useUserStore } from '@/stores/user.ts'
import config from "@/config/config.ts";

export default class AclManager {
  public static hasPermission(routeMustBeLogged: boolean): {
    isAllow: boolean,
    redirectRouteName?: string,
    params?: object
  } {
    const userStore = useUserStore();
    let user = userStore.getUser();
    let jwt = userStore.getDecodeJwt();
    let redirectRouteName = '';
    const params = undefined;

    if (config.isDevModeEnabled) {
      user = {
        id: 1,
        email: 'admin',
        firstname: 'Admin',
        lastname: 'User'
      };
      jwt = {
        iat: 123845,
        exp: Math.floor(Date.now() / 1000) + 99999999,
        user
      }
      return {
        isAllow: true,
        redirectRouteName: '',
        params
      }
    }

    console.log(routeMustBeLogged, user, jwt);

    if (jwt) {
      if (jwt.exp < Date.now() / 1000) {
        userStore.clear();
        return {
          isAllow: false,
          redirectRouteName: "login-page",
          params
        }
      }
    }

    if (!user) {
      if (!routeMustBeLogged) {
        return {
          isAllow: true,
          redirectRouteName: '',
          params
        }
      }
    } else {
      if (!routeMustBeLogged) {
        return {
          isAllow: false,
          redirectRouteName: 'index-page',
          params
        }
      }
    }
    return {
      isAllow: routeMustBeLogged,
      redirectRouteName,
      params
    }
  }
}
