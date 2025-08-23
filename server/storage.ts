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
  AuditLog, InsertAuditLog
} from "@shared/schema";
import { eq, desc, and, like, count, sum } from "drizzle-orm";
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
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS admissions (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        admission_id TEXT NOT NULL UNIQUE,
        patient_id TEXT NOT NULL REFERENCES patients(id),
        doctor_id TEXT REFERENCES doctors(id),
        room_number TEXT,
        ward_type TEXT,
        admission_date TEXT NOT NULL,
        discharge_date TEXT,
        status TEXT NOT NULL DEFAULT 'admitted',
        reason TEXT NOT NULL,
        diagnosis TEXT,
        notes TEXT,
        daily_cost REAL NOT NULL DEFAULT 0,
        total_cost REAL NOT NULL DEFAULT 0,
        initial_deposit REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
    // Check and create demo users
    const demoUserData = [
      { username: 'admin', password: 'admin123', fullName: 'System Administrator', role: 'admin', id: 'admin-user-id' },
      { username: 'doctor', password: 'doctor123', fullName: 'Dr. John Smith', role: 'doctor', id: 'doctor-user-id' },
      { username: 'billing', password: 'billing123', fullName: 'Billing Staff', role: 'billing_staff', id: 'billing-user-id' },
      { username: 'reception', password: 'reception123', fullName: 'Reception Staff', role: 'receptionist', id: 'reception-user-id' }
    ];

    for (const userData of demoUserData) {
      const existing = db.select().from(schema.users).where(eq(schema.users.username, userData.username)).get();
      if (!existing) {
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
  verifyPassword(password: string, hashedPassword: string): Promise<boolean>;
  hashPassword(password: string): Promise<string>;

  // Doctor management
  createDoctor(doctor: InsertDoctor): Promise<Doctor>;
  getDoctors(): Promise<Doctor[]>;
  getDoctorById(id: string): Promise<Doctor | undefined>;
  updateDoctor(id: string, doctor: Partial<InsertDoctor>): Promise<Doctor | undefined>;

  // Patient management
  createPatient(patient: InsertPatient): Promise<Patient>;
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

  // Billing
  createBill(bill: InsertBill, items: InsertBillItem[]): Promise<Bill>;
  getBills(): Promise<Bill[]>;
  getBillById(id: string): Promise<Bill | undefined>;
  getBillItems(billId: string): Promise<BillItem[]>;
  getBillsWithPatients(): Promise<any[]>;

  // Pathology order and test management
  createPathologyOrder(orderData: InsertPathologyOrder, tests: InsertPathologyTest[]): Promise<PathologyOrder>;
  getPathologyOrders(): Promise<any[]>;
  getPathologyOrderById(id: string): Promise<any>;
  getPathologyOrdersByPatient(patientId: string): Promise<PathologyOrder[]>;
  updatePathologyOrderStatus(id: string, status: string): Promise<PathologyOrder | undefined>;
  updatePathologyTestStatus(id: string, status: string, results?: string): Promise<PathologyTest | undefined>;

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

  // Dashboard stats
  getDashboardStats(): Promise<any>;

  // Audit logging
  logAction(log: InsertAuditLog): Promise<void>;
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
    const count = db.select().from(schema.admissions).all().length + 1;
    return `ADM-${year}-${count.toString().padStart(3, '0')}`;
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
    const user = db.select().from(schema.users).where(eq(schema.users.id, id)).get();
    return user;
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

  async createPatient(patient: InsertPatient): Promise<Patient> {
    const patientId = this.generatePatientId();
    const created = db.insert(schema.patients).values({
      ...patient,
      patientId,
    }).returning().get();
    return created;
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

  async createBill(bill: InsertBill, items: InsertBillItem[]): Promise<Bill> {
    const billNumber = this.generateBillNumber();
    
    return db.transaction((tx) => {
      const created = tx.insert(schema.bills).values({
        ...bill,
        billNumber,
      }).returning().get();

      const billItems = items.map(item => ({
        ...item,
        billId: created.id,
      }));

      tx.insert(schema.billItems).values(billItems);
      
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

  async createPathologyOrder(orderData: InsertPathologyOrder, tests: InsertPathologyTest[]): Promise<PathologyOrder> {
    const generatedOrderId = this.generateOrderId();
    const totalPrice = tests.reduce((total, test) => total + test.price, 0);
    
    return db.transaction((tx) => {
      // Insert the order first
      const created = tx.insert(schema.pathologyOrders).values({
        ...orderData,
        orderId: generatedOrderId,
        totalPrice,
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

  async getPathologyOrdersByPatient(patientId: string): Promise<PathologyOrder[]> {
    return db.select().from(schema.pathologyOrders)
      .where(eq(schema.pathologyOrders.patientId, patientId))
      .orderBy(desc(schema.pathologyOrders.createdAt))
      .all();
  }

  async updatePathologyOrderStatus(id: string, status: string): Promise<PathologyOrder | undefined> {
    const updated = db.update(schema.pathologyOrders)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(schema.pathologyOrders.id, id))
      .returning().get();
    return updated;
  }

  async updatePathologyTestStatus(id: string, status: string, results?: string): Promise<PathologyTest | undefined> {
    const updated = db.update(schema.pathologyTests)
      .set({ status, results, updatedAt: new Date().toISOString() })
      .where(eq(schema.pathologyTests.id, id))
      .returning().get();
    return updated;
  }

  async createPatientService(service: InsertPatientService): Promise<PatientService> {
    const serviceId = `SRV-${Date.now()}`;
    const created = db.insert(schema.patientServices).values({
      ...service,
      serviceId,
    }).returning().get();
    return created;
  }

  async getPatientServices(patientId?: string): Promise<PatientService[]> {
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
    const created = db.insert(schema.admissions).values({
      ...admission,
      admissionId,
    }).returning().get();
    
    // Increment occupied beds for the room type
    if (admission.wardType) {
      const roomType = db.select().from(schema.roomTypes)
        .where(eq(schema.roomTypes.name, admission.wardType))
        .get();
      
      if (roomType) {
        db.update(schema.roomTypes)
          .set({ 
            occupiedBeds: (roomType.occupiedBeds || 0) + 1,
            updatedAt: new Date().toISOString()
          })
          .where(eq(schema.roomTypes.id, roomType.id))
          .run();
      }
    }
    
    return created;
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
      if (currentAdmission.wardType) {
        const roomType = db.select().from(schema.roomTypes)
          .where(eq(schema.roomTypes.name, currentAdmission.wardType))
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
    
    return updated;
  }

  async logAction(log: InsertAuditLog): Promise<void> {
    db.insert(schema.auditLog).values(log);
  }

  async getDashboardStats(): Promise<any> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get OPD patient count for today
      const opdPatients = db.select()
        .from(schema.patientServices)
        .where(
          and(
            eq(schema.patientServices.serviceType, 'opd'),
            eq(schema.patientServices.scheduledDate, today)
          )
        ).all();

      // Get total revenue for today (you can expand this based on your billing system)
      const todayRevenue = 0; // Placeholder - implement based on your billing logic
      
      // Get pending bills count
      const pendingBills = 0; // Placeholder - implement based on your billing logic
      
      // Get lab tests count
      const labTests = db.select()
        .from(schema.pathologyOrders)
        .where(eq(schema.pathologyOrders.orderedDate, today))
        .all().length;

      return {
        todayRevenue,
        pendingBills,
        opdPatients: opdPatients.length,
        labTests
      };
    } catch (error) {
      console.error('Dashboard stats error:', error);
      return {
        todayRevenue: 0,
        pendingBills: 0,
        opdPatients: 0,
        labTests: 0
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
}

export const storage = new SqliteStorage();
