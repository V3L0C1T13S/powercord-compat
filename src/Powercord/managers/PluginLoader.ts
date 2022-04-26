import { Logger } from "@rikka/API/Utils";
import { readdirSync } from "fs";
import { join, resolve } from "path";
import Plugin from "../../NodeMod/powercord/entities/Plugin";
import { rmdirRf } from "../../powercord-git/src/fake_node_modules/powercord/util";

export default class PCPluginsManager {
    readonly pluginDir = PCPluginsManager.getPluginDirectory();
    plugins = new Map<string | any, Plugin>();

    load(pluginName: string) {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) throw new Error(`Failed to load plugin: ${pluginName}`);
        if (plugin.ready) return;

        plugin._load();
    }

    enablePlugin(pluginName: string) {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) throw new Error(`Failed to enable plugin: ${pluginName}`);
        if (plugin.ready) return;

        plugin._load();
    }

    static getPluginDirectory() {
        return resolve(join(__dirname, '..'), 'plugins');
    }

    mount(pluginName: string) {
        try {
            const pluginClass = require(resolve(this.pluginDir, pluginName));
            pluginClass.entityID = pluginName;
            const plugin = new pluginClass();
            Object.defineProperties(plugin, {
                entityID: {
                    get: () => pluginName,
                    set: () => {
                        throw new Error('Cannot set entityID');
                    }
                }
            })
            if (!pluginClass) throw new Error(`Failed to mount plugin: ${pluginName}`);

            this.plugins.set(pluginName, plugin);
        } catch (e) {
            Logger.error(`Failed to mount plugin: ${pluginName}. ${e}`);
        }
    }

    remount(pluginName: string) {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) throw new Error(`Failed to remount plugin: ${pluginName}`);
        if (plugin.ready) return;

        this.mount(pluginName);
    }

    async unmount (pluginID: string) {
        const plugin = this.get(pluginID);
        if (!plugin) {
          throw new Error(`Tried to unmount a non installed plugin (${plugin})`);
        }
        if (plugin.ready) {
          await plugin._unload();
        }
    
        Object.keys(require.cache).forEach(key => {
          if (key.includes(pluginID)) {
            delete require.cache[key];
          }
        });
        this.plugins.delete(pluginID);
      }
    
    // Enable
  enable (pluginID: string) {
    if (!this.get(pluginID)) {
      throw new Error(`Tried to enable a non installed plugin (${pluginID})`);
    }

    powercord.settings.set(
      'disabledPlugins',
      powercord.settings.get('disabledPlugins', []).filter((p: string) => p !== pluginID)
    );

    this.load(pluginID);
  }

    // Getters
  get (pluginID: string) {
    return this.plugins.get(pluginID);
  }

  getPlugins () {
    return [ ...this.plugins.keys() ];
  }

  isInstalled (plugin: string) {
    return this.plugins.has(plugin);
  }

  isEnabled (plugin: any) {
    return !powercord.settings.get('disabledPlugins', []).includes(plugin);
  }

    disable (pluginID: string) {
        const plugin = this.get(pluginID);
    
        if (!plugin) {
          throw new Error(`Tried to disable a non installed plugin (${pluginID})`);
        }
    
        powercord.settings.set('disabledPlugins', [
          ...powercord.settings.get('disabledPlugins', []),
          pluginID
        ]);
    
        this.unload(pluginID);
      }
    
      // noinspection JSUnusedLocalSymbols - Install
      async install (pluginID: any) { // eslint-disable-line no-unused-vars
        throw new Error('Not implemented');
      }
    
      async uninstall (pluginID: string) {
        if (pluginID.startsWith('pc-')) {
          throw new Error(`You cannot uninstall an internal plugin. (Tried to uninstall ${pluginID})`);
        }
    
        await this.unmount(pluginID);
        await rmdirRf(resolve(this.pluginDir, pluginID));
      }
    
      // Start
      startPlugins (sync = false) {
        const missingPlugins = [];
        const isOverlay = (/overlay/).test(location.pathname);
        readdirSync(this.pluginDir).sort(this._sortPlugins).forEach(filename => !this.isInstalled(filename) && this.mount(filename));
        for (const plugin of [ ...this.plugins.values() ]) {
          if (powercord.settings.get('disabledPlugins', []).includes(plugin.entityID)) {
            continue;
          }
          if (
            (plugin.manifest.appMode === 'overlay' && isOverlay) ||
            (plugin.manifest.appMode === 'app' && !isOverlay) ||
            plugin.manifest.appMode === 'both'
          ) {
            if (sync && !this.get(plugin.entityID ?? "")?.ready) {
              this.load(plugin.entityID ?? "");
              missingPlugins.push(plugin.entityID);
            } else if (!sync) {
              this.load(plugin.entityID ?? "");
            }
          } else {
            this.plugins.delete(plugin);
          }
        }
    
        if (sync) {
          return missingPlugins;
        }
        return;
      }
    
      shutdownPlugins () {
        return this._bulkUnload([ ...powercord.pluginManager.plugins.keys() ]);
      }
    
      _sortPlugins (pluginA: string, pluginB: string) {
        const priority = [ 'pc-commands', 'pc-settings', 'pc-moduleManager', 'pc-updater' ].reverse();
        const priorityA = priority.indexOf(pluginA);
        const priorityB = priority.indexOf(pluginB);
        return (priorityA === priorityB ? 0 : (priorityA < priorityB ? 1 : -1));
      }
    
      async _bulkUnload (plugins: any[]) {
        const nextPlugins = [];
        for (const plugin of plugins) {
          const deps = this.get(plugin)?.allDependencies;
          if (deps?.filter(dep => this.get(dep) && this.get(dep)?.ready).length !== 0) {
            nextPlugins.push(plugin);
          } else {
            await this.unmount(plugin);
          }
        }
    
        if (nextPlugins.length !== 0) {
          await this._bulkUnload(nextPlugins);
        }
      }
    
      unload (pluginID: string) {
        const plugin = this.get(pluginID);
        if (!plugin) {
          throw new Error(`Tried to unload a non installed plugin (${plugin})`);
        }
        if (!plugin.ready) {
          return console.error('%c[Powercord]', 'color: #7289da', `Tried to unload a non loaded plugin (${plugin})`);
        }
    
        plugin._unload();
      }
}