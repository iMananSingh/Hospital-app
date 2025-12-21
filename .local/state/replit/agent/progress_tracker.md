[x] 1. Install the required packages
[x] 2. Restart the workflow to see if the project is working
[x] 3. Verify the project is working using the screenshot tool
[x] 4. Inform user the import is completed and they can start building, mark the import as completed using the complete_project_import tool

### Environment Migration - December 21, 2025 at 10:13 AM
[x] Successfully configured workflow with webview output type and port 5000
- **Workflow Status**: Running successfully
- **Database**: Initialized successfully with all indexes created
- **Backup Scheduler**: Running at 15:41 (3:41 PM) daily
- **Application**: Serving on port 5000 ✓
- **Migration Status**: All 4 import tasks marked complete [x] ✓

### Batch Service Order ID Grouping Fix - December 21, 2025 at 10:05 AM
[x] Fixed batch service scheduling to assign same order ID to all services in a single batch
- **Issue**: When scheduling 2+ services together in a single batch, each service was getting a unique order ID (e.g., SER-2025-00083, SER-2025-00084) instead of sharing one order ID
- **Root Cause**: Code was calling `generateMultipleServiceOrderIds(count)` which generated a different ID for each service
- **Solution**:
  1. Changed routes.ts to call `generateServiceOrderId()` ONCE instead of `generateMultipleServiceOrderIds(count)`
  2. Assign the same order ID to ALL services in the batch (before transaction)
  3. Removed the orderIds parameter from batch creation since orderId is now in each service's data
  4. Made `generateServiceOrderId()` public for use in routes
- **Result**: All services in a single batch now share the same order ID while having unique receipt numbers
  - Example: Batch with Dressing + ECG → Both get `SER-2025-00085` (same order ID), but receipt numbers `251221-SRV-0025` and `251221-SRV-0026`
- **Files Modified**:
  - `server/routes.ts`: Changed order ID generation from multiple to single, assign to all batch services
  - `server/storage.ts`: Removed `orderIds` parameter from `createPatientServicesBatch`, made `generateServiceOrderId()` public
- **Status**: Application restarted successfully ✓

### Batch Service Order ID Increment Fix - December 21, 2025 at 9:51 AM
[x] Fixed service order IDs not incrementing in batch service scheduling
- **Issue**: When batch scheduling multiple services, all services in the batch were receiving the same order ID (e.g., SER-2025-00045 for all)
- **Root Cause**: Transaction isolation issue - `generateServiceOrderId()` was being called inside a database transaction. Each call saw the same committed database state, so all calls returned the same count+1, resulting in duplicate order IDs
- **Solution** (Transaction Isolation Fix):
  1. Created new public method `generateMultipleServiceOrderIds(count: number)` that generates ALL order IDs BEFORE the transaction (server/storage.ts lines 1848-1868)
  2. Updated `createPatientServicesBatch` to accept optional pre-generated orderIds parameter (server/storage.ts line 3916)
  3. Modified batch creation to use pre-generated IDs instead of generating them inside the transaction (server/storage.ts line 3937)
  4. Updated routes to call `generateMultipleServiceOrderIds()` BEFORE the batch operation (server/routes.ts lines 2460-2476)
- **Key Fix**: Order IDs are now generated outside the transaction, so each sequential call sees the updated database state
- **Changes Made**:
  - `server/storage.ts`: Added `generateMultipleServiceOrderIds()` method, updated `createPatientServicesBatch` signature
  - `server/routes.ts`: Pre-generate order IDs before batch creation, pass them to storage method
- **Result**: Batch scheduled services now each get proper incrementing unique order IDs (SER-2025-00045, SER-2025-00046, SER-2025-00047, etc.)
- **Status**: Application restarted successfully ✓

### Environment Migration - December 21, 2025 at 9:43 AM
[x] Successfully configured workflow with webview output type and port 5000
- **Workflow Status**: Running successfully
- **Database**: Initialized successfully with all indexes created
- **Backup Scheduler**: Running at 15:41 (3:41 PM) daily
- **Application**: Serving on port 5000 ✓
- **Login Page**: Verified via screenshot - HMSync login page displaying correctly ✓
- **Migration Status**: All 4 import tasks marked complete [x] ✓

