import API from "../../NodeMod/powercord/entities/API";
const { getModule, i18n } = require('powercord/webpack');

export = class I18nAPI extends API {
    locale: string = "en";
    messages: { [key: string]: { [key: string]: string } } = {};

    async startAPI() {
        getModule(['locale', 'theme']).then((module: { locale: string; addChangeListener: (arg0: () => void) => void; }) => {
            this.locale = module.locale;
            module.addChangeListener(() => {
                if (module.locale !== this.locale) {
                    this.locale = module.locale;
                    i18n.loadPromise.then(() => this.addPowercordStrings());
                }
            });
            this.addPowercordStrings();
        });
    }

    addPowercordStrings() {
        const i18nContextProvider = i18n._provider?._context || i18n._proxyContext;
        let { messages, defaultMessages } = i18nContextProvider;

        Object.defineProperty(i18nContextProvider, 'messages', {
            enumerable: true,
            get: () => messages,
            set: (v) => {
                messages = Object.assign(v, this.messages[this.locale]);
            }
        });
        Object.defineProperty(i18nContextProvider, 'defaultMessages', {
            enumerable: true,
            get: () => defaultMessages,
            set: (v) => {
                defaultMessages = Object.assign(v, this.messages['en-US']);
            }
        });
    
        i18nContextProvider.messages = messages;
        i18nContextProvider.defaultMessages = defaultMessages;
    }

    loadAllStrings(locale: string, strings: { [key: string]: string }) {
        this.messages[locale] = strings;
        this.addPowercordStrings();
    }
}