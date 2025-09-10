import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@shared/schema";
import type {
  User, InsertUser, Doctor, InsertDoctor, Patient, InsertPatient,
  PatientVisit, InsertPatientVisit, Service, InsertService,
  Bill, InsertBill, BillItem, InsertBillItem,
  PathologyOrder, InsertPathologyOrder, PathologyTest, InsertPathologyTest,
  PatientService, InsertPatientService, Admission, InsertAdmission,
  AdmissionEvent, InsertAdmissionEvent, AuditLog, InsertAuditLog,
  PathologyCategory, InsertPathologyCategory, DynamicPathologyTest, InsertDynamicPathologyTest, Activity, InsertActivity,
  PatientPayment, InsertPatientPayment, PatientDiscount, InsertPatientDiscount, ScheduleEvent, InsertScheduleEvent, ServiceCategory, InsertServiceCategory
} from "@shared/schema";
import { eq, desc, and, sql, asc, ne, like } from "drizzle-orm";
import bcrypt from "bcrypt";
import path from "path";
import fs from "fs";

// Initialize SQLite database
const dbPath = path.join(process.cwd(), "hospital.db");
const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });

// Initialize database with tables
async function initializeDatabase() {
  try {
    // Create tables if they don't exist
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS doctors (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT REFERENCES users(id),
        name TEXT NOT NULL,
        specialization TEXT NOT NULL,
        qualification TEXT NOT NULL,
        consultation_fee REAL NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        patient_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        age INTEGER NOT NULL,
        gender TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT,
        email TEXT,
        emergency_contact TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS patient_visits (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        visit_id TEXT NOT NULL UNIQUE,
        patient_id TEXT NOT NULL REFERENCES patients(id),
        doctor_id TEXT NOT NULL REFERENCES doctors(id),
        visit_type TEXT NOT NULL,
        visit_date TEXT NOT NULL,
        symptoms TEXT,
        diagnosis TEXT,
        prescription TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        admission_date TEXT,
        discharge_date TEXT,
        room_number TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL,
        description TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS bills (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        bill_number TEXT NOT NULL UNIQUE,
        patient_id TEXT NOT NULL REFERENCES patients(id),
        visit_id TEXT REFERENCES patient_visits(id),
        subtotal REAL NOT NULL,
        tax_amount REAL NOT NULL,
        discount_amount REAL NOT NULL DEFAULT 0,
        total_amount REAL NOT NULL,
        payment_method TEXT NOT NULL,
        payment_status TEXT NOT NULL DEFAULT 'pending',
        paid_amount REAL NOT NULL DEFAULT 0,
        created_by TEXT NOT NULL REFERENCES users(id),
        bill_date TEXT NOT NULL,
        due_date TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS bill_items (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        bill_id TEXT NOT NULL REFERENCES bills(id),
        service_id TEXT NOT NULL REFERENCES services(id),
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS pathology_orders (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        order_id TEXT NOT NULL UNIQUE,
        patient_id TEXT NOT NULL REFERENCES patients(id),
        visit_id TEXT REFERENCES patient_visits(id),
        doctor_id TEXT REFERENCES doctors(id),
        status TEXT NOT NULL DEFAULT 'ordered',
        ordered_date TEXT NOT NULL,
        collected_date TEXT,
        report_date TEXT,
        remarks TEXT,
        total_price REAL NOT NULL DEFAULT 0,
        receipt_number TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS pathology_tests (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        order_id TEXT NOT NULL REFERENCES pathology_orders(id),
        test_name TEXT NOT NULL,
        test_category TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ordered',
        results TEXT,
        normal_range TEXT,
        price REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS patient_services (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        service_id TEXT NOT NULL,
        patient_id TEXT NOT NULL REFERENCES patients(id),
        visit_id TEXT REFERENCES patient_visits(id),
        doctor_id TEXT REFERENCES doctors(id),
        service_type TEXT NOT NULL,
        service_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'scheduled',
        scheduled_date TEXT NOT NULL,
        scheduled_time TEXT NOT NULL DEFAULT '09:00',
        completed_date TEXT,
        notes TEXT,
        price REAL NOT NULL DEFAULT 0,
        receipt_number TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS admissions (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        admission_id TEXT NOT NULL UNIQUE,
        patient_id TEXT NOT NULL REFERENCES patients(id),
        doctor_id TEXT REFERENCES doctors(id),
        current_room_id TEXT,
        current_ward_type TEXT,
        current_room_number TEXT,
        admission_date TEXT NOT NULL,
        discharge_date TEXT,
        status TEXT NOT NULL DEFAULT 'admitted',
        reason TEXT,
        diagnosis TEXT,
        notes TEXT,
        daily_cost REAL NOT NULL DEFAULT 0,
        total_cost REAL NOT NULL DEFAULT 0,
        initial_deposit REAL NOT NULL DEFAULT 0,
        additional_payments REAL NOT NULL DEFAULT 0,
        last_payment_date TEXT,
        total_discount REAL DEFAULT 0,
        last_discount_date TEXT,
        last_discount_amount REAL DEFAULT 0,
        last_discount_reason TEXT,
        last_payment_amount REAL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS hospital_settings (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name TEXT NOT NULL DEFAULT 'MedCare Pro Hospital',
        address TEXT NOT NULL DEFAULT '123 Healthcare Street, Medical District, City - 123456',
        phone TEXT NOT NULL DEFAULT '+91 98765 43210',
        email TEXT NOT NULL DEFAULT 'info@medcarepro.com',
        registration_number TEXT,
        logo_path TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS admission_events (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        admission_id TEXT NOT NULL REFERENCES admissions(id),
        event_type TEXT NOT NULL,
        event_time TEXT NOT NULL DEFAULT (datetime('now')),
        room_id TEXT,
        room_number TEXT,
        ward_type TEXT,
        notes TEXT,
        receipt_number TEXT,
        created_by TEXT REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS room_types (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        daily_cost REAL NOT NULL DEFAULT 0,
        total_beds INTEGER NOT NULL DEFAULT 0,
        occupied_beds INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        room_number TEXT NOT NULL UNIQUE,
        room_type_id TEXT NOT NULL REFERENCES room_types(id),
        floor TEXT,
        building TEXT,
        capacity INTEGER NOT NULL DEFAULT 1,
        is_occupied INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS pathology_categories (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS dynamic_pathology_tests (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        category_id TEXT NOT NULL REFERENCES pathology_categories(id),
        test_name TEXT NOT NULL,
        price REAL NOT NULL DEFAULT 0,
        normal_range TEXT,
        description TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id),
        action TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        old_values TEXT,
        new_values TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        email_notifications INTEGER NOT NULL DEFAULT 0,
        sms_notifications INTEGER NOT NULL DEFAULT 0,
        auto_backup INTEGER NOT NULL DEFAULT 1,
        audit_logging INTEGER NOT NULL DEFAULT 1,
        backup_frequency TEXT NOT NULL DEFAULT 'daily',
        backup_time TEXT NOT NULL DEFAULT '02:00',
        last_backup_date TEXT,
        backup_retention_days INTEGER NOT NULL DEFAULT 30,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS backup_logs (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        backup_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        backup_type TEXT NOT NULL DEFAULT 'auto',
        file_path TEXT,
        file_size INTEGER,
        start_time TEXT NOT NULL,
        end_time TEXT,
        error_message TEXT,
        table_count INTEGER,
        record_count INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id),
        activity_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        entity_id TEXT,
        entity_type TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS patient_payments (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        payment_id TEXT NOT NULL UNIQUE,
        patient_id TEXT NOT NULL REFERENCES patients(id),
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL,
        payment_date TEXT NOT NULL,
        reason TEXT,
        receipt_number TEXT,
        processed_by TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS patient_discounts (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        discount_id TEXT NOT NULL UNIQUE,
        patient_id TEXT NOT NULL REFERENCES patients(id),
        amount REAL NOT NULL,
        discount_type TEXT NOT NULL DEFAULT 'manual',
        reason TEXT NOT NULL,
        discount_date TEXT NOT NULL,
        approved_by TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS schedule_events (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        title TEXT NOT NULL,
        description TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        doctor_id TEXT REFERENCES doctors(id),
        patient_id TEXT REFERENCES patients(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS service_categories (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        description TEXT,
        icon TEXT NOT NULL DEFAULT 'Settings',
        is_active INTEGER NOT NULL DEFAULT 1,
        is_system INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Migrate existing tables to add new columns if they don't exist
    try {
      // Add total_beds and occupied_beds columns to room_types table if they don't exist
      db.$client.exec(`
        ALTER TABLE room_types ADD COLUMN total_beds INTEGER DEFAULT 0;
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    try {
      db.$client.exec(`
        ALTER TABLE room_types ADD COLUMN occupied_beds INTEGER DEFAULT 0;
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    // Add additional_payments column to admissions table if it doesn't exist
    try {
      db.$client.exec(`
        ALTER TABLE admissions ADD COLUMN additional_payments REAL DEFAULT 0;
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    // Add registration_number column to hospital_settings table if it doesn't exist
    try {
      db.$client.exec(`
        ALTER TABLE hospital_settings ADD COLUMN registration_number TEXT;
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    // Add missing columns to service_categories table if they don't exist
    try {
      db.$client.exec(`
        ALTER TABLE service_categories ADD COLUMN label TEXT;
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    try {
      db.$client.exec(`
        ALTER TABLE service_categories ADD COLUMN icon TEXT DEFAULT 'Settings';
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    try {
      db.$client.exec(`
        ALTER TABLE service_categories ADD COLUMN is_system INTEGER DEFAULT 0;
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    // Add new columns to admissions table for current room tracking
    try {
      db.$client.exec(`
        ALTER TABLE admissions ADD COLUMN current_room_id TEXT;
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    try {
      db.$client.exec(`
        ALTER TABLE admissions ADD COLUMN current_ward_type TEXT;
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    try {
      db.$client.exec(`
        ALTER TABLE admissions ADD COLUMN current_room_number TEXT;
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    // Add last_payment_date column to admissions table if it doesn't exist
    try {
      db.$client.exec(`
        ALTER TABLE admissions ADD COLUMN last_payment_date TEXT;
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    // Add discount-related columns to admissions table if they don't exist
    try {
      db.$client.exec(`
        ALTER TABLE admissions ADD COLUMN total_discount REAL DEFAULT 0;
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    try {
      db.$client.exec(`
        ALTER TABLE admissions ADD COLUMN last_discount_date TEXT;
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    try {
      db.$client.exec(`
        ALTER TABLE admissions ADD COLUMN last_discount_amount REAL DEFAULT 0;
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    try {
      db.$client.exec(`
        ALTER TABLE admissions ADD COLUMN last_discount_reason TEXT;
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    try {
      db.$client.exec(`
        ALTER TABLE admissions ADD COLUMN last_payment_amount REAL DEFAULT 0;
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    // Add receiptNumber column to patient_services table if it doesn't exist
    try {
      db.$client.exec(`
        ALTER TABLE patient_services ADD COLUMN receipt_number TEXT;
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    // Add receiptNumber column to pathology_orders table if it doesn't exist
    try {
      db.$client.exec(`
        ALTER TABLE pathology_orders ADD COLUMN receipt_number TEXT;
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    // Add receiptNumber column to admission_events table if it doesn't exist
    try {
      db.$client.exec(`
        ALTER TABLE admission_events ADD COLUMN receipt_number TEXT;
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    // Always ensure demo users and data exist on every restart
    await createDemoData();

    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

// Demo data creation function
async function createDemoData() {
  try {
    // Check and create demo users (only create if they've never existed before)
    const demoUserData = [
      { username: 'admin', password: 'admin123', fullName: 'System Administrator', role: 'admin', id: 'admin-user-id' },
      { username: 'doctor', password: 'doctor123', fullName: 'Dr. John Smith', role: 'doctor', id: 'doctor-user-id' },
      { username: 'billing', password: 'billing123', fullName: 'Billing Staff', role: 'billing_staff', id: 'billing-user-id' },
      { username: 'reception', password: 'reception123', fullName: 'Reception Staff', role: 'receptionist', id: 'reception-user-id' }
    ];

    for (const userData of demoUserData) {
      // Check if user exists by ID (this will be null if user was deleted)
      const existing = db.select().from(schema.users).where(eq(schema.users.id, userData.id)).get();
      if (!existing) {
        // Only create if it's the first time the system is running (no users exist at all)
        // or if this is the admin user (which should always exist)
        const allUsers = db.select().from(schema.users).all();
        if (allUsers.length === 0 || userData.username === 'admin') {
          const hashedPassword = await bcrypt.hash(userData.password, 10);
          db.insert(schema.users).values({
            id: userData.id,
            username: userData.username,
            password: hashedPassword,
            fullName: userData.fullName,
            role: userData.role,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }).run();
          console.log(`Created demo user: ${userData.username}`);
        }
      }
    }

    // Check and create demo doctor profile
    const existingDoctor = db.select().from(schema.doctors).where(eq(schema.doctors.id, 'doctor-profile-id')).get();
    if (!existingDoctor) {
      // Ensure the doctor user exists first
      const doctorUser = db.select().from(schema.users).where(eq(schema.users.id, 'doctor-user-id')).get();
      if (doctorUser) {
        db.insert(schema.doctors).values({
          id: 'doctor-profile-id',
          userId: 'doctor-user-id',
          name: 'Dr. John Smith',
          specialization: 'General Medicine',
          qualification: 'MBBS, MD',
          consultationFee: 500,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).run();
        console.log("Created demo doctor profile");
      } else {
        console.log("Skipping demo doctor profile creation - doctor user not found");
      }
    }

    console.log("Demo data verification completed");
  } catch (error) {
    console.error("Error creating demo data:", error);
  }
}

// Initialize the database
initializeDatabase().then(() => {
  createDemoData();
});

export interface IStorage {
  // User management
  createUser(user: InsertUser): Promise<User>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<User | undefined>;
  verifyPassword(password: string, hashedPassword: string): Promise<boolean>;
  hashPassword(password: string): Promise<string>;

  // Doctor management
  createDoctor(doctor: InsertDoctor): Promise<Doctor>;
  getDoctors(): Promise<Doctor[]>;
  getDoctorById(id: string): Promise<Doctor | undefined>;
  updateDoctor(id: string, doctor: Partial<InsertDoctor>): Promise<Doctor | undefined>;
  deleteDoctor(id: string): Promise<Doctor | undefined>; // Added deleteDoctor
  restoreDoctor(id: string): Promise<Doctor | undefined>;
  permanentlyDeleteDoctor(id: string): Promise<Doctor | undefined>;

  // Patient management
  createPatient(patient: InsertPatient, userId?: string): Promise<Patient>;
  getPatients(): Promise<Patient[]>;
  getPatientById(id: string): Promise<Patient | undefined>;
  searchPatients(query: string): Promise<Patient[]>;
  updatePatient(id: string, patient: Partial<InsertPatient>): Promise<Patient | undefined>;

  // Patient visits
  createPatientVisit(visit: InsertPatientVisit): Promise<PatientVisit>;
  getPatientVisits(patientId?: string): Promise<PatientVisit[]>;
  getPatientVisitById(id: string): Promise<PatientVisit | undefined>;

  // Services
  createService(service: InsertService, userId?: string): Promise<Service>;
  getServices(): Promise<Service[]>;
  getServiceById(id: string): Promise<Service | undefined>;
  searchServices(query: string): Promise<Service[]>;
  updateService(id: string, service: InsertService, userId?: string): Promise<Service | undefined>;
  deleteService(id: string, userId?: string): Promise<boolean>;

  // Billing
  createBill(bill: InsertBill, items: InsertBillItem[], userId?: string): Promise<Bill>;
  getBills(): Promise<Bill[]>;
  getBillById(id: string): Promise<Bill | undefined>;
  getBillItems(billId: string): Promise<BillItem[]>;
  getBillsWithPatients(): Promise<any[]>;

  // Pathology order and test management
  createPathologyOrder(orderData: InsertPathologyOrder, tests: InsertPathologyTest[], userId?: string): Promise<PathologyOrder>;
  getPathologyOrders(): Promise<any[]>;
  getPathologyOrderById(id: string): Promise<any>;
  getPathologyOrdersByPatient(patientId: string): Promise<PathologyOrder[]>;
  updatePathologyOrderStatus(id: string, status: string): Promise<PathologyOrder | undefined>;
  updatePathologyTestStatus(id: string, status: string, results?: string, userId?: string): Promise<PathologyTest | undefined>;

  // Patient Services
  createPatientService(service: InsertPatientService, userId?: string): Promise<PatientService>;
  getPatientServices(patientId?: string): Promise<PatientService[]>;
  getPatientServiceById(id: string): Promise<PatientService | undefined>;
  updatePatientService(id: string, service: Partial<InsertPatientService>): Promise<PatientService | undefined>;

  // Patient Admissions
  createAdmission(admission: InsertAdmission): Promise<Admission>;
  getAdmissions(patientId?: string): Promise<Admission[]>;
  getAdmissionById(id: string): Promise<Admission | undefined>;
  updateAdmission(id: string, admission: Partial<InsertAdmission>): Promise<Admission | undefined>;

  // Admission Events
  createAdmissionEvent(event: InsertAdmissionEvent): Promise<AdmissionEvent>;
  getAdmissionEvents(admissionId: string): Promise<AdmissionEvent[]>;
  transferRoom(admissionId: string, roomData: { roomNumber: string, wardType: string }, userId: string): Promise<Admission | undefined>;
  dischargePatient(admissionId: string, userId: string, dischargeDateTime?: string): Promise<Admission | undefined>;

  // Dashboard stats
  getDashboardStats(): Promise<any>;

  // Hospital settings
  getHospitalSettings(): Promise<any>;
  saveHospitalSettings(settings: any): Promise<any>;
  saveLogo(logoData: string): Promise<string>;

  // System settings
  getSystemSettings(): Promise<any>;
  saveSystemSettings(settings: any): Promise<any>;

  // Backup functionality
  createBackup(backupType?: string): Promise<any>;
  getBackupLogs(): Promise<any[]>;
  getBackupHistory(): Promise<any[]>;
  cleanOldBackups(): Promise<void>;
  restoreBackup(backupFilePath: string): Promise<any>;
  getAvailableBackups(): Promise<any[]>;

  // Audit logging
  logAction(log: InsertAuditLog): Promise<void>;

  // Activity logging
  logActivity(userId: string, activityType: string, title: string, description: string, entityId?: string, entityType?: string, metadata?: any): Promise<void>;
  getRecentActivities(limit?: number): Promise<any[]>;

  // Receipt numbering
  getDailyReceiptCount(serviceType: string, date: string): Promise<number>;
  getDailyReceiptCountSync(serviceType: string, date: string): number;

  // Pathology category management
  createPathologyCategory(category: InsertPathologyCategory): Promise<PathologyCategory>;
  getPathologyCategories(): Promise<PathologyCategory[]>;
  getPathologyCategoryById(id: string): Promise<PathologyCategory | undefined>;
  updatePathologyCategory(id: string, category: Partial<InsertPathologyCategory>): Promise<PathologyCategory | undefined>;
  deletePathologyCategory(id: string): Promise<boolean>;

  // Dynamic pathology test management
  createDynamicPathologyTest(test: InsertDynamicPathologyTest): Promise<DynamicPathologyTest>;
  getDynamicPathologyTests(): Promise<DynamicPathologyTest[]>;
  getDynamicPathologyTestsByCategory(categoryId: string): Promise<DynamicPathologyTest[]>;
  getDynamicPathologyTestById(id: string): Promise<DynamicPathologyTest | undefined>;
  updateDynamicPathologyTest(id: string, test: Partial<InsertDynamicPathologyTest>): Promise<DynamicPathologyTest | undefined>;
  deleteDynamicPathologyTest(id: string): Promise<boolean>;
  bulkCreateDynamicPathologyTests(tests: InsertDynamicPathologyTest[]): Promise<DynamicPathologyTest[]>;

  // Schedule Event Management
  getAllScheduleEvents(): Promise<ScheduleEvent[]>;
  createScheduleEvent(event: InsertScheduleEvent): Promise<ScheduleEvent>;
  updateScheduleEvent(id: string, event: Partial<InsertScheduleEvent>): Promise<ScheduleEvent | undefined>;
  deleteScheduleEvent(id: string): Promise<void>;
  getScheduleEventsByDateRange(startDate: string, endDate: string): Promise<ScheduleEvent[]>;
  getScheduleEventsByDoctor(doctorId: string): Promise<ScheduleEvent[]>;

  // Inpatient Management Detail Methods
  getBedOccupancyDetails(): Promise<any[]>;
  getCurrentlyAdmittedPatients(): Promise<any[]>;
  getTodayAdmissions(): Promise<any[]>;
  getTodayDischarges(): Promise<any[]>;

  // Service Category Management
  getServiceCategories(): Promise<ServiceCategory[]>;
  createServiceCategory(category: InsertServiceCategory): Promise<ServiceCategory>;
  updateServiceCategory(id: string, category: Partial<InsertServiceCategory>): Promise<ServiceCategory | undefined>;
  deleteServiceCategory(id: string): Promise<boolean>;
}

export class SqliteStorage implements IStorage {
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private generatePatientId(): string {
    const year = new Date().getFullYear();
    const count = db.select().from(schema.patients).all().length + 1;
    return `PAT-${year}-${count.toString().padStart(3, '0')}`;
  }

  private generateVisitId(): string {
    const year = new Date().getFullYear();
    const count = db.select().from(schema.patientVisits).all().length + 1;
    return `VIS-${year}-${count.toString().padStart(3, '0')}`;
  }

  private generateBillNumber(): string {
    const year = new Date().getFullYear();
    const count = db.select().from(schema.bills).all().length + 1;
    return `BILL-${year}-${count.toString().padStart(4, '0')}`;
  }

  private generateOrderId(): string {
    const year = new Date().getFullYear();
    const count = db.select().from(schema.pathologyOrders).all().length + 1;
    return `LAB-${year}-${count.toString().padStart(3, '0')}`;
  }

  private generateAdmissionId(): string {
    const year = new Date().getFullYear();
    try {
      const count = db.select().from(schema.admissions).all().length + 1;
      return `ADM-${year}-${count.toString().padStart(3, '0')}`;
    } catch (error) {
      console.error('Error querying admissions table:', error);
      // Fallback to timestamp-based ID if table query fails
      const timestamp = Date.now().toString().slice(-6);
      return `ADM-${year}-${timestamp}`;
    }
  }

  private generatePaymentId(): string {
    const year = new Date().getFullYear();
    try {
      const count = db.select().from(schema.patientPayments).all().length + 1;
      return `PAY-${year}-${count.toString().padStart(3, '0')}`;
    } catch (error) {
      console.error('Error querying patient_payments table:', error);
      const timestamp = Date.now().toString().slice(-6);
      return `PAY-${year}-${timestamp}`;
    }
  }

  private generateDiscountId(): string {
    const year = new Date().getFullYear();
    try {
      const count = db.select().from(schema.patientDiscounts).all().length + 1;
      return `DISC-${year}-${count.toString().padStart(3, '0')}`;
    } catch (error) {
      console.error('Error querying patient_discounts table:', error);
      const timestamp = Date.now().toString().slice(-6);
      return `DISC-${year}-${timestamp}`;
    }
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async createUser(user: InsertUser): Promise<User> {
    const hashedPassword = await this.hashPassword(user.password);
    const created = db.insert(schema.users).values({
      ...user,
      password: hashedPassword,
    }).returning().get();
    return created;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const user = db.select().from(schema.users).where(eq(schema.users.username, username)).get();
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    return db.select().from(schema.users).where(eq(schema.users.id, id)).get();
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(schema.users).all();
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    // Hash password if it's being updated
    const updateData = { ...userData };
    if (updateData.password) {
      updateData.password = await this.hashPassword(updateData.password);
    }

    const updated = db.update(schema.users)
      .set({ ...updateData, updatedAt: new Date().toISOString() })
      .where(eq(schema.users.id, id))
      .returning().get();
    return updated;
  }

  async deleteUser(id: string): Promise<User | undefined> {
    try {
      // Use transaction to handle foreign key constraints
      return db.transaction((tx) => {
        try {
          // First, get the user to make sure it exists
          const userToDelete = tx.select().from(schema.users)
            .where(eq(schema.users.id, id))
            .get();

          if (!userToDelete) {
            return undefined;
          }

          // Update all references to this user to null before deleting

          // Update bills created by this user (createdBy column exists)
          const billsToUpdate = tx.select().from(schema.bills)
            .where(eq(schema.bills.createdBy, id))
            .all();

          for (const bill of billsToUpdate) {
            tx.update(schema.bills)
              .set({ createdBy: sql`NULL` })
              .where(eq(schema.bills.id, bill.id))
              .run();
          }

          // Update admission events created by this user (createdBy column exists)
          const eventsToUpdate = tx.select().from(schema.admissionEvents)
            .where(eq(schema.admissionEvents.createdBy, id))
            .all();

          for (const event of eventsToUpdate) {
            tx.update(schema.admissionEvents)
              .set({ createdBy: sql`NULL` })
              .where(eq(schema.admissionEvents.id, event.id))
              .run();
          }

          // Check if this user has a doctor profile and delete it first
          const doctorProfile = tx.select().from(schema.doctors)
            .where(eq(schema.doctors.userId, id))
            .get();

          if (doctorProfile) {
            // First, update all references to this doctor to null
            tx.update(schema.patientVisits)
              .set({ doctorId: null })
              .where(eq(schema.patientVisits.doctorId, doctorProfile.id))
              .run();

            tx.update(schema.pathologyOrders)
              .set({ doctorId: null })
              .where(eq(schema.pathologyOrders.doctorId, doctorProfile.id))
              .run();

            tx.update(schema.patientServices)
              .set({ doctorId: null })
              .where(eq(schema.patientServices.doctorId, doctorProfile.id))
              .run();

            tx.update(schema.admissions)
              .set({ doctorId: null })
              .where(eq(schema.admissions.doctorId, doctorProfile.id))
              .run();

            // Now delete the doctor profile
            tx.delete(schema.doctors)
              .where(eq(schema.doctors.id, doctorProfile.id))
              .run();
          }

          // Note: pathology_orders, patient_services, and admissions tables 
          // don't have createdBy columns in the schema, so we skip those updates

          // Now delete the user record
          const deleted = tx.delete(schema.users)
            .where(eq(schema.users.id, id))
            .returning().get();

          return deleted;
        } catch (transactionError) {
          console.error("Transaction error during user delete:", transactionError);
          throw transactionError;
        }
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      throw error;
    }
  }

  async createDoctor(doctor: InsertDoctor): Promise<Doctor> {
    const created = db.insert(schema.doctors).values(doctor).returning().get();
    return created;
  }



  async getDoctors(): Promise<Doctor[]> {
    return db.select().from(schema.doctors).where(eq(schema.doctors.isActive, true)).all();
  }

  async getDoctorById(id: string): Promise<Doctor | undefined> {
    return db.select().from(schema.doctors).where(eq(schema.doctors.id, id)).get();
  }

  async updateDoctor(id: string, doctor: Partial<InsertDoctor>): Promise<Doctor | undefined> {
    const updated = db.update(schema.doctors)
      .set({ ...doctor, updatedAt: new Date().toISOString() })
      .where(eq(schema.doctors.id, id))
      .returning().get();
    return updated;
  }

  async deleteDoctor(id: string): Promise<Doctor | undefined> {
    try {
      // Soft delete by setting isActive to false instead of hard delete
      const deleted = db.update(schema.doctors)
        .set({
          isActive: false,
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.doctors.id, id))
        .returning().get();
      return deleted;
    } catch (error) {
      console.error("Error deleting doctor:", error);
      throw error;
    }
  }

  async getDeletedDoctors(): Promise<Doctor[]> {
    return db.select().from(schema.doctors).where(eq(schema.doctors.isActive, false)).all();
  }

  async restoreDoctor(id: string): Promise<Doctor | undefined> {
    try {
      const restored = db.update(schema.doctors)
        .set({
          isActive: true,
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.doctors.id, id))
        .returning().get();
      return restored;
    } catch (error) {
      console.error("Error restoring doctor:", error);
      throw error;
    }
  }

  async permanentlyDeleteDoctor(id: string): Promise<Doctor | undefined> {
    try {
      // First, get the doctor to be deleted for returning
      const doctorToDelete = db.select().from(schema.doctors)
        .where(eq(schema.doctors.id, id))
        .get();

      if (!doctorToDelete) {
        return undefined;
      }

      // Use transaction to handle foreign key constraints
      return db.transaction((tx) => {
        try {
          // First, set all references to this doctor to null

          // Update patient_visits to set doctorId to null
          tx.update(schema.patientVisits)
            .set({ doctorId: null })
            .where(eq(schema.patientVisits.doctorId, id))
            .run();

          // Update pathology_orders to set doctorId to null
          tx.update(schema.pathologyOrders)
            .set({ doctorId: null })
            .where(eq(schema.pathologyOrders.doctorId, id))
            .run();

          // Update patient_services to set doctorId to null
          tx.update(schema.patientServices)
            .set({ doctorId: null })
            .where(eq(schema.patientServices.doctorId, id))
            .run();

          // Update admissions to set doctorId to null
          tx.update(schema.admissions)
            .set({ doctorId: null })
            .where(eq(schema.admissions.doctorId, id))
            .run();

          // Now delete the doctor record
          tx.delete(schema.doctors)
            .where(eq(schema.doctors.id, id))
            .run();

          return doctorToDelete;
        } catch (transactionError) {
          console.error("Transaction error during permanent delete:", transactionError);
          throw transactionError;
        }
      });
    } catch (error) {
      console.error("Error permanently deleting doctor:", error);
      throw error;
    }
  }

  async getDailyPatientCount(): Promise<number> {
    try {
      const count = db.select().from(schema.patients).all().length;
      return count;
    } catch (error) {
      console.error('Error getting daily patient count:', error);
      return 0;
    }
  }

  async createPatient(patientData: InsertPatient, userId?: string): Promise<Patient> {
    // Generate patient ID
    const today = new Date();
    const year = today.getFullYear();
    const patientCount = await this.getDailyPatientCount();
    const patientId = `PAT-${year}-${String(patientCount + 1).padStart(3, '0')}`;

    const patient = db.insert(schema.patients).values({
      ...patientData,
      patientId,
    }).returning().get();

    // Log activity
    if (userId) {
      this.logActivity(
        userId,
        'patient_registered',
        'New patient registered',
        `${patient.name} - ${patient.patientId}`,
        patient.id,
        'patient',
        { patientId: patient.patientId, age: patient.age, gender: patient.gender }
      );
    }

    return patient;
  }

  async getPatients(): Promise<Patient[]> {
    return db.select().from(schema.patients)
      .where(eq(schema.patients.isActive, true))
      .orderBy(desc(schema.patients.createdAt))
      .all();
  }

  async getPatientById(id: string): Promise<Patient | undefined> {
    return db.select().from(schema.patients).where(eq(schema.patients.id, id)).get();
  }

  async searchPatients(query: string): Promise<Patient[]> {
    return db.select().from(schema.patients)
      .where(
        and(
          eq(schema.patients.isActive, true),
          like(schema.patients.name, `%${query}%`)
        )
      )
      .limit(10)
      .all();
  }

  async updatePatient(id: string, patient: Partial<InsertPatient>): Promise<Patient | undefined> {
    const updated = db.update(schema.patients)
      .set({ ...patient, updatedAt: new Date().toISOString() })
      .where(eq(schema.patients.id, id))
      .returning().get();
    return updated;
  }

  async createPatientVisit(visit: InsertPatientVisit): Promise<PatientVisit> {
    const visitId = this.generateVisitId();
    const created = db.insert(schema.patientVisits).values({
      ...visit,
      visitId,
    }).returning().get();
    return created;
  }

  async getPatientVisits(patientId?: string): Promise<PatientVisit[]> {
    if (patientId) {
      return db.select().from(schema.patientVisits)
        .where(eq(schema.patientVisits.patientId, patientId))
        .orderBy(desc(schema.patientVisits.createdAt))
        .all();
    }
    return db.select().from(schema.patientVisits)
      .orderBy(desc(schema.patientVisits.createdAt))
      .all();
  }

  async getPatientVisitById(id: string): Promise<PatientVisit | undefined> {
    return db.select().from(schema.patientVisits).where(eq(schema.patientVisits.id, id)).get();
  }

  async createService(service: InsertService, userId?: string): Promise<Service> {
    const created = db.insert(schema.services).values(service).returning().get();

    if (userId) {
      this.logActivity(
        userId,
        'service_created',
        'Service created',
        `${service.name} - ${service.category}`,
        created.id,
        'service',
        { serviceName: service.name, category: service.category, price: service.price }
      );
    }

    return created;
  }

  async getServices(): Promise<Service[]> {
    return db.select().from(schema.services)
      .where(eq(schema.services.isActive, true))
      .orderBy(schema.services.name)
      .all();
  }

  async getServiceById(id: string): Promise<Service | undefined> {
    return db.select().from(schema.services).where(eq(schema.services.id, id)).get();
  }

  async searchServices(query: string): Promise<Service[]> {
    return db.select().from(schema.services)
      .where(
        and(
          eq(schema.services.isActive, true),
          like(schema.services.name, `%${query}%`)
        )
      )
      .limit(20)
      .all();
  }

  async updateService(id: string, service: InsertService, userId?: string): Promise<Service | undefined> {
    const updated = db.update(schema.services)
      .set(service)
      .where(eq(schema.services.id, id))
      .returning()
      .get();

    if (userId && updated) {
      this.logActivity(
        userId,
        'service_updated',
        'Service updated',
        `${updated.name} - ${updated.category}`,
        updated.id,
        'service',
        { serviceName: updated.name, category: updated.category }
      );
    }

    return updated;
  }

  async deleteService(id: string, userId?: string): Promise<boolean> {
    const service = db.select().from(schema.services).where(eq(schema.services.id, id)).get();
    const result = db.delete(schema.services).where(eq(schema.services.id, id)).run();

    if (userId && service && result.changes > 0) {
      this.logActivity(
        userId,
        'service_deleted',
        'Service deleted',
        `${service.name} - ${service.category}`,
        id,
        'service',
        { serviceName: service.name, category: service.category }
      );
    }

    return result.changes > 0;
  }

  async createBill(billData: InsertBill, itemsData: InsertBillItem[], userId?: string): Promise<Bill> {
    const billNumber = this.generateBillNumber();

    return db.transaction((tx) => {
      const created = tx.insert(schema.bills).values({
        ...billData,
        billNumber,
      }).returning().get();

      const billItems = itemsData.map(item => ({
        ...item,
        billId: created.id,
      }));

      tx.insert(schema.billItems).values(billItems);

      // Log activity
      if (userId) {
        const patient = tx.select().from(schema.patients).where(eq(schema.patients.id, billData.patientId)).get();
        this.logActivity(
          userId,
          'bill_created',
          'New bill generated',
          `${billNumber} for ${patient?.name || 'Unknown Patient'}`,
          created.id,
          'bill',
          { amount: billData.totalAmount, patientName: patient?.name }
        );
      }

      return created;
    });
  }

  async getBills(): Promise<Bill[]> {
    return db.select().from(schema.bills)
      .orderBy(desc(schema.bills.createdAt))
      .all();
  }

  async getBillById(id: string): Promise<Bill | undefined> {
    return db.select().from(schema.bills).where(eq(schema.bills.id, id)).get();
  }

  async getBillItems(billId: string): Promise<BillItem[]> {
    return db.select().from(schema.billItems)
      .where(eq(schema.billItems.billId, billId))
      .all();
  }

  async getBillsWithPatients(): Promise<any[]> {
    return db.select({
      bill: schema.bills,
      patient: schema.patients,
    })
    .from(schema.bills)
    .leftJoin(schema.patients, eq(schema.bills.patientId, schema.patients.id))
    .orderBy(desc(schema.bills.createdAt))
    .all();
  }

  async createPathologyOrder(orderData: InsertPathologyOrder, tests: InsertPathologyTest[], userId?: string): Promise<PathologyOrder> {
    const generatedOrderId = this.generateOrderId();
    const totalPrice = tests.reduce((total, test) => total + test.price, 0);
    const orderedDate = orderData.orderedDate || new Date().toISOString().split('T')[0];

    // Generate proper receipt number for pathology
    const count = await this.getDailyReceiptCount('pathology', orderedDate);
    const dateObj = new Date(orderedDate);
    const yymmdd = dateObj.toISOString().slice(2, 10).replace(/-/g, '').slice(0, 6);
    const receiptNumber = `${yymmdd}-PAT-${count.toString().padStart(4, '0')}`;

    return db.transaction((tx) => {
      // Insert the order first
      const created = tx.insert(schema.pathologyOrders).values({
        ...orderData,
        orderId: generatedOrderId,
        totalPrice,
        receiptNumber,
      }).returning().get();

      // Insert all tests for this order
      tests.forEach(test => {
        tx.insert(schema.pathologyTests).values({
          testName: test.testName,
          testCategory: test.testCategory,
          price: test.price,
          orderId: created.id, // Use the actual database ID, not the generated order ID
          status: 'ordered',
        }).run();
      });

      // Log activity
      if (userId) {
        const patient = tx.select().from(schema.patients).where(eq(schema.patients.id, orderData.patientId)).get();
        this.logActivity(
          userId,
          'lab_test_ordered',
          'Lab test ordered',
          `${generatedOrderId} for ${patient?.name || 'Unknown Patient'}`,
          created.id,
          'pathology_order',
          { testCount: tests.length, patientName: patient?.name }
        );
      }

      return created;
    });
  }

  async getPathologyOrders(): Promise<any[]> {
    return db.select({
      order: schema.pathologyOrders,
      patient: schema.patients,
      doctor: schema.doctors,
    })
    .from(schema.pathologyOrders)
    .leftJoin(schema.patients, eq(schema.pathologyOrders.patientId, schema.patients.id))
    .leftJoin(schema.doctors, eq(schema.pathologyOrders.doctorId, schema.doctors.id))
    .orderBy(desc(schema.pathologyOrders.createdAt))
    .all();
  }

  async getPathologyOrderById(id: string): Promise<any> {
    const order = db.select().from(schema.pathologyOrders).where(eq(schema.pathologyOrders.id, id)).get();
    if (!order) return null;

    const tests = db.select().from(schema.pathologyTests).where(eq(schema.pathologyTests.orderId, id)).all();
    const patient = db.select().from(schema.patients).where(eq(schema.patients.id, order.patientId)).get();
    const doctor = order.doctorId ? db.select().from(schema.doctors).where(eq(schema.doctors.id, order.doctorId)).get() : null;

    return {
      order,
      tests,
      patient,
      doctor,
    };
  }

  async updatePathologyOrderStatus(orderId: string, status: string): Promise<PathologyOrder | undefined> {
    const updated = db.update(schema.pathologyOrders)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(schema.pathologyOrders.id, orderId))
      .returning().get();
    return updated;
  }

  async getPathologyOrdersByPatient(patientId: string): Promise<PathologyOrder[]> {
    return db.select().from(schema.pathologyOrders)
      .where(eq(schema.pathologyOrders.patientId, patientId))
      .orderBy(desc(schema.pathologyOrders.createdAt))
      .all();
  }

  async updatePathologyTestStatus(testId: string, status: string, results?: string, userId?: string): Promise<PathologyTest | undefined> {
    const updated = db.update(schema.pathologyTests)
      .set({
        status,
        results,
        updatedAt: new Date().toISOString()
      })
      .where(eq(schema.pathologyTests.id, testId))
      .returning().get();

    // Log activity when test is completed
    if (status === 'completed' && userId) {
      const test = db.select().from(schema.pathologyTests).where(eq(schema.pathologyTests.id, testId)).get();
      const order = db.select().from(schema.pathologyOrders).where(eq(schema.pathologyOrders.id, test?.orderId || '')).get();
      const patient = db.select().from(schema.patients).where(eq(schema.patients.id, order?.patientId || '')).get();

      this.logActivity(
        userId,
        'lab_test_completed',
        'Lab test completed',
        `${test?.testName} for ${patient?.name || 'Unknown Patient'}`,
        testId,
        'pathology_test',
        { testName: test?.testName, patientName: patient?.name }
      );
    }

    return updated;
  }

  async createPatientService(serviceData: InsertPatientService, userId?: string): Promise<PatientService> {
    try {
      const created = db.insert(schema.patientServices).values({
        ...serviceData,
        serviceId: serviceData.serviceId || `SRV-${Date.now()}`,
        receiptNumber: serviceData.receiptNumber || null,
      }).returning().get();

      // Log activity for OPD appointments
      if (userId && serviceData.serviceType === 'opd') {
        const patient = db.select().from(schema.patients).where(eq(schema.patients.id, serviceData.patientId)).get();
        this.logActivity(
          userId,
          'opd_scheduled',
          'OPD appointment scheduled',
          `${serviceData.serviceName} for ${patient?.name || 'Unknown Patient'}`,
          created.id,
          'patient_service',
          { serviceName: serviceData.serviceName, patientName: patient?.name, scheduledDate: serviceData.scheduledDate }
        );
      }

      return created;
    } catch (error) {
      console.error('Error creating patient service:', error);
      throw error;
    }
  }

  async getPatientServices(patientId?: string): Promise<PatientService[]>{
    if (patientId) {
      return db.select().from(schema.patientServices)
        .where(eq(schema.patientServices.patientId, patientId))
        .orderBy(desc(schema.patientServices.scheduledDate))
        .all();
    }
    return db.select().from(schema.patientServices)
      .orderBy(desc(schema.patientServices.createdAt))
      .all();
  }

  async getPatientServiceById(id: string): Promise<PatientService | undefined> {
    return db.select().from(schema.patientServices)
      .where(eq(schema.patientServices.id, id))
      .get();
  }

  async updatePatientService(id: string, service: Partial<InsertPatientService>): Promise<PatientService | undefined> {
    const updated = db.update(schema.patientServices)
      .set({ ...service, updatedAt: new Date().toISOString() })
      .where(eq(schema.patientServices.id, id))
      .returning().get();
    return updated;
  }

  async createAdmission(admission: InsertAdmission): Promise<Admission> {
    const admissionId = this.generateAdmissionId();
    // Use the provided admission date, or current system time if not provided
    const now = new Date();
    let admissionDate: string;
    let eventDate: string;

    if (admission.admissionDate) {
      // Use the provided admission date
      admissionDate = admission.admissionDate;
      // Extract just the date part for receipt generation
      if (admission.admissionDate.includes('T')) {
        // datetime-local format: "YYYY-MM-DDTHH:MM"
        eventDate = admission.admissionDate.split('T')[0];
      } else {
        eventDate = admission.admissionDate;
      }
    } else {
      // Fallback to current system date
      eventDate = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');
      admissionDate = eventDate;
    }

    return db.transaction((tx) => {
      // CRITICAL VALIDATION: Check if room is already occupied
      if (admission.currentRoomNumber && admission.currentWardType) {
        const existingAdmission = tx.select()
          .from(schema.admissions)
          .where(
            and(
              eq(schema.admissions.currentRoomNumber, admission.currentRoomNumber),
              eq(schema.admissions.currentWardType, admission.currentWardType),
              eq(schema.admissions.status, 'admitted')
            )
          )
          .get();

        if (existingAdmission) {
          throw new Error(`Room ${admission.currentRoomNumber} in ${admission.currentWardType} is already occupied by another patient. Please select a different room.`);
        }
      }

      // Generate receipt number for admission
      const admissionCount = this.getDailyReceiptCountSync('admission', eventDate);
      const dateObj = new Date(eventDate);
      const yymmdd = dateObj.toISOString().slice(2, 10).replace(/-/g, '').slice(0, 6);
      const receiptNumber = `${yymmdd}-ADM-${admissionCount.toString().padStart(4, '0')}`;

      // Create the admission episode
      const created = tx.insert(schema.admissions).values({
        ...admission,
        admissionId,
        admissionDate,
        // Map the wardType to current fields
        currentWardType: admission.currentWardType,
        currentRoomNumber: admission.currentRoomNumber,
      }).returning().get();

      // Create the initial admission event with receipt number
      tx.insert(schema.admissionEvents).values({
        admissionId: created.id,
        eventType: "admit",
        eventTime: now.toISOString(),
        roomNumber: admission.currentRoomNumber,
        wardType: admission.currentWardType,
        notes: `Patient admitted to ${admission.currentWardType} - Room ${admission.currentRoomNumber}`,
        receiptNumber: receiptNumber,
      }).run();

      // Increment occupied beds for the room type
      if (admission.currentWardType) {
        const roomType = tx.select().from(schema.roomTypes)
          .where(eq(schema.roomTypes.name, admission.currentWardType))
          .get();

        if (roomType) {
          tx.update(schema.roomTypes)
            .set({
              occupiedBeds: (roomType.occupiedBeds || 0) + 1,
              updatedAt: new Date().toISOString()
            })
            .where(eq(schema.roomTypes.id, roomType.id))
            .run();
        }
      }

      // Log admission activity (do this after transaction to avoid issues)
      setImmediate(() => {
        const patient = db.select().from(schema.patients).where(eq(schema.patients.id, admission.patientId)).get();
        if (patient) {
          this.logActivity(
            'system',
            'patient_admitted',
            'Patient admitted',
            `${patient.name} - ${admissionId}`,
            created.id,
            'admission',
            { admissionId, patientName: patient.name, roomNumber: admission.currentRoomNumber, wardType: admission.currentWardType }
          );
        }
      });

      return created;
    });
  }

  async getAdmissions(patientId?: string): Promise<Admission[]> {
    if (patientId) {
      return db.select().from(schema.admissions)
        .where(eq(schema.admissions.patientId, patientId))
        .orderBy(desc(schema.admissions.admissionDate))
        .all();
    }
    return db.select().from(schema.admissions)
      .orderBy(desc(schema.admissions.createdAt))
      .all();
  }

  async getAdmissionById(id: string): Promise<Admission | undefined> {
    return db.select().from(schema.admissions)
      .where(eq(schema.admissions.id, id))
      .get();
  }

  async updateAdmission(id: string, admission: Partial<InsertAdmission>): Promise<Admission | undefined> {
    // Get the current admission to check for status changes
    const currentAdmission = db.select().from(schema.admissions)
      .where(eq(schema.admissions.id, id))
      .get();

    const updated = db.update(schema.admissions)
      .set({ ...admission, updatedAt: new Date().toISOString() })
      .where(eq(schema.admissions.id, id))
      .returning().get();

    // Handle bed count changes when status changes
    if (currentAdmission && admission.status === 'discharged' && currentAdmission.status === 'admitted') {
      // Patient is being discharged - decrement occupied beds
      if (currentAdmission.currentWardType) {
        const roomType = db.select().from(schema.roomTypes)
          .where(eq(schema.roomTypes.name, currentAdmission.currentWardType))
          .get();

        if (roomType && roomType.occupiedBeds > 0) {
          db.update(schema.roomTypes)
            .set({
              occupiedBeds: roomType.occupiedBeds - 1,
              updatedAt: new Date().toISOString()
            })
            .where(eq(schema.roomTypes.id, roomType.id))
            .run();
        }
      }
    }

    // Update last_payment_date if a payment is made
    if (admission.status === 'paid' && updated) {
        updated.lastPaymentDate = new Date().toISOString();
        await db.update(schema.admissions).set({ lastPaymentDate: updated.lastPaymentDate }).where(eq(schema.admissions.id, id)).run();
    }


    return updated;
  }

  // Patient Payment Methods
  async createPatientPayment(paymentData: InsertPatientPayment, userId: string): Promise<PatientPayment> {
    const paymentId = this.generatePaymentId();

    const created = db.insert(schema.patientPayments).values({
      ...paymentData,
      paymentId,
      processedBy: userId,
    }).returning().get();

    // Log activity
    const patient = db.select().from(schema.patients).where(eq(schema.patients.id, paymentData.patientId)).get();
    this.logActivity(
      userId,
      'payment_added',
      'Payment added',
      `₹${paymentData.amount} payment for ${patient?.name || 'Unknown Patient'}`,
      created.id,
      'patient_payment',
      { amount: paymentData.amount, paymentMethod: paymentData.paymentMethod, patientName: patient?.name }
    );

    return created;
  }

  async getPatientPayments(patientId: string): Promise<PatientPayment[]> {
    return db.select().from(schema.patientPayments)
      .where(eq(schema.patientPayments.patientId, patientId))
      .orderBy(desc(schema.patientPayments.paymentDate))
      .all();
  }

  async getPatientPaymentById(id: string): Promise<PatientPayment | undefined> {
    return db.select().from(schema.patientPayments)
      .where(eq(schema.patientPayments.id, id))
      .get();
  }

  // Patient Discount Methods
  async createPatientDiscount(discountData: InsertPatientDiscount, userId: string): Promise<PatientDiscount> {
    const discountId = this.generateDiscountId();

    const created = db.insert(schema.patientDiscounts).values({
      ...discountData,
      discountId,
      approvedBy: userId,
    }).returning().get();

    // Log activity
    const patient = db.select().from(schema.patients).where(eq(schema.patients.id, discountData.patientId)).get();
    this.logActivity(
      userId,
      'discount_added',
      'Discount added',
      `₹${discountData.amount} discount for ${patient?.name || 'Unknown Patient'}`,
      created.id,
      'patient_discount',
      { amount: discountData.amount, discountType: discountData.discountType, reason: discountData.reason, patientName: patient?.name }
    );

    return created;
  }

  async getPatientDiscounts(patientId: string): Promise<PatientDiscount[]> {
    return db.select().from(schema.patientDiscounts)
      .where(eq(schema.patientDiscounts.patientId, patientId))
      .orderBy(desc(schema.patientDiscounts.discountDate))
      .all();
  }

  async getPatientDiscountById(id: string): Promise<PatientDiscount | undefined> {
    return db.select().from(schema.patientDiscounts)
      .where(eq(schema.patientDiscounts.id, id))
      .get();
  }

  // Calculate patient financial summary
  async getPatientFinancialSummary(patientId: string): Promise<{
    totalCharges: number;
    totalPaid: number;
    totalDiscounts: number;
    balance: number;
  }> {
    // Calculate total charges from admissions, services, and pathology orders
    let totalCharges = 0;

    // Admission charges (daily cost only, not initial deposit)
    const admissions = await this.getAdmissions(patientId);
    admissions.forEach(admission => {
      if (admission.status === 'admitted' || admission.status === 'discharged') {
        const admissionDate = new Date(admission.admissionDate);
        const endDate = admission.dischargeDate ? new Date(admission.dischargeDate) : new Date();
        const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - admissionDate.getTime()) / (1000 * 3600 * 24)));
        totalCharges += (admission.dailyCost || 0) * daysDiff;
        // Initial deposit is NOT added to charges - it's a payment
      }
    });

    // Service charges
    const services = await this.getPatientServices(patientId);
    totalCharges += services.reduce((sum, service) => sum + (service.price || 0), 0);

    // Pathology order charges
    const pathologyOrders = await this.getPathologyOrdersByPatient(patientId);
    totalCharges += pathologyOrders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);

    // Calculate total payments
    const payments = await this.getPatientPayments(patientId);
    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

    // Add admission payments (initial deposits and additional payments)
    const admissionPayments = admissions.reduce((sum, admission) => {
      return sum + (admission.initialDeposit || 0) + (admission.additionalPayments || 0);
    }, 0);

    // Calculate total discounts
    const discounts = await this.getPatientDiscounts(patientId);
    const totalDiscounts = discounts.reduce((sum, discount) => sum + discount.amount, 0);

    // Add admission discounts for backwards compatibility
    const admissionDiscounts = admissions.reduce((sum, admission) => {
      return sum + (admission.totalDiscount || 0);
    }, 0);

    const finalTotalPaid = totalPaid + admissionPayments;
    const finalTotalDiscounts = totalDiscounts + admissionDiscounts;

    // Calculate balance: totalCharges - totalDiscounts - totalPaid
    // Positive balance = amount patient owes
    // Negative balance = amount hospital owes patient (overpayment)
    const balance = totalCharges - finalTotalDiscounts - finalTotalPaid;

    return {
      totalCharges,
      totalPaid: finalTotalPaid,
      totalDiscounts: finalTotalDiscounts,
      balance // Allow negative balances to show overpayments
    };
  }

  async logAction(log: InsertAuditLog): Promise<void> {
    db.insert(schema.auditLog).values(log);
  }

  async getDashboardStats(): Promise<any> {
    try {
      // Use local system time for dashboard statistics
      const now = new Date();
      const today = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');

      console.log('Dashboard stats - Today date (local time):', today);
      console.log('Dashboard stats - Current time:', now);

      // Get ALL OPD services first to debug
      const allOpdServices = db.select().from(schema.patientServices)
        .where(eq(schema.patientServices.serviceType, 'opd'))
        .all();

      console.log('All OPD services found:', allOpdServices.length);
      console.log('All OPD services details:', allOpdServices.map(s => ({
        id: s.id,
        scheduledDate: s.scheduledDate,
        serviceType: s.serviceType,
        createdAt: s.createdAt
      })));

      // Get OPD patient count for today using same filter logic as OPD List
      const todayOpdServices = allOpdServices.filter(service => {
        const matches = service.scheduledDate === today;
        console.log(`Service ${service.id}: scheduledDate="${service.scheduledDate}" vs today="${today}" => matches: ${matches}`);
        return matches;
      });

      console.log('Today OPD services filtered:', todayOpdServices.length);
      console.log('Today OPD services details:', todayOpdServices);
      console.log('Dashboard OPD count for today:', todayOpdServices.length);

      // Get inpatients count (currently admitted)
      const inpatients = db.select()
        .from(schema.admissions)
        .where(eq(schema.admissions.status, 'admitted'))
        .all().length;

      // Get lab tests count for today
      const labTests = db.select()
        .from(schema.pathologyOrders)
        .where(eq(schema.pathologyOrders.orderedDate, today))
        .all().length;

      // Get diagnostics count (diagnostic services scheduled today)
      const diagnosticServices = db.select()
        .from(schema.patientServices)
        .where(
          and(
            eq(schema.patientServices.scheduledDate, today),
            sql`(
              ${schema.patientServices.serviceType} = 'xray' OR 
              ${schema.patientServices.serviceType} = 'ecg' OR 
              ${schema.patientServices.serviceType} = 'ultrasound' OR 
              ${schema.patientServices.serviceType} = 'diagnostic' OR
              LOWER(${schema.patientServices.serviceName}) LIKE '%ecg%' OR
              LOWER(${schema.patientServices.serviceName}) LIKE '%usg%' OR
              LOWER(${schema.patientServices.serviceName}) LIKE '%x-ray%' OR
              LOWER(${schema.patientServices.serviceName}) LIKE '%xray%' OR
              LOWER(${schema.patientServices.serviceName}) LIKE '%ultrasound%' OR
              LOWER(${schema.patientServices.serviceName}) LIKE '%endoscopy%'
            )`
          )
        )
        .all();
      const diagnostics = diagnosticServices.length;

      return {
        opdPatients: todayOpdServices.length,
        inpatients,
        labTests,
        diagnostics
      };
    } catch (error) {
      console.error('Dashboard stats error:', error);
      return {
        opdPatients: 0,
        inpatients: 0,
        labTests: 0,
        diagnostics: 0
      };
    }
  }

  // Room Type Management
  async getAllRoomTypes(): Promise<any[]> {
    return db.select().from(schema.roomTypes).orderBy(schema.roomTypes.name).all();
  }

  async createRoomType(data: any): Promise<any> {
    return db.insert(schema.roomTypes).values(data).returning().get();
  }

  async updateRoomType(id: string, data: any): Promise<any> {
    return db.update(schema.roomTypes)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(schema.roomTypes.id, id))
      .returning()
      .get();
  }

  async deleteRoomType(id: string): Promise<void> {
    await db.delete(schema.roomTypes).where(eq(schema.roomTypes.id, id)).run();
  }

  // Room Management
  async getAllRooms(): Promise<any[]> {
    return db.select().from(schema.rooms).orderBy(schema.rooms.roomNumber).all();
  }

  async createRoom(data: any): Promise<any> {
    return db.insert(schema.rooms).values(data).returning().get();
  }

  async updateRoom(id: string, data: any): Promise<any> {
    return db.update(schema.rooms)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(schema.rooms.id, id))
      .returning()
      .get();
  }

  async deleteRoom(id: string): Promise<void> {
    await db.delete(schema.rooms).where(eq(schema.rooms.id, id)).run();
  }

  async getRoomsByType(roomTypeId: string): Promise<any[]> {
    return db.select().from(schema.rooms)
      .where(eq(schema.rooms.roomTypeId, roomTypeId))
      .all();
  }

  async updateRoomOccupancy(roomId: string, isOccupied: boolean): Promise<any> {
    return db.update(schema.rooms)
      .set({ isOccupied, updatedAt: new Date().toISOString() })
      .where(eq(schema.rooms.id, roomId))
      .returning()
      .get();
  }

  // Admission Events
  async createAdmissionEvent(event: InsertAdmissionEvent): Promise<AdmissionEvent> {
    const created = db.insert(schema.admissionEvents).values(event).returning().get();
    return created;
  }

  async getAdmissionEvents(admissionId: string): Promise<AdmissionEvent[]> {
    return db.select().from(schema.admissionEvents)
      .where(eq(schema.admissionEvents.admissionId, admissionId))
      .orderBy(schema.admissionEvents.eventTime)
      .all();
  }

  async transferRoom(admissionId: string, roomData: { roomNumber: string, wardType: string }, userId: string): Promise<Admission | undefined> {
    return db.transaction((tx) => {
      const eventTime = new Date().toISOString();
      const eventDate = eventTime.split('T')[0];

      // Generate receipt number for room transfer
      const transferCount = this.getDailyReceiptCountSync('room_transfer', eventDate);
      const dateObj = new Date(eventDate);
      const yymmdd = dateObj.toISOString().slice(2, 10).replace(/-/g, '').slice(0, 6);
      const receiptNumber = `${yymmdd}-RMC-${transferCount.toString().padStart(4, '0')}`;

      // Update the admission's current room
      const updated = tx.update(schema.admissions)
        .set({
          currentRoomNumber: roomData.roomNumber,
          currentWardType: roomData.wardType,
          updatedAt: eventTime
        })
        .where(eq(schema.admissions.id, admissionId))
        .returning().get();

      // Create room change event with receipt number
      tx.insert(schema.admissionEvents).values({
        admissionId: admissionId,
        eventType: "room_change",
        eventTime: eventTime,
        roomNumber: roomData.roomNumber,
        wardType: roomData.wardType,
        notes: `Room transferred to ${roomData.wardType} - Room ${roomData.roomNumber}`,
        createdBy: userId,
        receiptNumber: receiptNumber,
      }).run();

      return updated;
    });
  }

  async dischargePatient(admissionId: string, userId: string, dischargeDateTime?: string): Promise<Admission | undefined> {
    return db.transaction((tx) => {
      // Get current admission
      const currentAdmission = tx.select().from(schema.admissions)
        .where(eq(schema.admissions.id, admissionId))
        .get();

      if (!currentAdmission) {
        throw new Error("Admission not found");
      }

      if (currentAdmission.status === "discharged") {
        throw new Error("Patient is already discharged");
      }

      // Use provided discharge date/time or current time
      let dischargeDate: Date;
      let dischargeDateString: string;

      if (dischargeDateTime) {
        // Handle datetime-local format "YYYY-MM-DDTHH:MM" as local time
        if (dischargeDateTime.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
          const parts = dischargeDateTime.split('T');
          const dateParts = parts[0].split('-');
          const timeParts = parts[1].split(':');

          // Create date in local timezone (don't add Z)
          dischargeDate = new Date(
            parseInt(dateParts[0]), // year
            parseInt(dateParts[1]) - 1, // month (0-indexed)
            parseInt(dateParts[2]), // day
            parseInt(timeParts[0]), // hour
            parseInt(timeParts[1]) // minute
          );

          // Store as local datetime string for SQLite
          dischargeDateString = dischargeDate.getFullYear() + '-' +
            String(dischargeDate.getMonth() + 1).padStart(2, '0') + '-' +
            String(dischargeDate.getDate()).padStart(2, '0') + ' ' +
            String(dischargeDate.getHours()).padStart(2, '0') + ':' +
            String(dischargeDate.getMinutes()).padStart(2, '0') + ':' +
            String(dischargeDate.getSeconds()).padStart(2, '0');
        } else {
          // Fallback for other formats
          dischargeDate = new Date(dischargeDateTime);
          dischargeDateString = dischargeDate.toISOString();
        }
      } else {
        // Default to current time
        dischargeDate = new Date();
        dischargeDateString = dischargeDate.toISOString();
      }

      const eventDate = dischargeDate.getFullYear() + '-' +
        String(dischargeDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(dischargeDate.getDate()).padStart(2, '0');

      // Generate receipt number for discharge
      const dischargeCount = this.getDailyReceiptCountSync('discharge', eventDate);
      const dateObj = new Date(eventDate);
      const yymmdd = dateObj.toISOString().slice(2, 10).replace(/-/g, '').slice(0, 6);
      const receiptNumber = `${yymmdd}-DIS-${dischargeCount.toString().padStart(4, '0')}`;

      // Update admission status with provided discharge date/time
      const updated = tx.update(schema.admissions)
        .set({
          status: "discharged",
          dischargeDate: dischargeDateString,
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.admissions.id, admissionId))
        .returning().get();

      // Create discharge event with receipt number
      tx.insert(schema.admissionEvents).values({
        admissionId: admissionId,
        eventType: "discharge",
        eventTime: dischargeDateString,
        notes: `Patient discharged`,
        createdBy: userId,
        receiptNumber: receiptNumber,
      }).run();

      // Decrement occupied beds
      if (currentAdmission.currentWardType) {
        const roomType = tx.select().from(schema.roomTypes)
          .where(eq(schema.roomTypes.name, currentAdmission.currentWardType))
          .get();

        if (roomType && roomType.occupiedBeds > 0) {
          tx.update(schema.roomTypes)
            .set({
              occupiedBeds: roomType.occupiedBeds - 1,
              updatedAt: new Date().toISOString()
            })
            .where(eq(schema.roomTypes.id, roomType.id))
            .run();
        }
      }

      // Log discharge activity (do this after transaction to avoid issues)
      setImmediate(() => {
        const patient = db.select().from(schema.patients).where(eq(schema.patients.id, currentAdmission.patientId)).get();
        if (patient) {
          this.logActivity(
            userId,
            'patient_discharged',
            'Patient discharged',
            `${patient.name} - ${currentAdmission.admissionId}`,
            admissionId,
            'admission',
            { admissionId: currentAdmission.admissionId, patientName: patient.name }
          );
        }
      });

      return updated;
    });
  }

  async getHospitalSettings(): Promise<any> {
    try {
      // Try to get existing settings
      let settings = db.select().from(schema.hospitalSettings).where(eq(schema.hospitalSettings.id, 'default')).get();

      // If no settings exist, create default ones
      if (!settings) {
        settings = db.insert(schema.hospitalSettings).values({
          id: 'default',
          name: 'MedCare Pro Hospital',
          address: '123 Healthcare Street, Medical District, City - 123456',
          phone: '+91 98765 43210',
          email: 'info@medcarepro.com',
          registrationNumber: null,
          logoPath: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).returning().get();
      }

      return settings;
    } catch (error) {
      console.error('Error getting hospital settings:', error);
      // Return defaults if database operation fails
      return {
        id: 'default',
        name: 'MedCare Pro Hospital',
        address: '123 Healthcare Street, Medical District, City - 123456',
        phone: '+91 98765 43210',
        email: 'info@medcarepro.com',
        registrationNumber: null,
        logoPath: null,
      };
    }
  }

  async saveHospitalSettings(settings: any): Promise<any> {
    try {
      // Use Drizzle ORM to update hospital settings
      const updated = db.insert(schema.hospitalSettings).values({
        id: 'default',
        name: settings.name,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        registrationNumber: settings.registrationNumber || null,
        logoPath: settings.logoPath || null,
        updatedAt: new Date().toISOString()
      }).onConflictDoUpdate({
        target: schema.hospitalSettings.id,
        set: {
          name: settings.name,
          address: settings.address,
          phone: settings.phone,
          email: settings.email,
          registrationNumber: settings.registrationNumber || null,
          logoPath: settings.logoPath || null,
          updatedAt: new Date().toISOString()
        }
      }).returning().get();

      return updated;
    } catch (error) {
      console.error('Error saving hospital settings:', error);
      throw error;
    }
  }

  async saveLogo(logoData: string): Promise<string> {
    try {
      // Extract base64 data and file type
      const matches = logoData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Invalid image data format');
      }

      const mimeType = matches[1];
      const base64Data = matches[2];
      const extension = mimeType.split('/')[1];

      // Create filename and path
      const filename = `hospital-logo-${Date.now()}.${extension}`;
      const logoPath = `/uploads/${filename}`;

      // For simplicity, we'll store the base64 data directly in the database
      // In a production system, you'd save to filesystem or cloud storage
      return logoData; // Return the original data URL for now
    } catch (error) {
      console.error('Error saving logo:', error);
      throw error;
    }
  }

  // System settings
  async getSystemSettings(): Promise<any> {
    try {
      let settings = db.select().from(schema.systemSettings).get();

      // Create default settings if none exist
      if (!settings) {
        settings = {
          id: this.generateId(),
          emailNotifications: false,
          smsNotifications: false,
          autoBackup: true,
          auditLogging: true,
          backupFrequency: 'daily',
          backupTime: '02:00',
          lastBackupDate: null,
          backupRetentionDays: 30,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        db.insert(schema.systemSettings).values(settings).run();
      }

      return settings;
    } catch (error) {
      console.error('Error fetching system settings:', error);
      throw error;
    }
  }

  async saveSystemSettings(settings: any): Promise<any> {
    try {
      const existingSettings = db.select().from(schema.systemSettings).get();

      if (existingSettings) {
        // Update existing settings
        const updated = db.update(schema.systemSettings)
          .set({
            ...settings,
            updatedAt: new Date().toISOString()
          })
          .where(eq(schema.systemSettings.id, existingSettings.id))
          .returning()
          .get();
        return updated;
      } else {
        // Create new settings
        const newSettings = {
          ...settings,
          id: this.generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const created = db.insert(schema.systemSettings)
          .values(newSettings)
          .returning()
          .get();
        return created;
      }
    } catch (error) {
      console.error('Error saving system settings:', error);
      throw error;
    }
  }

  // Backup functionality
  private generateBackupId(): string {
    const year = new Date().getFullYear();
    const count = db.select().from(schema.backupLogs).all().length + 1;
    return `BACKUP-${year}-${count.toString().padStart(3, '0')}`;
  }

  async createBackup(backupType: string = 'auto'): Promise<any> {
    const backupId = this.generateBackupId();
    const startTime = new Date().toISOString();

    try {
      // Log backup start
      const backupLog = {
        backupId,
        status: 'running',
        backupType,
        startTime,
        createdAt: startTime
      };

      db.insert(schema.backupLogs).values(backupLog).run();

      // Create backup directory if it doesn't exist
      const backupDir = path.join(process.cwd(), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Generate backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `hospital-backup-${timestamp}.sql`);

      // Export database to SQL dump
      const tables = [
        'users', 'doctors', 'patients', 'patient_visits', 'services',
        'bills', 'bill_items', 'pathology_orders', 'pathology_tests',
        'patient_services', 'admissions', 'admission_events',
        'hospital_settings', 'system_settings', 'room_types', 'rooms'
      ];

      let sqlDump = '-- Hospital Management System Database Backup\n';
      sqlDump += `-- Created: ${new Date().toISOString()}\n`;
      sqlDump += `-- Backup ID: ${backupId}\n\n`;

      let totalRecords = 0;

      for (const tableName of tables) {
        try {
          const rows = db.$client.prepare(`SELECT * FROM ${tableName}`).all();
          totalRecords += rows.length;

          if (rows.length > 0) {
            sqlDump += `-- Table: ${tableName}\n`;
            sqlDump += `DELETE FROM ${tableName};\n`;

            for (const row of rows) {
              const columns = Object.keys(row).join(', ');
              const values = Object.values(row).map(v =>
                v === null ? 'NULL' :
                typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` :
                v
              ).join(', ');

              sqlDump += `INSERT INTO ${tableName} (${columns}) VALUES (${values});\n`;
            }
            sqlDump += '\n';
          }
        } catch (tableError) {
          console.warn(`Warning: Could not backup table ${tableName}:`, tableError);
        }
      }

      // Write backup file
      fs.writeFileSync(backupPath, sqlDump, 'utf8');
      const fileStats = fs.statSync(backupPath);
      const endTime = new Date().toISOString();

      console.log(`Backup file created: ${backupPath} (${fileStats.size} bytes)`);

      // Update backup log with success
      db.update(schema.backupLogs)
        .set({
          status: 'completed',
          filePath: backupPath,
          fileSize: fileStats.size,
          endTime,
          tableCount: tables.length,
          recordCount: totalRecords
        })
        .where(eq(schema.backupLogs.backupId, backupId))
        .run();

      console.log(`Backup log updated for ${backupId} with status: completed`);

      // Update system settings with last backup date
      const systemSettings = await this.getSystemSettings();
      if (systemSettings) {
        await this.saveSystemSettings({
          ...systemSettings,
          lastBackupDate: new Date().toISOString().split('T')[0]
        });
      }

      return {
        backupId,
        filePath: backupPath,
        fileSize: fileStats.size,
        recordCount: totalRecords,
        status: 'completed'
      };

    } catch (error) {
      console.error('Backup creation error:', error);

      // Update backup log with failure
      db.update(schema.backupLogs)
        .set({
          status: 'failed',
          endTime: new Date().toISOString(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        })
        .where(eq(schema.backupLogs.backupId, backupId))
        .run();

      throw error;
    }
  }

  async getBackupLogs(): Promise<any[]> {
    try {
      return db.select()
        .from(schema.backupLogs)
        .orderBy(desc(schema.backupLogs.createdAt))
        .limit(50)
        .all();
    } catch (error) {
      console.error('Error fetching backup logs:', error);
      return [];
    }
  }

  async getBackupHistory(): Promise<any[]>{
    try {
      const history = db.select()
        .from(schema.backupLogs)
        .where(
          and(
            eq(schema.backupLogs.status, 'completed'),
            ne(schema.backupLogs.backupType, 'restore')
          )
        )
        .orderBy(desc(schema.backupLogs.createdAt))
        .limit(20)
        .all();

      console.log('Backup history query result:', history.length, 'backups found');
      console.log('Backup types in history:', history.map(h => `${h.backupType} - ${h.backupId}`));

      return history;
    } catch (error) {
      console.error('Error fetching backup history:', error);
      return [];
    }
  }

  async cleanOldBackups(): Promise<void> {
    try {
      const systemSettings = await this.getSystemSettings();
      const retentionDays = systemSettings?.backupRetentionDays || 30;

      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoffIso = cutoffDate.toISOString();

      // Find old backup files
      const oldBackups = db.select()
        .from(schema.backupLogs)
        .where(sql`${schema.backupLogs.createdAt} < ${cutoffIso}`)
        .all();

      // Delete files and log entries
      for (const backup of oldBackups) {
        try {
          if (backup.filePath && fs.existsSync(backup.filePath)) {
            fs.unlinkSync(backup.filePath);
          }

          db.delete(schema.backupLogs)
            .where(eq(schema.backupLogs.id, backup.id))
            .run();

        } catch (deleteError) {
          console.warn(`Failed to delete backup ${backup.backupId}:`, deleteError);
        }
      }

      console.log(`Cleaned up ${oldBackups.length} old backup(s)`);
    } catch (error) {
      console.error('Error cleaning old backups:', error);
    }
  }

  async restoreBackup(backupFilePath: string): Promise<any> {
    const startTime = new Date().toISOString();

    try {
      // Validate backup file exists
      if (!fs.existsSync(backupFilePath)) {
        throw new Error('Backup file not found');
      }

      // Read backup file content
      const backupContent = fs.readFileSync(backupFilePath, 'utf8');

      if (!backupContent || backupContent.trim().length === 0) {
        throw new Error('Backup file is empty or corrupted');
      }

      // Create a restore log entry
      const restoreId = this.generateBackupId().replace('BACKUP', 'RESTORE');
      const restoreLog = {
        backupId: restoreId,
        status: 'running',
        backupType: 'restore',
        filePath: backupFilePath,
        startTime,
        createdAt: startTime
      };

      db.insert(schema.backupLogs).values(restoreLog).run();

      // Split SQL content into individual statements outside of transaction
      const statements = backupContent
        .split('\n')
        .filter(line =>
          line.trim() &&
          !line.trim().startsWith('--') &&
          !line.trim().startsWith('/*')
        )
        .join('\n')
        .split(';')
        .filter(stmt => stmt.trim());

      let executedStatements = 0;

      // Execute statements directly using the SQLite client
      for (const statement of statements) {
        const trimmedStmt = statement.trim();
        if (trimmedStmt) {
          try {
            db.$client.exec(trimmedStmt + ';');
            executedStatements++;
          } catch (stmtError) {
            console.warn(`Warning: Failed to execute statement: ${trimmedStmt.substring(0, 100)}...`, stmtError);
          }
        }
      }

      // Update restore log with success
      db.update(schema.backupLogs)
        .set({
          status: 'completed',
          endTime: new Date().toISOString(),
          recordCount: executedStatements
        })
        .where(eq(schema.backupLogs.backupId, restoreId))
        .run();

      return {
        restoreId,
        executedStatements,
        status: 'completed'
      };

    } catch (error) {
      console.error('Backup restore error:', error);

      // Update restore log with failure if possible
      try {
        const restoreId = this.generateBackupId().replace('BACKUP', 'RESTORE');
        db.update(schema.backupLogs)
          .set({
            status: 'failed',
            endTime: new Date().toISOString(),
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          })
          .where(eq(schema.backupLogs.backupId, restoreId))
          .run();
      } catch (logError) {
        console.error('Failed to update restore log:', logError);
      }

      throw error;
    }
  }

  async getAvailableBackups(): Promise<any[]> {
    try {
      const backupDir = path.join(process.cwd(), 'backups');

      if (!fs.existsSync(backupDir)) {
        return [];
      }

      const files = fs.readdirSync(backupDir)
        .filter(file => file.endsWith('.sql'))
        .map(file => {
          const filePath = path.join(backupDir, file);
          const stats = fs.statSync(filePath);

          // Get backup log info if available by matching file path
          const backupLog = db.select()
            .from(schema.backupLogs)
            .where(
              and(
                like(schema.backupLogs.filePath, `%${file}`),
                eq(schema.backupLogs.status, 'completed'),
                ne(schema.backupLogs.backupType, 'restore')
              )
            )
            .get();

          return {
            fileName: file,
            filePath,
            fileSize: stats.size,
            createdAt: backupLog?.createdAt || stats.birthtime.toISOString(),
            modifiedAt: stats.mtime.toISOString(),
            backupLog: backupLog || null
          };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      console.log(`Found ${files.length} backup files, ${files.filter(f => f.backupLog).length} with logs`);
      return files;
    } catch (error) {
      console.error('Error getting available backups:', error);
      return [];
    }
  }

  // Pathology category management
  async createPathologyCategory(category: InsertPathologyCategory): Promise<PathologyCategory> {
    const created = db.insert(schema.pathologyCategories).values(category).returning().get();
    return created;
  }

  async getPathologyCategories(): Promise<PathologyCategory[]> {
    return db.select().from(schema.pathologyCategories)
      .where(eq(schema.pathologyCategories.isActive, true))
      .orderBy(asc(schema.pathologyCategories.name))
      .all();
  }

  async getPathologyCategoryById(id: string): Promise<PathologyCategory | undefined> {
    return db.select().from(schema.pathologyCategories)
      .where(eq(schema.pathologyCategories.id, id))
      .get();
  }

  async updatePathologyCategory(id: string, category: Partial<InsertPathologyCategory>): Promise<PathologyCategory | undefined> {
    const updated = db.update(schema.pathologyCategories)
      .set({ ...category, updatedAt: sql`datetime('now')` })
      .where(eq(schema.pathologyCategories.id, id))
      .returning()
      .get();
    return updated;
  }

  async deletePathologyCategory(id: string): Promise<boolean> {
    try {
      // Check if category has any tests first
      const testsCount = db.select().from(schema.dynamicPathologyTests)
        .where(eq(schema.dynamicPathologyTests.categoryId, id))
        .all().length;

      if (testsCount > 0) {
        return false; // Cannot delete category with tests
      }

      const result = db.delete(schema.pathologyCategories)
        .where(eq(schema.pathologyCategories.id, id))
        .run();
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting pathology category:', error);
      return false;
    }
  }

  // Dynamic pathology test management
  async createDynamicPathologyTest(test: InsertDynamicPathologyTest): Promise<DynamicPathologyTest> {
    const created = db.insert(schema.dynamicPathologyTests).values(test).returning().get();
    return created;
  }

  async getDynamicPathologyTests(): Promise<DynamicPathologyTest[]> {
    return db.select().from(schema.dynamicPathologyTests)
      .where(eq(schema.dynamicPathologyTests.isActive, true))
      .orderBy(asc(schema.dynamicPathologyTests.testName))
      .all();
  }

  async getDynamicPathologyTestsByCategory(categoryId: string): Promise<DynamicPathologyTest[]> {
    return db.select().from(schema.dynamicPathologyTests)
      .where(and(
        eq(schema.dynamicPathologyTests.categoryId, categoryId),
        eq(schema.dynamicPathologyTests.isActive, true)
      ))
      .orderBy(asc(schema.dynamicPathologyTests.testName))
      .all();
  }

  async getDynamicPathologyTestById(id: string): Promise<DynamicPathologyTest | undefined> {
    return db.select().from(schema.dynamicPathologyTests)
      .where(eq(schema.dynamicPathologyTests.id, id))
      .get();
  }

  async updateDynamicPathologyTest(id: string, test: Partial<InsertDynamicPathologyTest>): Promise<DynamicPathologyTest | undefined> {
    const updated = db.update(schema.dynamicPathologyTests)
      .set({ ...test, updatedAt: sql`datetime('now')` })
      .where(eq(schema.dynamicPathologyTests.id, id))
      .returning()
      .get();
    return updated;
  }

  async deleteDynamicPathologyTest(id: string): Promise<boolean> {
    try {
      const result = db.delete(schema.dynamicPathologyTests)
        .where(eq(schema.dynamicPathologyTests.id, id))
        .run();
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting dynamic pathology test:', error);
      return false;
    }
  }

  async bulkCreateDynamicPathologyTests(tests: InsertDynamicPathologyTest[]): Promise<DynamicPathologyTest[]> {
    const createdTests: DynamicPathologyTest[] = [];

    const transaction = db.transaction(() => {
      for (const test of tests) {
        const created = db.insert(schema.dynamicPathologyTests).values(test).returning().get();
        createdTests.push(created);
      }
    });

    transaction();
    return createdTests;
  }

  async logActivity(userId: string, activityType: string, title: string, description: string, entityId?: string, entityType?: string, metadata?: any): Promise<void> {
    try {
      db.$client.prepare(`
        INSERT INTO activities (user_id, activity_type, title, description, entity_id, entity_type, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(userId, activityType, title, description, entityId || null, entityType || null, metadata ? JSON.stringify(metadata) : null);
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }

  async getRecentActivities(limit: number = 10): Promise<any[]> {
    try {
      const activities = db.$client.prepare(`
        SELECT
          a.id,
          a.activity_type as activityType,
          a.title,
          a.description,
          a.entity_id as entityId,
          a.entity_type as entityType,
          a.metadata,
          a.created_at as createdAt,
          u.full_name as userName
        FROM activities a
        LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC
        LIMIT ?
      `).all(limit);

      return (activities as any[]).map(activity => ({
        ...activity,
        metadata: activity.metadata ? JSON.parse(activity.metadata) : null,
      }));
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      return [];
    }
  }

  async getDailyReceiptCount(serviceType: string, date: string): Promise<number> {
    try {
      let count = 0;

      switch (serviceType) {
        case 'pathology':
          count = db.select().from(schema.pathologyOrders)
            .where(eq(schema.pathologyOrders.orderedDate, date))
            .all().length;
          break;
        case 'admission':
          count = db.select().from(schema.admissionEvents)
            .where(and(
              eq(schema.admissionEvents.eventType, 'admit'),
              like(schema.admissionEvents.eventTime, `${date}%`)
            ))
            .all().length;
          break;
        case 'room_transfer':
          count = db.select().from(schema.admissionEvents)
            .where(and(
              eq(schema.admissionEvents.eventType, 'room_change'),
              like(schema.admissionEvents.eventTime, `${date}%`)
            ))
            .all().length;
          break;
        case 'discharge':
          count = db.select().from(schema.admissionEvents)
            .where(and(
              eq(schema.admissionEvents.eventType, 'discharge'),
              like(schema.admissionEvents.eventTime, `${date}%`)
            ))
            .all().length;
          break;
        case 'opd':
          count = db.select().from(schema.patientServices)
            .where(and(
              eq(schema.patientServices.serviceType, 'opd'),
              eq(schema.patientServices.scheduledDate, date)
            ))
            .all().length;
          break;
        default:
          count = 0;
      }

      return count + 1;
    } catch (error) {
      console.error('Error getting daily receipt count:', error);
      return 1;
    }
  }

  getDailyReceiptCountSync(serviceType: string, date: string): number {
    try {
      let count = 0;

      switch (serviceType) {
        case 'pathology':
          count = db.$client.prepare(`
            SELECT COUNT(*) as count FROM pathology_orders
            WHERE ordered_date = ?
          `).get(date)?.count || 0;
          break;
        case 'admission':
          count = db.$client.prepare(`
            SELECT COUNT(*) as count FROM admission_events
            WHERE event_type = 'admit' AND event_time LIKE ?
          `).get(`${date}%`)?.count || 0;
          break;
        case 'room_transfer':
          count = db.$client.prepare(`
            SELECT COUNT(*) as count FROM admission_events
            WHERE event_type = 'room_change' AND event_time LIKE ?
          `).get(`${date}%`)?.count || 0;
          break;
        case 'discharge':
          count = db.$client.prepare(`
            SELECT COUNT(*) as count FROM admission_events
            WHERE event_type = 'discharge' AND event_time LIKE ?
          `).get(`${date}%`)?.count || 0;
          break;
        case 'opd':
          count = db.$client.prepare(`
            SELECT COUNT(*) as count FROM patient_services
            WHERE service_type = 'opd' AND scheduled_date = ?
          `).get(date)?.count || 0;
          break;
        default:
          count = 0;
      }

      return count + 1;
    } catch (error) {
      console.error('Error getting daily receipt count sync:', error);
      return 1;
    }
  }

  // Schedule Event Management
  async getAllScheduleEvents(): Promise<ScheduleEvent[]> {
    return db.select().from(schema.scheduleEvents).orderBy(schema.scheduleEvents.startTime).all();
  }

  async createScheduleEvent(event: InsertScheduleEvent): Promise<ScheduleEvent> {
    return db.insert(schema.scheduleEvents).values(event).returning().get();
  }

  async updateScheduleEvent(id: string, event: Partial<InsertScheduleEvent>): Promise<ScheduleEvent | undefined> {
    return db.update(schema.scheduleEvents)
      .set({ ...event, updatedAt: new Date().toISOString() })
      .where(eq(schema.scheduleEvents.id, id))
      .returning()
      .get();
  }

  async deleteScheduleEvent(id: string): Promise<void> {
    await db.delete(schema.scheduleEvents).where(eq(schema.scheduleEvents.id, id)).run();
  }

  async getScheduleEventsByDateRange(startDate: string, endDate: string): Promise<ScheduleEvent[]> {
    return db.select()
      .from(schema.scheduleEvents)
      .where(
        and(
          sql`${schema.scheduleEvents.startTime} >= ${startDate}`,
          sql`${schema.scheduleEvents.startTime} <= ${endDate}`
        )
      )
      .orderBy(schema.scheduleEvents.startTime)
      .all();
  }

  async getScheduleEventsByDoctor(doctorId: string): Promise<ScheduleEvent[]> {
    return db.select()
      .from(schema.scheduleEvents)
      .where(eq(schema.scheduleEvents.doctorId, doctorId))
      .orderBy(schema.scheduleEvents.startTime)
      .all();
  }

  // Inpatient Management Detail Methods (IST-based calculations)
  async getBedOccupancyDetails(): Promise<any[]> {
    try {
      // Get room types with occupancy details
      const roomTypes = db.select().from(schema.roomTypes)
        .where(eq(schema.roomTypes.isActive, true))
        .all();

      const bedOccupancyData = roomTypes.map(roomType => {
        // Get rooms for this room type
        const rooms = db.select().from(schema.rooms)
          .where(and(
            eq(schema.rooms.roomTypeId, roomType.id),
            eq(schema.rooms.isActive, true)
          ))
          .all();

        // Get current admissions for rooms of this type
        const currentAdmissions = db.select({
          admission: schema.admissions,
          patient: schema.patients
        })
        .from(schema.admissions)
        .leftJoin(schema.patients, eq(schema.admissions.patientId, schema.patients.id))
        .where(and(
          eq(schema.admissions.status, 'admitted'),
          eq(schema.admissions.currentWardType, roomType.name)
        ))
        .all();

        // Map rooms with occupancy info
        const roomsWithOccupancy = rooms.map(room => {
          const occupyingAdmission = currentAdmissions.find(
            admission => admission.admission.currentRoomNumber === room.roomNumber
          );

          return {
            ...room,
            isOccupied: !!occupyingAdmission,
            occupyingPatient: occupyingAdmission ? {
              name: occupyingAdmission.patient?.name || 'Unknown',
              patientId: occupyingAdmission.patient?.patientId || 'Unknown'
            } : null
          };
        });

        // Calculate actual occupied beds from rooms that are occupied
        const actualOccupiedBeds = roomsWithOccupancy.filter(room => room.isOccupied).length;

        // Calculate total beds from all active rooms for this room type
        const totalBeds = rooms.reduce((sum, room) => sum + (room.capacity || 1), 0);

        return {
          ...roomType,
          rooms: roomsWithOccupancy,
          occupiedBeds: actualOccupiedBeds,
          totalBeds: totalBeds,
          // Keep these for backwards compatibility
          actualOccupiedBeds: actualOccupiedBeds
        };
      });

      return bedOccupancyData;
    } catch (error) {
      console.error('Error getting bed occupancy details:', error);
      return [];
    }
  }

  async getCurrentlyAdmittedPatients(): Promise<any[]> {
    try {
      const currentAdmissions = db.select({
        admission: schema.admissions,
        patient: schema.patients,
        doctor: schema.doctors
      })
      .from(schema.admissions)
      .leftJoin(schema.patients, eq(schema.admissions.patientId, schema.patients.id))
      .leftJoin(schema.doctors, eq(schema.admissions.doctorId, schema.doctors.id))
      .where(eq(schema.admissions.status, 'admitted'))
      .orderBy(desc(schema.admissions.admissionDate))
      .all();

      return currentAdmissions.map(admission => ({
        ...admission.admission,
        patient: admission.patient,
        doctor: admission.doctor
      }));
    } catch (error) {
      console.error('Error getting currently admitted patients:', error);
      return [];
    }
  }

  async getTodayAdmissions(): Promise<any[]> {
    try {
      // Use local system time for date calculation
      const now = new Date();
      const today = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');

      const todayAdmissions = db.select({
        admission: schema.admissions,
        patient: schema.patients,
        doctor: schema.doctors
      })
      .from(schema.admissions)
      .leftJoin(schema.patients, eq(schema.admissions.patientId, schema.patients.id))
      .leftJoin(schema.doctors, eq(schema.admissions.doctorId, schema.doctors.id))
      .where(eq(schema.admissions.admissionDate, today))
      .orderBy(desc(schema.admissions.createdAt))
      .all();

      return todayAdmissions.map(admission => ({
        ...admission.admission,
        patient: admission.patient,
        doctor: admission.doctor
      }));
    } catch (error) {
      console.error('Error getting today\'s admissions:', error);
      return [];
    }
  }

  async getTodayDischarges(): Promise<any[]> {
    try {
      // Use local system time for date calculation
      const now = new Date();
      const today = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');

      const todayDischarges = db.select({
        admission: schema.admissions,
        patient: schema.patients,
        doctor: schema.doctors
      })
      .from(schema.admissions)
      .leftJoin(schema.patients, eq(schema.admissions.patientId, schema.patients.id))
      .leftJoin(schema.doctors, eq(schema.admissions.doctorId, schema.doctors.id))
      .where(and(
        eq(schema.admissions.status, 'discharged'),
        eq(schema.admissions.dischargeDate, today)
      ))
      .orderBy(desc(schema.admissions.updatedAt))
      .all();

      return todayDischarges.map(admission => ({
        ...admission.admission,
        patient: admission.patient,
        doctor: admission.doctor
      }));
    } catch (error) {
      console.error('Error getting today\'s discharges:', error);
      return [];
    }
  }

  // Service Category Management
  async getServiceCategories(): Promise<ServiceCategory[]> {
    return await db.select().from(schema.serviceCategories)
      .where(eq(schema.serviceCategories.isActive, true))
      .orderBy(schema.serviceCategories.name);
  }

  async createServiceCategory(category: InsertServiceCategory): Promise<ServiceCategory> {
    const [serviceCategory] = await db.insert(schema.serviceCategories).values(category).returning();
    return serviceCategory;
  }

  async updateServiceCategory(id: string, category: Partial<InsertServiceCategory>): Promise<ServiceCategory | undefined> {
    const [updated] = await db.update(schema.serviceCategories)
      .set({ ...category, updatedAt: new Date().toISOString() })
      .where(eq(schema.serviceCategories.id, id))
      .returning();
    return updated;
  }

  async deleteServiceCategory(id: string): Promise<boolean> {
    // Check if category has services
    const servicesInCategory = await db.select().from(schema.services)
      .where(eq(schema.services.category, id))
      .limit(1);

    if (servicesInCategory.length > 0) {
      throw new Error("Cannot delete category that has services");
    }

    const [deleted] = await db.update(schema.serviceCategories)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(schema.serviceCategories.id, id))
      .returning();
    return !!deleted;
  }
}

export const storage = new SqliteStorage();