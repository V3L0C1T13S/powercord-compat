import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { Logger } from "@rikka/API/Utils/logger";
import constants from "../../../NodeMod/powercord/constants";
import ActionTypes from "./constants";
const { Flux, FluxDispatcher } = require('powercord/webpack');

if (!existsSync(constants.SETTINGS_FOLDER))
    mkdirSync(constants.SETTINGS_FOLDER);

function loadSettings(file: string) {
    const categoryId = file.split('.')[0];
    try {
        return [
            file.split('.')[0],
            JSON.parse(
                readFileSync(join(constants.SETTINGS_FOLDER, file), 'utf8')
            )
        ];
    } catch (e) {
        // Maybe corrupted settings; Let's consider them empty
        return [categoryId, {}];
    }
}

const settings = Object.fromEntries(
    readdirSync(constants.SETTINGS_FOLDER)
        .filter(f => !f.startsWith('.') && f.endsWith('.json'))
        .map(loadSettings)
);

function updateSettings(category: string | number, newSettings: any) {
    if (!settings[category]) {
        settings[category] = {};
    }
    Object.assign(settings[category], newSettings);
}

function updateSetting(category: string | number, setting: string | number, value: undefined) {
    if (!settings[category]) {
        settings[category] = {};
    }
    if (value === void 0) {
        delete settings[category][setting];
    } else {
        settings[category][setting] = value;
    }
}

function toggleSetting(category: string | number, setting: string | number, defaultValue: any) {
    if (!settings[category]) {
        settings[category] = {};
    }
    const previous = settings[category][setting];
    if (previous === void 0) {
        settings[category][setting] = !defaultValue;
    } else {
        settings[category][setting] = !previous;
    }
}

function deleteSetting(category: string, setting: string) {
    if (!settings[category]) {
        settings[category] = {};
    }
    delete settings[category][setting];
}

class SettingsStore extends Flux.Store {
    constructor(Dispatcher: any, handlers: { [x: string]: ({ category, settings }: any) => void; }) {
        super(Dispatcher, handlers);

        //@ts-ignore
        this._persist = global._.debounce(this._persist.bind(this), 1000);
        this.addChangeListener(this._persist);
    }

    getAllSettings() {
        return settings;
    }

    getSettings(category: string) {
        return settings[category] || {};
    }

    getSetting(category: string, nodePath: string, defaultValue: any) {
        const nodePaths = nodePath.split('.');
        let currentNode = this.getSettings(category);

        for (const fragment of nodePaths) {
            currentNode = currentNode[fragment];
        }

        return (currentNode === void 0 || currentNode === null)
            ? defaultValue
            : currentNode;
    }

    getSettingsKeys(category: string) {
        return Object.keys(this.getSettings(category));
    }

    _persist() {
        Logger.log(`Settings are ${JSON.stringify(settings)}`);
        for (const category in settings) {
            Logger.log("Writing settings for category " + category);
            const file = join(constants.SETTINGS_FOLDER, `${category}.json`);
            const data = JSON.stringify(settings[category], null, 2);
            writeFileSync(file, data);
        }
    }
}


export = new SettingsStore(FluxDispatcher, {
    [ActionTypes.UPDATE_SETTINGS]: ({ category, settings }: any) => updateSettings(category, settings),
    [ActionTypes.TOGGLE_SETTING]: ({ category, setting, defaultValue }: any) => toggleSetting(category, setting, defaultValue),
    [ActionTypes.UPDATE_SETTING]: ({ category, setting, value }: any) => updateSetting(category, setting, value),
    [ActionTypes.DELETE_SETTING]: ({ category, setting }: any) => deleteSetting(category, setting)
});