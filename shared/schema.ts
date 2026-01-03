import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  check,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for authentication and role management
export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  profilePicture: text("profile_picture"),
  roles: text("roles").notNull(), // JSON array: ["super_user", "admin", "doctor", "receptionist", "billing_staff"]
  primaryRole: text("primary_role").notNull(), // Primary role for display purposes
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Doctors table
export const doctors = sqliteTable("doctors", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  userId: text("user_id").references(() => users.id),
  name: text("name").notNull(),
  specialization: text("specialization").notNull(),
  qualification: text("qualification").notNull(),
  consultationFee: real("consultation_fee").notNull(),
  profilePicture: text("profile_picture"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Patients table
export const patients = sqliteTable("patients", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  patientId: text("patient_id").notNull().unique(), // PT-2025-00001 format
  name: text("name").notNull(),
  age: integer("age").notNull(),
  gender: text("gender").notNull(), // male, female, other
  phone: text("phone").notNull(),
  address: text("address"),
  email: text("email"),
  emergencyContact: text("emergency_contact"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Patient visits for OPD and Inpatient tracking
export const patientVisits = sqliteTable("patient_visits", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  visitId: text("visit_id").notNull().unique(), // VIS-2024-001 format
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  doctorId: text("doctor_id")
    .notNull()
    .references(() => doctors.id),
  visitType: text("visit_type").notNull(), // opd, inpatient
  visitDate: text("visit_date").notNull(),
  scheduledDate: text("scheduled_date"), // for scheduled OPD appointments
  scheduledTime: text("scheduled_time").default("09:00"), // scheduled appointment time
  symptoms: text("symptoms"),
  diagnosis: text("diagnosis"),
  prescription: text("prescription"),
  consultationFee: real("consultation_fee").default(0), // fee for this visit
  receiptNumber: text("receipt_number"), // receipt number for OPD visits
  status: text("status").notNull().default("scheduled"), // scheduled, paid, completed, referred, cancelled, admitted
  admissionDate: text("admission_date"), // for inpatients
  dischargeDate: text("discharge_date"), // for inpatients
  roomNumber: text("room_number"), // for inpatients
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Services/procedures that can be billed
export const services = sqliteTable("services", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  name: text("name").notNull(),
  category: text("category").notNull(), // consultation, pathology, radiology, procedure
  price: real("price").notNull(),
  description: text("description"),
  billingType: text("billing_type").notNull().default("per_instance"), // per_instance, per_24_hours, per_hour, composite
  billingParameters: text("billing_parameters"), // JSON string for additional parameters
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Bills/Invoices
export const bills = sqliteTable("bills", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  billNumber: text("bill_number").notNull().unique(), // BILL-2024-0001 format
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  visitId: text("visit_id").references(() => patientVisits.id),
  subtotal: real("subtotal").notNull(),
  taxAmount: real("tax_amount").notNull(),
  discountAmount: real("discount_amount").notNull().default(0),
  totalAmount: real("total_amount").notNull(),
  paymentMethod: text("payment_method").notNull(), // cash, card, upi, insurance
  paymentStatus: text("payment_status").notNull().default("pending"), // pending, paid, partial
  paidAmount: real("paid_amount").notNull().default(0),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  billDate: text("bill_date").notNull(),
  dueDate: text("due_date"),
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Bill items/line items
export const billItems = sqliteTable("bill_items", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  billId: text("bill_id")
    .notNull()
    .references(() => bills.id),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: real("unit_price").notNull(),
  totalPrice: real("total_price").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Pathology orders (one order can have multiple tests)
export const pathologyOrders = sqliteTable("pathology_orders", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  orderId: text("order_id").notNull().unique(), // LAB-2024-001 format
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  visitId: text("visit_id").references(() => patientVisits.id),
  doctorId: text("doctor_id").references(() => doctors.id), // Optional for external patients
  status: text("status").notNull().default("ordered"), // ordered, collected, processing, completed, paid, cancelled
  orderedDate: text("ordered_date").notNull(),
  collectedDate: text("collected_date"),
  reportDate: text("report_date"),
  remarks: text("remarks"),
  totalPrice: real("total_price").notNull().default(0),
  receiptNumber: text("receipt_number"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Individual pathology tests within an order
export const pathologyTests = sqliteTable("pathology_tests", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  orderId: text("order_id")
    .notNull()
    .references(() => pathologyOrders.id),
  serviceId: text("service_id").references(() => services.id), // Link to services for doctor rate lookup (nullable for existing tests)
  testName: text("test_name").notNull(),
  testCategory: text("test_category").notNull(),
  status: text("status").notNull().default("ordered"), // ordered, collected, processing, completed
  results: text("results"),
  normalRange: text("normal_range"),
  price: real("price").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Patient Services (OPD, Lab tests, X-ray, ECG, etc.)
export const patientServices = sqliteTable("patient_services", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  serviceId: text("service_id").notNull(),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  visitId: text("visit_id").references(() => patientVisits.id),
  doctorId: text("doctor_id").references(() => doctors.id),
  serviceType: text("service_type").notNull(), // opd, labtest, xray, ecg, consultation, emergency
  serviceName: text("service_name").notNull(),
  orderId: text("order_id"), // SRV-2025-001 format for grouping related services
  status: text("status").notNull().default("scheduled"), // scheduled, in-progress, completed, cancelled
  scheduledDate: text("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time").notNull().default("09:00"),
  completedDate: text("completed_date"),
  notes: text("notes"),
  price: real("price").notNull().default(0),
  billingType: text("billing_type").notNull().default("per_instance"),
  billingQuantity: real("billing_quantity").default(1), // hours, days, km, etc.
  billingParameters: text("billing_parameters"), // JSON for composite billing
  calculatedAmount: real("calculated_amount").notNull().default(0),
  receiptNumber: text("receipt_number"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Patient Admissions - One record per admission episode
export const admissions = sqliteTable("admissions", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  admissionId: text("admission_id").notNull().unique(),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  doctorId: text("doctor_id").references(() => doctors.id),
  currentRoomId: text("current_room_id"),
  currentWardType: text("current_ward_type"),
  currentRoomNumber: text("current_room_number"),
  admissionDate: text("admission_date").notNull(),
  dischargeDate: text("discharge_date"),
  status: text("status").notNull().default("admitted"), // admitted, discharged
  reason: text("reason"),
  diagnosis: text("diagnosis"),
  notes: text("notes"),
  dailyCost: real("daily_cost").notNull().default(0),
  totalCost: real("total_cost").notNull().default(0),
  initialDeposit: real("initial_deposit").notNull().default(0),
  additionalPayments: real("additional_payments").notNull().default(0),
  totalDiscount: real("total_discount").notNull().default(0),
  lastPaymentDate: text("last_payment_date"),
  lastPaymentAmount: real("last_payment_amount").default(0),
  lastDiscountDate: text("last_discount_date"),
  lastDiscountAmount: real("last_discount_amount").default(0),
  lastDiscountReason: text("last_discount_reason"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Admission Events - History log for each admission episode
export const admissionEvents = sqliteTable("admission_events", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  admissionId: text("admission_id")
    .notNull()
    .references(() => admissions.id),
  eventType: text("event_type").notNull(), // 'admit', 'room_change', 'discharge'
  eventTime: text("event_time")
    .notNull()
    .default(sql`(datetime('now'))`),
  roomId: text("room_id"),
  roomNumber: text("room_number"),
  wardType: text("ward_type"),
  notes: text("notes"),
  receiptNumber: text("receipt_number"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Admission Services - Services linked to patient admissions (separate from patient_services)
export const admissionServices = sqliteTable("admission_services", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  admissionId: text("admission_id")
    .notNull()
    .references(() => admissions.id),
  serviceId: text("service_id").notNull().references(() => services.id),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  doctorId: text("doctor_id").references(() => doctors.id),
  serviceName: text("service_name").notNull(),
  status: text("status").notNull().default("scheduled"), // scheduled, in-progress, completed, cancelled
  scheduledDate: text("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time").notNull().default("09:00"),
  completedDate: text("completed_date"),
  notes: text("notes"),
  price: real("price").notNull().default(0),
  billingType: text("billing_type").notNull().default("per_date"), // per_date, per_24_hours, per_instance
  billingQuantity: real("billing_quantity").default(1),
  calculatedAmount: real("calculated_amount").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Hospital settings for system configuration
export const hospitalSettings = sqliteTable("hospital_settings", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  name: text("name").notNull().default("HMSync Hospital"),
  address: text("address")
    .notNull()
    .default("123 Healthcare Street, Medical District, City - 123456"),
  phone: text("phone").notNull().default("+91 98765 43210"),
  email: text("email").notNull().default("info@hmsync.com"),
  registrationNumber: text("registration_number"),
  logoPath: text("logo_path"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// System settings for application configuration
export const systemSettings = sqliteTable("system_settings", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  emailNotifications: integer("email_notifications", { mode: "boolean" })
    .notNull()
    .default(false),
  smsNotifications: integer("sms_notifications", { mode: "boolean" })
    .notNull()
    .default(false),
  autoBackup: integer("auto_backup", { mode: "boolean" })
    .notNull()
    .default(true),
  auditLogging: integer("audit_logging", { mode: "boolean" })
    .notNull()
    .default(true),
  backupFrequency: text("backup_frequency").notNull().default("daily"), // daily, weekly, monthly
  backupTime: text("backup_time").notNull().default("02:00"), // HH:MM format
  backupDay: text("backup_day").notNull().default("Sunday"), // Sunday, Monday, etc. for weekly backups
  backupDate: text("backup_date").notNull().default("1"), // 1-31 for monthly backups
  lastBackupDate: text("last_backup_date"),
  backupRetentionDays: integer("backup_retention_days").notNull().default(30),
  fiscalYearStartMonth: integer("fiscal_year_start_month").notNull().default(4), // 1-12, default April (4)
  fiscalYearStartDay: integer("fiscal_year_start_day").notNull().default(1), // 1-31, default 1st
  auditLogRetentionYears: integer("audit_log_retention_years")
    .notNull()
    .default(7), // Keep archived logs for 7 years
  lastAuditArchiveDate: text("last_audit_archive_date"), // Last time audit logs were archived
  timezone: text("timezone").notNull().default("UTC"), // Timezone for all timestamps (e.g., "Asia/Kolkata", "America/New_York")
  timezoneOffset: text("timezone_offset").notNull().default("+00:00"), // Offset in ±HH:MM format
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Backup logs to track backup history
export const backupLogs = sqliteTable("backup_logs", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  backupId: text("backup_id").notNull().unique(), // BACKUP-2024-001 format
  status: text("status").notNull(), // running, completed, failed
  backupType: text("backup_type").notNull().default("auto"), // auto, manual
  filePath: text("file_path"),
  fileSize: integer("file_size"),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  errorMessage: text("error_message"),
  tableCount: integer("table_count"),
  recordCount: integer("record_count"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Audit log for tracking user actions (active year)
export const auditLog = sqliteTable("audit_log", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  username: text("username").notNull(), // Denormalized for easier querying
  action: text("action").notNull(), // create, update, delete, view
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  oldValues: text("old_values"), // JSON string of old values
  newValues: text("new_values"), // JSON string of new values
  changedFields: text("changed_fields"), // JSON array of field names that changed
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Audit log backup for archived audit logs (multi-year retention)
export const auditLogBackup = sqliteTable("audit_log_backup", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  username: text("username").notNull(),
  action: text("action").notNull(), // create, update, delete, view
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  oldValues: text("old_values"), // JSON string of old values
  newValues: text("new_values"), // JSON string of new values
  changedFields: text("changed_fields"), // JSON array of field names that changed
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  fiscalYear: text("fiscal_year").notNull(), // e.g., "2024-2025"
  archivedAt: text("archived_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  createdAt: text("created_at").notNull(),
});

// Room/Service Management
export const roomTypes = sqliteTable("room_types", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  name: text("name").notNull().unique(), // "General Ward", "Private Room", "ICU", "Emergency"
  category: text("category").notNull(), // "ward", "icu", "emergency", "ot", "room"
  dailyCost: real("daily_cost").notNull().default(0),
  totalBeds: integer("total_beds").notNull().default(0),
  occupiedBeds: integer("occupied_beds").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const rooms = sqliteTable("rooms", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  roomNumber: text("room_number").notNull().unique(),
  roomTypeId: text("room_type_id")
    .notNull()
    .references(() => roomTypes.id),
  floor: text("floor"),
  building: text("building"),
  capacity: integer("capacity").notNull().default(1),
  isOccupied: integer("is_occupied", { mode: "boolean" })
    .notNull()
    .default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Pathology Categories for dynamic test management
export const pathologyCategories = sqliteTable("pathology_categories", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Pathology Category Tests
export const pathologyCategoryTests = sqliteTable("pathology_category_tests", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  categoryId: text("category_id")
    .notNull()
    .references(() => pathologyCategories.id),
  testName: text("test_name").notNull(),
  price: real("price").notNull().default(0),
  description: text("description"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Service Categories for dynamic category management
export const serviceCategories = sqliteTable("service_categories", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  name: text("name").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  icon: text("icon").notNull().default("Settings"), // Lucide icon name
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false), // true for predefined categories
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Patient Payments - Independent of admissions
export const patientPayments = sqliteTable("patient_payments", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  paymentId: text("payment_id").notNull().unique(), // PAY-2024-001 format
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  amount: real("amount").notNull(),
  paymentMethod: text("payment_method").notNull(), // cash, card, upi, bank_transfer
  paymentDate: text("payment_date").notNull(),
  reason: text("reason"), // Optional reason/notes for payment
  receiptNumber: text("receipt_number"),
  processedBy: text("processed_by")
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Patient Discounts - Independent of admissions
export const patientDiscounts = sqliteTable("patient_discounts", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  discountId: text("discount_id").notNull().unique(), // DISC-2024-001 format
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  amount: real("amount").notNull(),
  discountType: text("discount_type").notNull().default("manual"), // manual, insurance, senior_citizen, employee
  reason: text("reason").notNull(),
  discountDate: text("discount_date").notNull(),
  billableItemType: text("billable_item_type"), // opd_visit, admission, service, pathology, admission_service
  billableItemId: text("billable_item_id"), // Reference to the specific billable item
  approvedBy: text("approved_by")
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Activities table for tracking user actions
export const activities = sqliteTable("activities", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  userId: text("user_id").references(() => users.id),
  activityType: text("activity_type").notNull(), // e.g., 'login', 'create_patient', 'update_bill'
  title: text("title").notNull(),
  description: text("description").notNull(),
  entityId: text("entity_id"),
  entityType: text("entity_type"),
  metadata: text("metadata"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Doctor Service Rates - Maps doctors to services with commission/salary rates
export const doctorServiceRates = sqliteTable("doctor_service_rates", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  doctorId: text("doctor_id")
    .notNull()
    .references(() => doctors.id),
  serviceId: text("service_id").references(() => services.id), // Nullable to support representative entries (e.g., pathology_lab_representative, opd_consultation_placeholder)
  serviceName: text("service_name").notNull(), // Denormalized for easier querying
  serviceCategory: text("service_category").notNull(), // opd, diagnostics, lab_tests, admission, pathology
  rateType: text("rate_type").notNull().default("per_instance"), // per_instance, percentage, fixed_daily
  rateAmount: real("rate_amount").notNull(), // Amount or percentage
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  notes: text("notes"),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Doctor Earnings - Tracks what doctors have earned based on services performed
export const doctorEarnings = sqliteTable("doctor_earnings", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  earningId: text("earning_id").notNull().unique(), // EARN-2024-001 format
  doctorId: text("doctor_id")
    .notNull()
    .references(() => doctors.id),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id),
  patientServiceId: text("patient_service_id").references(
    () => patientServices.id,
  ), // Link to actual service performed
  serviceName: text("service_name").notNull(),
  serviceCategory: text("service_category").notNull(),
  serviceDate: text("service_date").notNull(),
  rateType: text("rate_type").notNull(), // per_instance, percentage, fixed_daily
  rateAmount: real("rate_amount").notNull(), // The rate applied
  servicePrice: real("service_price").notNull(), // Original service price
  earnedAmount: real("earned_amount").notNull(), // Calculated earning amount
  status: text("status").notNull().default("pending"), // pending, paid
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Doctor Payments - Tracks payments made to doctors
export const doctorPayments = sqliteTable("doctor_payments", {
  id: text("id")
    .primaryKey()
    .default(sql`(lower(hex(randomblob(16))))`),
  paymentId: text("payment_id").notNull().unique(), // DPAY-2024-001 format
  doctorId: text("doctor_id")
    .notNull()
    .references(() => doctors.id),
  paymentDate: text("payment_date").notNull(),
  totalAmount: real("total_amount").notNull(),
  paymentMethod: text("payment_method").notNull(), // cash, bank_transfer, cheque
  earningsIncluded: text("earnings_included").notNull(), // JSON array of earning IDs
  startDate: text("start_date").notNull(), // Period start date
  endDate: text("end_date").notNull(), // Period end date
  description: text("description"),
  processedBy: text("processed_by")
    .notNull()
    .references(() => users.id),
  receiptNumber: text("receipt_number"),
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    primaryRole: true,
  })
  .extend({
    roles: z
      .array(
        z.enum([
          "super_user",
          "admin",
          "doctor",
          "receptionist",
          "billing_staff",
        ]),
      )
      .min(1, "At least one role is required"),
  });

// Profile update schema - for users to edit their own profile
export const updateProfileSchema = z
  .object({
    username: z.string().min(1, "Username is required").trim(),
    fullName: z.string().min(1, "Full name is required").trim(),
    profilePicture: z.string().optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .optional(),
  })
  .partial()
  .refine(
    (data) => {
      // At least one field must be provided
      return Object.keys(data).length > 0;
    },
    { message: "At least one field must be provided" },
  );

export const insertDoctorSchema = createInsertSchema(doctors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPatientSchema = createInsertSchema(patients)
  .omit({
    id: true,
    patientId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1, "Name is required"),
    age: z
      .number()
      .min(1, "Age must be greater than 0")
      .max(150, "Invalid age"),
    gender: z.string().min(1, "Gender is required"),
    phone: z.string().min(1, "Phone number is required"),
  });

export const insertPatientVisitSchema = createInsertSchema(patientVisits).omit({
  id: true,
  visitId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceSchema = createInsertSchema(services)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    billingType: z
      .enum([
        "per_instance",
        "per_24_hours",
        "per_hour",
        "composite",
        "variable",
        "per_date",
      ])
      .default("per_instance"),
    billingParameters: z.string().nullable().optional(),
  });

export const insertBillSchema = createInsertSchema(bills).omit({
  id: true,
  billNumber: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBillItemSchema = createInsertSchema(billItems).omit({
  id: true,
  createdAt: true,
});

export const insertPathologyOrderSchema = createInsertSchema(
  pathologyOrders,
).omit({
  id: true,
  orderId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPatientServiceSchema = createInsertSchema(patientServices)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    patientId: z.string().min(1, "Patient ID is required"),
    serviceType: z.string().min(1, "Service type is required"),
    serviceName: z.string().min(1, "Service name is required"),
    scheduledDate: z.string().min(1, "Scheduled date is required"),
    scheduledTime: z.string().min(1, "Scheduled time is required"),
    billingType: z
      .enum([
        "per_instance",
        "per_24_hours",
        "per_hour",
        "composite",
        "variable",
        "per_date",
      ])
      .default("per_instance"),
    billingQuantity: z.number().optional().default(1),
    billingParameters: z.string().optional(),
    calculatedAmount: z.number().default(0),
    receiptNumber: z.string().optional(),
  });

export const insertAdmissionSchema = createInsertSchema(admissions)
  .omit({
    id: true,
    admissionId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    patientId: z.string().min(1, "Patient is required"),
    doctorId: z.string().min(1, "Doctor is required"),
    currentWardType: z.string().min(1, "Ward type is required"),
    admissionDate: z.string().min(1, "Admission date is required"),
    reason: z.string().optional(),
    dailyCost: z.number().min(0, "Daily cost must be non-negative"),
    initialDeposit: z
      .number()
      .min(0, "Initial deposit must be non-negative")
      .optional(),
  });

export const insertAdmissionEventSchema = createInsertSchema(
  admissionEvents,
).omit({
  id: true,
  createdAt: true,
});

export const insertAdmissionServiceSchema = createInsertSchema(admissionServices)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    admissionId: z.string().min(1, "Admission ID is required"),
    serviceId: z.string().min(1, "Service ID is required"),
    patientId: z.string().min(1, "Patient ID is required"),
    serviceName: z.string().min(1, "Service name is required"),
    scheduledDate: z.string().min(1, "Scheduled date is required"),
    scheduledTime: z.string().min(1, "Scheduled time is required"),
    billingType: z
      .enum(["per_date", "per_24_hours", "per_instance"])
      .default("per_date"),
    billingQuantity: z.number().optional().default(1),
    calculatedAmount: z.number().default(0),
  });

export const insertPathologyTestSchema = createInsertSchema(
  pathologyTests,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLog).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogBackupSchema = createInsertSchema(
  auditLogBackup,
).omit({
  id: true,
  archivedAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

export const insertPathologyCategorySchema = createInsertSchema(
  pathologyCategories,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPathologyCategoryTestSchema = createInsertSchema(
  pathologyCategoryTests,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceCategorySchema = createInsertSchema(
  serviceCategories,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPatientPaymentSchema = createInsertSchema(patientPayments)
  .omit({
    id: true,
    paymentId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    patientId: z.string().min(1, "Patient ID is required"),
    amount: z.number().min(0.01, "Payment amount must be greater than 0"),
    paymentMethod: z.enum(["cash", "card", "upi", "bank_transfer"], {
      errorMap: () => ({
        message: "Payment method must be cash, card, upi, or bank_transfer",
      }),
    }),
    paymentDate: z.string().min(1, "Payment date is required"),
    processedBy: z.string().min(1, "Processed by user ID is required"),
    reason: z.string().optional(),
    receiptNumber: z.string().optional(),
  });

export const insertPatientDiscountSchema = createInsertSchema(patientDiscounts)
  .omit({
    id: true,
    discountId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    patientId: z.string().min(1, "Patient ID is required"),
    amount: z.number().min(0.01, "Discount amount must be greater than 0"),
    discountType: z.enum(
      ["manual", "insurance", "senior_citizen", "employee"],
      {
        errorMap: () => ({
          message:
            "Discount type must be manual, insurance, senior_citizen, or employee",
        }),
      },
    ),
    reason: z.string().min(1, "Discount reason is required"),
    discountDate: z.string().min(1, "Discount date is required"),
    billableItemType: z.enum(["opd_visit", "admission", "service", "pathology", "admission_service"]).optional(),
    billableItemId: z.string().optional(),
    approvedBy: z.string().min(1, "Approved by user ID is required"),
  });

export const insertRoomTypeSchema = createInsertSchema(roomTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRoomSchema = createInsertSchema(rooms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHospitalSettingsSchema = createInsertSchema(
  hospitalSettings,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSystemSettingsSchema = createInsertSchema(
  systemSettings,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBackupLogSchema = createInsertSchema(backupLogs).omit({
  id: true,
  createdAt: true,
});

export const insertDoctorServiceRateSchema = createInsertSchema(
  doctorServiceRates,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    doctorId: z.string().min(1, "Doctor ID is required"),
    serviceId: z.string().min(1, "Service ID is required"),
    serviceName: z.string().min(1, "Service name is required"),
    serviceCategory: z.enum(
      ["opd", "diagnostics", "lab_tests", "admission", "pathology"],
      {
        errorMap: () => ({
          message:
            "Service category must be opd, diagnostics, lab_tests, admission, or pathology",
        }),
      },
    ),
    rateType: z
      .enum(["amount", "percentage", "fixed_daily"], {
        errorMap: () => ({
          message: "Rate type must be amount, percentage, or fixed_daily",
        }),
      })
      .default("amount"),
    rateAmount: z.number().min(0, "Rate amount must be non-negative"),
    createdBy: z.string().min(1, "Created by user ID is required"),
  });

export const insertDoctorEarningSchema = createInsertSchema(doctorEarnings)
  .omit({
    id: true,
    earningId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    doctorId: z.string().min(1, "Doctor ID is required"),
    patientId: z.string().min(1, "Patient ID is required"),
    serviceId: z.string().min(1, "Service ID is required"),
    serviceName: z.string().min(1, "Service name is required"),
    serviceCategory: z.string().min(1, "Service category is required"),
    serviceDate: z.string().min(1, "Service date is required"),
    rateType: z.enum(["amount", "percentage", "fixed_daily"]),
    rateAmount: z.number().min(0, "Rate amount must be non-negative"),
    servicePrice: z.number().min(0, "Service price must be non-negative"),
    earnedAmount: z.number().min(0, "Earned amount must be non-negative"),
  });

export const insertDoctorPaymentSchema = createInsertSchema(doctorPayments)
  .omit({
    id: true,
    paymentId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    doctorId: z.string().min(1, "Doctor ID is required"),
    paymentDate: z.string().min(1, "Payment date is required"),
    totalAmount: z.number().min(0.01, "Total amount must be greater than 0"),
    paymentMethod: z.enum(["cash", "bank_transfer", "cheque"], {
      errorMap: () => ({
        message: "Payment method must be cash, bank_transfer, or cheque",
      }),
    }),
    earningsIncluded: z.string().min(1, "Earnings included is required"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    processedBy: z.string().min(1, "Processed by user ID is required"),
  });

// Types
export type User = typeof users.$inferSelect & {
  rolesArray?: string[]; // Helper property for parsed roles
};
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Doctor = typeof doctors.$inferSelect;
export type InsertDoctor = z.infer<typeof insertDoctorSchema>;
export type Patient = typeof patients.$inferSelect;
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type PatientVisit = typeof patientVisits.$inferSelect;
export type InsertPatientVisit = z.infer<typeof insertPatientVisitSchema>;
export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Bill = typeof bills.$inferSelect;
export type InsertBill = z.infer<typeof insertBillSchema>;
export type BillItem = typeof billItems.$inferSelect;
export type InsertBillItem = z.infer<typeof insertBillItemSchema>;
export type PathologyOrder = typeof pathologyOrders.$inferSelect;
export type InsertPathologyOrder = z.infer<typeof insertPathologyOrderSchema>;
export type PathologyTest = typeof pathologyTests.$inferSelect;
export type InsertPathologyTest = z.infer<typeof insertPathologyTestSchema>;
export type PatientService = typeof patientServices.$inferSelect;
export type InsertPatientService = z.infer<typeof insertPatientServiceSchema>;
export type Admission = typeof admissions.$inferSelect;
export type InsertAdmission = z.infer<typeof insertAdmissionSchema>;
export type AdmissionEvent = typeof admissionEvents.$inferSelect;
export type InsertAdmissionEvent = z.infer<typeof insertAdmissionEventSchema>;
export type AdmissionService = typeof admissionServices.$inferSelect;
export type InsertAdmissionService = z.infer<typeof insertAdmissionServiceSchema>;
export type RoomType = typeof roomTypes.$inferSelect;
export type InsertRoomType = z.infer<typeof insertRoomTypeSchema>;
export type Room = typeof rooms.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type HospitalSettings = typeof hospitalSettings.$inferSelect;
export type InsertHospitalSettings = z.infer<
  typeof insertHospitalSettingsSchema
>;
export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;
export type BackupLog = typeof backupLogs.$inferSelect;
export type PatientPayment = typeof patientPayments.$inferSelect;
export type InsertPatientPayment = z.infer<typeof insertPatientPaymentSchema>;
export type PatientDiscount = typeof patientDiscounts.$inferSelect;
export type InsertPatientDiscount = z.infer<typeof insertPatientDiscountSchema>;
export type InsertBackupLog = z.infer<typeof insertBackupLogSchema>;
export type PathologyCategory = typeof pathologyCategories.$inferSelect;
export type InsertPathologyCategory = z.infer<
  typeof insertPathologyCategorySchema
>;
export type PathologyCategoryTest = typeof pathologyCategoryTests.$inferSelect;
export type InsertPathologyCategoryTest = z.infer<
  typeof insertPathologyCategoryTestSchema
>;
export type ServiceCategory = typeof serviceCategories.$inferSelect;
export type InsertServiceCategory = z.infer<typeof insertServiceCategorySchema>;

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type AuditLogBackup = typeof auditLogBackup.$inferSelect;
export type InsertAuditLogBackup = z.infer<typeof insertAuditLogBackupSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export type DoctorServiceRate = typeof doctorServiceRates.$inferSelect;
export type InsertDoctorServiceRate = z.infer<
  typeof insertDoctorServiceRateSchema
>;

export type DoctorEarning = typeof doctorEarnings.$inferSelect;
export type InsertDoctorEarning = z.infer<typeof insertDoctorEarningSchema>;

export type DoctorPayment = typeof doctorPayments.$inferSelect;
export type InsertDoctorPayment = z.infer<typeof insertDoctorPaymentSchema>;

// Update schema for PATCH (partial updates allowed)
export const updatePatientSchema = insertPatientSchema.partial();
export type UpdatePatient = z.infer<typeof updatePatientSchema>;

/**
 * Calculate 24-hour periods for per_24_hours billing type
 * Example: Jan 1 6pm to Jan 3 11am = 41 hours = ceil(41/24) = 2 periods
 */
export function calculate24HourPeriods(
  admissionDate: string | Date,
  endDate?: string | Date,
): number {
  let startDate: Date;

  // Parse admission date
  if (typeof admissionDate === "string") {
    const dateStr = admissionDate;

    // Detect SQL datetime format "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD HH:MM"
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(dateStr)) {
      const match = dateStr.match(
        /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/,
      );
      if (match) {
        const [, year, month, day, hour, minute, second = "0"] = match;
        startDate = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hour),
          parseInt(minute),
          parseInt(second),
        );
      } else {
        startDate = new Date(dateStr);
      }
    } else {
      startDate = new Date(dateStr);
    }
  } else {
    startDate = admissionDate;
  }

  const end = endDate ? new Date(endDate) : new Date();

  // Guard against invalid dates
  if (isNaN(startDate.getTime()) || isNaN(end.getTime())) {
    return 1;
  }

  // Calculate actual hours elapsed
  const hoursElapsed = (end.getTime() - startDate.getTime()) / (1000 * 60 * 60);
  
  // Round up to nearest 24-hour period (minimum 1)
  const periods = Math.ceil(hoursElapsed / 24);
  
  return Math.max(1, periods);
}

/**
 * Calculate admission stay duration in calendar days for per_date billing type
 * Example: Jan 1 6pm to Jan 3 11am = 3 days (1st, 2nd, 3rd - inclusive)
 * This ensures frontend and backend calculations always match
 */
export function calculateStayDays(
  admissionDate: string | Date,
  endDate?: string | Date,
  timezone: string = "UTC",
): number {
  let startDate: Date;

  // Parse admission date using the same robust logic as frontend
  if (typeof admissionDate === "string") {
    const dateStr = admissionDate;

    // Detect SQL datetime format "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD HH:MM"
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(dateStr)) {
      // Parse SQL format as local time to avoid timezone conversion
      const match = dateStr.match(
        /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/,
      );
      if (match) {
        const [, year, month, day, hour, minute, second = "0"] = match;
        startDate = new Date(
          parseInt(year),
          parseInt(month) - 1, // Month is 0-indexed
          parseInt(day),
          parseInt(hour),
          parseInt(minute),
          parseInt(second),
        );
      } else {
        startDate = new Date(dateStr);
      }
    } else {
      // Fallback to default Date parsing for other formats
      startDate = new Date(dateStr);
    }
  } else {
    startDate = admissionDate;
  }

  const end = endDate ? new Date(endDate) : new Date();

  // Guard against invalid dates
  if (isNaN(startDate.getTime()) || isNaN(end.getTime())) {
    return 1; // Fallback to minimum 1 day for invalid dates
  }

  // Timezone-aware calendar day calculation
  const getParts = (date: Date, tz: string) => {
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: false,
      });
      const parts: Record<string, number> = {};
      formatter.formatToParts(date).forEach(({ type, value }) => {
        if (type !== "literal") parts[type] = parseInt(value, 10);
      });
      return parts;
    } catch (e) {
      // Fallback to UTC if timezone is invalid
      return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
      };
    }
  };

  const p1 = getParts(startDate, timezone);
  const p2 = getParts(end, timezone);

  // Create dates at midnight in the respective timezone days
  const d1 = new Date(Date.UTC(p1.year, p1.month - 1, p1.day));
  const d2 = new Date(Date.UTC(p2.year, p2.month - 1, p2.day));

  // Calculate difference in calendar dates
  const timeDiff = d2.getTime() - d1.getTime();
  const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24)) + 1;

  // Minimum 1 day for any admission
  return Math.max(1, daysDiff);
}
