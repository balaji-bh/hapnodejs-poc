# Task Log — Bridge-Level Batch GET/SET Handlers

## Bugfix: "No Response" in Apple Home (Post-Batch Implementation)

### 10. Fix circular reference crash in batch items (JSON.stringify)
**Status**: COMPLETED
**Files**: `/hap-nodejs-latest-fork/HAP-NodeJS/src/lib/Accessory.ts`, `/hap-nodejs/index-1.js`

**Root Cause**: `BatchReadItem` and `BatchWriteItem` include object references (`characteristic`, `service`, `accessory`). The `Accessory` object has a `bridge` property pointing to the `Bridge`, which has `bridgedAccessories` pointing back to the `Accessory` — creating a circular reference. Any call to `JSON.stringify()` on the batch items (e.g., for logging) throws `TypeError: Converting circular structure to JSON`, which is caught by the batch handler's catch block and returns `-70402` (SERVICE_COMMUNICATION_FAILURE) for all items → Apple Home shows "No Response".

**How it was found**: Added progressive debug logging to the compiled Accessory.js to trace the full request/response flow. The logs revealed:
1. `findCharacteristicWithContext` found all characteristics correctly (`found=true`)
2. `batchItems` were populated correctly (e.g., `batchItems=4`)
3. But the response contained all error statuses: `{"status":-70402}` for every item
4. The batch handler's outer catch block was silently swallowing the error
5. After adding error logging to the catch block, the actual error was revealed: `TypeError: Converting circular structure to JSON`

**Fixes applied**:
1. **Accessory.ts** — Made `characteristic`, `service`, and `accessory` properties non-enumerable on batch items via `Object.defineProperty(batchItem, "property", { enumerable: false })`. This means `JSON.stringify()` skips them (preventing the crash) while they remain accessible via `item.characteristic`, `item.service`, `item.accessory` for advanced use cases.
2. **index-1.js** — Removed `JSON.stringify(items, null, 2)` calls that the user added for debugging. Restored the original per-field logging that only accesses primitive properties.

---

### 8. Fix unhandled async promise rejections in batch handlers
**Status**: COMPLETED
**File**: `/hap-nodejs-latest-fork/HAP-NodeJS/src/lib/Accessory.ts`

**Root Cause**: `handleBatchGetCharacteristics` and `handleBatchSetCharacteristics` are `async` methods, but the callers (`handleGetCharacteristics` / `handleSetCharacteristics`) called them without `.catch()`. If any error occurred, the returned Promise was silently rejected, the HAP callback was never invoked, and HomeKit timed out → "No Response".

**Fixes applied**:
1. Added `.catch()` on both async calls so any unhandled error results in an HTTP 500 error response (instead of silence)
2. Added per-item try/catch inside the value-processing loops — if processing one characteristic fails, only that one gets an error status, the rest still succeed
3. Fixed duplicate-entry bug: if the outer try/catch caught an error after some items had already been pushed as successes, ALL items were also pushed as failures (duplicates). Now uses `.some()` check to avoid duplicates.

---

### 9. Fix "Rotation Speed" key mismatch in index-1.js database
**Status**: COMPLETED
**File**: `/hap-nodejs/index-1.js`

**Root Cause**: The database used `"RotationSpeed"` as the key, but the HAP-NodeJS characteristic `displayName` is `"Rotation Speed"` (with a space). The batch GET handler looked up `database["Bedroom Fan"]["RotationSpeed"]` but the batch item had `characteristicDisplayName: "Rotation Speed"`, so the lookup returned `undefined` and fell back to cached value (which worked by coincidence). Fixed the key to `"Rotation Speed"`.

---

## Completed Tasks

### 1. Add batch types and handler properties to Accessory.ts
**Status**: COMPLETED
**File**: `/hap-nodejs-latest-fork/HAP-NodeJS/src/lib/Accessory.ts`

**Changes**:
- Added 4 new exported types after the `WriteRequestState` enum (line ~318):
  - `BatchReadItem` — describes a single characteristic in a batch read (includes `aid`, `iid`, `accessoryDisplayName`, `serviceDisplayName`, `characteristicDisplayName`, plus non-enumerable object references to `characteristic`, `service`, `accessory`)
  - `BatchWriteItem` — same as above but also includes the `value` being written
  - `BatchGetHandler` — callback type `(items, connection?) => Record<"aid.iid", value>`
  - `BatchSetHandler` — callback type `(items, connection?) => void`
- Added 2 private properties to the `Accessory` class:
  - `batchGetHandler?: BatchGetHandler`
  - `batchSetHandler?: BatchSetHandler`
- Added `findCharacteristicWithContext(aid, iid)` helper — returns `{ accessory, service, characteristic }` instead of just the characteristic (needed for batch items to include display names)
- Added 2 public methods:
  - `onBatchGet(handler)` — registers the batch GET handler
  - `onBatchSet(handler)` — registers the batch SET handler

---

### 2. Modify handleGetCharacteristics for batch support
**Status**: COMPLETED
**File**: `/hap-nodejs-latest-fork/HAP-NodeJS/src/lib/Accessory.ts`

