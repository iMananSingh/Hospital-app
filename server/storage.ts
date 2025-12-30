import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@shared/schema";
import { calculateStayDays } from "@shared/schema";
import type {
  User,
  InsertUser,
  Doctor,
  InsertDoctor,
  Patient,
  InsertPatient,
  PatientVisit,
  InsertPatientVisit,
  Service,
  InsertService,
  Bill,
  InsertBill,
  BillItem,
  InsertBillItem,
  PathologyOrder,
  InsertPathologyOrder,
  PathologyTest,
  InsertPathologyTest,
  PatientService,
  InsertPatientService,
  Admission,
  InsertAdmission,
  AdmissionEvent,
  InsertAdmissionEvent,
  AdmissionService,
  InsertAdmissionService,
  AuditLog,
  InsertAuditLog,
  PathologyCategory,
  InsertPathologyCategory,
  PathologyCategoryTest,
  InsertPathologyCategoryTest,
  Activity,
  InsertActivity,
  PatientPayment,
  InsertPatientPayment,
  PatientDiscount,
  InsertPatientDiscount,
  PatientRefund,
  InsertPatientRefund,
  ServiceCategory,
  InsertServiceCategory,
  DoctorServiceRate,
  InsertDoctorServiceRate,
  DoctorEarning,
  InsertDoctorEarning,
  DoctorPayment,
  InsertDoctorPayment,
  ScheduleEvent,
  InsertScheduleEvent,
} from "@shared/schema";
import {
  eq,
  gte,
  lte,
  and,
  desc,
  asc,
  isNull,
  isNotNull,
  like,
  sql,
  ne,
  inArray,
  or,
} from "drizzle-orm";
import bcrypt from "bcrypt";
import path from "path";
import fs from "fs";

// Filter types for patient services
export interface PatientServiceFilters {
  patientId?: string;
  serviceType?: string;
  serviceTypes?: string[]; // Added for multiple service types
  fromDate?: string;
  toDate?: string;
  doctorId?: string;
  serviceName?: string;
  status?: string;
}

// Filter types for bills
export interface BillFilters {
  fromDate?: string;
  toDate?: string;
  paymentStatus?: string;
  patientId?: string;
}

// Initialize SQLite database
// In production (Fly.io), use /data volume mount. In development, use local file.
const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "hospital.db");
console.log(`Using database at: ${dbPath}`);

