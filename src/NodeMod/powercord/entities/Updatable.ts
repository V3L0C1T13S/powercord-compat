import Events from "events";
import { existsSync } from "fs";
import { join } from "path";
import { promisify } from "util";
import cp from "child_process";
import { Logger } from "@rikka/API/Utils";
import { head } from "../http";
const exec = promisify(cp.exec);

export = class Updatable extends Events {
  basePath: string;

  entityID?: string;

  entityPath: string;

  updateIdentifier: string;

  private __shortCircuit: boolean = false;

  private update_timeout = 10e3

  constructor(basePath: string, entityID?: string, updateIdentifier?: string) {
    super();

    this.basePath = basePath;
    if (!this.entityID) {
      // It might be pre-defined by plugin manager
      this.entityID = entityID;
    }

    this.entityPath = join(this.basePath, this.entityID ?? "fixme-eid-undefined");

    if (!updateIdentifier) {
      updateIdentifier = `${this.basePath.split(/[\\/]/).pop()}_${this.entityID}`;
    }
    this.updateIdentifier = updateIdentifier;
  }

  async _getUpdateCommits () {
    const abort = new AbortController();
    const timeout = setTimeout(() => {
      abort.abort();
      throw new Error('Timed out.');
    }, this.update_timeout);

    const branch = await this.getBranch();
    const commits: { id: string | undefined; author: string | undefined; message: string | undefined; }[] = [];

    const gitLog = await exec(`git log --format="%H -- %an -- %s" ..origin/${branch}`, {
      cwd: this.entityPath,
      signal: abort.signal
    }).then(({ stdout }) => stdout.toString());

    const lines = gitLog.split('\n');
    lines.pop();
    lines.forEach(line => {
      const data = line.split(' -- ');
      commits.push({
        id: data.shift(),
        author: data.shift(),
        message: data.shift()
      });
    });

    clearTimeout(timeout);
    return commits;
  }

  async _checkForUpdates(): Promise<boolean> {
    Logger.trace("Stub %d", this.entityID);
    return false;
  }

  isUpdatable() {
    return existsSync(join(this.basePath, this.entityID ?? "FIXME", '.git')) && !this.__shortCircuit;
  }

  async getGitRepo() {
    const abort = new AbortController();
    const timeout = setTimeout(() => {
      abort.abort();
      throw new Error('Timed out.');
    }, 10e3);

    try {
      return await exec('git remote get-url origin', {
        cwd: this.entityPath,
        signal: abort.signal
      }).then((r) => {
        clearTimeout(timeout);
        return r.stdout.toString().match(/github\.com[:/]([\w-_]+\/[\w-_]+)/) ?? 'FIXME_GITREPO_STUB'[1];
      });
    } catch (e) {
      clearTimeout(timeout);
      console.warn('Failed to fetch git origin url; ignoring.');
      return null;
    }
  }

  async _update (force = false) {
    try {
      let command = 'git pull --ff-only';
      if (force) {
        const branch = await this.getBranch();
        command = `git reset --hard origin/${branch}`;
      }
      await exec(command, { cwd: this.entityPath }).then(({ stdout }) => stdout.toString());
      return true;
    } catch (e) {
      return false;
    }
  }

  getBranch () {
    const abort = new AbortController();
    const timeout = setTimeout(() => {
      abort.abort();
      throw new Error('Timed out.');
    }, this.update_timeout);

    return exec('git branch', {
      cwd: this.entityPath,
      signal: abort.signal
    }).then(({ stdout }) => {
      clearTimeout(timeout);
      return stdout.toString().split('\n').find(l => l.startsWith('*'))?.slice(2).trim();
    });
  }

  async __migrateIfNecessary () {
    if (!this.isUpdatable()) {
      return;
    }

    const repo = await this.getGitRepo();
    if (!repo) {
      return;
    }

    const url = `https://github.com/${repo}`;
    const newUrl = await this.__followRedirects(url);
    if (!newUrl) {
      this.__shortCircuit = true;
    } else if (url !== newUrl) {
      console.debug('[Updater] Migrating %s to repository %s', this.entityID, newUrl);
      await exec(`git remote set-url origin "${newUrl}"`, { cwd: this.entityPath });
    }
  }

  async __followRedirects (url: any) {
    let code = -1;
    do {
      try {
        const res = await head(url);
        //@ts-ignore
        code = res.statusCode;
        if (code === 301 || code === 302) {
          //@ts-ignore
          url = res.headers.location;
        }
      } catch (e) {
        return false;
      }
    } while (code === 301 || code === 302);
    return url;
  }
}