### Service and Pathology Earnings Calculation Triggers - December 20, 2025 at 10:33 PM
[x] Fixed missing earnings calculations for patient services
- **Issue**: Service earnings were never being calculated despite having rates configured (similar to the OPD duplicate rate issue)
- **Root Cause**: The `calculateDoctorEarning()` function existed but was NEVER called from any route. No trigger existed to calculate service earnings when services were created or updated.
- **Solution**:
  1. Changed `calculateDoctorEarning()` from private to public method in storage.ts
  2. Made the service parameter optional - function now fetches it from database if not provided
  3. Added earnings calculation trigger in THREE places:
     - Single service creation route (POST /api/patient-services)
     - Batch service creation route (POST /api/patient-services/batch)
     - Service update route (PUT /api/patient-services/:id)
- **Changes Made**:
  - `server/storage.ts`: Made calculateDoctorEarning public, added auto-fetch of service data
  - `server/routes.ts`: Added calculateDoctorEarning calls in service creation (line 2333) and batch creation (lines 2480-2489) and update (line 2543) routes
- **Earnings Flow Summary**:
  - **OPD Earnings**: Triggered when OPD visit is created (already working)
  - **Service Earnings**: Now triggered when service is created/updated with a doctor assigned
  - **Pathology Earnings**: Triggered when payment is made (already working)
- **Status**: Application restarted successfully, all earnings triggers now active ✓

### OPD Earnings Rate Calculation Fix - December 20, 2025 at 10:18 PM
[x] Fixed OPD earnings being calculated with wrong rate (50% instead of 100%)
- **Issue**: Service rate for OPD consultation for Dr. John S was set to 100%, but earnings were being calculated at 50%
- **Root Cause**: Duplicate OPD consultation rates existed in database (one 50%, one 100%). Query was retrieving the first record (50%) instead of the most recent one (100%)
- **Solution**:
  1. Deleted the old 50% OPD rate record from doctor_service_rates table
  2. Updated ALL earnings calculation functions to query for most recent rate when duplicates exist:
     - `calculateOpdEarning()` - OPD consultation earnings
     - `calculateServiceEarning()` - Service-related earnings (by serviceId match)
     - `calculateServiceEarning()` - Service-related earnings (by name+category match)
     - `calculatePathologyOrderEarning()` - Pathology order earnings
- **Changes Made**: 
  - `server/storage.ts` lines 2007, 2026, 2131, 2246: Added `.orderBy(desc(schema.doctorServiceRates.createdAt))` to all rate queries
  - Database: Deleted duplicate 50% OPD rate record
- **Prevention**: Future rate saves will now always use the most recent rate, preventing calculation errors if duplicates occur
- **Status**: Application restarted successfully, fix deployed ✓

### Environment Migration - December 20, 2025 at 10:14 PM
[x] Successfully configured workflow with webview output type and port 5000
- **Workflow Status**: Running successfully
- **Database**: Initialized successfully with all indexes created
- **Backup Scheduler**: Running at 15:41 (3:41 PM) daily
- **Application**: Serving on port 5000 ✓
- **Login Page**: Verified via screenshot - HMSync login page displaying correctly ✓
- **Migration Status**: All 4 import tasks marked complete [x] ✓

