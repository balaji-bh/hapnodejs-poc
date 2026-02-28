// Catch ALL unhandled errors to diagnose "No Response" issues
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught exception:", err.stack || err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("[FATAL] Unhandled promise rejection:", reason?.stack || reason);
});

const {
  Bridge,
  Accessory,
  Service,
  Characteristic,
  CharacteristicEventTypes,
  Categories,
  uuid,
} = require("@homebridge/hap-nodejs");

// ============================================================================
// In-memory "database" to simulate persisted device state.
// Keys are structured as: database[accessoryDisplayName][characteristicDisplayName]
// ============================================================================
const database = {
  "Living Room Light": {
    On: true,
    Brightness: 100,
  },
  "Bedroom Fan": {
    On: false,
    "Rotation Speed": 0,  // NOTE: displayName is "Rotation Speed" (with space), not "RotationSpeed"
  },
};

// ============================================================================
// 1. CREATE THE BRIDGE
// ============================================================================
const bridge = new Bridge("My Home Bridge", uuid.generate("my-home-bridge"));

bridge
  .getService(Service.AccessoryInformation)
  .setCharacteristic(Characteristic.Manufacturer, "MyCompany")
  .setCharacteristic(Characteristic.Model, "Bridge-v1")
  .setCharacteristic(Characteristic.SerialNumber, "BRIDGE-001")
  .setCharacteristic(Characteristic.FirmwareRevision, "1.0.0");

// ============================================================================
// 2. CREATE THE LIGHT ACCESSORY
// ============================================================================
const lightAccessory = new Accessory(
  "Living Room Light",
  uuid.generate("living-room-light")
);
lightAccessory.category = Categories.LIGHTBULB;

lightAccessory
  .getService(Service.AccessoryInformation)
  .setCharacteristic(Characteristic.Manufacturer, "MyCompany")
  .setCharacteristic(Characteristic.Model, "SmartLight-v1")
  .setCharacteristic(Characteristic.SerialNumber, "LIGHT-001");

// Add Lightbulb service with On (required) and Brightness (optional)
const lightService = lightAccessory.addService(Service.Lightbulb, "Living Room Light");
lightService.addCharacteristic(Characteristic.Brightness);

// ============================================================================
// 3. CREATE THE FAN ACCESSORY
// ============================================================================
const fanAccessory = new Accessory(
  "Bedroom Fan",
  uuid.generate("bedroom-fan")
);
fanAccessory.category = Categories.FAN;

fanAccessory
  .getService(Service.AccessoryInformation)
  .setCharacteristic(Characteristic.Manufacturer, "MyCompany")
  .setCharacteristic(Characteristic.Model, "SmartFan-v1")
  .setCharacteristic(Characteristic.SerialNumber, "FAN-001");

// Add Fan service with On (required) and RotationSpeed (optional)
const fanService = fanAccessory.addService(Service.Fan, "Bedroom Fan");
fanService.addCharacteristic(Characteristic.RotationSpeed);

// ============================================================================
// 4. ADD ACCESSORIES TO THE BRIDGE
// ============================================================================
bridge.addBridgedAccessory(lightAccessory);
bridge.addBridgedAccessory(fanAccessory);

// ============================================================================
// 5. REGISTER BATCH GET HANDLER ON THE BRIDGE
// ============================================================================
// Instead of individual onGet per characteristic, ONE callback handles ALL reads.
// This lets you make a single batched DB query for all characteristics at once.

bridge.onBatchGet((items, connection) => {
  console.log(`\n[BatchGET] Reading ${items.length} characteristic(s):`);
  const values = {};
  for (const item of items) {
    const key = `${item.aid}.${item.iid}`;
    const dbValue = database[item.accessoryDisplayName]?.[item.characteristicDisplayName];
    values[key] = dbValue;

    console.log(
      `  → ${item.accessoryDisplayName} / ${item.serviceDisplayName} / ${item.characteristicDisplayName}` +
      ` (aid=${item.aid}, iid=${item.iid}) = ${dbValue}`
    );
  }

  console.log("[BatchGET] Returning values:", values);
  return values;
});

// ============================================================================
// 6. REGISTER BATCH SET HANDLER ON THE BRIDGE
// ============================================================================
// Instead of individual onSet per characteristic, ONE callback handles ALL writes.
// This lets you make a single batched DB update for all characteristics at once.

