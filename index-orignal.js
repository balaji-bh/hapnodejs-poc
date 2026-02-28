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
// In-memory "database" to simulate persisted device state
// ============================================================================
const database = {
  light: {
    on: true,
    brightness: 100,
  },
  fan: {
    on: false,
    rotationSpeed: 0,
  },
};

// ============================================================================
// 1. CREATE THE BRIDGE
// ============================================================================
// A Bridge is a special accessory that hosts other accessories.
// Instead of publishing each accessory individually (each needs its own port),
// a bridge lets you publish many accessories under a single HomeKit pairing.

const bridge = new Bridge("My Home Bridge", uuid.generate("my-home-bridge"));

// Set accessory information for the bridge itself
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

// Set accessory information
lightAccessory
  .getService(Service.AccessoryInformation)
  .setCharacteristic(Characteristic.Manufacturer, "MyCompany")
  .setCharacteristic(Characteristic.Model, "SmartLight-v1")
  .setCharacteristic(Characteristic.SerialNumber, "LIGHT-001");

// Add the Lightbulb service.
// The Lightbulb service comes with the "On" characteristic by default (required).
// We also add the optional "Brightness" characteristic.
const lightService = lightAccessory.addService(Service.Lightbulb, "Living Room Light");

// --- On Characteristic (required) ---
lightService
  .getCharacteristic(Characteristic.On)

  // onGet: Called when Apple Home reads the current value.
  // Return the current state from our database.
  .onGet((context, connection) => {
    console.log("[Light] GET On → value:", database.light.on);
    console.log("[Light] GET On → context:", context);
    return database.light.on;
  })

  // onSet: Called when Apple Home writes a new value (user toggled the switch).
  // This is where you save to your database.
  .onSet((value, context, connection) => {
    database.light.on = value;
    console.log("[Light] SET On → value:", value);
    console.log("[Light] SET On → context:", context);
    console.log("[Light] Database updated:", database.light);
  });

// --- Brightness Characteristic (optional, we add it explicitly) ---
lightService
  .addCharacteristic(Characteristic.Brightness)

  .onGet((context, connection) => {
    console.log("[Light] GET Brightness → value:", database.light.brightness);
    console.log("[Light] GET Brightness → context:", context);
    return database.light.brightness;
  })

  .onSet((value, context, connection) => {
    database.light.brightness = value;
    console.log("[Light] SET Brightness → value:", value);
    console.log("[Light] SET Brightness → context:", context);
    console.log("[Light] Database updated:", database.light);
  });

// --- Listen to ALL changes on the On characteristic (optional) ---
// The CHANGE event fires after any value change, whether from HomeKit or from
// our code calling updateValue(). The `reason` field tells you the source.
lightService
  .getCharacteristic(Characteristic.On)
  .on(CharacteristicEventTypes.CHANGE, (change) => {
    console.log(
      `[Light] On CHANGED: ${change.oldValue} → ${change.newValue} (reason: ${change.reason})`
    );
  });

lightService
  .getCharacteristic(Characteristic.Brightness)
  .on(CharacteristicEventTypes.CHANGE, (change) => {
    console.log(
      `[Light] Brightness CHANGED: ${change.oldValue} → ${change.newValue} (reason: ${change.reason})`
    );
  });

// ============================================================================
// 3. CREATE THE FAN ACCESSORY
// ============================================================================
const fanAccessory = new Accessory(
  "Bedroom Fan",
  uuid.generate("bedroom-fan")
);
fanAccessory.category = Categories.FAN;

// Set accessory information
fanAccessory
  .getService(Service.AccessoryInformation)
  .setCharacteristic(Characteristic.Manufacturer, "MyCompany")
  .setCharacteristic(Characteristic.Model, "SmartFan-v1")
  .setCharacteristic(Characteristic.SerialNumber, "FAN-001");

// Add the Fan service.
// The Fan service comes with the "On" characteristic by default (required).
// We also add the optional "RotationSpeed" characteristic.
const fanService = fanAccessory.addService(Service.Fan, "Bedroom Fan");

