"use strict";

const { extractPowerFromDashboard } = require("../lib/lm_client");

class LaMarzoccoPlatformAccessory {
  constructor(platform, accessory) {
    this.platform = platform;
    this.accessory = accessory;
    this.cachedPower = false;

    this.service =
      this.accessory.getService(this.platform.Service.Switch) ||
      this.accessory.addService(
        this.platform.Service.Switch,
        this.accessory.displayName
      );

    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.handleGet.bind(this))
      .onSet(this.handleSet.bind(this));

    const pollIntervalSeconds = this.platform.pollIntervalSeconds;
    if (pollIntervalSeconds > 0) {
      this.startPolling(pollIntervalSeconds);
    }
  }

  async handleGet() {
    if (!this.platform.client) {
      return this.cachedPower;
    }

    try {
      const dashboard = await this.platform.client.getDashboard(
        this.platform.serial
      );
      const power = extractPowerFromDashboard(dashboard);
      if (power === null) {
        this.platform.log.warn(
          "Unable to determine machine power from dashboard."
        );
        return this.cachedPower;
      }
      this.cachedPower = power;
      return power;
    } catch (err) {
      this.platform.log.error(
        "Failed to fetch dashboard: %s",
        err.message || err
      );
      return this.cachedPower;
    }
  }

  async handleSet(value) {
    if (!this.platform.client) {
      throw new Error("Accessory not configured.");
    }

    const enabled = value === true;
    try {
      await this.platform.client.setPower(this.platform.serial, enabled);
      this.cachedPower = enabled;
    } catch (err) {
      this.platform.log.error(
        "Failed to set power: %s",
        err.message || err
      );
      throw err;
    }
  }

  startPolling(intervalSeconds) {
    const intervalMs = intervalSeconds * 1000;
    setInterval(async () => {
      try {
        const power = await this.handleGet();
        this.service.updateCharacteristic(
          this.platform.Characteristic.On,
          power
        );
      } catch (err) {
        this.platform.log.debug("Polling error: %s", err.message || err);
      }
    }, intervalMs);
  }
}

module.exports = { LaMarzoccoPlatformAccessory };
