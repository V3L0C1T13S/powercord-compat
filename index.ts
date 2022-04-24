import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import RikkaPlugin from "@rikka/Common/entities/Plugin";
import { RikkaPowercord } from "./src/Common/Constants";
import { Logger } from "@rikka/API/Utils";
import pkg from "./package.json";

export default class PowercordCompat extends RikkaPlugin {
    Manifest = {
        name: "Powercord Compat",
        description: "Adds Powercord support to Rikka",
        author: "V3L0C1T13S",
        version: pkg.version,
        license: "Apache-2.0",
        dependencies: []
    }

    private powercord?: any;

    private powercord_modules_directory = join(__dirname, 'src', 'powercord-git', 'src', 'fake_node_modules');
    private placein_modules_directory = join(__dirname, 'src', 'NodeMod');

    private experimentalPreload: boolean = true;

    private mkdDirIfNotExists(dir: string, recursive: boolean = false) {
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: recursive });
        }
    }

    private createPowercordDataDir() {
        this.mkdDirIfNotExists(RikkaPowercord.Constants.RKPOWERCORD_FOLDER, true);
        this.mkdDirIfNotExists(RikkaPowercord.Constants.RKPOWERCORD_SETTINGS, true);
        this.mkdDirIfNotExists(RikkaPowercord.Constants.RKPOWERCORD_CACHE, true);
        this.mkdDirIfNotExists(RikkaPowercord.Constants.RKPOWERCORD_LOGS, true);
    }

    private setGlobals() {
        global.NEW_BACKEND = true;
    }

    preInject() {
        console.log("Powercord compat preinjecting...");
        require("./src/ipc/main");
        console.log("Done preinjecting Powercord compat!");
    }

    async inject() {
        console.log("Powercord compat is enabled!");

        this.setGlobals();
        require("./src/ipc/renderer");

        // Place-ins are pushed first so they can override the Powercord modules
        require('module').Module.globalPaths.push(this.placein_modules_directory);

        if (this.experimentalPreload) {
            // All other modules are pushed after so they can be overridden by Place-ins
            require('module').Module.globalPaths.push(this.powercord_modules_directory);
        }

        require('./preloader');

        this.createPowercordDataDir();

        // Might be assigned already
        if (this.powercord) {
            Logger.warn("Powercord already initialized");
            return;
        }

        const Powercord = require("./src/Powercord");
        global.powercord = new Powercord.default(false);
        this.powercord = global.powercord;
    }
}
