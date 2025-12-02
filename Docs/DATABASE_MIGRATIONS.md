# HMSync Database Migrations Guide

## Table of Contents
1. [Philosophy](#philosophy)
2. [Types of Migrations](#types-of-migrations)
3. [Schema Evolution Migrations](#schema-evolution-migrations)
4. [Data Import Migrations](#data-import-migrations)
5. [Migration Best Practices](#migration-best-practices)
6. [Real-World Scenario: Migrating from Another HMS](#real-world-scenario-migrating-from-another-hms)

---

## Philosophy

Database migrations are **controlled, version-tracked changes** to your database schema and data. The core philosophy behind migrations is:

### Why Migrations Matter

1. **Preserving Data**: When your app evolves, your database schema may need to evolve too. Migrations ensure data integrity during these changes.

2. **Predictability**: Migrations are deterministic—they produce consistent results across different environments (development, staging, production).

3. **Reversibility**: If something goes wrong, migrations can be rolled back (though with care for data loss).

4. **Safety**: Migrations prevent human error by automating schema changes instead of manual SQL execution.

5. **Auditability**: Every migration is tracked and version-controlled, so you know exactly what changed and when.

### The Migration Mindset

- **Never** manually edit the database structure directly
- **Always** define schema changes in code (in `shared/schema.ts`)
- **Always** test migrations locally before deploying
- **Always** backup data before deploying to production
- **Document** what your migration does and why

---

## Types of Migrations

### 1. Schema Evolution Migrations
Changes to your app's database structure that **only affect internal schema**:
- Adding a new column to users table
- Creating a new table for a new feature
- Changing column types or constraints
- Adding or removing indexes

**Example**: Adding a "department" field to doctors

### 2. Data Import Migrations
Moving data **from external sources** into HMSync:
- Importing patient records from another HMS
- Bulk-uploading historical data
- Consolidating multiple data sources
- Converting data from one format to another

**Example**: Migrating 2 years of patient visits from Legacy HMS to HMSync

---

## Schema Evolution Migrations

### How HMSync Migrations Work

HMSync uses **Drizzle ORM** which provides automatic migration management.

### Step 1: Define Your Schema Changes

Edit `shared/schema.ts` and make your schema changes:

```typescript
// Before
export const doctors = sqliteTable("doctors", {
  id: text().primaryKey().default(sql`(uuid())`),
  fullName: text().notNull(),
  // ... other fields
});

// After (adding department field)
export const doctors = sqliteTable("doctors", {
  id: text().primaryKey().default(sql`(uuid())`),
  fullName: text().notNull(),
  department: text().default("General"), // NEW FIELD
  // ... other fields
});
```

### Step 2: Push Schema Locally

Test the migration locally first:

```bash
npm run db:push
```

This creates/updates the database schema and shows you what will change.

### Step 3: Verify Changes

Check your local database to ensure:
- New columns exist and have correct types
- Default values work as expected
- Existing data was preserved

### Step 4: Deploy to Production

Once tested locally, deploy your code to production:

```bash
# On your deployed Fly app
fly deploy
```

The migration runs automatically during deployment.

### Step 4b: If Migration Fails

If something goes wrong in production (rare), force a schema sync:

```bash
npm run db:push --force
```

**Note**: `--force` should only be used if `db:push` encounters conflicts. It will recreate the schema to match your Drizzle definitions.

---

## Data Import Migrations

### Scenario: Migrating from Another HMS

A healthcare organization has been using **Legacy HMS** for 2+ years. They now want to switch to **HMSync** and need all their historical data.

### Phase 1: Assessment

**Before you start, determine:**
1. What data exists in the legacy system?
   - Patients (how many? what fields?)
   - Doctor information
   - Patient visits/consultations
   - Bills and payments
   - Pathology tests
   - Other custom data

2. Data quality check:
   - Are there duplicate records?
   - Missing required fields?
   - Invalid data formats?
   - Corrupted entries?

### Phase 2: Data Extraction

Extract data from the legacy HMS in a standardized format (CSV, JSON, Excel):

```
patients.csv:
patientId, firstName, lastName, phoneNumber, age, gender, address, registrationDate
123, John, Doe, +1234567890, 45, M, "123 Main St", 2022-01-15
124, Jane, Smith, +1234567891, 38, F, "456 Oak Ave", 2022-02-20
...

doctors.csv:
doctorId, fullName, specialty, licenseNumber, phoneNumber, joinDate
D1, Dr. Rajesh Kumar, Cardiology, LIC12345, +919876543210, 2021-06-01
D2, Dr. Priya Sharma, Pediatrics, LIC12346, +919876543211, 2021-07-15
...

visits.csv:
visitId, patientId, doctorId, visitDate, consultationFee, diagnosis, notes
V1, 123, D1, 2022-02-10, 500, Hypertension, Follow-up visit
V2, 124, D2, 2022-02-15, 300, Common Cold, Prescribed antibiotics
...
```

### Phase 3: Data Transformation

Transform legacy data to match HMSync schema:

```typescript
// Example: Transform legacy patient data
const legacyPatients = readCSV('patients.csv');
const hmsyncPatients = legacyPatients.map(patient => ({
  id: generateUUID(), // HMSync uses UUIDs
  firstName: patient.firstName,
  lastName: patient.lastName,
  fullName: `${patient.firstName} ${patient.lastName}`,
  phone: patient.phoneNumber,
  age: parseInt(patient.age),
  gender: patient.gender.toUpperCase(),
  address: patient.address,
  registrationDate: new Date(patient.registrationDate).toISOString(),
  // Map other fields as needed
}));
```

### Phase 4: Data Validation

Before import, validate all data:

```typescript
// Validate transformed data
const validatePatients = (patients) => {
  const errors = [];
  
  patients.forEach((patient, index) => {
    if (!patient.fullName) errors.push(`Row ${index}: Missing name`);
    if (!patient.phone) errors.push(`Row ${index}: Missing phone`);
    if (patient.age < 0 || patient.age > 150) {
      errors.push(`Row ${index}: Invalid age ${patient.age}`);
    }
    if (!['M', 'F', 'O'].includes(patient.gender)) {
      errors.push(`Row ${index}: Invalid gender ${patient.gender}`);
    }
  });
  
  return errors;
};

const errors = validatePatients(hmsyncPatients);
if (errors.length > 0) {
  console.error('Validation errors:', errors);
  process.exit(1);
}
```

### Phase 5: Backup Before Import

**Critical step**: Always backup production database before importing:

```bash
# Export current HMSync database
sqlite3 production.db ".backup backup-$(date +%Y%m%d-%H%M%S).db"
```

### Phase 6: Import Data

Use HMSync's API to import transformed data, or direct database insertion:

```typescript
// Example: Bulk import patients via API
async function importPatients(patients) {
  for (const patient of patients) {
    const response = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patient)
    });
    
    if (!response.ok) {
      console.error(`Failed to import patient:`, patient);
      throw new Error(`Import failed at patient ${patient.id}`);
    }
  }
  
  console.log(`Successfully imported ${patients.length} patients`);
}
```

### Phase 7: Data Verification

After import, verify all data:

```typescript
// Verify import
async function verifyImport() {
  const importedCount = await storage.getPatients().length;
  const expectedCount = legacyPatients.length;
  
  if (importedCount !== expectedCount) {
    throw new Error(`Import mismatch: ${importedCount} imported vs ${expectedCount} expected`);
  }
  
  console.log(`✓ All ${importedCount} patients imported successfully`);
}
```

### Phase 8: Cutover

Once verified:
1. Inform client of cutover plan
2. Stop using legacy HMS at agreed time
3. Perform final data sync if needed
4. Switch users to HMSync
5. Monitor for any issues in first 24 hours
6. Keep legacy system as backup for 30 days

---

## Migration Best Practices

### For Schema Migrations

1. **Plan ahead**: Discuss schema changes with your team
2. **Test locally first**: Always run migrations in development first
3. **One change per migration**: Make it easy to debug if something fails
4. **Use meaningful names**: Clear names help when reviewing history
5. **Document the reason**: Why is this change needed?
6. **Deploy during low-traffic**: If possible, migrate during off-peak hours
7. **Have a rollback plan**: Know how you'd undo the change if needed
8. **Monitor after deployment**: Watch logs for errors post-migration

### For Data Import Migrations

1. **Start with a pilot**: Import for one location/department first
2. **Clean data first**: Fix issues in legacy system before import
3. **Map fields explicitly**: Don't assume field order
4. **Handle missing data**: Decide what to do with incomplete records
5. **Preserve IDs when possible**: Helps with traceability
6. **Create audit trail**: Log what was imported and when
7. **Validate relationships**: Ensure foreign keys are correct
8. **Duplicate detection**: Check for already-imported records
9. **Test reconciliation**: Verify counts match between systems
10. **Keep legacy system running**: For a while as backup

---

## Real-World Scenario: Migrating from Another HMS

### Client Story

**Legacy HMS**: "HealthCare Plus" (using Oracle DB)
**Duration**: 2+ years of patient data (~5,000 patients, ~20,000 visits)
**Goal**: Migrate to HMSync with zero data loss

### Step-by-Step Process

#### Week 1: Planning & Assessment

**Monday**: Kickoff call with client
- Identify all data to migrate
- Document their current system schema
- Create timeline (typically 2-4 weeks)

**Tuesday-Thursday**: Data assessment
- Export sample data from HealthCare Plus
- Analyze data quality issues
- Create mapping document (legacy fields → HMSync fields)

**Friday**: Review & approval
- Present findings to client
- Get approval to proceed
- Identify any custom fields that need accommodation

#### Week 2: Preparation

**Monday-Tuesday**: Set up migration tools
```bash
# Create migration scripts directory
mkdir -p migration-scripts
```

**Wednesday**: Create transformation scripts
```typescript
// migration-scripts/transform-legacy-data.ts
const FIELD_MAPPING = {
  'PAT_ID': 'id',
  'FNAME': 'firstName',
  'LNAME': 'lastName',
  'PHONE': 'phone',
  'AGE': 'age',
  'GENDER': 'gender',
  'REGISTRATION_DATE': 'registrationDate'
};

export async function transformLegacyPatients() {
  // Read from legacy export
  // Transform using mapping
  // Output validated JSON
}
```

**Thursday-Friday**: Testing in staging
- Run migration on staging environment
- Verify record counts
- Check data integrity

#### Week 3: Production Cutover

**Monday-Tuesday**: Final preparation
- Schedule maintenance window (e.g., 2 AM UTC)
- Notify all users
- Backup production database

**Wednesday 2:00 AM UTC**: Migration execution
1. Stop all HealthCare Plus users from creating new records
2. Final data export from HealthCare Plus
3. Transform and validate data
4. Import into HMSync
5. Run verification queries
6. Restore from backup if needed (confidence check)

**Wednesday 6:00 AM UTC**: Cutover
- Switch all users to HMSync
- Monitor logs for errors
- Have support team on standby

**Week 3-4**: Post-migration
- Daily data reconciliation checks
- User feedback collection
- Performance monitoring
- Keep HealthCare Plus running as backup for 30 days

### Expected Outcomes

**Success Metrics**:
- ✓ 100% of patient records migrated
- ✓ Zero data corruption
- ✓ Relationships intact (doctor-patient, visits-patients, etc.)
- ✓ All historical data queryable
- ✓ Reports match legacy system

**Timeline**: 4 weeks total
**Cost**: Depends on data volume and complexity
**Support**: Post-migration support included for 30 days

---

## Troubleshooting

### Problem: Migration Failed in Production

**Solution**:
1. Don't panic—the database is still intact
2. Check error logs: `fly logs`
3. Review what changed in schema
4. Rollback if needed: restore from backup
5. Fix the issue locally and re-test
6. Re-deploy

### Problem: Data Didn't Import Correctly

**Solution**:
1. Verify data in legacy system was correct
2. Check transformation logic
3. Review validation errors
4. For small issues: manually fix in UI
5. For large issues: restore backup and retry

### Problem: Performance Degradation After Migration

**Solution**:
1. Check if indexes were created
2. Verify large tables have appropriate indexes
3. Run `VACUUM` and `ANALYZE` on SQLite
4. Profile slow queries

---

## Summary

Migrations are **not just for developers**—they're a safety net for your data:

| Scenario | Approach | Tools |
|----------|----------|-------|
| Adding new feature (new column) | Schema migration | Drizzle ORM + `db:push` |
| Changing column type | Schema migration | Drizzle ORM + `db:push` |
| Creating new table | Schema migration | Drizzle ORM + `db:push` |
| Importing legacy data | Data import migration | Custom scripts + validation |
| Consolidating systems | Data import migration | ETL pipeline + verification |
| Fixing corrupt data | Data import migration | Scripts + manual verification |

**Golden Rule**: *Always test locally before production, always backup before importing, always validate after.*

---

## Questions?

For migration help specific to HMSync:
- Schema changes: Update `shared/schema.ts` and run `npm run db:push`
- Data imports: Use the patient/doctor/visit API endpoints or direct insertion with validation
- Production issues: Contact support with logs and migration details
