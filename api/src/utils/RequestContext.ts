import { AsyncLocalStorage } from 'async_hooks';
import RequestContextError from "../errors/RequestContextError";
import Utils from "./Utils";

interface RequestContextType {
  userId: number ;
  requestId: string;
}

export class RequestContext {
  private static storage = new AsyncLocalStorage<RequestContextType>();

  static run(context: {  userId: number }, callback: () => void) {
    this.storage.run(
      {
        userId: context.userId,
        requestId: Utils.generateRandomToken(20)
      },
      callback
    );
  }

  /**
   * @throws RequestContextError when called out of a request context
   */
  static getCurrentContext(): RequestContextType {
    const store = this.storage.getStore();

    if (!store)
      throw new RequestContextError();

    return store;
  }

  /**
   * @throws RequestContextError when called out of a request context
   */
  static getUserId(): number {
    return this.getCurrentContext().userId;
  }

  static getRequestId(): string {
    return this.getCurrentContext().requestId;
  }
}