**Changes**:
- Added a guard at the top of `handleGetCharacteristics`: if `this.batchGetHandler` is set, delegate to the new `handleBatchGetCharacteristics` method (with `.catch()` error handling); otherwise, run the original individual-handler code path unchanged.
- New `handleBatchGetCharacteristics` method:
  1. Iterates all requested characteristic IDs
  2. Resolves each via `findCharacteristicWithContext(aid, iid)`
  3. Runs the same permission checks as the original `handleCharacteristicRead` (PAIRED_READ, admin-only access)
  4. Collects valid items into `BatchReadItem[]` (with non-enumerable object references); failed items go directly into the response with error status
  5. Calls `await this.batchGetHandler(batchItems, connection)` — one single call for all reads
  6. Applies returned values: updates `characteristic.value`, emits `CHANGE` event if value changed, formats outgoing value, includes metadata/perms/type/event flags as requested
  7. Per-item try/catch ensures one item's failure doesn't affect others
  8. If the batch handler throws, all unprocessed batch items are marked `SERVICE_COMMUNICATION_FAILURE`

---

### 3. Modify handleSetCharacteristics for batch support
**Status**: COMPLETED
**File**: `/hap-nodejs-latest-fork/HAP-NodeJS/src/lib/Accessory.ts`

**Changes**:
- Added a guard in `handleSetCharacteristics`: if `this.batchSetHandler` is set, delegate to `handleBatchSetCharacteristics` (with `.catch()` error handling); otherwise, original code path.
- New `handleBatchSetCharacteristics` method:
  1. Iterates all write requests
  2. Resolves each characteristic, checks timed-write state
  3. Handles event subscription (`ev` field) changes per-characteristic — these are protocol-level and cannot be batched
  4. For value writes: runs permission checks (PAIRED_WRITE, admin-only, additional authorization, timed-write requirement)
  5. Collects valid value-write items into `BatchWriteItem[]` (with non-enumerable object references)
  6. Calls `await this.batchSetHandler(batchItems, connection)` — one single call for all writes
  7. Applies values: sets `characteristic.value`, emits `CHANGE` event with `reason: WRITE`
  8. Per-item try/catch ensures one item's failure doesn't affect others
  9. If the batch handler throws, all unprocessed batch items are marked `SERVICE_COMMUNICATION_FAILURE`

---

### 4. Export new types from src/index.ts
**Status**: COMPLETED (no changes needed)
**File**: `/hap-nodejs-latest-fork/HAP-NodeJS/src/index.ts`

**Explanation**: `index.ts` already has `export * from "./lib/Accessory"` which automatically re-exports all our new types (`BatchReadItem`, `BatchWriteItem`, `BatchGetHandler`, `BatchSetHandler`). No additional changes were required.

---

### 5. Build HAP-NodeJS fork and deploy to node_modules
**Status**: COMPLETED

**Steps performed**:
1. `cd /hap-nodejs-latest-fork/HAP-NodeJS && npm install` — installed all dependencies
2. `npm run build` — compiled TypeScript to `dist/` with zero errors
3. Copied `dist/` contents to `node_modules/@homebridge/hap-nodejs/dist/` in the demo project
4. Verified checksums match between source dist and node_modules dist

---

### 6. Create index-1.js with batch API demo
**Status**: COMPLETED
**File**: `/hap-nodejs/index-1.js`

**Changes**:
- Created new file demonstrating the batch API
- Same bridge/light/fan accessory setup as `index.js`
- NO individual `onGet`/`onSet` handlers on characteristics
- Uses `bridge.onBatchGet(handler)` — single callback receives all reads, returns a `Record<"aid.iid", value>`
- Uses `bridge.onBatchSet(handler)` — single callback receives all writes
- Database keyed by `accessoryDisplayName` → `characteristicDisplayName` for easy batch lookup
- Includes `CHANGE` event listeners to show they still fire with batch handlers
- Includes `updateValue()` demo for backend → HomeKit sync (unchanged from index.js)
- Uses different MAC address (`CC:22:3D:E3:CE:F7`) and port (`47129`) to avoid conflicts with index.js

---

### 7. Create TASKS.md log file
**Status**: COMPLETED
**File**: `/hap-nodejs/TASKS.md` (this file)

---

## Key Design Decisions

### Why modify Accessory.ts instead of Bridge.ts?
Bridge is a thin subclass of Accessory (just sets `_isBridge = true`). All the HTTP request handling (`handleGetCharacteristics`, `handleSetCharacteristics`) lives in Accessory. Adding batch support at the Accessory level means it works on both standalone Accessories and Bridges.

### Why batch at the `handleGetCharacteristics`/`handleSetCharacteristics` level?
HomeKit already sends batch requests at the HTTP level. HAP-NodeJS receives them in these methods and fans them out to individual handlers. This is the natural interception point — we catch the batch before it's split into individual calls.

### Why keep event subscription (`ev`) handling per-characteristic?
Event subscriptions are protocol-level bookkeeping (enabling/disabling HAP event notifications per characteristic). They don't involve user data or database calls, so batching them provides no benefit.

### Why make object references non-enumerable on batch items?
The `characteristic`, `service`, and `accessory` properties on `BatchReadItem`/`BatchWriteItem` contain circular references (Accessory.bridge → Bridge.bridgedAccessories → Accessory). Making them non-enumerable means `JSON.stringify()` safely skips them while they remain accessible for advanced use. This prevents a common developer trap where logging batch items with `JSON.stringify` would crash the handler.

### setValue() vs updateValue() with batch handlers
- `setValue()` / `onSet` / `onBatchSet`: For changes coming FROM Apple Home
- `updateValue()`: For changes coming FROM your backend TO Apple Home (bypasses SET handlers, avoids loops)
Both work exactly the same with batch handlers as without.

### Backward Compatibility
If no `onBatchGet`/`onBatchSet` is registered, the code follows the exact original path. The guard is a simple `if (this.batchGetHandler)` check at the top of each method.