### Default Date Range to Today for Multiple Pages (December 20, 2025 at 9:33 PM)
[x] Set default date range to today for OPD Appointments, Lab Tests, and Diagnostics pages
- **Change**: Modified three pages to automatically set date range to today on page load
- **Implementation**:
  - Added `useEffect` hook to detect when `today` data is fetched
  - Automatically sets `selectedFromDate` and `selectedToDate` to today's date
  - Only applies on initial load (doesn't override user selections)
  - When pages open, shows only today's items by default
  - Users can still change the date range using the date picker
- **Files Modified**: 
  - `client/src/pages/opd-list.tsx` (lines 1, 92-98)
  - `client/src/pages/lab-tests.tsx` (lines 1, 49-55)
  - `client/src/pages/diagnostics.tsx` (lines 1, 52-58)
- **Status**: Application running successfully, changes hot-reloaded ✓

### Environment Migration - December 20, 2025 at 9:18 PM
[x] Successfully configured workflow with webview output type and port 5000
- **Workflow Status**: Running successfully
- **Database**: Initialized successfully with all indexes created
- **Backup Scheduler**: Running at 15:41 (3:41 PM) daily
- **Application**: Serving on port 5000 ✓
- **Migration Status**: All 4 import tasks marked complete [x] ✓

### Environment Migration - December 03, 2025 at 12:39 PM
[x] Successfully configured workflow with webview output type and port 5000
- **Workflow Status**: Running successfully
- **Database**: Initialized successfully with all indexes created
- **Backup Scheduler**: Running at 15:41 (3:41 PM) daily
- **Application**: Serving on port 5000 ✓
- **Login Page**: Verified via screenshot - HMSync login page displaying correctly ✓
- **Migration Status**: All 4 import tasks marked complete [x] ✓

### Service Order Display Fix in Record Payment Dialog - December 02, 2025 at 4:21 PM
[x] Fixed service order display showing receipt number instead of order number
- **Issue**: In Record Payment dialog's "Billable Item" dropdown, service orders were displaying the receipt number (e.g., "251202-SRV-0001") instead of the order number (e.g., "SER-2025-00072")
- **Root Cause**: Line 4543 in server/storage.ts used `orderData.receipt || orderId` which preferred the receipt number over the order ID
- **Solution**: Changed the label and value to use `orderId` directly instead of the receipt number
- **File Modified**: `server/storage.ts` (lines 4545-4555)
- **Before**: "Service - Service Order - 251202-SRV-0001"
- **After**: "Service - Service Order - SER-2025-00072"
- **Status**: Application restarted successfully, fix deployed ✓

### Environment Migration - December 02, 2025 at 4:16 PM
[x] Successfully configured workflow with webview output type and port 5000
- **Workflow Status**: Running successfully
- **Database**: Initialized successfully with all indexes created
- **Backup Scheduler**: Running at 15:41 (3:41 PM) daily
- **Application**: Serving on port 5000 ✓
- **Login Page**: Verified via screenshot - HMSync login page displaying correctly ✓
- **Migration Status**: All 4 import tasks marked complete [x] ✓

### Environment Migration - November 28, 2025 at 5:17 PM
[x] Successfully configured workflow with webview output type and port 5000
- **Workflow Status**: Running successfully
- **Database**: Initialized successfully with all indexes created
- **Backup Scheduler**: Running at 15:41 (3:41 PM) daily
- **Application**: Serving on port 5000 ✓
- **Login Page**: Verified via screenshot - HMSync login page displaying correctly ✓
- **Migration Status**: All 4 import tasks marked complete [x] ✓

### Fly.io Deployment Preparation - November 22, 2025 at 12:40 PM
[x] Prepared HMSync for Fly.io deployment with persistent database storage
- **Configuration Files Created**:
  - `fly.toml` - Fly.io app configuration with volume mount for database
  - `Dockerfile` - Multi-stage build optimized for Node.js + SQLite
  - `.dockerignore` - Excludes dev files and local database from builds
  - `DEPLOYMENT.md` - Complete step-by-step deployment guide
- **Database Path Update**: Modified `server/storage.ts` to use DATABASE_PATH environment variable
  - Development: Uses local `hospital.db` file
  - Production (Fly.io): Uses `/data/hospital.db` on mounted volume
- **Cost Estimate**: ~$0.15/month for 1GB volume storage (VM is free tier)
- **Key Features**:
  - Persistent database storage via Fly.io volumes
  - Automatic database initialization on first run
  - Daily backups at 3:41 PM (built into app)
  - Health checks configured
  - Auto-scaling disabled for always-on operation
- **Next Steps**: Follow DEPLOYMENT.md instructions to deploy to Fly.io
- **Status**: Ready for deployment ✓
