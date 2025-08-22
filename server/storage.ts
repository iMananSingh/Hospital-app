import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@shared/schema";
import type { 
  User, InsertUser, Doctor, InsertDoctor, Patient, InsertPatient,
  PatientVisit, InsertPatientVisit, Service, InsertService,
  Bill, InsertBill, BillItem, InsertBillItem,
  PathologyOrder, InsertPathologyOrder, PathologyTest, InsertPathologyTest, 
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
    const demoServiceData = [
      { id: 'service-consultation', name: 'General Consultation', category: 'consultation', price: 500, description: 'General medical consultation' },
      { id: 'service-blood-test', name: 'Complete Blood Count', category: 'pathology', price: 300, description: 'CBC blood test' },
      { id: 'service-xray', name: 'X-Ray Chest', category: 'radiology', price: 800, description: 'Chest X-Ray examination' }
    ];

    for (const serviceData of demoServiceData) {
      const existing = db.select().from(schema.services).where(eq(schema.services.id, serviceData.id)).get();
      if (!existing) {
        db.insert(schema.services).values({
          ...serviceData,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).run();
        console.log(`Created demo service: ${serviceData.name}`);
      }
    }

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
    const orderId = this.generateOrderId();
    const totalPrice = tests.reduce((total, test) => total + test.price, 0);
    
    return db.transaction((tx) => {
      const created = tx.insert(schema.pathologyOrders).values({
        ...orderData,
        orderId,
        totalPrice,
      }).returning().get();

      tests.forEach(test => {
        tx.insert(schema.pathologyTests).values({
          ...test,
          orderId: created.id,
        });
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

  async getDashboardStats(): Promise<any> {
    const today = new Date().toISOString().split('T')[0];
    
    // Today's revenue
    const todayBills = db.select({ total: sum(schema.bills.totalAmount) })
      .from(schema.bills)
      .where(eq(schema.bills.billDate, today))
      .get();

    // Pending bills count
    const pendingBills = db.select({ count: count() })
      .from(schema.bills)
      .where(eq(schema.bills.paymentStatus, 'pending'))
      .get();

    // Today's OPD patients
    const todayOPD = db.select({ count: count() })
      .from(schema.patientVisits)
      .where(
        and(
          eq(schema.patientVisits.visitType, 'opd'),
          eq(schema.patientVisits.visitDate, today)
        )
      )
      .get();

    // Completed lab tests today
    const todayLabs = db.select({ count: count() })
      .from(schema.pathologyOrders)
      .where(
        and(
          eq(schema.pathologyOrders.status, 'completed'),
          eq(schema.pathologyOrders.reportDate, today)
        )
      )
      .get();

    return {
      todayRevenue: todayBills?.total || 0,
      pendingBills: pendingBills?.count || 0,
      opdPatients: todayOPD?.count || 0,
      labTests: todayLabs?.count || 0,
    };
  }

  async logAction(log: InsertAuditLog): Promise<void> {
    db.insert(schema.auditLog).values(log);
  }
}

export const storage = new SqliteStorage();
