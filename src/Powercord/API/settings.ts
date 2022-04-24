const { Flux } = require('powercord/webpack');
import API from "../../NodeMod/powercord/entities/API";

import store from "./settingsStore/store";
import actions from "./settingsStore/actions";
import { Logger } from "@rikka/API/Utils/logger";

export = class SettingsAPI extends API {
    tabs: { [key: string]: any } = {};
    store = store;
    _interval!: NodeJS.Timer;

    registerSettings(tabId: string | number, props: { category: any; render: any; }) {
        if (this.tabs[tabId]) {
            throw new Error(`Settings tab ${tabId} is already registered!`);
        }

        this.tabs[tabId] = props;
        this.tabs[tabId].render = this.connectStores(props.category)(props.render);
        Object.freeze(this.tabs[tabId].render.prototype);
        Object.freeze(this.tabs[tabId]);
    }

    unregisterSettings(tabId: string | number) {
        if (this.tabs[tabId]) {
            delete this.tabs[tabId];
        }
    }

    buildCategoryObject(category: string) {
        return {
            connectStore: (component: any) => this.connectStores(category)(component),
            getKeys: () => store.getSettingsKeys(category),
            get: (setting: string, defaultValue: any) => store.getSetting(category, setting, defaultValue),
            set: (setting: any, newValue: undefined) => {
                if (newValue === void 0) {
                    return actions.toggleSetting(category, setting);
                }
                actions.updateSetting(category, setting, newValue);
            },
            delete: (setting: any) => {
                actions.deleteSetting(category, setting);
            }
        };
    }

    connectStores(category: string) {
        return Flux.connectStores([this.store], () => this._fluxProps(category));
    }

    private _fluxProps(category: string) {
        return {
            settings: store.getSettings(category),
            getSetting: (setting: string, defaultValue: any) => store.getSetting(category, setting, defaultValue),
            updateSetting: (setting: any, value: any) => actions.updateSetting(category, setting, value),
            toggleSetting: (setting: any, defaultValue: any) => actions.toggleSetting(category, setting, defaultValue)
        };
    }

    // Stuff to rewrite
    async startAPI() {
        // defer download a bit
        setTimeout(this.download.bind(this), 1500);
        this._interval = setInterval(this.upload.bind(this), 10 * 60 * 1000);
    }

    async apiWillUnload() {
        clearInterval(this._interval);
        await this.upload();
    }

    async upload() {
        Logger.warn("What is this?");
        return false;
    }

    async download() {
        Logger.warn("What is this?");
        return false;
    }
}
