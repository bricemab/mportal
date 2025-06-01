import * as qs from "qs";
import * as crypto from "crypto";
import config from "../config/config";
import { ApplicationError } from "./Types";
import * as util from "node:util";

const buildHmacSha256Signature = (parameters: object) => {
  const dataQueryString = qs.stringify(parameters); // .replace("%20", "+");
  return crypto
    .createHmac("sha256", config.security.hmacSecretKey)
    .update(dataQueryString)
    .digest("hex");
};

const validateHmacSha256Signature = (token: string, data: object) => {
  const signature = buildHmacSha256Signature(data);
  return signature === token;
};

export default {
  buildHmacSha256Signature,
  validateHmacSha256Signature,
  formatStringWithStars(str: string, start = 3) {
    return `${str.substring(0, start)}*****`;
  },
  platform(userAgent: string) {
    const toMatch = [
      /Android/i,
      /webOS/i,
      /iPhone/i,
      /iPad/i,
      /iPod/i,
      /BlackBerry/i,
      /Windows Phone/i,
    ];

    toMatch.some((toMatchItem) => {
      const m = userAgent.match(toMatchItem);
      if (m) {
        return toMatchItem;
      }
    });
    return "Computer";
  },
  debug(variable: any) {
    console.log(util.inspect(variable, false, null, true /* enable colors */));
  },
  manageError(errorMessage: ApplicationError) {
    // Logger.error(errorMessage.toString());
    this.debug(errorMessage);
  },
  removeAccents(string: string): string {
    return string.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  },
  isValidEmail(email: string): boolean {
    const emailRegEx = new RegExp(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    );
    return emailRegEx.test(email);
  },
  generateRandomToken(length: number) {
    const a =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890".split(
        "",
      );
    const b = [];
    for (let i = 0; i < length; i++) {
      const j: number = (Math.random() * (a.length - 1)).toFixed(
        0,
      ) as unknown as number;
      b[i] = a[j];
    }
    return b.join("");
  },

  generateCurrentDateFileName() {
    const today = new Date();
    return `${today.getFullYear()}_${today.getMonth() + 1}_${today.getDate()}`;
  },
  ucFirst(string: string) {
    if (!string) {
      return "";
    }
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
  },
  ucWords(string: string) {
    if (!string) {
      return "";
    }
    return string
      .toLowerCase()
      .replace(/(?<= )[^\s]|^./g, (a) => a.toUpperCase());
  },
  replaceAllString(str: string, find: string, replace: string) {
    function escapeRegExp(string: string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
    }
    return str.replace(new RegExp(escapeRegExp(find), "g"), replace);
  },
  shortId() {
    return `_${Math.random().toString(36).substr(2, 9)}`;
  },
  createTimeOutPromise(delayMs: number) {
    return new Promise((resolve) => {
      setTimeout(() => resolve("timeout"), delayMs);
    });
  },
  uniqueId(length = 20) {
    const ALPHABET =
      "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

    if (!length) {
      length = 9;
    }

    let result = "";
    for (let i = 0; i < length; i++) {
      result += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
    }

    return result;
  },
  generateCode(length: number) {
    let result = "";
    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#&-_|+=";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  },
  generateNumberCode(length: number) {
    let result = "";
    const characters = "0123456789";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  },
  isPasswordValid(password: string) {
    const regexPassword = new RegExp(
      /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[!@#\/\\\-_+$&*~]).{8,}$/,
    );
    return regexPassword.test(password);
  },
  isEmailValid(email: string) {
    const regexEmail = new RegExp(
      /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    );
    return regexEmail.test(email);
  },
  isPhoneNumberValid(phoneNumber: string) {
    const regexPhoneNumber = new RegExp(
      /(\b(0041|0)|\B\+41)(\s?\(0\))?(\s)?[1-9]{2}(\s)?[0-9]{3}(\s)?[0-9]{2}(\s)?[0-9]{2}\b/,
    );
    return regexPhoneNumber.test(phoneNumber);
  },
};
