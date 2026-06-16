"use strict";

// electron-builder afterPack 统一入口：按平台分发
const tuneMacHelpers = require("./tune-mac-helpers.cjs");
const setWindowsExeResources = require("./win-exe-resources.cjs");

module.exports = async function afterPack(context) {
  tuneMacHelpers(context);
  setWindowsExeResources(context);
};
