import { DataSource } from "typeorm";
import {WsManager} from "../services/WebSocket/WsManager";

type dataType = { [key: string]: any };

class GlobalStore {
  data: dataType;

  constructor() {
    this.data = {};
  }

  addItem(key: string, item: any) {
    this.data[key] = item;
  }

  getItem<ResponseType>(key: string): ResponseType {
    return this.data[key];
  }
  get<ResponseType>(key: string): ResponseType {
    return this.data[key];
  }

  getORM(): DataSource {
    return this.data["orm"];
  }
  getViewORM(): DataSource {
    return this.data["viewORM"];
  }
  getWs(): WsManager {
    return this.data["wsManager"];
  }
}

const store = new GlobalStore();
export default store;
