import PCPluginsManager from "./managers/PluginLoader";
import { join } from "path";
import * as pkg from "../../package.json"
import Updatable from "../NodeMod/powercord/entities/Updatable";
import APIManager from "./managers/API";
import modules from "./modules";
import styleManager from "./managers/styleManager";
import Webpack from "../powercord-git/src/fake_node_modules/powercord/webpack";
import { Logger } from "@rikka/API/Utils/logger";
import { sleep } from "@rikka/API/Utils";
import { get } from "../NodeMod/powercord/http";
import constants from "../NodeMod/powercord/constants";
const { shell: { openExternal } } = require('electron');

let hide_rikka = false;

type powercordAccount = {
    token?: string,
}
export default class Powercord extends Updatable {
    api = {};

    apiManager = new APIManager();

    pluginManager = new PCPluginsManager();

    styleManager = new styleManager();

    initialized: boolean = false;

    settings: any;

    gitInfos = {
        upstream: 'https://github.com/powercord-org/powercord',
        branch: 'v2',
        revision: '7'
    };

    private account: powercordAccount | null = null;

    private isLinking = false;

    constructor(hidden: boolean = true) {
        super(join(__dirname, '..', '..'), '', 'powercord-compat');
        hide_rikka = hidden;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        Logger.trace("Starting Powercord Emulator");

        await Webpack.init();

        await Promise.all(modules.map((mdl: () => any) => mdl()));
        this.emit('initializing');

        await this.startup();
        this.fetchAccount();
        //(this.gitInfos = await this.pluginManager.get('pc-updater') as any)?.getGitInfos();

        if (this.settings.get('hideToken', true)) {
            const tokenModule = await require('powercord/webpack').getModule(['hideToken']);
            tokenModule.hideToken = () => void 0;
            setImmediate(() => tokenModule.showToken()); // just to be sure
        }

        window.addEventListener('beforeunload', () => {
            if (this.account && this.settings.get('settingsSync', false))
                powercord.api.settings.upload();
        });

        this.emit('loaded');
    }

    async startup() {
        await this.apiManager.startAPIs();
        this.settings = powercord.api.settings.buildCategoryObject('pc-general');
        this.emit('settingsReady');

        const coremods = require('./coremods');
        await coremods.load();

        await this.pluginManager.startPlugins();

        this.initialized = true;
    }

    get rikkapc_version() {
        if (hide_rikka) {
            Logger.trace("A plugin is trying to access Rikka's version when Rikka is hidden.");
            return;
        }
        return pkg.version;
    }

    async fetchAccount () {
        if (this.isLinking) {
          while (this.isLinking) {
            await sleep(1);
          }
          return;
        }
    
        this.isLinking = true;
        const token = this.settings.get('powercordToken', null);
        if (token) {
          const baseUrl = this.settings.get('backendURL', constants.WEBSITE);
          console.debug('%c[Powercord]', 'color: #7289da', 'Logging in to your account...');
    
          const resp = await get(`${baseUrl}/api/v2/users/@me`)
            .set('Authorization', token)
            .catch(e => e) as any;
    
          if (resp.statusCode === 401) {
            if (!resp.body.error && resp.body.error !== 'DISCORD_REVOKED') {
              powercord.api.notices.sendAnnouncement('pc-account-discord-unlinked', {
                color: 'red',
                message: 'Your Powercord account is no longer linked to your Discord account! Some integrations will be disabled.',
                button: {
                  text: 'Link it back',
                  onClick: () => openExternal(`${constants.WEBSITE}/api/v2/oauth/discord`)
                }
              });
    
              this.isLinking = false;
              return; // keep token stored
            }
            this.settings.set('powercordToken', null);
            this.account = null;
            this.isLinking = false;
            return console.error('%c[Powercord]', 'color: #7289da', 'Unable to fetch your account (Invalid token). Removed token from config');
          } else if (resp.statusCode !== 200) {
            this.account = null;
            this.isLinking = false;
            return console.error('%c[Powercord]', 'color: #7289da', `An error occurred while fetching your account: ${resp.statusCode} - ${resp.statusText}`, resp.body);
          }
    
          this.account = resp.body;
          this.account!.token = token;
        } else {
          this.account = null;
        }
        console.debug('%c[Powercord]', 'color: #7289da', 'Logged in!');
        this.isLinking = false;
      }
}
