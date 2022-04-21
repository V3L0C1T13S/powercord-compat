import { Logger } from "@rikka/API/Utils";
import Events from "events";


export = class API extends Events {
  ready: boolean = false;

  async _load(): Promise<void> {
    if (typeof this.startAPI === 'function') {
      await this.startAPI().catch(e => this.error(`api load error: ${e}`));
    }
    this.log('API loaded');
    this.ready = true;
  }

  async _unload(): Promise<void> {
    if (typeof this.apiWillUnload === 'function') {
      await this.apiWillUnload().catch(e => this.error(`api unload error: ${e}`));
    }
    this.ready = false;
  }

  async startAPI(): Promise<void> {
    return;
  }

  async apiWillUnload(): Promise<void> {
    return;
  }

  log = (...data: string[]) => Logger.log(`${this.constructor.name} TRACE ${data}`);

  warn = (...data: string[]) => Logger.warn(`${this.constructor.name} WARN ${data}`);

  error = (...data: string[]) => Logger.error(`${this.constructor.name} ERROR ${data}`);
}
