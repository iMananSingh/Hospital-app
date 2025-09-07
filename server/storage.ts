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
  PathologyCategory, InsertPathologyCategory, DynamicPathologyTest, InsertDynamicPathologyTest, Activity, InsertActivity
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
        userId TEXT NOT NULL REFERENCES users(id),
        activityType TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        entityId TEXT,
        entityType TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

    // Check and create demo services
    // Demo services removed - only use services created through the service management system

    // Check and create demo doctor profile
    const existingDoctor = db.select().from(schema.doctors).where(eq(schema.doctors.id, 'doctor-profile-id')).get();
    if (!existingDoctor) {
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
  createService(service: InsertService): Promise<Service>;
  getServices(): Promise<Service[]>;
  getServiceById(id: string): Promise<Service | undefined>;
  searchServices(query: string): Promise<Service[]>;
  updateService(id: string, service: InsertService): Promise<Service | undefined>;
  deleteService(id: string): Promise<boolean>;

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
  createPatientService(service: InsertPatientService): Promise<PatientService>;
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
  dischargePatient(admissionId: string, userId: string): Promise<Admission | undefined>;

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

  async createPatient(patientData: InsertPatient, userId?: string): Promise<Patient> {
    // Generate patient ID
    const today = new Date();
    const year = today.getFullYear();
    const patientCount = await this.getDailyPatientCount();
    const patientId = `PAT-${year}-${String(patientCount + 1).padStart(3, '0')}`;

    const [patient] = this.db.insert(schema.patients).values({
      ...patientData,
      patientId,
    }).returning();

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

  async createService(service: InsertService): Promise<Service> {
    const created = db.insert(schema.services).values(service).returning().get();
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

  async updateService(id: string, service: InsertService): Promise<Service | undefined> {
    const updated = db.update(schema.services)
      .set(service)
      .where(eq(schema.services.id, id))
      .returning()
      .get();
    return updated;
  }

  async deleteService(id: string): Promise<boolean> {
    const result = db.delete(schema.services).where(eq(schema.services.id, id)).run();
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
          `${orderId} for ${patient?.name || 'Unknown Patient'}`,
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
    const [updated] = this.db.update(schema.pathologyTests)
      .set({
        status,
        results,
        updatedAt: new Date().toISOString()
      })
      .where(eq(schema.pathologyTests.id, testId))
      .returning();

    // Log activity when test is completed
    if (status === 'completed' && userId) {
      const test = this.db.select().from(schema.pathologyTests).where(eq(schema.pathologyTests.id, testId)).get();
      const order = this.db.select().from(schema.pathologyOrders).where(eq(schema.pathologyOrders.id, test?.orderId || '')).get();
      const patient = this.db.select().from(schema.patients).where(eq(schema.patients.id, order?.patientId || '')).get();

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

  async createPatientService(serviceData: InsertPatientService): Promise<PatientService> {
    try {
      const created = db.insert(schema.patientServices).values({
        ...serviceData,
        serviceId: serviceData.serviceId || `SRV-${Date.now()}`,
        receiptNumber: serviceData.receiptNumber || null,
      }).returning().get();

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
    // Use Indian timezone (UTC+5:30) for consistent date calculation
    const now = new Date();
    const indianTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const eventDate = indianTime.getFullYear() + '-' +
      String(indianTime.getMonth() + 1).padStart(2, '0') + '-' +
      String(indianTime.getDate()).padStart(2, '0');
    const admissionDate = eventDate; // Store just the date part for easier querying

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
        eventTime: admissionDate,
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

  async logAction(log: InsertAuditLog): Promise<void> {
    db.insert(schema.auditLog).values(log);
  }

  async getDashboardStats(): Promise<any> {
    try {
      // Use Indian timezone (UTC+5:30) for consistent date calculation
      const now = new Date();
      const indianTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      const today = indianTime.getFullYear() + '-' +
        String(indianTime.getMonth() + 1).padStart(2, '0') + '-' +
        String(indianTime.getDate()).padStart(2, '0');

      console.log('Dashboard stats - Today date (Indian time):', today);
      console.log('Dashboard stats - Raw now:', now);
      console.log('Dashboard stats - Indian time:', indianTime);

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

      // Get diagnostics count (pathology tests completed today)
      const diagnostics = db.select()
        .from(schema.pathologyTests)
        .where(eq(schema.pathologyTests.status, 'completed'))
        .all().length;

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

  async dischargePatient(admissionId: string, userId: string): Promise<Admission | undefined> {
    return db.transaction((tx) => {
      const currentAdmission = tx.select().from(schema.admissions)
        .where(eq(schema.admissions.id, admissionId))
        .get();

      if (!currentAdmission) return undefined;

      // Use Indian timezone (UTC+5:30) for consistent date calculation
      const now = new Date();
      const indianTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      const eventDate = indianTime.getFullYear() + '-' +
        String(indianTime.getMonth() + 1).padStart(2, '0') + '-' +
        String(indianTime.getDate()).padStart(2, '0');
      const dischargeDate = eventDate; // Store just the date part for easier querying

      // Generate receipt number for discharge
      const dischargeCount = this.getDailyReceiptCountSync('discharge', eventDate);
      const dateObj = new Date(eventDate);
      const yymmdd = dateObj.toISOString().slice(2, 10).replace(/-/g, '').slice(0, 6);
      const receiptNumber = `${yymmdd}-DIS-${dischargeCount.toString().padStart(4, '0')}`;

      // Update admission status
      const updated = tx.update(schema.admissions)
        .set({
          status: "discharged",
          dischargeDate: dischargeDate,
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.admissions.id, admissionId))
        .returning().get();

      // Create discharge event with receipt number
      tx.insert(schema.admissionEvents).values({
        admissionId: admissionId,
        eventType: "discharge",
        eventTime: new Date().toISOString(),
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

  // Synchronous version for use within transactions
  private getDailyReceiptCountSync(serviceType: string, date: string): number {
    try {
      let count = 0;

      switch (serviceType.toLowerCase()) {
        case 'opd':
          count = db.select().from(schema.patientServices)
            .where(and(
              eq(schema.patientServices.scheduledDate, date),
              eq(schema.patientServices.serviceType, 'opd')
            ))
            .all().length;
          break;

        case 'service':
        case 'ser':
          count = db.select().from(schema.patientServices)
            .where(and(
              eq(schema.patientServices.scheduledDate, date),
              ne(schema.patientServices.serviceType, 'opd')
            ))
            .all().length;
          break;

        case 'pathology':
        case 'pat':
          count = db.select().from(schema.pathologyOrders)
            .where(eq(schema.pathologyOrders.orderedDate, date))
            .all().length;
          break;

        case 'admission':
        case 'adm':
          count = db.select().from(schema.admissionEvents)
            .where(and(
              like(schema.admissionEvents.eventTime, `${date}%`),
              eq(schema.admissionEvents.eventType, 'admit')
            ))
            .all().length;
          break;

        case 'discharge':
        case 'dis':
          count = db.select().from(schema.admissionEvents)
            .where(and(
              like(schema.admissionEvents.eventTime, `${date}%`),
              eq(schema.admissionEvents.eventType, 'discharge')
            ))
            .all().length;
          break;

        case 'room_transfer':
        case 'rts':
          count = db.select().from(schema.admissionEvents)
            .where(and(
              like(schema.admissionEvents.eventTime, `${date}%`),
              eq(schema.admissionEvents.eventType, 'room_change')
            ))
            .all().length;
          break;

        case 'payment':
        case 'pay':
          count = db.select().from(schema.admissions)
            .where(like(schema.admissions.lastPaymentDate, `${date}%`))
            .all().length;
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

  async getDailyReceiptCount(serviceType: string, date: string): Promise<number> {
    return this.getDailyReceiptCountSync(serviceType, date);
  }

  // Inpatient Management Detail Methods (IST-based calculations)
  async getBedOccupancyDetails(): Promise<any> {
    try {
      // Get all room types with their rooms
      const roomTypes = await this.getAllRoomTypes();

      const bedOccupancy = await Promise.all(roomTypes.map(async (roomType) => {
        // Get all rooms for this room type
        const rooms = await this.getRoomsByType(roomType.id);

        let actualOccupiedBeds = 0;

        // For each room, check if there's an actual current admission
        const roomsWithOccupancy = await Promise.all(rooms.map(async (room) => {
          let occupyingPatient = null;
          let isActuallyOccupied = false;

          // Check if there's a current admission for this room by room number and ward type
          const admission = db.select()
            .from(schema.admissions)
            .where(
              and(
                eq(schema.admissions.currentRoomNumber, room.roomNumber),
                eq(schema.admissions.currentWardType, roomType.name),
                eq(schema.admissions.status, 'admitted')
              )
            )
            .get();

          if (admission) {
            isActuallyOccupied = true;
            actualOccupiedBeds++;

            // Get patient details
            const patient = db.select()
              .from(schema.patients)
              .where(eq(schema.patients.id, admission.patientId))
              .get();

            if (patient) {
              occupyingPatient = {
                name: patient.name,
                patientId: patient.patientId
              };
            }
          }

          return {
            ...room,
            isOccupied: isActuallyOccupied,
            occupyingPatient
          };
        }));

        // Return the room type with corrected occupied bed count
        return {
          ...roomType,
          occupiedBeds: actualOccupiedBeds, // Use actual count instead of stored value
          rooms: roomsWithOccupancy
        };
      }));

      return bedOccupancy;
    } catch (error) {
      console.error('Error fetching bed occupancy details:', error);
      throw error;
    }
  }

  async getCurrentlyAdmittedPatients(): Promise<any[]> {
    try {
      // Get all currently admitted patients with their details
      const admissions = db.select()
        .from(schema.admissions)
        .where(eq(schema.admissions.status, 'admitted'))
        .orderBy(desc(schema.admissions.admissionDate))
        .all();

      const patientsWithDetails = await Promise.all(admissions.map(async (admission) => {
        // Get patient details
        const patient = db.select()
          .from(schema.patients)
          .where(eq(schema.patients.id, admission.patientId))
          .get();

        // Get doctor details
        const doctor = admission.doctorId ? db.select()
          .from(schema.doctors)
          .where(eq(schema.doctors.id, admission.doctorId))
          .get() : null;

        return {
          ...admission,
          patient,
          doctor
        };
      }));

      return patientsWithDetails;
    } catch (error) {
      console.error('Error fetching currently admitted patients:', error);
      throw error;
    }
  }

  async getTodayAdmissions(): Promise<any[]> {
    try {
      // Use Indian timezone (UTC+5:30) for consistent date calculation
      const now = new Date();
      const indianTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      const today = indianTime.getFullYear() + '-' +
        String(indianTime.getMonth() + 1).padStart(2, '0') + '-' +
        String(indianTime.getDate()).padStart(2, '0');

      // Get admissions for today
      const admissions = db.select()
        .from(schema.admissions)
        .where(eq(schema.admissions.admissionDate, today))
        .orderBy(desc(schema.admissions.createdAt))
        .all();

      const admissionsWithDetails = await Promise.all(admissions.map(async (admission) => {
        // Get patient details
        const patient = db.select()
          .from(schema.patients)
          .where(eq(schema.patients.id, admission.patientId))
          .get();

        // Get doctor details
        const doctor = admission.doctorId ? db.select()
          .from(schema.doctors)
          .where(eq(schema.doctors.id, admission.doctorId))
          .get() : null;

        return {
          ...admission,
          patient,
          doctor
        };
      }));

      return admissionsWithDetails;
    } catch (error) {
      console.error('Error fetching today\'s admissions:', error);
      throw error;
    }
  }

  async getTodayDischarges(): Promise<any[]> {
    try {
      // Use Indian timezone (UTC+5:30) for consistent date calculation
      const now = new Date();
      const indianTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      const today = indianTime.getFullYear() + '-' +
        String(indianTime.getMonth() + 1).padStart(2, '0') + '-' +
        String(indianTime.getDate()).padStart(2, '0');

      // Get discharges for today
      const admissions = db.select()
        .from(schema.admissions)
        .where(
          and(
            eq(schema.admissions.dischargeDate, today),
            eq(schema.admissions.status, 'discharged')
          )
        )
        .orderBy(desc(schema.admissions.updatedAt))
        .all();

      const dischargesWithDetails = await Promise.all(admissions.map(async (admission) => {
        // Get patient details
        const patient = db.select()
          .from(schema.patients)
          .where(eq(schema.patients.id, admission.patientId))
          .get();

        // Get doctor details
        const doctor = admission.doctorId ? db.select()
          .from(schema.doctors)
          .where(eq(schema.doctors.id, admission.doctorId))
          .get() : null;

        return {
          ...admission,
          patient,
          doctor
        };
      }));

      return dischargesWithDetails;
    } catch (error) {
      console.error('Error fetching today\'s discharges:', error);
      throw error;
    }
  }

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

  async getBackupHistory(): Promise<any[]> {
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
      this.db.insert(schema.activities).values({
        userId,
        activityType,
        title,
        description,
        entityId,
        entityType,
        metadata: metadata ? JSON.stringify(metadata) : null,
      }).run();
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }

  async getRecentActivities(limit: number = 10): Promise<any[]> {
    const activities = this.db
      .select({
        id: schema.activities.id,
        activityType: schema.activities.activityType,
        title: schema.activities.title,
        description: schema.activities.description,
        entityId: schema.activities.entityId,
        entityType: schema.activities.entityType,
        metadata: schema.activities.metadata,
        createdAt: schema.activities.createdAt,
        userName: schema.users.fullName,
      })
      .from(schema.activities)
      .leftJoin(schema.users, eq(schema.activities.userId, schema.users.id))
      .orderBy(desc(schema.activities.createdAt))
      .limit(limit)
      .all();

    return activities.map(activity => ({
      ...activity,
      metadata: activity.metadata ? JSON.parse(activity.metadata) : null,
    }));
  }
}

export const storage = new SqliteStorage();