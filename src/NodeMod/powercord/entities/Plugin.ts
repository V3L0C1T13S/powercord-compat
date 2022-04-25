import { Logger } from "@rikka/API/Utils";
import { existsSync } from "fs";
import { join } from "path";
import { resolveCompiler } from "../../../powercord-git/src/fake_node_modules/powercord/compilers";
import { createElement } from "../../../powercord-git/src/fake_node_modules/powercord/util";
import PCPluginsManager from "../../../Powercord/managers/PluginLoader";
import Updatable from "./Updatable";

export = class Plugin extends Updatable {
    ready = false;
    styles: any = {};
    settings = powercord.api.settings.buildCategoryObject(this.entityID);
    manifest = {
        dependencies: [],
        optionalDependencies: [],
        appMode: 'app',
    };

    constructor() {
        super(PCPluginsManager.getPluginDirectory());
    }

        // Getters
    get isInternal () {
        return this.entityID?.startsWith('pc-');
    }

    get dependencies () {
        return this.manifest.dependencies;
    }

    get optionalDependencies () {
        return this.manifest.optionalDependencies;
    }

    get effectiveOptionalDependencies () {
        const deps = this.manifest.optionalDependencies;
        const disabled = powercord.settings.get('disabledPlugins', []);
        return deps.filter(d => powercord.pluginManager.get(d) !== void 0 && !disabled.includes(d));
    }

    get allDependencies () {
        return this.dependencies.concat(this.optionalDependencies);
    }

    get allEffectiveDependencies () {
        return this.dependencies.concat(this.effectiveOptionalDependencies);
    }

    get dependents () {
        const dependents = [ ...powercord.pluginManager.plugins.values() ].filter(p => p.manifest.dependencies.includes(this.entityID));
        return [ ...new Set(dependents.map(d => d.entityID).concat(...dependents.map(d => d.dependents))) ];
      }

    get color () {
    return '#7289da';
    }

    async _unload() {
        try {
            for (const id in this.styles) {
                this.styles[id].compiler.on('src-update', this.styles[id].compile);
                this.styles[id].compiler.disableWatcher();
                document.getElementById(`style-${this.entityID}-${id}`)?.remove();
            }

            this.styles = {};
            if (typeof this.pluginWillUnload === 'function') {
                await this.pluginWillUnload();
            }
        } catch (e) {
            console.error('An error occurred during shutting down! It\'s heavily recommended reloading Discord to ensure there are no conflicts.', e);
        } finally {
            this.ready = false;
        }
    }

    loadStylesheet(path: string) {
        let resolvedPath = path;

        if (!existsSync(resolvedPath)) {
            // Assume it's a relative path and try resolving it
            resolvedPath = join(powercord.pluginManager.pluginDir, this.entityID!, path);
            console.log(resolvedPath);

            if (!existsSync(resolvedPath)) {
                throw new Error(`Cannot find "${path}"! Make sure the file exists and try again.`);
            }
        }

        const id = Math.random().toString(36).slice(2);
        const compiler = resolveCompiler(resolvedPath);
        const style = createElement('style', {
            id: `style-${this.entityID}-${id}`,
            'data-powercord': true,
            'data-plugin': true
        });

        document.head.appendChild(style);
        const compile = async () => (style.innerHTML = await compiler?.compile());
        this.styles[id] = {
            compiler,
            compile
        };

        compiler?.enableWatcher();
        compiler?.on('src-update', compile);
        return compile();
    }

    
    protected log = (...args: any[]) => Logger.trace(...args);

    protected warn = (...args: any[]) => Logger.trace(`[WARN] ${this.entityID}`, ...args);

    protected error = (...args: any[]) => Logger.trace(`[ERROR] ${this.entityID}`, ...args);

    async pluginWillUnload() {}

    _load() {
        this.startPlugin();
    }

    // Update
  async _update (force = false) {
    const success = await super._update(force);
    if (success && this.ready) {
      await powercord.pluginManager.remount(this.entityID);
    }
    return success;
  }

    startPlugin() {}
}
