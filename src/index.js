"use strict";

const { PLUGIN_NAME, PLATFORM_NAME } = require("./settings");
const { LaMarzoccoPlatform } = require("./platform");

module.exports = (api) => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, LaMarzoccoPlatform);
};