// --- On Characteristic (required) ---
fanService
  .getCharacteristic(Characteristic.On)

  .onGet((context, connection) => {
    console.log("[Fan] GET On → value:", database.fan.on);
    console.log("[Fan] GET On → context:", context);
    return database.fan.on;
  })

  .onSet((value, context, connection) => {
    database.fan.on = value;
    console.log("[Fan] SET On → value:", value);
    console.log("[Fan] SET On → context:", context);
    console.log("[Fan] Database updated:", database.fan);
  });

// --- RotationSpeed Characteristic (optional, we add it explicitly) ---
fanService
  .addCharacteristic(Characteristic.RotationSpeed)

  .onGet((context, connection) => {
    console.log("[Fan] GET RotationSpeed → value:", database.fan.rotationSpeed);
    console.log("[Fan] GET RotationSpeed → context:", context);
    return database.fan.rotationSpeed;
  })

  .onSet((value, context, connection) => {
    database.fan.rotationSpeed = value;
    console.log("[Fan] SET RotationSpeed → value:", value);
    console.log("[Fan] SET RotationSpeed → context:", context);
    console.log("[Fan] Database updated:", database.fan);
  });

// --- Listen to ALL changes on Fan characteristics ---
fanService
  .getCharacteristic(Characteristic.On)
  .on(CharacteristicEventTypes.CHANGE, (change) => {
    console.log(
      `[Fan] On CHANGED: ${change.oldValue} → ${change.newValue} (reason: ${change.reason})`
    );
  });

fanService
  .getCharacteristic(Characteristic.RotationSpeed)
  .on(CharacteristicEventTypes.CHANGE, (change) => {
    console.log(
      `[Fan] RotationSpeed CHANGED: ${change.oldValue} → ${change.newValue} (reason: ${change.reason})`
    );
  });

// ============================================================================
// 4. ADD ACCESSORIES TO THE BRIDGE
// ============================================================================
bridge.addBridgedAccessory(lightAccessory);
bridge.addBridgedAccessory(fanAccessory);

// ============================================================================
// 5. PUBLISH THE BRIDGE
// ============================================================================
bridge.publish({
  username: "CC:22:3D:E3:CE:F6", // Unique MAC-like address for this bridge
  pincode: "031-45-154",          // PIN shown in Apple Home when pairing
  category: Categories.BRIDGE,    // Tells iOS this is a bridge
  port: 47128,                    // Fixed port (optional, 0 = random)
});

console.log("============================================");
console.log("HomeKit Bridge is running!");
console.log("Bridge Name : My Home Bridge");
console.log("PIN Code    : 031-45-154");
console.log("Accessories : Living Room Light, Bedroom Fan");
console.log("============================================");

// ============================================================================
// 6. SIMULATING EXTERNAL UPDATES (Node.js → Apple Home)
// ============================================================================
// Use updateValue() to push state changes FROM your backend TO Apple Home.
//
// updateValue() does NOT trigger onSet handlers (avoids infinite loops).
// It DOES trigger CHANGE event listeners and sends notifications to Apple Home.

function updateLightFromBackend(on, brightness) {
  // Update our database
  database.light.on = on;
  database.light.brightness = brightness;

  // Push the new values to Apple Home
  lightService.getCharacteristic(Characteristic.On).updateValue(on);
  lightService.getCharacteristic(Characteristic.Brightness).updateValue(brightness);

  console.log(`[Backend → HomeKit] Light updated: on=${on}, brightness=${brightness}`);
}

function updateFanFromBackend(on, rotationSpeed) {
  // Update our database
  database.fan.on = on;
  database.fan.rotationSpeed = rotationSpeed;

  // Push the new values to Apple Home
  fanService.getCharacteristic(Characteristic.On).updateValue(on);
  fanService.getCharacteristic(Characteristic.RotationSpeed).updateValue(rotationSpeed);

  console.log(`[Backend → HomeKit] Fan updated: on=${on}, speed=${rotationSpeed}`);
}

// --- Demo: simulate backend updates after 15 seconds ---
setTimeout(() => {
  console.log("\n--- Simulating backend update: turning light ON at 75% ---");
  updateLightFromBackend(true, 75);
}, 15000);

// setTimeout(() => {
//   console.log("\n--- Simulating backend update: turning fan ON at 50% speed ---");
//   updateFanFromBackend(true, 50);
// }, 20000);

// Export the functions so they can be used from other modules
module.exports = { updateLightFromBackend, updateFanFromBackend, database };
