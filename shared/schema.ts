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
  completedDate: text("completed_date"),
  notes: text("notes"),
  price: real("price").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Patient Admissions
export const admissions = sqliteTable("admissions", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  admissionId: text("admission_id").notNull().unique(),
  patientId: text("patient_id").notNull().references(() => patients.id),
  doctorId: text("doctor_id").references(() => doctors.id),
  roomNumber: text("room_number"),
  wardType: text("ward_type"), // general, private, icu, emergency
  admissionDate: text("admission_date").notNull(),
  dischargeDate: text("discharge_date"),
  status: text("status").notNull().default("admitted"), // admitted, discharged, transferred
  reason: text("reason").notNull(),
  diagnosis: text("diagnosis"),
  notes: text("notes"),
  dailyCost: real("daily_cost").notNull().default(0),
  totalCost: real("total_cost").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Audit log for tracking all changes
export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  userId: text("user_id").notNull().references(() => users.id),
  action: text("action").notNull(), // create, update, delete, login, logout
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  oldValues: text("old_values"), // JSON string
  newValues: text("new_values"), // JSON string
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
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
});

export const insertAdmissionSchema = createInsertSchema(admissions).omit({
  id: true,
  admissionId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  patientId: z.string().min(1, "Patient is required"),
  admissionDate: z.string().min(1, "Admission date is required"),
  reason: z.string().min(1, "Reason for admission is required"),
  dailyCost: z.number().min(0, "Daily cost must be non-negative"),
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

// Types
export type User = typeof users.$inferSelect;
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
export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type PatientService = typeof patientServices.$inferSelect;
export type InsertPatientService = z.infer<typeof insertPatientServiceSchema>;
export type Admission = typeof admissions.$inferSelect;
export type InsertAdmission = z.infer<typeof insertAdmissionSchema>;