// Ensure directory exists for the database file
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let sqlite = new Database(dbPath);
let db = drizzle(sqlite, { schema });

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
        roles TEXT NOT NULL DEFAULT '["user"]', -- Store roles as JSON array
        primary_role TEXT NOT NULL, -- Required: for quick access to a primary role
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
        profile_picture TEXT,
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
        status TEXT NOT NULL DEFAULT 'scheduled',
        admission_date TEXT,
        discharge_date TEXT,
        room_number TEXT,
        scheduled_date TEXT,
        scheduled_time TEXT DEFAULT '09:00',
        consultation_fee REAL NOT NULL DEFAULT 0,
        receipt_number TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL,
        description TEXT,
        billing_type TEXT NOT NULL DEFAULT 'per_instance',
        billing_parameters TEXT,
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
        service_id TEXT REFERENCES services(id),
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
        order_id TEXT,
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
        billing_type TEXT NOT NULL DEFAULT 'per_instance',
        billing_quantity REAL DEFAULT 1,
        billing_parameters TEXT,
        calculated_amount REAL NOT NULL DEFAULT 0,
        receipt_number TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Add order_id column to existing patient_services table if it doesn't exist
      PRAGMA table_info(patient_services);
    `);

    // Check if order_id column exists and add it if it doesn't
    const columns = sqlite.prepare("PRAGMA table_info(patient_services)").all();
    const hasOrderId = columns.some((col: any) => col.name === "order_id");

    if (!hasOrderId) {
      sqlite.exec("ALTER TABLE patient_services ADD COLUMN order_id TEXT;");
      console.log("Added order_id column to patient_services table");
    }

    sqlite.exec(`

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
        name TEXT NOT NULL DEFAULT 'HMSync Hospital',
        address TEXT NOT NULL DEFAULT '123 Healthcare Street, Medical District, City - 123456',
        phone TEXT NOT NULL DEFAULT '+91 98765 43210',
        email TEXT NOT NULL DEFAULT 'info@hmsync.com',
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

      CREATE TABLE IF NOT EXISTS admission_services (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        admission_id TEXT NOT NULL REFERENCES admissions(id),
        service_id TEXT NOT NULL REFERENCES services(id),
        patient_id TEXT NOT NULL REFERENCES patients(id),
        doctor_id TEXT REFERENCES doctors(id),
        service_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'scheduled',
        scheduled_date TEXT NOT NULL,
        scheduled_time TEXT NOT NULL DEFAULT '09:00',
        completed_date TEXT,
        notes TEXT,
        price REAL NOT NULL DEFAULT 0,
        billing_type TEXT NOT NULL DEFAULT 'per_date',
        billing_quantity REAL DEFAULT 1,
        calculated_amount REAL NOT NULL DEFAULT 0,
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

      CREATE TABLE IF NOT EXISTS pathology_categories (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS pathology_category_tests (
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
        username TEXT NOT NULL,
        action TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        old_values TEXT,
        new_values TEXT,
        changed_fields TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS audit_log_backup (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id),
        username TEXT NOT NULL,
        action TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        old_values TEXT,
        new_values TEXT,
        changed_fields TEXT,
        ip_address TEXT,
        user_agent TEXT,
        fiscal_year TEXT NOT NULL,
        archived_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL
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
        fiscal_year_start_month INTEGER NOT NULL DEFAULT 4,
        fiscal_year_start_day INTEGER NOT NULL DEFAULT 1,
        audit_log_retention_years INTEGER NOT NULL DEFAULT 7,
        last_audit_archive_date TEXT,
        timezone TEXT DEFAULT 'UTC',
        timezone_offset TEXT DEFAULT '+00:00',
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
        billable_type TEXT,
        billable_id TEXT,
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

      CREATE TABLE IF NOT EXISTS patient_refunds (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        refund_id TEXT NOT NULL UNIQUE,
        patient_id TEXT NOT NULL REFERENCES patients(id),
        amount REAL NOT NULL,
        refund_method TEXT NOT NULL,
        refund_date TEXT NOT NULL,
        reason TEXT,
        original_billable_item_id TEXT,
        receipt_number TEXT,
        processed_by TEXT NOT NULL REFERENCES users(id),
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

      CREATE TABLE IF NOT EXISTS doctor_service_rates (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        doctor_id TEXT NOT NULL REFERENCES doctors(id),
        service_id TEXT REFERENCES services(id),
        service_name TEXT NOT NULL,
        service_category TEXT NOT NULL,
        rate_type TEXT NOT NULL DEFAULT 'per_instance',
        rate_amount REAL NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        notes TEXT,
        created_by TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS doctor_earnings (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        earning_id TEXT NOT NULL UNIQUE,
        doctor_id TEXT NOT NULL REFERENCES doctors(id),
        patient_id TEXT NOT NULL REFERENCES patients(id),
        service_id TEXT NOT NULL REFERENCES services(id),
        patient_service_id TEXT REFERENCES patient_services(id),
        service_name TEXT NOT NULL,
        service_category TEXT NOT NULL,
        service_date TEXT NOT NULL,
        rate_type TEXT NOT NULL,
        rate_amount REAL NOT NULL,
        service_price REAL NOT NULL,
        earned_amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS doctor_payments (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        payment_id TEXT NOT NULL UNIQUE,
        doctor_id TEXT NOT NULL REFERENCES doctors(id),
        payment_date TEXT NOT NULL,
        total_amount REAL NOT NULL,
        payment_method TEXT NOT NULL,
        earnings_included TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        description TEXT,
        processed_by TEXT NOT NULL REFERENCES users(id),
        receipt_number TEXT,
        notes TEXT,
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

    // Add billing columns to services table if they don't exist
    try {
      db.$client.exec(`
        ALTER TABLE services ADD COLUMN billing_type TEXT DEFAULT 'per_instance';
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    try {
      db.$client.exec(`
        ALTER TABLE services ADD COLUMN billing_parameters TEXT;
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    // Add billing columns to patient_services table if they don't exist
    try {
      db.$client.exec(`
        ALTER TABLE patient_services ADD COLUMN billing_type TEXT DEFAULT 'per_instance';
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    try {
      db.$client.exec(`
        ALTER TABLE patient_services ADD COLUMN billing_quantity REAL DEFAULT 1;
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    try {
      db.$client.exec(`
        ALTER TABLE patient_services ADD COLUMN billing_parameters TEXT;
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    try {
      db.$client.exec(`
        ALTER TABLE patient_services ADD COLUMN calculated_amount REAL DEFAULT 0;
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    // Add consultation_fee column to patient_visits table if it doesn't exist
    try {
      db.$client.exec(`
        ALTER TABLE patient_visits ADD COLUMN consultation_fee REAL DEFAULT 0;
      `);
      console.log("Added consultation_fee column to patient_visits table");
    } catch (error) {
      // Column already exists, ignore error
    }

    // Add receipt_number column to patient_visits table if it doesn't exist
    try {
      db.$client.exec(`
        ALTER TABLE patient_visits ADD COLUMN receipt_number TEXT;
      `);
      console.log("Added receipt_number column to patient_visits table");
    } catch (error) {
      // Column already exists, ignore error
    }

    // Add profile_picture column to users table if it doesn't exist
    try {
      db.$client.exec(`
        ALTER TABLE users ADD COLUMN profile_picture TEXT;
      `);
      console.log("Added profile_picture column to users table");
    } catch (error) {
      // Column already exists, ignore error
    }

    // Add profile_picture column to doctors table if it doesn't exist
    try {
      db.$client.exec(`
        ALTER TABLE doctors ADD COLUMN profile_picture TEXT;
      `);
      console.log("Added profile_picture column to doctors table");
    } catch (error) {
      // Column already exists, ignore error
    }

    // Add timezone columns to system_settings table if they don't exist
    try {
      db.$client.exec(`
        ALTER TABLE system_settings ADD COLUMN timezone TEXT DEFAULT 'UTC';
      `);
      console.log("Added timezone column to system_settings table");
    } catch (error) {
      // Column already exists, ignore error
    }

    try {
      db.$client.exec(`
        ALTER TABLE system_settings ADD COLUMN timezone_offset TEXT DEFAULT '+00:00';
      `);
      console.log("Added timezone_offset column to system_settings table");
    } catch (error) {
      // Column already exists, ignore error
    }

    // Add fiscal year columns to system_settings table if they don't exist
    try {
      db.$client.exec(`
        ALTER TABLE system_settings ADD COLUMN fiscal_year_start_month INTEGER DEFAULT 4;
      `);
      console.log(
        "Added fiscal_year_start_month column to system_settings table",
      );
    } catch (error) {
      // Column already exists, ignore error
    }

    try {
      db.$client.exec(`
        ALTER TABLE system_settings ADD COLUMN fiscal_year_start_day INTEGER DEFAULT 1;
      `);
      console.log(
        "Added fiscal_year_start_day column to system_settings table",
      );
    } catch (error) {
      // Column already exists, ignore error
    }

    try {
      db.$client.exec(`
        ALTER TABLE system_settings ADD COLUMN audit_log_retention_years INTEGER DEFAULT 7;
      `);
      console.log(
        "Added audit_log_retention_years column to system_settings table",
      );
    } catch (error) {
      // Column already exists, ignore error
    }

    try {
      db.$client.exec(`
        ALTER TABLE system_settings ADD COLUMN last_audit_archive_date TEXT;
      `);
      console.log(
        "Added last_audit_archive_date column to system_settings table",
      );
    } catch (error) {
      // Column already exists, ignore error
    }

    // Add backup configuration columns to system_settings table if they don't exist
    try {
      db.$client.exec(`
        ALTER TABLE system_settings ADD COLUMN backup_day TEXT DEFAULT 'Sunday';
      `);
      console.log("Added backup_day column to system_settings table");
    } catch (error) {
      // Column already exists, ignore error
    }

    try {
      db.$client.exec(`
        ALTER TABLE system_settings ADD COLUMN backup_date TEXT DEFAULT '1';
      `);
      console.log("Added backup_date column to system_settings table");
    } catch (error) {
      // Column already exists, ignore error
    }

    // Add new columns to audit_log table if they don't exist
    try {
      db.$client.exec(`
        ALTER TABLE audit_log ADD COLUMN username TEXT DEFAULT '';
      `);
      console.log("Added username column to audit_log table");
    } catch (error) {
      // Column already exists, ignore error
    }

    try {
      db.$client.exec(`
        ALTER TABLE audit_log ADD COLUMN changed_fields TEXT;
      `);
      console.log("Added changed_fields column to audit_log table");
    } catch (error) {
      // Column already exists, ignore error
    }

    // Add service_id column to pathology_tests table for doctor rate lookup
    try {
      db.$client.exec(`
        ALTER TABLE pathology_tests ADD COLUMN service_id TEXT REFERENCES services(id);
      `);
      console.log("Added service_id column to pathology_tests table");
    } catch (error) {
      // Column already exists, ignore error
    }

    // Add billable_type and billable_id columns to patient_payments table
    try {
      db.$client.exec(`
        ALTER TABLE patient_payments ADD COLUMN billable_type TEXT;
      `);
      console.log("Added billable_type column to patient_payments table");
    } catch (error) {
      // Column already exists, ignore error
    }

    try {
      db.$client.exec(`
        ALTER TABLE patient_payments ADD COLUMN billable_id TEXT;
      `);
      console.log("Added billable_id column to patient_payments table");
    } catch (error) {
      // Column already exists, ignore error
    }

    // Migration: Make service_id nullable in doctor_service_rates table
    // This supports representative entries like pathology_lab_representative and opd_consultation_placeholder
    try {
      // Check if the table needs migration by checking the schema
      const tableInfo = db.$client.prepare(
        "PRAGMA table_info(doctor_service_rates);"
      ).all() as Array<{ name: string; notnull: number }>;

      const serviceIdColumn = tableInfo.find(col => col.name === 'service_id');

      // If service_id is NOT NULL (notnull === 1), we need to recreate the table
      if (serviceIdColumn && serviceIdColumn.notnull === 1) {
        console.log("Migrating doctor_service_rates table to make service_id nullable...");

        db.$client.exec(`
          -- Create new table with nullable service_id
          CREATE TABLE doctor_service_rates_new (
            id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
            doctor_id TEXT NOT NULL REFERENCES doctors(id),
            service_id TEXT REFERENCES services(id),
            service_name TEXT NOT NULL,
            service_category TEXT NOT NULL,
            rate_type TEXT NOT NULL DEFAULT 'per_instance',
            rate_amount REAL NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            notes TEXT,
            created_by TEXT NOT NULL REFERENCES users(id),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          );

          -- Copy existing data
          INSERT INTO doctor_service_rates_new 
          SELECT * FROM doctor_service_rates;

          -- Drop old table
          DROP TABLE doctor_service_rates;

          -- Rename new table
          ALTER TABLE doctor_service_rates_new RENAME TO doctor_service_rates;
        `);

        console.log("Successfully migrated doctor_service_rates table - service_id is now nullable");
      }
    } catch (error) {
      console.error("Error migrating doctor_service_rates table:", error);
      // Don't throw - allow app to continue even if migration fails
    }

    // Create indexes for audit_log table for better query performance
    try {
      db.$client.exec(`
        CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
      `);
      console.log("Created index on audit_log.user_id");
    } catch (error) {
      // Index already exists, ignore error
    }

    try {
      db.$client.exec(`
        CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);
      `);
      console.log("Created index on audit_log.table_name");
    } catch (error) {
      // Index already exists, ignore error
    }

    try {
      db.$client.exec(`
        CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
      `);
      console.log("Created index on audit_log.action");
    } catch (error) {
      // Index already exists, ignore error
    }

    try {
      db.$client.exec(`
        CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
      `);
      console.log("Created index on audit_log.created_at");
    } catch (error) {
      // Index already exists, ignore error
    }

    try {
      db.$client.exec(`
        CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON audit_log(record_id);
      `);
      console.log("Created index on audit_log.record_id");
    } catch (error) {
      // Index already exists, ignore error
    }

    // Create indexes for audit_log_backup table
    try {
      db.$client.exec(`
        CREATE INDEX IF NOT EXISTS idx_audit_log_backup_user_id ON audit_log_backup(user_id);
      `);
      console.log("Created index on audit_log_backup.user_id");
    } catch (error) {
      // Index already exists, ignore error
    }

    try {
      db.$client.exec(`
        CREATE INDEX IF NOT EXISTS idx_audit_log_backup_table_name ON audit_log_backup(table_name);
      `);
      console.log("Created index on audit_log_backup.table_name");
    } catch (error) {
      // Index already exists, ignore error
    }

    try {
      db.$client.exec(`
        CREATE INDEX IF NOT EXISTS idx_audit_log_backup_fiscal_year ON audit_log_backup(fiscal_year);
      `);
      console.log("Created index on audit_log_backup.fiscal_year");
    } catch (error) {
      // Index already exists, ignore error
    }

    try {
      db.$client.exec(`
        CREATE INDEX IF NOT EXISTS idx_audit_log_backup_created_at ON audit_log_backup(created_at);
      `);
      console.log("Created index on audit_log_backup.created_at");
    } catch (error) {
      // Index already exists, ignore error
    }

    // Migration: Move existing admission services from patient_services to admission_services
    try {
      // Check if migration is needed by looking for admission-type services in patient_services
      const admissionServicesCount = db.$client.prepare(`
        SELECT COUNT(*) as count FROM patient_services WHERE service_type = 'admission'
      `).get() as { count: number };

      if (admissionServicesCount.count > 0) {
        console.log(`Found ${admissionServicesCount.count} admission services in patient_services. Starting migration...`);

        // Get all admission services from patient_services
        const admissionServicesToMigrate = db.$client.prepare(`
          SELECT 
            ps.*,
            a.id as matching_admission_id
          FROM patient_services ps
          LEFT JOIN admissions a ON ps.patient_id = a.patient_id 
            AND DATE(ps.scheduled_date) = DATE(a.admission_date)
          WHERE ps.service_type = 'admission'
        `).all() as Array<{
          id: string;
          service_id: string;
          patient_id: string;
          doctor_id: string | null;
          service_name: string;
          status: string;
          scheduled_date: string;
          scheduled_time: string;
          completed_date: string | null;
          notes: string | null;
          price: number;
          billing_type: string;
          billing_quantity: number;
          calculated_amount: number;
          created_at: string;
          updated_at: string;
          matching_admission_id: string | null;
        }>;

        let migratedCount = 0;
        let skippedCount = 0;

        for (const service of admissionServicesToMigrate) {
          // Find the admission for this service
          let admissionId = service.matching_admission_id;
          
          // If no matching admission by date, try to find by patient
          if (!admissionId) {
            const patientAdmission = db.$client.prepare(`
              SELECT id FROM admissions WHERE patient_id = ? ORDER BY admission_date DESC LIMIT 1
            `).get(service.patient_id) as { id: string } | undefined;
            
            if (patientAdmission) {
              admissionId = patientAdmission.id;
            }
          }

          if (admissionId) {
            // Check if already migrated - check by ID first, then by admission/service/patient combo
            const existingById = db.$client.prepare(`
              SELECT id FROM admission_services WHERE id = ?
            `).get(service.id);

            const existingByCombo = db.$client.prepare(`
              SELECT id FROM admission_services 
              WHERE admission_id = ? AND service_id = ? AND patient_id = ?
            `).get(admissionId, service.service_id, service.patient_id);

            if (!existingById && !existingByCombo) {
              // Insert into admission_services
              db.$client.prepare(`
                INSERT INTO admission_services (
                  id, admission_id, service_id, patient_id, doctor_id, service_name,
                  status, scheduled_date, scheduled_time, completed_date, notes,
                  price, billing_type, billing_quantity, calculated_amount,
                  created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                service.id,
                admissionId,
                service.service_id,
                service.patient_id,
                service.doctor_id,
                service.service_name,
                service.status,
                service.scheduled_date,
                service.scheduled_time,
                service.completed_date,
                service.notes,
                service.price,
                service.billing_type || 'per_date',
                service.billing_quantity || 1,
                service.calculated_amount || service.price,
                service.created_at,
                service.updated_at
              );
              migratedCount++;
            } else {
              // Already migrated - just count as skipped
              skippedCount++;
            }

            // Always delete the original record from patient_services if it exists
            db.$client.prepare(`
              DELETE FROM patient_services WHERE id = ?
            `).run(service.id);
          } else {
            console.log(`Could not find admission for patient ${service.patient_id} - skipping service ${service.id}`);
            skippedCount++;
          }
        }

        console.log(`Migration complete: ${migratedCount} services migrated, ${skippedCount} skipped`);
      }
    } catch (error) {
      console.error("Error migrating admission services:", error);
      // Don't throw - allow app to continue even if migration fails
    }

    // Always ensure demo users and data exist on every restart
    await createDemoData();

    // Ensure Root user has super_user role
    await ensureRootUserSuperRole();

    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

// Ensure Root user has super_user role
async function ensureRootUserSuperRole() {
  try {
    // Check if root user exists
    const rootUser = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, "root"))
      .get();

    if (!rootUser) {
      // Create root user with super_user role
      const hashedPassword = await bcrypt.hash("root123", 10);
      const rolesJson = JSON.stringify(["super_user"]);
      db.insert(schema.users)
        .values({
          id: "root-user-id",
          username: "root",
          password: hashedPassword,
          fullName: "Root User",
          roles: rolesJson,
          primaryRole: "super_user",
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .run();
      console.log("Created Root user with super_user role");
    } else {
      // Update existing root user to have super_user role if it doesn't already
      const currentRoles = JSON.parse(rootUser.roles);
      if (
        !currentRoles.includes("super_user") ||
        rootUser.primaryRole !== "super_user"
      ) {
        const updatedRoles = JSON.stringify(["super_user"]);
        db.update(schema.users)
          .set({
            roles: updatedRoles,
            primaryRole: "super_user",
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.users.id, rootUser.id))
          .run();
        console.log("Updated Root user to have super_user role");
      }
    }
  } catch (error) {
    console.error("Error ensuring Root user super role:", error);
  }
}

// Demo data creation function
async function createDemoData() {
  try {
    // Check and create demo users (only create if they've never existed before)
    const demoUserData = [
      {
        username: "doctor",
        password: "doctor123",
        fullName: "Dr. John Smith",
        roles: ["doctor", "billing_staff"], // Multiple roles
        primaryRole: "doctor",
        id: "doctor-user-id",
      },
      {
        username: "billing",
        password: "billing123",
        fullName: "Billing Staff",
        roles: ["billing_staff"],
        primaryRole: "billing_staff",
        id: "billing-user-id",
      },
      {
        username: "reception",
        password: "reception123",
        fullName: "Reception Staff",
        roles: ["receptionist"],
        primaryRole: "receptionist",
        id: "reception-user-id",
      },
    ];

    for (const userData of demoUserData) {
      // Check if user exists by ID (this will be null if user was deleted)
      const existing = db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userData.id))
        .get();
      if (!existing) {
        // Only create if it's the first time the system is running (no users exist at all)
        const allUsers = db.select().from(schema.users).all();
        if (allUsers.length <= 1) {
          // Allow for root user existence
          const hashedPassword = await bcrypt.hash(userData.password, 10);
          const rolesJson = JSON.stringify(userData.roles);
          db.insert(schema.users)
            .values({
              id: userData.id,
              username: userData.username,
              password: hashedPassword,
              fullName: userData.fullName,
              roles: rolesJson, // Store roles as JSON string
              primaryRole: userData.primaryRole,
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
            .run();
          console.log(`Created demo user: ${userData.username}`);
        }
      }
    }

    // Check and create demo doctor profile
    const existingDoctor = db
      .select()
      .from(schema.doctors)
      .where(eq(schema.doctors.id, "doctor-profile-id"))
      .get();
    if (!existingDoctor) {
      // Ensure the doctor user exists first
      const doctorUser = db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, "doctor-user-id"))
        .get();
      if (doctorUser) {
        db.insert(schema.doctors)
          .values({
            id: "doctor-profile-id",
            userId: "doctor-user-id",
            name: "Dr. John Smith",
            specialization: "General Medicine",
            qualification: "MBBS, MD",
            consultationFee: 500,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .run();
        console.log("Created demo doctor profile");
      } else {
        console.log(
          "Skipping demo doctor profile creation - doctor user not found",
        );
      }
    }

    // Check and create pathology_test_placeholder service (for doctor earnings)
    const existingPathologyService = db
      .select()
      .from(schema.services)
      .where(eq(schema.services.id, "pathology_test_placeholder"))
      .get();
    if (!existingPathologyService) {
      db.insert(schema.services)
        .values({
          id: "pathology_test_placeholder",
          name: "Pathology Lab (All Tests)",
          category: "pathology",
          price: 0,
          description:
            "Placeholder for doctor-specific pathology lab fees",
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .run();
      console.log("Created pathology_test_placeholder service");
    }

    // Check and create opd_consultation_placeholder service (for doctor earnings)
    const existingOpdService = db
      .select()
      .from(schema.services)
      .where(eq(schema.services.id, "opd_consultation_placeholder"))
      .get();
    if (!existingOpdService) {
      db.insert(schema.services)
        .values({
          id: "opd_consultation_placeholder",
          name: "OPD Consultation",
          category: "opd",
          price: 0,
          description:
            "Placeholder for doctor-specific OPD consultation fees",
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .run();
      console.log("Created opd_consultation_placeholder service");
    }

    // Create demo pathology categories and tests
    const existingDemoCat1 = db
      .select()
      .from(schema.pathologyCategories)
      .where(eq(schema.pathologyCategories.name, "demo category 1"))
      .get();
    if (!existingDemoCat1) {
      const cat1Id = db.insert(schema.pathologyCategories)
        .values({
          name: "demo category 1",
          description: "Demo pathology category 1",
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .returning({ id: schema.pathologyCategories.id })
        .get();

      if (cat1Id) {
        // Add demo tests for category 1
        db.insert(schema.pathologyCategoryTests)
          .values([
            {
              categoryId: cat1Id.id,
              testName: "demo test 1",
              price: 100,
              description: "First demo test",
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              categoryId: cat1Id.id,
              testName: "demo test 2",
              price: 150,
              description: "Second demo test",
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ])
          .run();
        console.log("Created demo category 1 with 2 tests");
      }
    }

    // Create demo category 2 (empty)
    const existingDemoCat2 = db
      .select()
      .from(schema.pathologyCategories)
      .where(eq(schema.pathologyCategories.name, "demo category 2"))
      .get();
    if (!existingDemoCat2) {
      db.insert(schema.pathologyCategories)
        .values({
          name: "demo category 2",
          description: "Demo pathology category 2",
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .run();
      console.log("Created demo category 2 (empty)");
    }

    console.log("Demo data verification completed");
  } catch (error) {
    console.error("Error creating demo data:", error);
  }
}

// IMPORTANT: All timestamps in the database are stored in UTC.
// The server should NOT format timestamps for display - that's the frontend's job.
// The frontend uses Intl.DateTimeFormat with the configured IANA timezone to
// correctly handle timezone conversion including DST.
//
// This file intentionally does NOT include a server-side formatting function
// to prevent double-offset issues. If you need to format timestamps on the server
// (e.g., for exports), use a proper library like date-fns-tz or Luxon.

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
  createDoctor(doctor: InsertDoctor, userId?: string): Promise<Doctor>;
  getDoctors(): Promise<Doctor[]>;
  getDoctorById(id: string): Promise<Doctor | undefined>;
  updateDoctor(
    id: string,
    doctor: Partial<InsertDoctor>,
  ): Promise<Doctor | undefined>;
  updateDoctorProfilePicture(
    id: string,
    profilePicture: string,
    userId?: string,
  ): Promise<Doctor | undefined>;
  deleteDoctor(id: string, userId?: string): Promise<Doctor | undefined>; // Added deleteDoctor
  restoreDoctor(id: string, userId?: string): Promise<Doctor | undefined>;
  permanentlyDeleteDoctor(id: string): Promise<Doctor | undefined>;

  // Patient management
  createPatient(patient: InsertPatient, userId?: string): Promise<Patient>;
  getPatients(): Promise<Patient[]>;
  getPatientById(id: string): Promise<Patient | undefined>;
  searchPatients(query: string): Promise<Patient[]>;
  updatePatient(
    id: string,
    patient: Partial<InsertPatient>,
  ): Promise<Patient | undefined>;

  // Patient visits
  getPatientVisits(patientId?: string): Promise<PatientVisit[]>;
  getPatientVisitById(id: string): Promise<PatientVisit | undefined>;

  // OPD visits - specific methods for OPD management
  createOpdVisit(visit: InsertPatientVisit): Promise<PatientVisit>;
  getOpdVisits(filters?: {
    doctorId?: string;
    patientId?: string;
    scheduledDate?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<any[]>;
  updateOpdVisitStatus(
    id: string,
    status: string,
  ): Promise<PatientVisit | undefined>;

  // Services
  createService(service: InsertService, userId?: string): Promise<Service>;
  getServices(): Promise<Service[]>;
  getServiceById(id: string): Promise<Service | undefined>;
  searchServices(query: string): Promise<Service[]>;
  updateService(
    id: string,
    service: InsertService,
    userId?: string,
  ): Promise<Service | undefined>;
  deleteService(id: string, userId?: string): Promise<boolean>;

  // Billing
  createBill(
    bill: InsertBill,
    items: InsertBillItem[],
    userId?: string,
  ): Promise<Bill>;
  getBills(): Promise<Bill[]>;
  getBillById(id: string): Promise<Bill | undefined>;
  getBillItems(billId: string): Promise<BillItem[]>;
  getBillsWithPatients(): Promise<any[]>;
  getBillsWithFilters(filters: BillFilters): Promise<any[]>;

  // Pathology order and test management
  createPathologyOrder(
    orderData: InsertPathologyOrder,
    tests: InsertPathologyTest[],
    userId?: string,
  ): Promise<PathologyOrder>;
  getPathologyOrders(fromDate?: string, toDate?: string): Promise<any[]>;
  getPathologyOrderById(id: string): Promise<any>;
  getPathologyOrdersByPatient(patientId: string): Promise<PathologyOrder[]>;
  updatePathologyOrderStatus(
    id: string,
    status: string,
  ): Promise<PathologyOrder | undefined>;
  updatePathologyTestStatus(
    id: string,
    status: string,
    results?: string,
    userId?: string,
  ): Promise<PathologyTest | undefined>;

  // Patient Services
  createPatientService(
    service: InsertPatientService,
    userId?: string,
  ): Promise<PatientService>;
  createPatientServicesBatch(
    services: InsertPatientService[],
    userId?: string,
  ): Promise<PatientService[]>;
  getPatientServices(patientId?: string): Promise<PatientService[]>;
  getPatientServicesWithFilters(
    filters: PatientServiceFilters,
  ): Promise<PatientService[]>;
  getPatientServiceById(id: string): Promise<PatientService | undefined>;
  updatePatientService(
    id: string,
    service: Partial<InsertPatientService>,
  ): Promise<PatientService | undefined>;

  // Patient Admissions
  createAdmission(
    admission: InsertAdmission,
    userId?: string,
  ): Promise<Admission>;
  getAdmissions(
    patientId?: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<Admission[]>;
  getAdmissionById(id: string): Promise<Admission | undefined>;
  updateAdmission(
    id: string,
    admission: Partial<InsertAdmission>,
  ): Promise<Admission | undefined>;

  // Admission Events
  createAdmissionEvent(event: InsertAdmissionEvent): Promise<AdmissionEvent>;
  getAdmissionEvents(admissionId: string): Promise<AdmissionEvent[]>;
  transferRoom(
    admissionId: string,
    roomData: { roomNumber: string; wardType: string },
    userId: string,
  ): Promise<Admission | undefined>;
  dischargePatient(
    admissionId: string,
    userId: string,
    dischargeDateTime?: string,
  ): Promise<Admission | undefined>;

  // Admission Services (separate from patient_services)
  createAdmissionService(
    service: InsertAdmissionService,
    userId?: string,
  ): Promise<AdmissionService>;
  createAdmissionServicesBatch(
    services: InsertAdmissionService[],
    userId?: string,
  ): Promise<AdmissionService[]>;
  getAdmissionServices(admissionId?: string): Promise<AdmissionService[]>;
  getAdmissionServicesByPatient(patientId: string): Promise<AdmissionService[]>;
  getAdmissionServiceById(id: string): Promise<AdmissionService | undefined>;
  updateAdmissionService(
    id: string,
    service: Partial<InsertAdmissionService>,
  ): Promise<AdmissionService | undefined>;
  deleteAdmissionService(id: string): Promise<void>;

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
  logActivity(
    userId: string,
    activityType: string,
    title: string,
    description: string,
    entityId?: string,
    entityType?: string,
    metadata?: any,
  ): Promise<void>;
  getRecentActivities(limit?: number): Promise<any[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;

  // Receipt numbering
  getDailyReceiptCount(serviceType: string, date: string): Promise<number>;
  getDailyReceiptCountSync(serviceType: string, date: string): number;

  // Pathology category management
  createPathologyCategory(
    category: InsertPathologyCategory,
  ): Promise<PathologyCategory>;
  getPathologyCategories(): Promise<PathologyCategory[]>;
  getPathologyCategoryById(id: string): Promise<PathologyCategory | undefined>;
  updatePathologyCategory(
    id: string,
    category: Partial<InsertPathologyCategory>,
  ): Promise<PathologyCategory | undefined>;
  deletePathologyCategory(id: string): Promise<boolean>;

  // Dynamic pathology test management
  createPathologyCategoryTest(
    test: InsertPathologyCategoryTest,
  ): Promise<PathologyCategoryTest>;
  getPathologyCategoryTests(): Promise<PathologyCategoryTest[]>;
  getPathologyCategoryTestsByCategory(
    categoryId: string,
  ): Promise<PathologyCategoryTest[]>;
  getPathologyCategoryTestById(
    id: string,
  ): Promise<PathologyCategoryTest | undefined>;
  updatePathologyCategoryTest(
    id: string,
    test: Partial<InsertPathologyCategoryTest>,
  ): Promise<PathologyCategoryTest | undefined>;
  deletePathologyCategoryTest(id: string): Promise<boolean>;
  bulkCreatePathologyCategoryTests(
    tests: InsertPathologyCategoryTest[],
  ): Promise<PathologyCategoryTest[]>;

  // Patient Financials
  createPatientPayment(
    payment: InsertPatientPayment,
    userId?: string,
  ): Promise<PatientPayment>;
  getPatientPayments(
    patientId?: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<any[]>;
  getPatientPaymentById(id: string): Promise<PatientPayment | undefined>;
  createPatientDiscount(
    discount: InsertPatientDiscount,
    userId?: string,
  ): Promise<PatientDiscount>;
  getPatientDiscounts(patientId: string): Promise<PatientDiscount[]>;
  getPatientDiscountById(id: string): Promise<PatientDiscount | undefined>;
  getPatientBillableItems(patientId: string): Promise<any[]>;
  getPatientFinancialSummary(patientId: string): Promise<{
    totalCharges: number;
    totalPaid: number;
    totalDiscounts: number;
    balance: number;
  }>;

  // Schedule Event Management
  getAllScheduleEvents(): Promise<ScheduleEvent[]>;
  createScheduleEvent(event: InsertScheduleEvent): Promise<ScheduleEvent>;
  updateScheduleEvent(
    id: string,
    event: Partial<InsertScheduleEvent>,
  ): Promise<ScheduleEvent | undefined>;
  deleteScheduleEvent(id: string): Promise<void>;
  getScheduleEventsByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ScheduleEvent[]>;
  getScheduleEventsByDoctor(doctorId: string): Promise<ScheduleEvent[]>;

  // Inpatient Management Detail Methods
  getBedOccupancyDetails(): Promise<any[]>;
  getCurrentlyAdmittedPatients(): Promise<any[]>;
  getTodayAdmissions(): Promise<any[]>;
  getTodayDischarges(): Promise<any[]>;

  // Service Category Management
  getServiceCategories(): Promise<ServiceCategory[]>;
  createServiceCategory(
    category: InsertServiceCategory,
  ): Promise<ServiceCategory>;
  updateServiceCategory(
    id: string,
    category: Partial<InsertServiceCategory>,
  ): Promise<ServiceCategory | undefined>;
  deleteServiceCategory(id: string): Promise<boolean>;

  // Comprehensive Bill Generation
  generateComprehensiveBill(patientId: string): Promise<any>;

  // Doctor Salary Management
  createDoctorServiceRate(
    rate: InsertDoctorServiceRate,
  ): Promise<DoctorServiceRate>;
  getDoctorServiceRates(doctorId?: string): Promise<DoctorServiceRate[]>;
  getDoctorServiceRateById(id: string): Promise<DoctorServiceRate | undefined>;
  updateDoctorServiceRate(
    id: string,
    rate: Partial<InsertDoctorServiceRate>,
  ): Promise<DoctorServiceRate | undefined>;
  deleteDoctorServiceRate(id: string): Promise<boolean>;

  // Doctor Earnings Management
  createDoctorEarning(earning: InsertDoctorEarning): Promise<DoctorEarning>;
  getDoctorEarnings(
    doctorId?: string,
    status?: string,
  ): Promise<DoctorEarning[]>;
  getDoctorEarningById(id: string): Promise<DoctorEarning | undefined>;
  updateDoctorEarningStatus(
    id: string,
    status: string,
  ): Promise<DoctorEarning | undefined>;
  getDoctorPendingEarnings(doctorId: string): Promise<DoctorEarning[]>;
  recalculateDoctorEarnings(
    doctorId?: string,
  ): Promise<{ processed: number; created: number }>;
  saveDoctorServiceRates(
    doctorId: string,
    rates: any[],
    userId: string,
  ): Promise<void>;
  markDoctorEarningsPaid(
    doctorId: string,
    userId: string,
    paymentMethod?: string,
  ): Promise<number>;
  markEarningAsPaid(
    earningId: string,
    userId: string,
    paymentMethod?: string,
  ): Promise<DoctorEarning | undefined>;
  calculateDoctorEarningForVisit(
    visitId: string,
  ): Promise<DoctorEarning | null>;

  // Doctor Payment Management
  getAllDoctorPayments(): Promise<DoctorPayment[]>;
  getDoctorPayments(doctorId: string): Promise<DoctorPayment[]>;
}

export class SqliteStorage implements IStorage {
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private generatePatientId(): string {
    const year = new Date().getFullYear();
    const count = db.select().from(schema.patients).all().length + 1;
    return `PT-${year}-${count.toString().padStart(5, "0")}`;
  }

  private generateBillNumber(): string {
    const year = new Date().getFullYear();
    const count = db.select().from(schema.bills).all().length + 1;
    return `BILL-${year}-${count.toString().padStart(4, "0")}`;
  }

  private generateOrderId(): string {
    const year = new Date().getFullYear();
    const count = db.select().from(schema.pathologyOrders).all().length + 1;
    return `LAB-${year}-${count.toString().padStart(5, "0")}`;
  }

  generateServiceOrderId(): string {
    const year = new Date().getFullYear();
    // Parse sequence numbers from all orderIds and find the maximum
    const existingOrderIds = db
      .select({ orderId: schema.patientServices.orderId })
      .from(schema.patientServices)
      .where(isNotNull(schema.patientServices.orderId))
      .all();

    // Find the highest sequence number
    let maxSequence = 0;
    for (const row of existingOrderIds) {
      if (row.orderId) {
        // Parse format: SER-YYYY-##### or SER-YYYY-#
        const match = row.orderId.match(/SER-\d+-(\d+)/);
        if (match) {
          const sequenceNum = parseInt(match[1], 10);
          maxSequence = Math.max(maxSequence, sequenceNum);
        }
      }
    }

    // Use SER prefix with 5-digit padding (auto-expands beyond 99999)
    return `SER-${year}-${(maxSequence + 1).toString().padStart(5, "0")}`;
  }

  generateMultipleServiceOrderIds(count: number): string[] {
    const year = new Date().getFullYear();
    // Get the current highest order ID by parsing sequence numbers
    const existingOrderIds = db
      .select({ orderId: schema.patientServices.orderId })
      .from(schema.patientServices)
      .where(isNotNull(schema.patientServices.orderId))
      .all();

    // Parse sequence numbers from all orderIds and find the maximum
    let maxSequence = 0;
    for (const row of existingOrderIds) {
      if (row.orderId) {
        // Parse format: SER-YYYY-##### or SER-YYYY-#
        const match = row.orderId.match(/SER-\d+-(\d+)/);
        if (match) {
          const sequenceNum = parseInt(match[1], 10);
          maxSequence = Math.max(maxSequence, sequenceNum);
        }
      }
    }

    // Start from the next number after the highest found
    let startCount = maxSequence + 1;

    // Generate the requested number of sequential order IDs
    const generatedIds: string[] = [];
    for (let i = 0; i < count; i++) {
      generatedIds.push(`SER-${year}-${(startCount + i).toString().padStart(5, "0")}`);
    }

    return generatedIds;
  }

  private generateAdmissionId(): string {
    const year = new Date().getFullYear();
    try {
      const count = db.select().from(schema.admissions).all().length + 1;
      return `ADM-${year}-${count.toString().padStart(5, "0")}`;
    } catch (error) {
      console.error("Error querying admissions table:", error);
      // Fallback to timestamp-based ID if table query fails
      const timestamp = Date.now().toString().slice(-6);
      return `ADM-${year}-${timestamp}`;
    }
  }

  private generatePaymentId(): string {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, "0");
    const yearMonth = `${yy}${mm}`;

    try {
      // Count payments from current month only
      const startOfMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ).toISOString();
      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
      ).toISOString();

      const monthlyPayments = db
        .select()
        .from(schema.patientPayments)
        .where(
          and(
            gte(schema.patientPayments.paymentDate, startOfMonth),
            lte(schema.patientPayments.paymentDate, endOfMonth),
          ),
        )
        .all();

      const count = monthlyPayments.length + 1;
      return `PAY-${yearMonth}-${count.toString().padStart(5, "0")}`;
    } catch (error) {
      console.error("Error querying patient_payments table:", error);
      const timestamp = Date.now().toString().slice(-6);
      return `PAY-${yearMonth}-${timestamp}`;
    }
  }

  private generateDiscountId(): string {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, "0");
    const yearMonth = `${yy}${mm}`;

    try {
      // Count discounts from current month only
      const startOfMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ).toISOString();
      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
      ).toISOString();

      const monthlyDiscounts = db
        .select()
        .from(schema.patientDiscounts)
        .where(
          and(
            gte(schema.patientDiscounts.createdAt, startOfMonth),
            lte(schema.patientDiscounts.createdAt, endOfMonth),
          ),
        )
        .all();

      const count = monthlyDiscounts.length + 1;
      return `DISC-${yearMonth}-${count.toString().padStart(5, "0")}`;
    } catch (error) {
      console.error("Error querying patient_discounts table:", error);
      const timestamp = Date.now().toString().slice(-6);
      return `DISC-${yearMonth}-${timestamp}`;
    }
  }

  private generateRefundId(): string {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, "0");
    const yearMonth = `${yy}${mm}`;

    try {
      const startOfMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ).toISOString();
      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
      ).toISOString();

      const monthlyRefunds = db
        .select()
        .from(schema.patientRefunds)
        .where(
          and(
            gte(schema.patientRefunds.createdAt, startOfMonth),
            lte(schema.patientRefunds.createdAt, endOfMonth),
          ),
        )
        .all();

      const count = monthlyRefunds.length + 1;
      return `REF-${yearMonth}-${count.toString().padStart(5, "0")}`;
    } catch (error) {
      console.error("Error querying patient_refunds table:", error);
      const timestamp = Date.now().toString().slice(-6);
      return `REF-${yearMonth}-${timestamp}`;
    }
  }


  private generateEarningId(): string {
    const year = new Date().getFullYear();
    try {
      const count = db.select().from(schema.doctorEarnings).all().length + 1;
      return `EARN-${year}-${count.toString().padStart(3, "0")}`;
    } catch (error) {
      console.error("Error querying doctor_earnings table:", error);
      const timestamp = Date.now().toString().slice(-6);
      return `EARN-${year}-${timestamp}`;
    }
  }

  private generateDoctorPaymentId(): string {
    const year = new Date().getFullYear();
    try {
      const count = db.select().from(schema.doctorPayments).all().length + 1;
      return `DPAY-${year}-${count.toString().padStart(3, "0")}`;
    } catch (error) {
      console.error("Error querying doctor_payments table:", error);
      const timestamp = Date.now().toString().slice(-6);
      return `DPAY-${year}-${timestamp}`;
    }
  }

  // Calculate and create doctor earning record for a patient service
  async calculateDoctorEarning(
    patientService: PatientService,
    service?: Service,
  ): Promise<void> {
    try {
      // If service is not provided, fetch it
      let serviceData = service;
      if (!serviceData) {
        serviceData = db
          .select()
          .from(schema.services)
          .where(eq(schema.services.id, patientService.serviceId!))
          .get();
      }

      if (!serviceData) {
        console.log(
          `Cannot calculate earning - service not found for patient service ${patientService.id}`,
        );
        return;
      }

      console.log(
        `Starting earnings calculation for doctor ${patientService.doctorId}, patient service ${patientService.id}`,
      );
      console.log(
        `Service details - ID: ${serviceData.id}, Name: ${serviceData.name}, Category: ${serviceData.category}`,
      );

      // Check if earning already exists for this patient service to prevent duplicates
      const existingEarning = db
        .select()
        .from(schema.doctorEarnings)
        .where(eq(schema.doctorEarnings.patientServiceId, patientService.id))
        .get();

      if (existingEarning) {
        console.log(
          `Earning already exists for patient service ${patientService.id}, skipping creation`,
        );
        return;
      }

      // Try to find doctor service rate - First by exact serviceId match
      let doctorRate = db
        .select()
        .from(schema.doctorServiceRates)
        .where(
          and(
            eq(schema.doctorServiceRates.doctorId, patientService.doctorId!),
            eq(schema.doctorServiceRates.serviceId, serviceData.id),
            eq(schema.doctorServiceRates.isActive, true),
          ),
        )
        .orderBy(desc(schema.doctorServiceRates.createdAt))
        .get();

      // If not found by serviceId, try matching by service name and category
      if (!doctorRate) {
        console.log(
          `No exact serviceId match, trying name+category match for ${serviceData.name} in ${serviceData.category}`,
        );
        doctorRate = db
          .select()
          .from(schema.doctorServiceRates)
          .where(
            and(
              eq(schema.doctorServiceRates.doctorId, patientService.doctorId!),
              eq(schema.doctorServiceRates.serviceName, serviceData.name),
              eq(schema.doctorServiceRates.serviceCategory, serviceData.category),
              eq(schema.doctorServiceRates.isActive, true),
            ),
          )
          .orderBy(desc(schema.doctorServiceRates.createdAt))
          .get();
      }

      if (!doctorRate) {
        console.log(
          `No salary rate found for doctor ${patientService.doctorId}, service ${serviceData.name} (${serviceData.category})`,
        );
        return;
      }

      console.log(
        `Found doctor rate: ${doctorRate.rateType} = ${doctorRate.rateAmount} for service ${serviceData.name}`,
      );

      // Calculate earning amount based on rate type
      let earnedAmount = 0;
      const servicePrice =
        patientService.calculatedAmount ||
        patientService.price ||
        serviceData.price;

      if (doctorRate.rateType === "percentage") {
        earnedAmount = (servicePrice * doctorRate.rateAmount) / 100;
      } else if (doctorRate.rateType === "amount") {
        earnedAmount = doctorRate.rateAmount;
      } else if (doctorRate.rateType === "fixed_daily") {
        earnedAmount = doctorRate.rateAmount;
      }

      console.log(
        `Calculated earning: ₹${earnedAmount} (${doctorRate.rateType} of ₹${servicePrice})`,
      );

      // Create doctor earning record using the storage interface method
      await this.createDoctorEarning({
        doctorId: patientService.doctorId!,
        patientId: patientService.patientId,
        serviceId: serviceData.id,
        patientServiceId: patientService.id,
        serviceName: serviceData.name,
        serviceCategory: doctorRate.serviceCategory,
        serviceDate: patientService.scheduledDate,
        rateType: doctorRate.rateType,
        rateAmount: doctorRate.rateAmount,
        servicePrice,
        earnedAmount,
        status: "pending",
        notes: `Automatic calculation for ${serviceData.name}`,
      });

      console.log(
        `✓ Created doctor earning for doctor ${patientService.doctorId} amount ₹${earnedAmount}`,
      );
    } catch (error) {
      console.error("Error calculating doctor earning:", error);
    }
  }

  // Calculate and create doctor earning for OPD consultation from patient_visits
  private async calculateOpdEarning(patientVisit: PatientVisit): Promise<void> {
    try {
      if (
        !patientVisit.doctorId ||
        !patientVisit.consultationFee ||
        patientVisit.consultationFee === 0
      ) {
        console.log(
          `Skipping OPD earning - no doctor or zero fee for visit ${patientVisit.visitId}`,
        );
        return;
      }

      console.log(
        `Starting OPD earnings calculation for doctor ${patientVisit.doctorId}, visit ${patientVisit.visitId}`,
      );

      // Check if earning already exists for this visit to prevent duplicates
      const existingEarning = db
        .select()
        .from(schema.doctorEarnings)
        .where(
          eq(
            schema.doctorEarnings.notes,
            `OPD consultation - Visit ${patientVisit.visitId}`,
          ),
        )
        .get();

      if (existingEarning) {
        console.log(
          `Earning already exists for visit ${patientVisit.visitId}, skipping creation`,
        );
        return;
      }

      // Find doctor OPD consultation rate (get most recent if multiple exist)
      const opdRate = db
        .select()
        .from(schema.doctorServiceRates)
        .where(
          and(
            eq(schema.doctorServiceRates.doctorId, patientVisit.doctorId),
            eq(schema.doctorServiceRates.serviceCategory, "opd"),
            eq(schema.doctorServiceRates.isActive, true),
          ),
        )
        .orderBy(desc(schema.doctorServiceRates.createdAt))
        .get();

      if (!opdRate) {
        console.log(
          `No OPD consultation rate found for doctor ${patientVisit.doctorId}`,
        );
        return;
      }

      console.log(
        `Found OPD rate: ${opdRate.rateType} = ${opdRate.rateAmount}`,
      );

      // Calculate earning amount based on rate type
      let earnedAmount = 0;
      const consultationFee = patientVisit.consultationFee;

      if (opdRate.rateType === "percentage") {
        earnedAmount = (consultationFee * opdRate.rateAmount) / 100;
      } else if (opdRate.rateType === "per_instance") {
        earnedAmount = opdRate.rateAmount;
      }

      console.log(
        `Calculated OPD earning: ₹${earnedAmount} (${opdRate.rateType} of ₹${consultationFee})`,
      );

      // Create doctor earning record
      await this.createDoctorEarning({
        doctorId: patientVisit.doctorId,
        patientId: patientVisit.patientId,
        serviceId: "opd-consultation",
        patientServiceId: null,
        serviceName: "OPD Consultation",
        serviceCategory: "opd",
        serviceDate: patientVisit.scheduledDate || patientVisit.visitDate,
        rateType: opdRate.rateType,
        rateAmount: opdRate.rateAmount,
        servicePrice: consultationFee,
        earnedAmount,
        status: "pending",
        notes: `OPD consultation - Visit ${patientVisit.visitId}`,
      });

      console.log(
        `✓ Created OPD earning for doctor ${patientVisit.doctorId} amount ₹${earnedAmount}`,
      );
    } catch (error) {
      console.error("Error calculating OPD earning:", error);
    }
  }

  // Calculate and create doctor earning for pathology order (order-level, not per-test)
  async calculatePathologyOrderEarning(
    pathologyOrderId: string,
  ): Promise<void> {
    try {
      // Get pathology order
      const pathologyOrder = db
        .select()
        .from(schema.pathologyOrders)
        .where(eq(schema.pathologyOrders.id, pathologyOrderId))
        .get();

      if (!pathologyOrder) {
        console.log(`⚠️  Pathology order not found: ${pathologyOrderId}`);
        return;
      }

      if (!pathologyOrder.doctorId || !pathologyOrder.totalPrice || pathologyOrder.totalPrice === 0) {
        console.log(
          `Skipping pathology order earning - no doctor or zero total price for order ${pathologyOrder.orderId}`,
        );
        return;
      }

      console.log(
        `Starting pathology order earnings calculation for doctor ${pathologyOrder.doctorId}, order ${pathologyOrder.orderId}, total: ₹${pathologyOrder.totalPrice}`,
      );

      // Check if earning already exists for this order to prevent duplicates
      const existingEarning = db
        .select()
        .from(schema.doctorEarnings)
        .where(
          eq(
            schema.doctorEarnings.notes,
            `Pathology order - ${pathologyOrder.orderId}`,
          ),
        )
        .get();

      if (existingEarning) {
        console.log(
          `Earning already exists for order ${pathologyOrder.orderId}, skipping creation`,
        );
        return;
      }

      // Find doctor rate for pathology representative service (category='pathology', serviceId='pathology_test_placeholder')
      // Get most recent if multiple exist
      const pathologyRate = db
        .select()
        .from(schema.doctorServiceRates)
        .where(
          and(
            eq(schema.doctorServiceRates.doctorId, pathologyOrder.doctorId),
            eq(schema.doctorServiceRates.serviceCategory, "pathology"),
            eq(schema.doctorServiceRates.serviceId, "pathology_test_placeholder"),
            eq(schema.doctorServiceRates.isActive, true),
          ),
        )
        .orderBy(desc(schema.doctorServiceRates.createdAt))
        .get();

      if (!pathologyRate) {
        console.log(
          `No pathology representative rate found for doctor ${pathologyOrder.doctorId}`,
        );
        return;
      }

      console.log(
        `Found pathology rate: ${pathologyRate.rateType} = ${pathologyRate.rateAmount}`,
      );

      // Calculate earning amount based on rate type using total order amount
      let earnedAmount = 0;
      const orderTotal = pathologyOrder.totalPrice;

      if (pathologyRate.rateType === "percentage") {
        earnedAmount = (orderTotal * pathologyRate.rateAmount) / 100;
      } else if (pathologyRate.rateType === "per_instance") {
        earnedAmount = pathologyRate.rateAmount;
      }

      console.log(
        `Calculated pathology order earning: ₹${earnedAmount} (${pathologyRate.rateType} of ₹${orderTotal})`,
      );

      // Create doctor earning record
      await this.createDoctorEarning({
        doctorId: pathologyOrder.doctorId,
        patientId: pathologyOrder.patientId,
        serviceId: "pathology_test_placeholder",
        patientServiceId: null,
        serviceName: pathologyRate.serviceName || "Pathology Lab (All Tests)",
        serviceCategory: "pathology",
        serviceDate: pathologyOrder.orderedDate,
        rateType: pathologyRate.rateType,
        rateAmount: pathologyRate.rateAmount,
        servicePrice: orderTotal,
        earnedAmount,
        status: "pending",
        notes: `Pathology order - ${pathologyOrder.orderId}`,
      });

      console.log(
        `✓ Created pathology order earning for doctor ${pathologyOrder.doctorId} amount ₹${earnedAmount}`,
      );
    } catch (error) {
      console.error("Error calculating pathology order earning:", error);
    }
  }

  // Calculate and create doctor earning for service order (order-level, not per-service)
  async calculateServiceOrderEarning(
    serviceOrderId: string,
  ): Promise<void> {
    try {
      // Get all services for this order
      const services = db
        .select()
        .from(schema.patientServices)
        .where(eq(schema.patientServices.orderId, serviceOrderId))
        .all();

      if (services.length === 0) {
        console.log(`⚠️  No services found for order: ${serviceOrderId}`);
        return;
      }

      // Get the first service to check for doctor
      const firstService = services[0];

      if (!firstService.doctorId) {
        console.log(
          `Skipping service order earning - no doctor assigned for order ${serviceOrderId}`,
        );
        return;
      }

      // Calculate total price for all services in the order
      const totalPrice = services.reduce((sum, service) => sum + (service.price || 0), 0);

      if (!totalPrice || totalPrice === 0) {
        console.log(
          `Skipping service order earning - zero total price for order ${serviceOrderId}`,
        );
        return;
      }

      console.log(
        `Starting service order earnings calculation for doctor ${firstService.doctorId}, order ${serviceOrderId}, total: ₹${totalPrice}`,
      );

      // Check if earning already exists for this order to prevent duplicates
      const existingEarning = db
        .select()
        .from(schema.doctorEarnings)
        .where(
          eq(
            schema.doctorEarnings.notes,
            `Service order - ${serviceOrderId}`,
          ),
        )
        .get();

      if (existingEarning) {
        console.log(
          `Earning already exists for order ${serviceOrderId}, skipping creation`,
        );
        return;
      }

      // Get the actual service from database to find a configured rate
      const serviceData = await this.getServiceById(firstService.serviceId);
      if (!serviceData) {
        console.log(
          `No service found for serviceId: ${firstService.serviceId}`,
        );
        return;
      }

      // Find doctor rate for this specific service
      let serviceRate = db
        .select()
        .from(schema.doctorServiceRates)
        .where(
          and(
            eq(schema.doctorServiceRates.doctorId, firstService.doctorId),
            eq(schema.doctorServiceRates.serviceId, firstService.serviceId),
            eq(schema.doctorServiceRates.isActive, true),
          ),
        )
        .get();

      // If not found by exact serviceId, try matching by service name and category
      if (!serviceRate) {
        console.log(
          `No exact serviceId match, trying name+category match for ${serviceData.name} in ${serviceData.category}`,
        );
        serviceRate = db
          .select()
          .from(schema.doctorServiceRates)
          .where(
            and(
              eq(schema.doctorServiceRates.doctorId, firstService.doctorId),
              eq(schema.doctorServiceRates.serviceName, serviceData.name),
              eq(schema.doctorServiceRates.serviceCategory, serviceData.category),
              eq(schema.doctorServiceRates.isActive, true),
            ),
          )
          .get();
      }

      if (!serviceRate) {
        console.log(
          `No service rate found for doctor ${firstService.doctorId} for service ${serviceData.name} (${serviceData.category})`,
        );
        return;
      }

      console.log(
        `Found service rate: ${serviceRate.rateType} = ${serviceRate.rateAmount}`,
      );

      // Calculate earning amount based on rate type using total order amount
      let earnedAmount = 0;

      if (serviceRate.rateType === "percentage") {
        earnedAmount = (totalPrice * serviceRate.rateAmount) / 100;
      } else if (serviceRate.rateType === "amount") {
        earnedAmount = serviceRate.rateAmount;
      } else if (serviceRate.rateType === "per_instance") {
        earnedAmount = serviceRate.rateAmount;
      }

      console.log(
        `Calculated service order earning: ₹${earnedAmount} (${serviceRate.rateType} of ₹${totalPrice})`,
      );

      // Create doctor earning record
      await this.createDoctorEarning({
        doctorId: firstService.doctorId,
        patientId: firstService.patientId,
        serviceId: firstService.serviceId,
        patientServiceId: firstService.id,
        serviceName: serviceData.name,
        serviceCategory: serviceData.category,
        serviceDate: firstService.scheduledDate,
        rateType: serviceRate.rateType,
        rateAmount: serviceRate.rateAmount,
        servicePrice: totalPrice,
        earnedAmount,
        status: "pending",
        notes: `Service order - ${serviceOrderId}`,
      });

      console.log(
        `✓ Created service order earning for doctor ${firstService.doctorId} amount ₹${earnedAmount}`,
      );
    } catch (error) {
      console.error("Error calculating service order earning:", error);
    }
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async verifyPassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async createUser(userData: InsertUser): Promise<User> {
    const hashedPassword = await this.hashPassword(userData.password);

    // Convert roles array to JSON string for storage
    const rolesJson = JSON.stringify(userData.roles);

    // Set primary role to the first role in the array
    const primaryRole = Array.isArray(userData.roles)
      ? userData.roles[0]
      : userData.roles;

    const user = db
      .insert(schema.users)
      .values({
        ...userData,
        password: hashedPassword,
        roles: rolesJson,
        primaryRole: primaryRole, // Always use the calculated primaryRole
      })
      .returning()
      .get();

    // Add parsed roles array for convenience
    const userWithRoles = {
      ...user,
      rolesArray: JSON.parse(user.roles),
    };

    // Activity logging is handled in the route handler for more detailed information
    return userWithRoles;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const user = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .get();
    if (!user) return undefined;

    // Parse the roles JSON string into an array
    return {
      ...user,
      rolesArray: JSON.parse(user.roles),
    };
  }

  async getUserById(id: string): Promise<User | undefined> {
    const user = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .get();
    if (!user) return undefined;

    // Parse the roles JSON string into an array
    return {
      ...user,
      rolesArray: JSON.parse(user.roles),
    };
  }

  async getAllUsers(): Promise<User[]> {
    const users = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.isActive, true))
      .all();
    // Parse the roles JSON string into an array for each user
    return users.map((user) => ({
      ...user,
      rolesArray: JSON.parse(user.roles),
    }));
  }

  async updateUser(
    id: string,
    userData: Partial<InsertUser>,
  ): Promise<User | undefined> {
    let updateData: any = { ...userData };

    if (userData.password) {
      updateData.password = await this.hashPassword(userData.password);
    }

    // Convert roles array to JSON string if provided
    if (userData.roles) {
      updateData.roles = JSON.stringify(userData.roles);
    }

    updateData.updatedAt = new Date().toISOString();

    const user = db
      .update(schema.users)
      .set(updateData)
      .where(eq(schema.users.id, id))
      .returning()
      .get();

    if (user) {
      const userWithRoles = {
        ...user,
        rolesArray: JSON.parse(user.roles),
      };

      this.logActivity(
        "system",
        "user_updated",
        "User Updated",
        `Updated user: ${user.username} (${user.fullName})`,
        user.id,
        "user",
        {
          username: user.username,
          roles: userWithRoles.rolesArray,
          primaryRole: user.primaryRole,
        },
      );

      return userWithRoles;
    }

    return undefined;
  }

  async deleteUser(id: string, userId?: string): Promise<User | undefined> {
    try {
      // Soft delete: mark user as inactive and append timestamp to username
      const userToDelete = db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, id))
        .get();

      if (!userToDelete) {
        return undefined;
      }

      // Log activity BEFORE deleting (while user still exists)
      if (userId) {
        await this.logActivity(
          userId,
          "user_deleted",
          "User Deactivated",
          `${userToDelete.fullName} (${userToDelete.username}) was deactivated`,
          userToDelete.id,
          "user",
          {
            username: userToDelete.username,
            fullName: userToDelete.fullName,
            roles: JSON.parse(userToDelete.roles),
          },
        );
      }

      // Append timestamp to username to free it up for reuse
      const timestamp = Date.now();
      const newUsername = `${userToDelete.username}_deleted_${timestamp}`;

      const deleted = db
        .update(schema.users)
        .set({
          username: newUsername,
          isActive: false,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.users.id, id))
        .returning()
        .get();

      return deleted;
    } catch (error) {
      console.error("Error deleting user:", error);
      throw error;
    }
  }

  async createDoctor(doctor: InsertDoctor, userId?: string): Promise<Doctor> {
    const created = db.insert(schema.doctors).values(doctor).returning().get();

    // Log activity for doctor creation
    if (userId) {
      this.logActivity(
        userId,
        "doctor_created",
        "Doctor Added",
        `${created.name} - ${created.specialization}`,
        created.id,
        "doctor",
        {
          doctorName: created.name,
          specialization: created.specialization,
          consultationFee: created.consultationFee,
        },
      );

      // Audit log
      const user = await this.getUserById(userId);
      if (user) {
        await this.logAction({
          userId,
          username: user.username,
          action: "create",
          tableName: "doctors",
          recordId: created.id,
          oldValues: null,
          newValues: JSON.stringify(created),
          changedFields: JSON.stringify(Object.keys(created)),
          ipAddress: null,
          userAgent: null,
        });
      }
    }

    return created;
  }

  async getDoctors(): Promise<Doctor[]> {
    return db
      .select()
      .from(schema.doctors)
      .where(eq(schema.doctors.isActive, true))
      .all();
  }

  async getDoctorById(id: string): Promise<Doctor | undefined> {
    return db
      .select()
      .from(schema.doctors)
      .where(eq(schema.doctors.id, id))
      .get();
  }

  async updateDoctor(
    id: string,
    doctor: Partial<InsertDoctor>,
    userId?: string,
  ): Promise<Doctor | undefined> {
    // Get the original doctor data before update
    const originalDoctor = db
      .select()
      .from(schema.doctors)
      .where(eq(schema.doctors.id, id))
      .get();

    const updated = db
      .update(schema.doctors)
      .set({ ...doctor, updatedAt: new Date().toISOString() })
      .where(eq(schema.doctors.id, id))
      .returning()
      .get();

    if (updated && userId && originalDoctor) {
      // Determine what changed
      const changes: string[] = [];

      if (doctor.name && doctor.name !== originalDoctor.name) {
        changes.push(`name from "${originalDoctor.name}" to "${doctor.name}"`);
      }
      if (
        doctor.specialization &&
        doctor.specialization !== originalDoctor.specialization
      ) {
        changes.push(
          `specialization from "${originalDoctor.specialization}" to "${doctor.specialization}"`,
        );
      }
      if (
        doctor.qualification &&
        doctor.qualification !== originalDoctor.qualification
      ) {
        changes.push(
          `qualification from "${originalDoctor.qualification}" to "${doctor.qualification}"`,
        );
      }
      if (
        doctor.consultationFee !== undefined &&
        doctor.consultationFee !== originalDoctor.consultationFee
      ) {
        changes.push(
          `consultation fee from ₹${originalDoctor.consultationFee} to ₹${doctor.consultationFee}`,
        );
      }

      const changesDescription =
        changes.length > 0
          ? `Updated: ${changes.join(", ")}`
          : "Updated doctor information";

      this.logActivity(
        userId,
        "doctor_updated",
        "Doctor Updated",
        `Updated Doctor: ${updated.name} - ${changesDescription}`,
        updated.id,
        "doctor",
        {
          doctorName: updated.name,
          specialization: updated.specialization,
          changes: changes,
        },
      );
    }

    return updated;
  }

  async updateDoctorProfilePicture(
    id: string,
    profilePicture: string,
    userId?: string,
  ): Promise<Doctor | undefined> {
    const updated = db
      .update(schema.doctors)
      .set({ profilePicture, updatedAt: new Date().toISOString() })
      .where(eq(schema.doctors.id, id))
      .returning()
      .get();

    if (updated && userId) {
      this.logActivity(
        userId,
        "doctor_profile_updated",
        "Doctor Profile Updated",
        `Updated profile picture for ${updated.name}`,
        updated.id,
        "doctor",
        {
          doctorName: updated.name,
          hasProfilePicture: !!profilePicture,
        },
      );
    }

    return updated;
  }

  async deleteDoctor(id: string, userId?: string): Promise<Doctor | undefined> {
    try {
      // Soft delete by setting isActive to false instead of hard delete
      const deleted = db
        .update(schema.doctors)
        .set({
          isActive: false,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.doctors.id, id))
        .returning()
        .get();

      // Activity logging is handled in the route handler to avoid duplicates
      return deleted;
    } catch (error) {
      console.error("Error deleting doctor:", error);
      throw error;
    }
  }

  async permanentlyDeleteDoctor(
    id: string,
    userId?: string,
  ): Promise<Doctor | undefined> {
    try {
      // First, get the doctor to be deleted for returning and logging
      const doctorToDelete = db
        .select()
        .from(schema.doctors)
        .where(eq(schema.doctors.id, id))
        .get();

      if (!doctorToDelete) {
        return undefined;
      }

      // Use transaction to handle foreign key constraints
      const result = db.transaction((tx) => {
        try {
          // First, set all references to this doctor to null
          tx.update(schema.patientVisits)
            .set({ doctorId: null })
            .where(eq(schema.patientVisits.doctorId, id))
            .run();

          tx.update(schema.pathologyOrders)
            .set({ doctorId: null })
            .where(eq(schema.pathologyOrders.doctorId, id))
            .run();

          tx.update(schema.patientServices)
            .set({ doctorId: null })
            .where(eq(schema.patientServices.doctorId, id))
            .run();

          tx.update(schema.admissions)
            .set({ doctorId: null })
            .where(eq(schema.admissions.doctorId, id))
            .run();

          // Now delete the doctor record
          tx.delete(schema.doctors).where(eq(schema.doctors.id, id)).run();

          return doctorToDelete;
        } catch (transactionError) {
          console.error(
            "Transaction error during permanent delete:",
            transactionError,
          );
          throw transactionError;
        }
      });

      // Activity logging is handled in the route handler to avoid duplicates
      return result;
    } catch (error) {
      console.error("Error permanently deleting doctor:", error);
      throw error;
    }
  }

  async getDeletedDoctors(): Promise<Doctor[]> {
    return db
      .select()
      .from(schema.doctors)
      .where(eq(schema.doctors.isActive, false))
      .all();
  }

  async restoreDoctor(
    id: string,
    userId?: string,
  ): Promise<Doctor | undefined> {
    try {
      const restored = db
        .update(schema.doctors)
        .set({
          isActive: true,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.doctors.id, id))
        .returning()
        .get();

      // Log activity for doctor restoration
      if (restored && userId) {
        this.logActivity(
          userId,
          "doctor_restored",
          "Doctor Restored",
          `${restored.name} - ${restored.specialization}`,
          restored.id,
          "doctor",
          {
            doctorName: restored.name,
            specialization: restored.specialization,
          },
        );
      }

      return restored;
    } catch (error) {
      console.error("Error restoring doctor:", error);
      throw error;
    }
  }

  async permanentlyDeleteDoctor(id: string): Promise<Doctor | undefined> {
    try {
      // First, get the doctor to be deleted for returning
      const doctorToDelete = db
        .select()
        .from(schema.doctors)
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
          tx.delete(schema.doctors).where(eq(schema.doctors.id, id)).run();

          return doctorToDelete;
        } catch (transactionError) {
          console.error(
            "Transaction error during permanent delete:",
            transactionError,
          );
          throw transactionError;
        }
      });
    } catch (error) {
      console.error("Error permanently deleting doctor:", error);
      throw error;
    }
  }

  async getAllDoctorPayments(): Promise<DoctorPayment[]> {
    return db
      .select()
      .from(schema.doctorPayments)
      .orderBy(desc(schema.doctorPayments.paymentDate))
      .all();
  }

  async getDoctorPayments(doctorId: string): Promise<DoctorPayment[]> {
    return db
      .select()
      .from(schema.doctorPayments)
      .where(eq(schema.doctorPayments.doctorId, doctorId))
      .orderBy(desc(schema.doctorPayments.paymentDate))
      .all();
  }

  async getDailyPatientCount(): Promise<number> {
    try {
      const count = db.select().from(schema.patients).all().length;
      return count;
    } catch (error) {
      console.error("Error getting daily patient count:", error);
      return 0;
    }
  }

  async createPatient(
    patientData: InsertPatient,
    userId?: string,
  ): Promise<Patient> {
    // Generate patient ID
    const today = new Date();
    const year = today.getFullYear();
    const patientCount = await this.getDailyPatientCount();
    const patientId = `PT-${year}-${String(patientCount + 1).padStart(5, "0")}`;

    // Don't set createdAt or updatedAt - let the database default handle it in UTC
    const patient = db
      .insert(schema.patients)
      .values({
        ...patientData,
        patientId,
        // Explicitly omit timestamp fields to use database defaults
        createdAt: undefined,
        updatedAt: undefined,
      })
      .returning()
      .get();

    // Log activity
    if (userId) {
      this.logActivity(
        userId,
        "patient_registered",
        "New Patient Registered",
        `${patient.name} - ${patient.patientId}`,
        patient.id,
        "patient",
        {
          patientId: patient.patientId,
          age: patient.age,
          gender: patient.gender,
        },
      );

      // Audit log
      const user = await this.getUserById(userId);
      if (user) {
        await this.logAction({
          userId,
          username: user.username,
          action: "create",
          tableName: "patients",
          recordId: patient.id,
          oldValues: null,
          newValues: JSON.stringify(patient),
          changedFields: JSON.stringify(Object.keys(patient)),
          ipAddress: null,
          userAgent: null,
        });
      }
    }

    return patient;
  }

  async getPatients(): Promise<Patient[]> {
    return db
      .select()
      .from(schema.patients)
      .where(eq(schema.patients.isActive, true))
      .orderBy(desc(schema.patients.createdAt))
      .all();
  }

  async getPatientById(id: string): Promise<Patient | undefined> {
    return db
      .select()
      .from(schema.patients)
      .where(eq(schema.patients.id, id))
      .get();
  }

  async searchPatients(query: string): Promise<Patient[]> {
    return db
      .select()
      .from(schema.patients)
      .where(
        and(
          eq(schema.patients.isActive, true),
          like(schema.patients.name, `%${query}%`),
        ),
      )
      .limit(10)
      .all();
  }

  async updatePatient(
    id: string,
    patient: Partial<InsertPatient>,
    userId?: string,
  ): Promise<Patient | undefined> {
    // Get old values before update
    const oldPatient = db
      .select()
      .from(schema.patients)
      .where(eq(schema.patients.id, id))
      .get();

    const updated = db
      .update(schema.patients)
      .set({ ...patient, updatedAt: new Date().toISOString() })
      .where(eq(schema.patients.id, id))
      .returning()
      .get();

    // Audit log
    if (updated && userId && oldPatient) {
      const user = await this.getUserById(userId);
      if (user) {
        const changedFields = Object.keys(patient);
        await this.logAction({
          userId,
          username: user.username,
          action: "update",
          tableName: "patients",
          recordId: id,
          oldValues: JSON.stringify(oldPatient),
          newValues: JSON.stringify(updated),
          changedFields: JSON.stringify(changedFields),
          ipAddress: null,
          userAgent: null,
        });
      }
    }

    return updated;
  }

  async getPatientVisits(patientId?: string): Promise<PatientVisit[]> {
    if (patientId) {
      return db
        .select()
        .from(schema.patientVisits)
        .where(eq(schema.patientVisits.patientId, patientId))
        .orderBy(desc(schema.patientVisits.createdAt))
        .all();
    }
    return db
      .select()
      .from(schema.patientVisits)
      .orderBy(desc(schema.patientVisits.createdAt))
      .all();
  }

  async getPatientVisitById(id: string): Promise<PatientVisit | undefined> {
    return db
      .select()
      .from(schema.patientVisits)
      .where(eq(schema.patientVisits.id, id))
      .get();
  }

  // OPD-specific methods
  async createOpdVisit(data: InsertPatientVisit): Promise<PatientVisit> {
    try {
      // Generate visit ID with yearly count: VIS-YYYY-000001
      const year = new Date().getFullYear();
      const yearlyVisitCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(schema.patientVisits)
        .where(
          sql`strftime('%Y', ${schema.patientVisits.createdAt}) = ${year.toString()}`,
        );

      const visitCount = yearlyVisitCount[0]?.count || 0;
      const orderNumber = String(visitCount + 1).padStart(6, "0");
      const visitId = `VIS-${year}-${orderNumber}`;

      // Store the data as-is without any timezone conversion
      const result = await db
        .insert(schema.patientVisits)
        .values({
          ...data,
          id: this.generateId(),
          visitId: visitId,
          visitType: "opd",
          visitDate: data.scheduledDate || data.visitDate,
          status: "scheduled",
          consultationFee: data.consultationFee || 0,
          receiptNumber: data.receiptNumber || null, // Include receiptNumber
          // Database defaults will handle createdAt/updatedAt in UTC
        })
        .returning()
        .get();

      // Calculate doctor earning for this OPD visit
      if (
        result.doctorId &&
        result.consultationFee &&
        result.consultationFee > 0
      ) {
        await this.calculateOpdEarning(result);
      }

      return result;
    } catch (error) {
      console.error("Error creating OPD visit:", error);
      throw error;
    }
  }

  async getOpdVisits(filters?: {
    doctorId?: string;
    patientId?: string;
    scheduledDate?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<any[]> {
    const whereConditions: any[] = [eq(schema.patientVisits.visitType, "opd")];

    if (filters?.doctorId && filters.doctorId !== "all") {
      whereConditions.push(eq(schema.patientVisits.doctorId, filters.doctorId));
    }

    if (filters?.patientId) {
      whereConditions.push(
        eq(schema.patientVisits.patientId, filters.patientId),
      );
    }

    if (filters?.scheduledDate) {
      whereConditions.push(
        sql`DATE(${schema.patientVisits.scheduledDate}) = DATE(${filters.scheduledDate})`,
      );
    }

    if (filters?.status && filters.status !== "all") {
      whereConditions.push(eq(schema.patientVisits.status, filters.status));
    }

    if (filters?.fromDate) {
      whereConditions.push(
        sql`DATE(${schema.patientVisits.scheduledDate}) >= DATE(${filters.fromDate})`,
      );
    }

    if (filters?.toDate) {
      whereConditions.push(
        sql`DATE(${schema.patientVisits.scheduledDate}) <= DATE(${filters.toDate})`,
      );
    }

    // Join with patients and doctors to get their details
    const results = db
      .select({
        id: schema.patientVisits.id,
        visitId: schema.patientVisits.visitId,
        patientId: schema.patientVisits.patientId,
        doctorId: schema.patientVisits.doctorId,
        visitType: schema.patientVisits.visitType,
        visitDate: schema.patientVisits.visitDate,
        scheduledDate: schema.patientVisits.scheduledDate,
        scheduledTime: schema.patientVisits.scheduledTime,
        symptoms: schema.patientVisits.symptoms,
        diagnosis: schema.patientVisits.diagnosis,
        prescription: schema.patientVisits.prescription,
        status: schema.patientVisits.status,
        consultationFee: schema.patientVisits.consultationFee,
        receiptNumber: schema.patientVisits.receiptNumber, // Include receiptNumber
        createdAt: schema.patientVisits.createdAt,
        // Patient details
        patientName: schema.patients.name,
        patientAge: schema.patients.age,
        patientGender: schema.patients.gender,
        patientPhone: schema.patients.phone,
        patientPatientId: schema.patients.patientId,
        // Doctor details
        doctorName: schema.doctors.name,
        doctorSpecialization: schema.doctors.specialization,
        doctorConsultationFee: schema.doctors.consultationFee,
      })
      .from(schema.patientVisits)
      .leftJoin(
        schema.patients,
        eq(schema.patientVisits.patientId, schema.patients.id),
      )
      .leftJoin(
        schema.doctors,
        eq(schema.patientVisits.doctorId, schema.doctors.id),
      )
      .where(and(...whereConditions))
      .orderBy(
        desc(schema.patientVisits.scheduledDate),
        desc(schema.patientVisits.scheduledTime),
      )
      .all();

    // Ensure consultationFee is properly set - use stored fee or fallback to doctor's default
    return results.map((visit) => ({
      ...visit,
      consultationFee:
        visit.consultationFee || visit.doctorConsultationFee || 0,
    }));
  }

  async updateOpdVisitStatus(
    id: string,
    status: string,
  ): Promise<PatientVisit | undefined> {
    const updated = db
      .update(schema.patientVisits)
      .set({
        status,
        updatedAt: sql`(datetime('now'))`,
      })
      .where(
        and(
          eq(schema.patientVisits.id, id),
          eq(schema.patientVisits.visitType, "opd"),
        ),
      )
      .returning()
      .get();
    return updated;
  }

  async createService(
    service: InsertService,
    userId?: string,
  ): Promise<Service> {
    const created = db
      .insert(schema.services)
      .values(service)
      .returning()
      .get();

    if (userId) {
      this.logActivity(
        userId,
        "service_created",
        "Service Created",
        `${service.category} - ${service.name}`,
        created.id,
        "service",
        {
          serviceName: service.name,
          category: service.category,
          price: service.price,
        },
      );
    }

    return created;
  }

  async getServices(): Promise<Service[]> {
    return db
      .select()
      .from(schema.services)
      .where(eq(schema.services.isActive, true))
      .orderBy(schema.services.name)
      .all();
  }

  async getServiceById(id: string): Promise<Service | undefined> {
    return db
      .select()
      .from(schema.services)
      .where(eq(schema.services.id, id))
      .get();
  }

  async searchServices(query: string): Promise<Service[]> {
    return db
      .select()
      .from(schema.services)
      .where(
        and(
          eq(schema.services.isActive, true),
          like(schema.services.name, `%${query}%`),
        ),
      )
      .limit(20)
      .all();
  }

  async updateService(
    id: string,
    service: InsertService,
    userId?: string,
  ): Promise<Service | undefined> {
    const updated = db
      .update(schema.services)
      .set(service)
      .where(eq(schema.services.id, id))
      .returning()
      .get();

    if (userId && updated) {
      this.logActivity(
        userId,
        "service_updated",
        "Service updated",
        `${updated.name} - ${updated.category}`,
        updated.id,
        "service",
        { serviceName: updated.name, category: updated.category },
      );
    }

    return updated;
  }

  async deleteService(id: string, userId?: string): Promise<boolean> {
    const service = db
      .select()
      .from(schema.services)
      .where(eq(schema.services.id, id))
      .get();
    const result = db
      .delete(schema.services)
      .where(eq(schema.services.id, id))
      .run();

    if (userId && service && result.changes > 0) {
      this.logActivity(
        userId,
        "service_deleted",
        "Service deleted",
        `${service.name} - ${service.category}`,
        id,
        "service",
        { serviceName: service.name, category: service.category },
      );
    }

    return result.changes > 0;
  }

  async createBill(
    billData: InsertBill,
    itemsData: InsertBillItem[],
    userId?: string,
  ): Promise<Bill> {
    const billNumber = this.generateBillNumber();

    return db.transaction((tx) => {
      const created = tx
        .insert(schema.bills)
        .values({
          ...billData,
          billNumber,
        })
        .returning()
        .get();

      const billItems = itemsData.map((item) => ({
        ...item,
        billId: created.id,
      }));

      tx.insert(schema.billItems).values(billItems);

      // Log activity
      if (userId) {
        const patient = tx
          .select()
          .from(schema.patients)
          .where(eq(schema.patients.id, billData.patientId))
          .get();
        this.logActivity(
          userId,
          "bill_created",
          "New bill generated",
          `${billNumber} for ${patient?.name || "Unknown Patient"}`,
          created.id,
          "bill",
          { amount: billData.totalAmount, patientName: patient?.name },
        );
      }

      return created;
    });
  }

  async getBills(): Promise<Bill[]> {
    return db
      .select()
      .from(schema.bills)
      .orderBy(desc(schema.bills.createdAt))
      .all();
  }

  async getBillById(id: string): Promise<Bill | undefined> {
    return db.select().from(schema.bills).where(eq(schema.bills.id, id)).get();
  }

  async getBillItems(billId: string): Promise<BillItem[]> {
    return db
      .select()
      .from(schema.billItems)
      .where(eq(schema.billItems.billId, billId))
      .all();
  }

  async getBillsWithPatients(): Promise<any[]> {
    return db
      .select({
        bill: schema.bills,
        patient: schema.patients,
      })
      .from(schema.bills)
      .leftJoin(schema.patients, eq(schema.bills.patientId, schema.patients.id))
      .orderBy(desc(schema.bills.createdAt))
      .all();
  }

  async getBillsWithFilters(filters: BillFilters): Promise<any[]> {
    // Build WHERE conditions based on filters
    const whereConditions: any[] = [];

    if (filters.patientId) {
      whereConditions.push(eq(schema.bills.patientId, filters.patientId));
    }

    if (filters.paymentStatus) {
      whereConditions.push(
        eq(schema.bills.paymentStatus, filters.paymentStatus),
      );
    }

    // Date filtering - use billDate for filtering by date range
    if (filters.fromDate) {
      whereConditions.push(
        sql`DATE(${schema.bills.billDate}) >= DATE(${filters.fromDate})`,
      );
    }

    if (filters.toDate) {
      whereConditions.push(
        sql`DATE(${schema.bills.billDate}) <= DATE(${filters.toDate})`,
      );
    }

    // Build the query with all conditions
    const query = db
      .select({
        id: schema.bills.id,
        billNumber: schema.bills.billNumber,
        patientId: schema.bills.patientId,
        visitId: schema.bills.visitId,
        subtotal: schema.bills.subtotal,
        taxAmount: schema.bills.taxAmount,
        discountAmount: schema.bills.discountAmount,
        totalAmount: schema.bills.totalAmount,
        paymentMethod: schema.bills.paymentMethod,
        paymentStatus: schema.bills.paymentStatus,
        paidAmount: schema.bills.paidAmount,
        createdBy: schema.bills.createdBy,
        billDate: schema.bills.billDate,
        dueDate: schema.bills.dueDate,
        notes: schema.bills.notes,
        createdAt: schema.bills.createdAt,
        updatedAt: schema.bills.updatedAt,
        // Include patient data
        patient: {
          id: schema.patients.id,
          name: schema.patients.name,
          age: schema.patients.age,
          gender: schema.patients.gender,
          phone: schema.patients.phone,
        },
      })
      .from(schema.bills)
      .leftJoin(schema.patients, eq(schema.bills.patientId, schema.patients.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : sql`1=1`)
      .orderBy(desc(schema.bills.billDate), desc(schema.bills.createdAt));

    return query.all();
  }

  async createPathologyOrder(
    orderData: InsertPathologyOrder,
    tests: InsertPathologyTest[],
    userId?: string,
  ): Promise<PathologyOrder> {
    const generatedOrderId = this.generateOrderId();
    const totalPrice = tests.reduce((total, test) => total + test.price, 0);
    const orderedDate =
      orderData.orderedDate || new Date().toISOString().split("T")[0];

    return db.transaction((tx) => {
      // Generate proper receipt number for pathology inside transaction
      // Extract just the date part (YYYY-MM-DD) for accurate counting
      const dateOnly = orderedDate.split("T")[0];
      const count = this.getDailyReceiptCountSync("pathology", dateOnly);
      console.log(
        `[PATHOLOGY] Date: ${dateOnly}, Count from getDailyReceiptCountSync: ${count}`,
      );
      const dateObj = new Date(dateOnly);
      const yymmdd = dateObj
        .toISOString()
        .slice(2, 10)
        .replace(/-/g, "")
        .slice(0, 6);
      const receiptNumber = `${yymmdd}-PAT-${count.toString().padStart(4, "0")}`;
      console.log(`[PATHOLOGY] Generated receipt number: ${receiptNumber}`);

      // Insert the order first
      const created = tx
        .insert(schema.pathologyOrders)
        .values({
          ...orderData,
          orderId: generatedOrderId,
          totalPrice,
          receiptNumber,
        })
        .returning()
        .get();

      // Insert all tests for this order
      tests.forEach((test) => {
        // Try to find matching service for doctor rate lookup
        // Match by name and pathology category
        const matchingService = tx
          .select()
          .from(schema.services)
          .where(
            and(
              eq(schema.services.name, test.testName),
              eq(schema.services.category, "pathology"),
              eq(schema.services.isActive, true),
            ),
          )
          .get();

        if (!matchingService) {
          console.log(
            `⚠️  No matching service found for pathology test: ${test.testName} (${test.testCategory})`,
          );
        }

        tx.insert(schema.pathologyTests)
          .values({
            testName: test.testName,
            testCategory: test.testCategory,
            price: test.price,
            orderId: created.id, // Use the actual database ID, not the generated order ID
            serviceId: matchingService?.id || null, // Link to service for doctor rate lookup
            status: "ordered",
          })
          .run();
      });

      // Log activity
      if (userId) {
        const patient = tx
          .select()
          .from(schema.patients)
          .where(eq(schema.patients.id, orderData.patientId))
          .get();
        this.logActivity(
          userId,
          "lab_test_ordered",
          "Lab test ordered",
          `${generatedOrderId} for ${patient?.name || "Unknown Patient"}`,
          created.id,
          "pathology_order",
          { testCount: tests.length, patientName: patient?.name },
        );
      }

      return created;
    });
  }

  async getPathologyOrders(fromDate?: string, toDate?: string): Promise<any[]> {
    try {
      let query = db
        .select({
          order: schema.pathologyOrders,
          patient: schema.patients,
          doctor: schema.doctors,
        })
        .from(schema.pathologyOrders)
        .leftJoin(
          schema.patients,
          eq(schema.pathologyOrders.patientId, schema.patients.id),
        )
        .leftJoin(
          schema.doctors,
          eq(schema.pathologyOrders.doctorId, schema.doctors.id),
        );

      // Apply date filters if provided - use DATE() for proper comparison
      if (fromDate && toDate) {
        query = query.where(
          and(
            sql`DATE(${schema.pathologyOrders.orderedDate}) >= DATE(${fromDate})`,
            sql`DATE(${schema.pathologyOrders.orderedDate}) <= DATE(${toDate})`,
          ),
        );
      } else if (fromDate) {
        query = query.where(
          sql`DATE(${schema.pathologyOrders.orderedDate}) >= DATE(${fromDate})`,
        );
      } else if (toDate) {
        query = query.where(
          sql`DATE(${schema.pathologyOrders.orderedDate}) <= DATE(${toDate})`,
        );
      }

      return query.orderBy(desc(schema.pathologyOrders.createdAt)).all();
    } catch (error) {
      console.error("Error in getPathologyOrders:", error);
      throw error;
    }
  }

  async getPathologyOrderById(id: string): Promise<any> {
    const order = db
      .select()
      .from(schema.pathologyOrders)
      .where(eq(schema.pathologyOrders.id, id))
      .get();

    if (!order) return null;

    const tests = db
      .select()
      .from(schema.pathologyTests)
      .where(eq(schema.pathologyTests.orderId, id))
      .all();

    // Get patient info
    const patient = order.patientId
      ? db
          .select()
          .from(schema.patients)
          .where(eq(schema.patients.id, order.patientId))
          .get()
      : null;

    // Get doctor info if applicable
    const doctor = order.doctorId
      ? db
          .select()
          .from(schema.doctors)
          .where(eq(schema.doctors.id, order.doctorId))
          .get()
      : null;

    return {
      order: {
        ...order,
        tests, // Include tests in the order object for receipt generation
      },
      tests,
      patient,
      doctor,
    };
  }

  async updatePathologyOrderStatus(
    orderId: string,
    status: string,
  ): Promise<PathologyOrder | undefined> {
    const updated = db
      .update(schema.pathologyOrders)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(schema.pathologyOrders.id, orderId))
      .returning()
      .get();
    return updated;
  }

  async getPathologyOrdersByPatient(patientId: string): Promise<any[]> {
    const orders = db
      .select()
      .from(schema.pathologyOrders)
      .where(eq(schema.pathologyOrders.patientId, patientId))
      .orderBy(desc(schema.pathologyOrders.createdAt))
      .all();

    // For each order, get its associated tests
    const ordersWithTests = orders.map((order) => {
      const tests = db
        .select()
        .from(schema.pathologyTests)
        .where(eq(schema.pathologyTests.orderId, order.id))
        .all();

      return {
        order,
        tests,
      };
    });

    return ordersWithTests;
  }

  async updatePathologyTestStatus(
    testId: string,
    status: string,
    results?: string,
    userId?: string,
  ): Promise<PathologyTest | undefined> {
    const updated = db
      .update(schema.pathologyTests)
      .set({
        status,
        results,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.pathologyTests.id, testId))
      .returning()
      .get();

    // Log activity and calculate doctor earning when test is completed
    if (status === "completed" && userId) {
      const test = db
        .select()
        .from(schema.pathologyTests)
        .where(eq(schema.pathologyTests.id, testId))
        .get();
      const order = db
        .select()
        .from(schema.pathologyOrders)
        .where(eq(schema.pathologyOrders.id, test?.orderId || ""))
        .get();
      const patient = db
        .select()
        .from(schema.patients)
        .where(eq(schema.patients.id, order?.patientId || ""))
        .get();

      this.logActivity(
        userId,
        "lab_test_completed",
        "Lab test completed",
        `${test?.testName} for ${patient?.name || "Unknown Patient"}`,
        testId,
        "pathology_test",
        { testName: test?.testName, patientName: patient?.name },
      );

      // Note: Doctor earnings for pathology are now calculated at order level when payment is made,
      // not per-test when test is completed
    }

    return updated;
  }

  // Get doctor earning by patient service ID
  async getDoctorEarningByPatientServiceId(
    patientServiceId: string,
  ): Promise<DoctorEarning | undefined> {
    return db
      .select()
      .from(schema.doctorEarnings)
      .where(eq(schema.doctorEarnings.patientServiceId, patientServiceId))
      .get();
  }
}

export const storage = new SqliteStorage();