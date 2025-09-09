import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, check } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for authentication and role management
export const users = sqliteTable("users", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull(), // admin, doctor, receptionist, billing_staff
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Doctors table
export const doctors = sqliteTable("doctors", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  userId: text("user_id").references(() => users.id),
  name: text("name").notNull(),
  specialization: text("specialization").notNull(),
  qualification: text("qualification").notNull(),
  consultationFee: real("consultation_fee").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Patients table
export const patients = sqliteTable("patients", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  patientId: text("patient_id").notNull().unique(), // PAT-2024-001 format
  name: text("name").notNull(),
  age: integer("age").notNull(),
  gender: text("gender").notNull(), // male, female, other
  phone: text("phone").notNull(),
  address: text("address"),
  email: text("email"),
  emergencyContact: text("emergency_contact"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Patient visits for OPD and Inpatient tracking
export const patientVisits = sqliteTable("patient_visits", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  visitId: text("visit_id").notNull().unique(), // VIS-2024-001 format
  patientId: text("patient_id").notNull().references(() => patients.id),
  doctorId: text("doctor_id").notNull().references(() => doctors.id),
  visitType: text("visit_type").notNull(), // opd, inpatient
  visitDate: text("visit_date").notNull(),
  symptoms: text("symptoms"),
  diagnosis: text("diagnosis"),
  prescription: text("prescription"),
  status: text("status").notNull().default("active"), // active, completed, cancelled
  admissionDate: text("admission_date"), // for inpatients
  dischargeDate: text("discharge_date"), // for inpatients
  roomNumber: text("room_number"), // for inpatients
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Schedule events for calendar-based scheduling
export const scheduleEvents = sqliteTable("schedule_events", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  title: text("title").notNull(),
  eventType: text("event_type").notNull(), // opd, inpatient, surgery, doctor_shift
  patientId: text("patient_id").references(() => patients.id), // Optional for doctor shifts
  doctorId: text("doctor_id").notNull().references(() => doctors.id),
  startTime: text("start_time").notNull(), // ISO datetime string
  endTime: text("end_time").notNull(), // ISO datetime string
  notes: text("notes"),
  status: text("status").notNull().default("scheduled"), // scheduled, completed, cancelled
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Services/procedures that can be billed
export const services = sqliteTable("services", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  name: text("name").notNull(),
  category: text("category").notNull(), // consultation, pathology, radiology, procedure
  price: real("price").notNull(),
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Bills/Invoices
export const bills = sqliteTable("bills", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  billNumber: text("bill_number").notNull().unique(), // BILL-2024-0001 format
  patientId: text("patient_id").notNull().references(() => patients.id),
  visitId: text("visit_id").references(() => patientVisits.id),
  subtotal: real("subtotal").notNull(),
  taxAmount: real("tax_amount").notNull(),
  discountAmount: real("discount_amount").notNull().default(0),
  totalAmount: real("total_amount").notNull(),
  paymentMethod: text("payment_method").notNull(), // cash, card, upi, insurance
  paymentStatus: text("payment_status").notNull().default("pending"), // pending, paid, partial
  paidAmount: real("paid_amount").notNull().default(0),
  createdBy: text("created_by").notNull().references(() => users.id),
  billDate: text("bill_date").notNull(),
  dueDate: text("due_date"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Bill items/line items
export const billItems = sqliteTable("bill_items", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  billId: text("bill_id").notNull().references(() => bills.id),
  serviceId: text("service_id").notNull().references(() => services.id),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: real("unit_price").notNull(),
  totalPrice: real("total_price").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// Pathology orders (one order can have multiple tests)
export const pathologyOrders = sqliteTable("pathology_orders", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  orderId: text("order_id").notNull().unique(), // LAB-2024-001 format
  patientId: text("patient_id").notNull().references(() => patients.id),
  visitId: text("visit_id").references(() => patientVisits.id),
  doctorId: text("doctor_id").references(() => doctors.id), // Optional for external patients
  status: text("status").notNull().default("ordered"), // ordered, collected, processing, completed
  orderedDate: text("ordered_date").notNull(),
  collectedDate: text("collected_date"),
  reportDate: text("report_date"),
  remarks: text("remarks"),
  totalPrice: real("total_price").notNull().default(0),
  receiptNumber: text("receipt_number"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Individual pathology tests within an order
export const pathologyTests = sqliteTable("pathology_tests", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  orderId: text("order_id").notNull().references(() => pathologyOrders.id),
  testName: text("test_name").notNull(),
  testCategory: text("test_category").notNull(),
  status: text("status").notNull().default("ordered"), // ordered, collected, processing, completed
  results: text("results"),
  normalRange: text("normal_range"),
  price: real("price").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Patient Services (OPD, Lab tests, X-ray, ECG, etc.)
export const patientServices = sqliteTable("patient_services", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  serviceId: text("service_id").notNull(),
  patientId: text("patient_id").notNull().references(() => patients.id),
  visitId: text("visit_id").references(() => patientVisits.id),
  doctorId: text("doctor_id").references(() => doctors.id),
  serviceType: text("service_type").notNull(), // opd, labtest, xray, ecg, consultation, emergency
  serviceName: text("service_name").notNull(),
  status: text("status").notNull().default("scheduled"), // scheduled, in-progress, completed, cancelled
  scheduledDate: text("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time").notNull().default("09:00"),
  completedDate: text("completed_date"),
  notes: text("notes"),
  price: real("price").notNull().default(0),
  receiptNumber: text("receipt_number"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Patient Admissions - One record per admission episode
export const admissions = sqliteTable("admissions", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  admissionId: text("admission_id").notNull().unique(),
  patientId: text("patient_id").notNull().references(() => patients.id),
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
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Admission Events - History log for each admission episode
export const admissionEvents = sqliteTable("admission_events", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  admissionId: text("admission_id").notNull().references(() => admissions.id),
  eventType: text("event_type").notNull(), // 'admit', 'room_change', 'discharge'
  eventTime: text("event_time").notNull().default(sql`(datetime('now'))`),
  roomId: text("room_id"),
  roomNumber: text("room_number"),
  wardType: text("ward_type"),
  notes: text("notes"),
  receiptNumber: text("receipt_number"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// Hospital settings for system configuration
export const hospitalSettings = sqliteTable("hospital_settings", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  name: text("name").notNull().default("MedCare Pro Hospital"),
  address: text("address").notNull().default("123 Healthcare Street, Medical District, City - 123456"),
  phone: text("phone").notNull().default("+91 98765 43210"),
  email: text("email").notNull().default("info@medcarepro.com"),
  registrationNumber: text("registration_number"),
  logoPath: text("logo_path"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// System settings for application configuration
export const systemSettings = sqliteTable("system_settings", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  emailNotifications: integer("email_notifications", { mode: "boolean" }).notNull().default(false),
  smsNotifications: integer("sms_notifications", { mode: "boolean" }).notNull().default(false),
  autoBackup: integer("auto_backup", { mode: "boolean" }).notNull().default(true),
  auditLogging: integer("audit_logging", { mode: "boolean" }).notNull().default(true),
  backupFrequency: text("backup_frequency").notNull().default("daily"), // daily, weekly, monthly
  backupTime: text("backup_time").notNull().default("02:00"), // HH:MM format
  lastBackupDate: text("last_backup_date"),
  backupRetentionDays: integer("backup_retention_days").notNull().default(30),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Backup logs to track backup history
export const backupLogs = sqliteTable("backup_logs", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
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
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// Audit log for tracking all user actions
export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  userId: text("user_id").notNull().references(() => users.id),
  action: text("action").notNull(), // create, update, delete, view
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  oldValues: text("old_values"), // JSON string of old values
  newValues: text("new_values"), // JSON string of new values
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// Room/Service Management
export const roomTypes = sqliteTable("room_types", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  name: text("name").notNull().unique(), // "General Ward", "Private Room", "ICU", "Emergency"
  category: text("category").notNull(), // "ward", "icu", "emergency", "ot", "room"
  dailyCost: real("daily_cost").notNull().default(0),
  totalBeds: integer("total_beds").notNull().default(0),
  occupiedBeds: integer("occupied_beds").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  roomNumber: text("room_number").notNull().unique(),
  roomTypeId: text("room_type_id").notNull().references(() => roomTypes.id),
  floor: text("floor"),
  building: text("building"),
  capacity: integer("capacity").notNull().default(1),
  isOccupied: integer("is_occupied", { mode: "boolean" }).notNull().default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Pathology Categories for dynamic test management
export const pathologyCategories = sqliteTable("pathology_categories", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  name: text("name").notNull().unique(),
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Dynamic Pathology Tests
export const dynamicPathologyTests = sqliteTable("dynamic_pathology_tests", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  categoryId: text("category_id").notNull().references(() => pathologyCategories.id),
  testName: text("test_name").notNull(),
  price: real("price").notNull().default(0),
  normalRange: text("normal_range"),
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Patient Payments - Independent of admissions
export const patientPayments = sqliteTable("patient_payments", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  paymentId: text("payment_id").notNull().unique(), // PAY-2024-001 format
  patientId: text("patient_id").notNull().references(() => patients.id),
  amount: real("amount").notNull(),
  paymentMethod: text("payment_method").notNull(), // cash, card, upi, bank_transfer
  paymentDate: text("payment_date").notNull(),
  reason: text("reason"), // Optional reason/notes for payment
  receiptNumber: text("receipt_number"),
  processedBy: text("processed_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Patient Discounts - Independent of admissions
export const patientDiscounts = sqliteTable("patient_discounts", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  discountId: text("discount_id").notNull().unique(), // DISC-2024-001 format
  patientId: text("patient_id").notNull().references(() => patients.id),
  amount: real("amount").notNull(),
  discountType: text("discount_type").notNull().default("manual"), // manual, insurance, senior_citizen, employee
  reason: text("reason").notNull(),
  discountDate: text("discount_date").notNull(),
  approvedBy: text("approved_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Activities table for tracking user actions
export const activities = sqliteTable("activities", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  userId: text("user_id").references(() => users.id),
  activityType: text("activity_type").notNull(), // e.g., 'login', 'create_patient', 'update_bill'
  title: text("title").notNull(),
  description: text("description").notNull(),
  entityId: text("entity_id"),
  entityType: text("entity_type"),
  metadata: text("metadata"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});


// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDoctorSchema = createInsertSchema(doctors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPatientSchema = createInsertSchema(patients).omit({
  id: true,
  patientId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "Name is required"),
  age: z.number().min(1, "Age must be greater than 0").max(150, "Invalid age"),
  gender: z.string().min(1, "Gender is required"),
  phone: z.string().min(1, "Phone number is required"),
});

export const insertPatientVisitSchema = createInsertSchema(patientVisits).omit({
  id: true,
  visitId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScheduleEventSchema = createInsertSchema(scheduleEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  title: z.string().min(1, "Title is required"),
  eventType: z.enum(["opd", "inpatient", "surgery", "doctor_shift"], {
    errorMap: () => ({ message: "Event type must be opd, inpatient, surgery, or doctor_shift" })
  }),
  doctorId: z.string().min(1, "Doctor is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  patientId: z.string().optional(),
  notes: z.string().optional(),
  createdBy: z.string().min(1, "Created by is required"),
});

export const insertServiceSchema = createInsertSchema(services).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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

export const insertPathologyOrderSchema = createInsertSchema(pathologyOrders).omit({
  id: true,
  orderId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPatientServiceSchema = createInsertSchema(patientServices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  patientId: z.string().min(1, "Patient ID is required"),
  serviceType: z.string().min(1, "Service type is required"),
  serviceName: z.string().min(1, "Service name is required"),
  scheduledDate: z.string().min(1, "Scheduled date is required"),
  scheduledTime: z.string().min(1, "Scheduled time is required"),
  receiptNumber: z.string().optional(),
});

export const insertAdmissionSchema = createInsertSchema(admissions).omit({
  id: true,
  admissionId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  patientId: z.string().min(1, "Patient is required"),
  doctorId: z.string().min(1, "Doctor is required"),
  currentWardType: z.string().min(1, "Ward type is required"),
  admissionDate: z.string().min(1, "Admission date is required"),
  reason: z.string().optional(),
  dailyCost: z.number().min(0, "Daily cost must be non-negative"),
  initialDeposit: z.number().min(0, "Initial deposit must be non-negative").optional(),
});

export const insertAdmissionEventSchema = createInsertSchema(admissionEvents).omit({
  id: true,
  createdAt: true,
});

export const insertPathologyTestSchema = createInsertSchema(pathologyTests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLog).omit({
  id: true,
  createdAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

export const insertPathologyCategorySchema = createInsertSchema(pathologyCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDynamicPathologyTestSchema = createInsertSchema(dynamicPathologyTests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPatientPaymentSchema = createInsertSchema(patientPayments).omit({
  id: true,
  paymentId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  patientId: z.string().min(1, "Patient ID is required"),
  amount: z.number().min(0.01, "Payment amount must be greater than 0"),
  paymentMethod: z.enum(["cash", "card", "upi", "bank_transfer"], {
    errorMap: () => ({ message: "Payment method must be cash, card, upi, or bank_transfer" })
  }),
  paymentDate: z.string().min(1, "Payment date is required"),
  processedBy: z.string().min(1, "Processed by user ID is required"),
});

export const insertPatientDiscountSchema = createInsertSchema(patientDiscounts).omit({
  id: true,
  discountId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  patientId: z.string().min(1, "Patient ID is required"),
  amount: z.number().min(0.01, "Discount amount must be greater than 0"),
  discountType: z.enum(["manual", "insurance", "senior_citizen", "employee"], {
    errorMap: () => ({ message: "Discount type must be manual, insurance, senior_citizen, or employee" })
  }),
  reason: z.string().min(1, "Discount reason is required"),
  discountDate: z.string().min(1, "Discount date is required"),
  approvedBy: z.string().min(1, "Approved by user ID is required"),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Doctor = typeof doctors.$inferSelect;
export type InsertDoctor = z.infer<typeof insertDoctorSchema>;
export type Patient = typeof patients.$inferSelect;
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type PatientVisit = typeof patientVisits.$inferSelect;
export type InsertPatientVisit = z.infer<typeof insertPatientVisitSchema>;
export type ScheduleEvent = typeof scheduleEvents.$inferSelect;
export type InsertScheduleEvent = z.infer<typeof insertScheduleEventSchema>;
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
export type RoomType = typeof roomTypes.$inferSelect;
export type InsertRoomType = z.infer<typeof insertRoomTypeSchema>;
export type Room = typeof rooms.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type HospitalSettings = typeof hospitalSettings.$inferSelect;
export type InsertHospitalSettings = z.infer<typeof insertHospitalSettingsSchema>;
export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;
export type BackupLog = typeof backupLogs.$inferSelect;
export type PatientPayment = typeof patientPayments.$inferSelect;
export type InsertPatientPayment = z.infer<typeof insertPatientPaymentSchema>;
export type PatientDiscount = typeof patientDiscounts.$inferSelect;
export type InsertPatientDiscount = z.infer<typeof insertPatientDiscountSchema>;
export type InsertBackupLog = z.infer<typeof insertBackupLogSchema>;
export type PathologyCategory = typeof pathologyCategories.$inferSelect;
export type InsertPathologyCategory = z.infer<typeof insertPathologyCategorySchema>;
export type DynamicPathologyTest = typeof dynamicPathologyTests.$inferSelect;
export type InsertDynamicPathologyTest = z.infer<typeof insertDynamicPathologyTestSchema>;

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export type PatientPayment = typeof patientPayments.$inferSelect;
export type InsertPatientPayment = z.infer<typeof insertPatientPaymentSchema>;

export type PatientDiscount = typeof patientDiscounts.$inferSelect;
export type InsertPatientDiscount = z.infer<typeof insertPatientDiscountSchema>;

// Update schema for PATCH (partial updates allowed)
export const updatePatientSchema = insertPatientSchema.partial();
export type UpdatePatient = z.infer<typeof updatePatientSchema>;