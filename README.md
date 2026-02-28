
# HAP-NodeJS HomeKit Bridge

A Node.js-based HomeKit Accessory Protocol (HAP) bridge that enables smart home device integration with Apple HomeKit. This project demonstrates how to create a bridge accessory that manages multiple smart devices (lights, fans, etc.) and communicates with Apple Home using batch operations for efficient state management.

## Overview

This project implements a **HomeKit Bridge** that:
- Exposes multiple smart home accessories (lights, fans, etc.) to Apple HomeKit
- Uses **batch GET/SET handlers** for efficient bulk reads and writes
- Maintains an in-memory database for device state
- Supports real-time synchronization between backend systems and Apple Home
- Includes comprehensive error handling for production reliability

## Features

✅ **Bridge Architecture** - Manage multiple accessories under a single HomeKit bridge  
✅ **Batch Operations** - Efficient batch GET/SET handlers for bulk characteristic reads/writes  
✅ **Multiple Accessories** - Pre-configured Light and Fan accessories  
✅ **State Persistence** - In-memory database for tracking device states  
✅ **Backend Sync** - Push updates from backend systems to Apple Home  
✅ **Error Handling** - Catches uncaught exceptions and unhandled rejections  
✅ **Detailed Logging** - Comprehensive console logs for debugging  

## Project Structure

```
├── index.js                 # Basic single accessory example
├── index-optimized.js       # Bridge with batch operations (recommended)
├── package.json             # Dependencies and metadata
└── README.md               # This file
```

## Installation

### Prerequisites
- Node.js 21+ 
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Verify installation
npm list @homebridge/hap-nodejs
```

## Quick Start

### Run the Optimized Bridge (Recommended)

```bash
node index-optimized.js
```

### Add Bridge to Apple HomeKit

1. Open **Home** app on your iPhone/iPad
2. Tap **+** → **Add Accessory**
3. Scan the HomeKit code or enter PIN: **031-45-154**
4. Follow setup prompts
5. You'll now see "Living Room Light" and "Bedroom Fan" in HomeKit

## Architecture

### Bridge Components

```
┌─────────────────────────────────────┐
│      HomeKit Bridge                 │
│  (My Home Bridge - Port 1234)      │
└─────────────────────────────────────┘
           ↓
    ┌──────────────┐
    │ Batch Handlers
    ├──────────────┤
    │ onBatchGet   │ ← Read multiple characteristics at once
    │ onBatchSet   │ ← Write multiple characteristics at once
    └──────────────┘
           ↓
    ┌─────────────────────────────────┐
    │   In-Memory Database            │
    ├─────────────────────────────────┤
    │ Living Room Light: {On, Br}     │
    │ Bedroom Fan: {On, Speed}        │
    └─────────────────────────────────┘
           ↓
    ┌──────────────────────────────┐
    │ Bridged Accessories          │
    ├──────────────────────────────┤
    │ • Lightbulb Service          │
    │ • Fan Service                │
    └──────────────────────────────┘
```

### Batch Operations Flow

**Read (GET):**
```
HomeKit → onBatchGet() → Query Database → Return all values at once
```

**Write (SET):**
```
HomeKit → onBatchSet() → Update Database → Push to accessories
```

## API Reference

### Accessories Included

#### Living Room Light
- **Service:** Lightbulb
- **Characteristics:** On, Brightness (0-100)
- **Database Key:** `database["Living Room Light"]`

#### Bedroom Fan
- **Service:** Fan
- **Characteristics:** On, RotationSpeed (0-100)
- **Database Key:** `database["Bedroom Fan"]`

### Backend Integration

Push updates from your backend to HomeKit:

```javascript
// Update light
updateLightFromBackend(true, 75);  // on=true, brightness=75%

// Update fan
updateFanFromBackend(true, 50);    // on=true, speed=50%
```

## Configuration

### Change Bridge PIN Code
Edit `index-optimized.js`:
```javascript
bridge.publish({
  pincode: "YOUR-NEW-PIN",  // Format: XXX-XX-XXX
  // ...other settings
});
```

### Change Port
```javascript
bridge.publish({
  port: YOUR_PORT_NUMBER,  // Default: 47129
  // ...other settings
});
```

### Add New Accessories
```javascript
const newAccessory = new Accessory("Device Name", uuid.generate("unique-id"));
newAccessory.category = Categories.LIGHTBULB;  // or other category

const service = newAccessory.addService(Service.Lightbulb, "Display Name");
service.addCharacteristic(Characteristic.Brightness);

bridge.addBridgedAccessory(newAccessory);
```

## Debugging

### Enable Change Event Logging
Uncomment the CHANGE event listeners in `index-optimized.js`:

```javascript
lightService
  .getCharacteristic(Characteristic.On)
  .on(CharacteristicEventTypes.CHANGE, (change) => {
    console.log(`[CHANGE] Light On: ${change.oldValue} → ${change.newValue}`);
  });
```

### View Current State
```bash
# While bridge is running, in another terminal:
node -e "const m = require('./index-optimized.js'); console.log(m.database);"
```

### Common Issues

| Issue | Solution |
|-------|----------|
| "Port already in use" | Change `port` in publish() or kill process on that port |
| "Cannot add to HomeKit" | Ensure PIN format is XXX-XX-XXX and bridge is accessible |
| "No Response" | Check uncaught exceptions in console; enable all error handlers |
| "Characteristics not updating" | Verify batch handlers are returning correct values |

## Production Considerations

- ✅ Error handlers catch all exceptions
- ✅ Batch operations minimize network calls
- ✅ In-memory database can be replaced with persistent storage (DB, Redis, etc.)
- ✅ Consider implementing authentication for backend API calls
- ✅ Monitor HomeKit events and log all state changes
- ✅ Implement timeout handling for batch operations

## Performance

**Batch Operations Benefits:**
- **Single request** for multiple characteristics instead of individual requests
- **Reduced latency** - One round trip vs. multiple
- **Better scaling** - Efficient for accessories with many characteristics

## License

MIT

## Support

For issues or questions:
1. Check the console logs for error messages
2. Verify all dependencies are installed: `npm install`
3. Ensure HomeKit bridge PIN is in correct format: `XXX-XX-XXX`
4. Check that port is not already in use

## References

- [HAP-NodeJS Documentation](https://github.com/homebridge/HAP-nodejs)
- [HomeKit Accessory Protocol Specification](https://developer.apple.com/homekit/)
- [HomeKit Categories](https://developer.apple.com/documentation/homekit/hmhaccessorycategory)
