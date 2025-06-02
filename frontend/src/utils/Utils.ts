import type { ApplicationError, ApplicationResponse } from '@/types/GlobalTypes'
import * as CryptoJS from 'crypto-js'
import qs from 'qs'
import config from '@/config/config'
import RequestManager from '@/utils/RequestManager'
import { routes } from '@/router'
import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router'
import { GeneralErrors } from '@/types/BackendErrors.ts'
import axios from 'axios'
import { toast } from 'vue3-toastify'
import Global from '@/utils/Global.ts'

export default class Utils {
  static async downloadPdf(url: string, params: Object, filename: string): Promise<void> {
    const token = Utils.buildHmacSha256Signature(params)

    const response = await Global.instanceAxios.post(
      url,
      {
        token,
        data: params,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        responseType: 'blob',
      },
    )

    const blob = new Blob([response.data], { type: 'application/pdf' })
    const downloadUrl = window.URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = filename + '.pdf'
    document.body.appendChild(a)
    a.click()
    a.remove()

    window.URL.revokeObjectURL(downloadUrl)
  }
  static async checkServerHealth(): Promise<boolean> {
    try {
      const response = await axios.get(config.api.endpoint + '/health', { timeout: 2000 })
      if (response.status !== 200) {
        toast.error('Le serveur ne repond plus...')
        return false
      }
      return true
    } catch (e) {
      console.log(e)
      toast.error('Le serveur ne repond plus...')
      return false
    }
  }
  static async postEncodedToBackend<DataResponse>(
    url: string,
    params: Object | FormData,
    config?: Object,
    isUploadFile?: boolean,
  ): Promise<ApplicationResponse<DataResponse>> {
    const token = Utils.buildHmacSha256Signature(params)
    if (isUploadFile) {
      return RequestManager.executePost(
        url,
        {
          token,
          params,
        },
        config,
      )
    } else {
      const data = {
        data: params,
        token,
      }
      return RequestManager.executePost(url, data, config)
    }
  }

  static buildHmacSha256Signature(parameters: Object) {
    const dataQueryString = qs.stringify(parameters) // .replace("%20", "+");
    return CryptoJS.HmacSHA256(dataQueryString, config.api.hmacSecretKey).toString(CryptoJS.enc.Hex)
  }

  static showLoader() {
    const loader = document.getElementById('loader')
    if (loader) {
      loader.style.display = 'block'
    }
  }

  static hideLoader() {
    const loader = document.getElementById('loader')
    if (loader) {
      loader.style.display = 'none'
    }
  }

  static handlerError(error: ApplicationError) {
    // todo: handle error
    // todo: faire un code quand JWT expired et appeler useUserStore.logout()
    let message = ''
    let reason: string | undefined = ''
    switch (error.code) {
      case GeneralErrors.API_SERVER_DOWN:
        message = 'Le serveur est hors service'
        Utils.alertError('Erreur', message)
        break
      case GeneralErrors.UNHANDLED_ERROR:
      default:
        Utils.alertError('Erreur', 'Une erreur inattendue est survenue')
        console.error(error)
        throw new Error(error.message)
    }
  }

  static alertInfo(title: string, message = '', timeout: number | boolean = 5000) {
    const container = document.getElementById('alerts-container')
    const alert = document.createElement('div')
    alert.classList.add('alert', 'alert-info')
    alert.setAttribute('role', 'alert')
    alert.innerHTML = `<svg style="flex-shrink: 0; display: inline; width: 1rem; height: 1rem; margin-inline-end: 0.5rem;" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
      <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"/>
      </svg><span>${title}</span>&nbsp;${message}
    `
    container!.appendChild(alert)
    alert.addEventListener('click', () => {
      alert.remove()
    })
    if (typeof timeout === 'number') {
      setTimeout(() => {
        alert.remove()
      }, timeout)
    }
  }

  static alertError(title: string, message = '', reason = '', timeout = 5000) {
    const container = document.getElementById('alerts-container')
    const alert = document.createElement('div')
    alert.classList.add('alert', 'alert-danger')
    alert.setAttribute('role', 'alert')
    alert.innerHTML = `<svg style="flex-shrink: 0; display: inline; width: 1rem; height: 1rem; margin-inline-end: 0.5rem;" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="-1.7 0 20.4 20.4">
      <path d="M16.417 10.283A7.917 7.917 0 1 1 8.5 2.366a7.916 7.916 0 0 1 7.917 7.917zm-6.804.01 3.032-3.033a.792.792 0 0 0-1.12-1.12L8.494 9.173 5.46 6.14a.792.792 0 0 0-1.12 1.12l3.034 3.033-3.033 3.033a.792.792 0 0 0 1.12 1.119l3.032-3.033 3.033 3.033a.792.792 0 0 0 1.12-1.12z"/>
      </svg><span>${title}</span>&nbsp;${message}
      <div class="text-2xs">details: ${reason}</div>
    `
    container!.appendChild(alert)
    alert.addEventListener('click', () => {
      alert.remove()
    })
    setTimeout(() => {
      alert.remove()
    }, timeout)
  }

