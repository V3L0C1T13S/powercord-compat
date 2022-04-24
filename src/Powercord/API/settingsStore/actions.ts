const { FluxDispatcher } = require('powercord/webpack');
const ActionTypes = require('./constants');

export = {
  toggleSetting (category: any, setting: any, defaultValue?: any) {
    FluxDispatcher.dispatch({
      type: ActionTypes.TOGGLE_SETTING,
      category,
      setting,
      defaultValue
    });
  },
  updateSettings (category: any, settings: any) {
    FluxDispatcher.dispatch({
      type: ActionTypes.UPDATE_SETTINGS,
      category,
      settings
    });
  },

  updateSetting (category: any, setting: any, value: any) {
    FluxDispatcher.dispatch({
      type: ActionTypes.UPDATE_SETTING,
      category,
      setting,
      value
    });
  },

  deleteSetting (category: any, setting: any) {
    FluxDispatcher.dispatch({
      type: ActionTypes.DELETE_SETTING,
      category,
      setting
    });
  }
};
