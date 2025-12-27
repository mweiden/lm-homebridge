"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  LaMarzoccoCloudClient,
  generateInstallationKey,
} = require("../lib/lm_client");
const { LaMarzoccoPlatformAccessory } = require("./platformAccessory");
const { PLUGIN_NAME, PLATFORM_NAME } = require("./settings");

class LaMarzoccoPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config || {};
    this.api = api;
    this.accessories = [];

    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;

    if (!config) {
      this.log.warn("No config supplied. Skipping plugin setup.");
      return;
    }

    this.name = this.config.name || "La Marzocco";
    this.serial = this.config.serial;
    this.username = this.config.username;
    this.password = this.config.password;
    this.pollIntervalSeconds = Number(this.config.pollIntervalSeconds || 30);

    if (!this.serial || !this.username || !this.password) {
      this.log.error(
        "Missing required config. Please set serial, username, and password."
      );
      return;
    }

    const storageRoot = this.api.user.storagePath();
    const defaultKeyPath = path.join(
      storageRoot,
      "lm-homebridge",
      "installation_key.json"
    );
    this.installationKeyPath =
      this.config.installationKeyPath || defaultKeyPath;
    this.ensureKeyDir();

    const { key, created } = this.loadOrCreateInstallationKey();
    this.client = new LaMarzoccoCloudClient({
      username: this.username,
      password: this.password,
      installationKey: key,
    });

    if (created) {
      this.registerInstallationKey().catch((err) => {
        this.log.error("Failed to register installation key: %s", err.message);
      });
    }

    this.api.on("didFinishLaunching", () => {
      this.discoverDevices();
    });
  }

  configureAccessory(accessory) {
    this.log.info("Loading accessory from cache: %s", accessory.displayName);
    this.accessories.push(accessory);
  }

  ensureKeyDir() {
    const dir = path.dirname(this.installationKeyPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  loadOrCreateInstallationKey() {
    if (fs.existsSync(this.installationKeyPath)) {
      const raw = fs.readFileSync(this.installationKeyPath, "utf8");
      return { key: JSON.parse(raw), created: false };
    }

    const installationId = crypto.randomUUID().toLowerCase();
    const key = generateInstallationKey(installationId);
    fs.writeFileSync(this.installationKeyPath, JSON.stringify(key, null, 2));
    return { key, created: true };
  }

  async registerInstallationKey() {
    this.log.info("Registering installation key with LM cloud...");
    await this.client.registerClient();
    this.log.info("Installation key registration complete.");
  }

  discoverDevices() {
    const uuid = this.api.hap.uuid.generate(this.serial);
    const existingAccessory = this.accessories.find(
      (accessory) => accessory.UUID === uuid
    );

    if (existingAccessory) {
      existingAccessory.context.device = {
        name: this.name,
        serial: this.serial,
      };
      new LaMarzoccoPlatformAccessory(this, existingAccessory);
      this.api.updatePlatformAccessories([existingAccessory]);
      return;
    }

    const accessory = new this.api.platformAccessory(this.name, uuid);
    accessory.context.device = {
      name: this.name,
      serial: this.serial,
    };

    new LaMarzoccoPlatformAccessory(this, accessory);
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
  }
}

module.exports = { LaMarzoccoPlatform };