  static alertWarning(title: string, message = '', timeout = 5000) {
    const container = document.getElementById('alerts-container')
    const alert = document.createElement('div')
    alert.classList.add('alert', 'alert-warning')
    alert.setAttribute('role', 'alert')
    alert.innerHTML = `<svg style="flex-shrink: 0; display: inline; width: 1rem; height: 1rem; margin-inline-end: 0.5rem;" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 36 36">
      <path class="clr-i-solid clr-i-solid-path-1" d="M18,2.1a16,16,0,1,0,16,16A16,16,0,0,0,18,2.1ZM16.6,8.8a1.4,1.4,0,0,1,2.8,0v12a1.4,1.4,0,0,1-2.8,0ZM18,28.6a1.8,1.8,0,1,1,1.8-1.8A1.8,1.8,0,0,1,18,28.6Z"></path>
      </svg><span>${title}</span>&nbsp;${message}
    `
    container!.appendChild(alert)
    alert.addEventListener('click', () => {
      alert.remove()
    })
    setTimeout(() => {
      alert.remove()
    }, timeout)
  }

  static alertSuccess(title: string, message = '', timeout = 5000) {
    const container = document.getElementById('alerts-container')
    const alert = document.createElement('div')
    alert.classList.add('alert', 'alert-success')
    alert.setAttribute('role', 'alert')
    alert.innerHTML = `<svg style="flex-shrink: 0; display: inline; width: 1rem; height: 1rem; margin-inline-end: 0.5rem;" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 1024 1024">
      <path d="M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896zm-55.808 536.384-99.52-99.584a38.4 38.4 0 1 0-54.336 54.336l126.72 126.72a38.272 38.272 0 0 0 54.336 0l262.4-262.464a38.4 38.4 0 1 0-54.272-54.336L456.192 600.384z"/>
      </svg><span>${title}</span>&nbsp;${message}
    `
    container!.appendChild(alert)
    alert.addEventListener('click', () => {
      alert.remove()
    })
    setTimeout(() => {
      alert.remove()
    }, timeout)
  }

  static ucFirst(string: string) {
    if (!string) {
      return ''
    }
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase()
  }

  static removeUnsupportedCharacters(string: string) {
    if (!string) {
      return string
    }
    return string
      .normalize('NFD')
      .replace(',', '')
      .replace(/\s/g, '')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
  }

  static ucWords(string: string) {
    if (!string) {
      return ''
    }
    return string.toLowerCase().replace(/(?<= )[^\s]|^./g, (a) => a.toUpperCase())
  }

  static buildAcronym(firstname: string, lastname: string) {
    const firsNameFirstLetter = firstname[0].charAt(0).toUpperCase()
    const lastNameFirstLetter = lastname.charAt(0).toUpperCase()
    return firsNameFirstLetter + lastNameFirstLetter
  }

  static isChildOf(parentName: string, currentRoute: RouteLocationNormalized): boolean {
    const parentRoute = Utils.findRouteByName(parentName, routes)
    if (!parentRoute) {
      return false
    }
    const parentPath = Utils.getFullPath(parentRoute, routes)
    return currentRoute.path.startsWith(parentPath)
  }

  static findRouteByName(name: string, routes: RouteRecordRaw[]): RouteRecordRaw | null {
    for (const route of routes) {
      if (route.name === name) {
        return route
      }
      if (route.children) {
        const childRoute = Utils.findRouteByName(name, route.children)
        if (childRoute) {
          return childRoute
        }
      }
    }
    return null
  }

  static getFullPath(route: RouteRecordRaw, allRoutes: RouteRecordRaw[], parentPath = ''): string {
    if (route.path.startsWith('/')) {
      return route.path
    }

    for (const parentRoute of allRoutes) {
      if (parentRoute.children && parentRoute.children.includes(route)) {
        const parentFullPath = Utils.getFullPath(parentRoute, allRoutes)
        return `${parentFullPath}/${route.path}`.replace(/\/+/g, '/')
      }
      if (parentRoute.children) {
        const childPath = Utils.getFullPath(route, parentRoute.children, parentPath)
        if (childPath) {
          return `${parentPath}/${childPath}`.replace(/\/+/g, '/')
        }
      }
    }

    return `${parentPath}/${route.path}`.replace(/\/+/g, '/')
  }

  static isPasswordValid(password: string) {
    const regexPassword = new RegExp(
      // eslint-disable-next-line
      /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[!@#/\\\-_+$&*~]).{12,}$/,
    )
    return regexPassword.test(password)
  }

  static isEmailValid(email: string) {
    const regexEmail = new RegExp(
      // eslint-disable-next-line
      /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    )
    return regexEmail.test(email)
  }

  static uniqueId(length = 20) {
    const letters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
    let pwd = ''
    for (let i = 0; i < length; i++) {
      const random = Math.floor(Math.random() * letters.length)
      pwd += letters[random]
    }
    return pwd
  }

  static randomPassword(length: number) {
    const letters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
    let pwd = ''
    for (let i = 0; i < length; i++) {
      const random = Math.floor(Math.random() * letters.length)
      pwd += letters[random]
    }
    return pwd
  }

  static isPhoneNumberValid(phoneNumber: string) {
    const regexPhoneNumber = new RegExp(
      /(\b(00[0-9]{2}|0)|\B\+[0-9]{2})(\s?\(0\))?(\s)?[1-9]{2}(\s)?[0-9]{3}(\s)?[0-9]{2}(\s)?[0-9]{2}\b/,
    )
    return regexPhoneNumber.test(phoneNumber)
  }
}