bridge.onBatchSet((items, connection) => {
  console.log(`\n[BatchSET] Writing ${items.length} characteristic(s):`);
  for (const item of items) {
    // Update our in-memory database
    if (!database[item.accessoryDisplayName]) {
      database[item.accessoryDisplayName] = {};
    }
    database[item.accessoryDisplayName][item.characteristicDisplayName] = item.value;

    console.log(
      `  → ${item.accessoryDisplayName} / ${item.serviceDisplayName} / ${item.characteristicDisplayName}` +
      ` (aid=${item.aid}, iid=${item.iid}) = ${item.value}`
    );
  }

  console.log("[BatchSET] Database after update:", JSON.stringify(database, null, 2));
});

// ============================================================================
// 7. OPTIONAL: Listen to CHANGE events for additional monitoring
// ============================================================================
// CHANGE events still fire even with batch handlers — they fire after the batch
// handler completes and values are applied to characteristics.

// lightService
//   .getCharacteristic(Characteristic.On)
//   .on(CharacteristicEventTypes.CHANGE, (change) => {
//     console.log(
//       `[CHANGE] Light On: ${change.oldValue} → ${change.newValue} (reason: ${change.reason})`
//     );
//   });

// lightService
//   .getCharacteristic(Characteristic.Brightness)
//   .on(CharacteristicEventTypes.CHANGE, (change) => {
//     console.log(
//       `[CHANGE] Light Brightness: ${change.oldValue} → ${change.newValue} (reason: ${change.reason})`
//     );
//   });

// fanService
//   .getCharacteristic(Characteristic.On)
//   .on(CharacteristicEventTypes.CHANGE, (change) => {
//     console.log(
//       `[CHANGE] Fan On: ${change.oldValue} → ${change.newValue} (reason: ${change.reason})`
//     );
//   });

// fanService
//   .getCharacteristic(Characteristic.RotationSpeed)
//   .on(CharacteristicEventTypes.CHANGE, (change) => {
//     console.log(
//       `[CHANGE] Fan RotationSpeed: ${change.oldValue} → ${change.newValue} (reason: ${change.reason})`
//     );
//   });

// ============================================================================
// 8. PUBLISH THE BRIDGE
// ============================================================================
bridge.publish({
  username: "CC:22:3D:E3:CE:F8", // Different MAC from index.js to avoid conflict
  pincode: "031-45-154",
  category: Categories.BRIDGE,
  port: 47129,
});

console.log("============================================");
console.log("HomeKit Bridge (BATCH MODE) is running!");
console.log("Bridge Name : My Home Bridge");
console.log("PIN Code    : 031-45-154");
console.log("Port        : 47129");
console.log("Accessories : Living Room Light, Bedroom Fan");
console.log("============================================");
console.log("");
console.log("Batch handlers registered:");
console.log("  - onBatchGet: All reads go through a single callback");
console.log("  - onBatchSet: All writes go through a single callback");
console.log("");

// ============================================================================
// 9. SIMULATING EXTERNAL UPDATES (Node.js → Apple Home)
// ============================================================================
// updateValue() still works exactly the same way — it pushes new values to
// Apple Home without triggering onSet/onBatchSet handlers.

function updateLightFromBackend(on, brightness) {
  database["Living Room Light"].On = on;
  database["Living Room Light"].Brightness = brightness;

  lightService.getCharacteristic(Characteristic.On).updateValue(on);
  lightService.getCharacteristic(Characteristic.Brightness).updateValue(brightness);

  console.log(`[Backend → HomeKit] Light updated: on=${on}, brightness=${brightness}`);
}

function updateFanFromBackend(on, rotationSpeed) {
  database["Bedroom Fan"].On = on;
  database["Bedroom Fan"]["Rotation Speed"] = rotationSpeed;

  fanService.getCharacteristic(Characteristic.On).updateValue(on);
  fanService.getCharacteristic(Characteristic.RotationSpeed).updateValue(rotationSpeed);

  console.log(`[Backend → HomeKit] Fan updated: on=${on}, speed=${rotationSpeed}`);
}

// Demo: simulate backend updates after 15 seconds
// setTimeout(() => {
//   console.log("\n--- Simulating backend update: turning light ON at 75% ---");
//   updateLightFromBackend(true, 75);
// }, 15000);

// setTimeout(() => {
//   console.log("\n--- Simulating backend update: turning fan ON at 50% speed ---");
//   updateFanFromBackend(true, 50);
// }, 20000);

module.exports = { updateLightFromBackend, updateFanFromBackend, database };
