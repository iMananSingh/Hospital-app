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

    // Add demo pathology categories and tests
    const demoCategories = [
      {
        id: "biochem-cat",
        name: "Biochemistry",
        description: "Chemical analysis of body fluids and tissues",
      },
      {
        id: "hematology-cat",
        name: "Hematology",
        description: "Blood cell and clotting analysis",
      },
      {
        id: "microbiology-cat",
        name: "Microbiology",
        description: "Bacterial and viral culture analysis",
      },
    ];

    for (const cat of demoCategories) {
      const existing = db
        .select()
        .from(schema.pathologyCategories)
        .where(eq(schema.pathologyCategories.id, cat.id))
        .get();
      if (!existing) {
        db.insert(schema.pathologyCategories)
          .values({
            id: cat.id,
            name: cat.name,
            description: cat.description,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .run();
        console.log(`Created pathology category: ${cat.name}`);
      }
    }

    // Add demo tests for each category
    const demoTests = [
      // Biochemistry tests
      { categoryId: "biochem-cat", testName: "Blood Glucose", price: 150 },
      { categoryId: "biochem-cat", testName: "Hemoglobin A1C", price: 200 },
      { categoryId: "biochem-cat", testName: "Lipid Profile", price: 250 },
      { categoryId: "biochem-cat", testName: "Liver Function Tests", price: 300 },
      { categoryId: "biochem-cat", testName: "Kidney Function Tests", price: 300 },
      // Hematology tests
      { categoryId: "hematology-cat", testName: "Complete Blood Count", price: 200 },
      { categoryId: "hematology-cat", testName: "Blood Group", price: 100 },
      { categoryId: "hematology-cat", testName: "Prothrombin Time", price: 150 },
      { categoryId: "hematology-cat", testName: "Platelet Count", price: 100 },
      // Microbiology tests
      { categoryId: "microbiology-cat", testName: "Blood Culture", price: 400 },
      { categoryId: "microbiology-cat", testName: "Urinalysis", price: 150 },
      { categoryId: "microbiology-cat", testName: "Stool Culture", price: 300 },
    ];

    for (const test of demoTests) {
      const existing = db
        .select()
        .from(schema.pathologyCategoryTests)
        .where(
          and(
            eq(schema.pathologyCategoryTests.categoryId, test.categoryId),
            eq(schema.pathologyCategoryTests.testName, test.testName),
          ),
        )
        .get();
      if (!existing) {
        db.insert(schema.pathologyCategoryTests)
          .values({
            id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            categoryId: test.categoryId,
            testName: test.testName,
            price: test.price,
            description: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .run();
        console.log(`Created pathology test: ${test.testName}`);
      }
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

  private generateServiceOrderId(): string {
    const year = new Date().getFullYear();
    // Count DISTINCT orderIds instead of all services to get correct sequential number
    const existingOrderIds = db
      .select({ orderId: schema.patientServices.orderId })
      .from(schema.patientServices)
      .where(isNotNull(schema.patientServices.orderId))
      .all();

    // Get unique orderIds
    const uniqueOrderIds = new Set(existingOrderIds.map((row) => row.orderId));
    const count = uniqueOrderIds.size + 1;

    // Use SER prefix with 5-digit padding (auto-expands beyond 99999)
    return `SER-${year}-${count.toString().padStart(5, "0")}`;
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
  private async calculateDoctorEarning(
    patientService: PatientService,
    service: Service,
  ): Promise<void> {
    try {
      console.log(
        `Starting earnings calculation for doctor ${patientService.doctorId}, patient service ${patientService.id}`,
      );
      console.log(
        `Service details - ID: ${service.id}, Name: ${service.name}, Category: ${service.category}`,
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
            eq(schema.doctorServiceRates.serviceId, service.id),
            eq(schema.doctorServiceRates.isActive, true),
          ),
        )
        .get();

      // If not found by serviceId, try matching by service name and category
      if (!doctorRate) {
        console.log(
          `No exact serviceId match, trying name+category match for ${service.name} in ${service.category}`,
        );
        doctorRate = db
          .select()
          .from(schema.doctorServiceRates)
          .where(
            and(
              eq(schema.doctorServiceRates.doctorId, patientService.doctorId!),
              eq(schema.doctorServiceRates.serviceName, service.name),
              eq(schema.doctorServiceRates.serviceCategory, service.category),
              eq(schema.doctorServiceRates.isActive, true),
            ),
          )
          .get();
      }

      if (!doctorRate) {
        console.log(
          `No salary rate found for doctor ${patientService.doctorId}, service ${service.name} (${service.category})`,
        );
        return;
      }

      console.log(
        `Found doctor rate: ${doctorRate.rateType} = ${doctorRate.rateAmount} for service ${service.name}`,
      );

      // Calculate earning amount based on rate type
      let earnedAmount = 0;
      const servicePrice =
        patientService.calculatedAmount ||
        patientService.price ||
        service.price;

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
        serviceId: service.id,
        patientServiceId: patientService.id,
        serviceName: service.name,
        serviceCategory: doctorRate.serviceCategory,
        serviceDate: patientService.scheduledDate,
        rateType: doctorRate.rateType,
        rateAmount: doctorRate.rateAmount,
        servicePrice,
        earnedAmount,
        status: "pending",
        notes: `Automatic calculation for ${service.name}`,
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

      // Find doctor OPD consultation rate
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
        .select({ count: sql`COUNT(*)` })
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

  async createPatientServicesBatch(
    servicesData: InsertPatientService[],
    userId?: string,
  ): Promise<PatientService[]> {
    try {
      // Import smart costing here to avoid circular dependencies
      const { SmartCostingEngine } = await import("./smart-costing");

      // Generate a single order ID for all services in this batch
      const orderId = this.generateServiceOrderId();

      return db.transaction((tx) => {
        const createdServices: PatientService[] = [];
        const earningsToProcess: Array<{
          patientService: PatientService;
          service: Service;
        }> = [];

        for (const serviceData of servicesData) {
          console.log("=== BATCH SERVICE CREATION DEBUG ===");
          console.log("Service Name:", serviceData.serviceName);
          console.log("Doctor ID from request:", serviceData.doctorId);
          console.log("Doctor ID type:", typeof serviceData.doctorId);
          console.log("Service Type:", serviceData.serviceType);

          // Ensure doctor ID is properly preserved for all service types
          const finalServiceData = {
            ...serviceData,
            orderId: orderId,
            // Always preserve the doctor ID exactly as sent from frontend
            doctorId: serviceData.doctorId,
          };

          console.log("Final service data before DB insert:", {
            doctorId: finalServiceData.doctorId,
            doctorIdType: typeof finalServiceData.doctorId,
            serviceName: finalServiceData.serviceName,
            serviceType: finalServiceData.serviceType,
          });

          const created = tx
            .insert(schema.patientServices)
            .values(finalServiceData)
            .returning()
            .get();

          console.log("Created service in DB:", {
            id: created.id,
            doctorId: created.doctorId,
            doctorIdType: typeof created.doctorId,
            serviceName: created.serviceName,
            serviceType: created.serviceType,
          });

          createdServices.push(created);

          // Log activity for OPD appointments
          if (userId && serviceData.serviceType === "opd") {
            const patient = tx
              .select()
              .from(schema.patients)
              .where(eq(schema.patients.id, serviceData.patientId))
              .get();
            this.logActivity(
              userId,
              "opd_scheduled",
              "OPD appointment scheduled",
              `${serviceData.serviceName} for ${patient?.name || "Unknown Patient"}`,
              created.id,
              "patient_service",
              {
                serviceName: serviceData.serviceName,
                patientName: patient?.name,
                scheduledDate: serviceData.scheduledDate,
              },
            );
          }

          // Calculate doctor earnings if doctor is assigned and service exists
          if (serviceData.doctorId && serviceData.serviceId) {
            // Get service details for earnings calculation
            let serviceForEarnings = tx
              .select()
              .from(schema.services)
              .where(eq(schema.services.id, serviceData.serviceId))
              .get();

            // If service not found by ID, try fallback match by name and category
            if (
              !serviceForEarnings &&
              serviceData.serviceName &&
              serviceData.serviceType
            ) {
              console.log(
                `Batch: Service not found by ID ${serviceData.serviceId}, trying fallback by name: ${serviceData.serviceName}, type: ${serviceData.serviceType}`,
              );
              serviceForEarnings = tx
                .select()
                .from(schema.services)
                .where(
                  and(
                    eq(schema.services.name, serviceData.serviceName),
                    eq(schema.services.category, serviceData.serviceType),
                  ),
                )
                .get();

              if (serviceForEarnings) {
                console.log(
                  `✓ Batch fallback service match found: ${serviceForEarnings.id} - ${serviceForEarnings.name}`,
                );
              } else {
                console.log(
                  `Batch: No service match found for name: ${serviceData.serviceName}, type: ${serviceData.serviceType}`,
                );
              }
            }

            console.log(
              `Batch patient service created with doctor ${serviceData.doctorId}, service exists: ${!!serviceForEarnings}`,
            );
            if (serviceForEarnings) {
              console.log(
                `Queueing earnings calculation for doctor ${serviceData.doctorId} and service ${serviceForEarnings.id}`,
              );
              // Queue for processing after transaction
              earningsToProcess.push({
                patientService: created,
                service: serviceForEarnings,
              });
            } else {
              console.log(
                `⚠️ No service found for serviceId: ${serviceData.serviceId} in batch, cannot calculate earnings`,
              );
            }
          }
        }

        // Process earnings calculations after transaction completes
        setImmediate(async () => {
          for (const { patientService, service } of earningsToProcess) {
            try {
              console.log(
                `Processing queued earnings calculation for service ${patientService.id}`,
              );
              await this.calculateDoctorEarning(patientService, service);
            } catch (error) {
              console.error(
                `❌ Error calculating earnings for service ${patientService.id}:`,
                error,
              );
            }
          }
        });

        return createdServices;
      });
    } catch (error) {
      console.error("Error creating patient services batch:", error);
      throw error;
    }
  }

  async createPatientService(
    serviceData: InsertPatientService,
    userId?: string,
  ): Promise<PatientService> {
    try {
      // Import smart costing here to avoid circular dependencies
      const { SmartCostingEngine } = await import("./smart-costing");

      // Get service details for billing calculation
      let service = null;
      let calculatedAmount = serviceData.price || 0;
      let billingType = serviceData.billingType || "per_instance";
      let billingQuantity = serviceData.billingQuantity || 1;

      if (
        serviceData.serviceId &&
        serviceData.serviceId !== `SRV-${Date.now()}`
      ) {
        service = db
          .select()
          .from(schema.services)
          .where(eq(schema.services.id, serviceData.serviceId))
          .get();

        // If service not found by ID, try fallback match by name and category
        if (!service && serviceData.serviceName && serviceData.serviceType) {
          console.log(
            `Service not found by ID ${serviceData.serviceId}, trying fallback by name: ${serviceData.serviceName}, type: ${serviceData.serviceType}`,
          );
          service = db
            .select()
            .from(schema.services)
            .where(
              and(
                eq(schema.services.name, serviceData.serviceName),
                eq(schema.services.category, serviceData.serviceType),
              ),
            )
            .get();

          if (service) {
            console.log(
              `✓ Fallback service match found: ${service.id} - ${service.name}`,
            );
          } else {
            console.log(
              `No service match found for name: ${serviceData.serviceName}, type: ${serviceData.serviceType}`,
            );
          }
        }

        if (service) {
          // Calculate billing using smart costing
          const customParams = serviceData.billingParameters
            ? JSON.parse(serviceData.billingParameters)
            : {};

          const billingResult = SmartCostingEngine.calculateBilling({
            service: {
              id: service.id,
              name: service.name,
              price: service.price,
              billingType: service.billingType as any,
              billingParameters: service.billingParameters || undefined,
            },
            quantity: serviceData.billingQuantity || 1,
            customParameters: customParams,
          });

          calculatedAmount = billingResult.totalAmount;
          billingType = service.billingType || "per_instance";
          billingQuantity = billingResult.billingQuantity;
        }
      }

      const created = db
        .insert(schema.patientServices)
        .values({
          ...serviceData,
          serviceId: serviceData.serviceId || `SRV-${Date.now()}`,
          receiptNumber: serviceData.receiptNumber || null,
          orderId: serviceData.orderId || null,
          billingType,
          billingQuantity,
          calculatedAmount,
          // Preserve doctorId exactly as received
          doctorId: serviceData.doctorId,
        })
        .returning()
        .get();

      // Log activity for OPD appointments
      if (userId && serviceData.serviceType === "opd") {
        const patient = db
          .select()
          .from(schema.patients)
          .where(eq(schema.patients.id, serviceData.patientId))
          .get();
        this.logActivity(
          userId,
          "opd_scheduled",
          "OPD appointment scheduled",
          `${serviceData.serviceName} for ${patient?.name || "Unknown Patient"}`,
          created.id,
          "patient_service",
          {
            serviceName: serviceData.serviceName,
            patientName: patient?.name,
            scheduledDate: serviceData.scheduledDate,
          },
        );
      }

      // Calculate doctor earnings if doctor is assigned and service has rates
      if (serviceData.doctorId) {
        console.log(
          `Patient service created with doctor ${serviceData.doctorId}, service exists: ${!!service}`,
        );
        if (service) {
          console.log(
            `Triggering earnings calculation for doctor ${serviceData.doctorId} and service ${service.id}`,
          );
          // Calculate earnings asynchronously to avoid blocking
          setImmediate(async () => {
            try {
              await this.calculateDoctorEarning(created, service);
            } catch (error) {
              console.error(
                `Error in async earnings calculation for doctor ${serviceData.doctorId}:`,
                error,
              );
            }
          });
        } else {
          console.log(
            `No service found for serviceId: ${serviceData.serviceId}, cannot calculate earnings`,
          );
        }
      }

      return created;
    } catch (error) {
      console.error("Error creating patient service:", error);
      throw error;
    }
  }

  async getPatientServices(patientId?: string): Promise<PatientService[]> {
    if (patientId) {
      // Use Drizzle ORM to join with doctors table
      const results = db
        .select({
          // Select all fields from patient_services
          ...schema.patientServices,
          // Select doctor name if available
          doctorName: schema.doctors.name,
          doctorSpecialization: schema.doctors.specialization,
        })
        .from(schema.patientServices)
        .leftJoin(
          schema.doctors,
          eq(schema.patientServices.doctorId, schema.doctors.id),
        )
        .where(
          and(
            eq(schema.patientServices.patientId, patientId),
            isNotNull(schema.patientServices.doctorId), // Only include services with a doctor assigned
          ),
        )
        .orderBy(
          desc(schema.patientServices.scheduledDate),
          desc(schema.patientServices.createdAt),
        )
        .all();

      console.log(
        "Retrieved services with doctor info:",
        results.map((s) => ({
          id: s.id,
          serviceName: s.serviceName,
          doctorId: s.doctorId,
          doctorName: s.doctorName,
          serviceType: s.serviceType,
        })),
      );

      // Manually cast the results to PatientService type, including doctorName and doctorSpecialization
      // This is a bit of a workaround because Drizzle's type inference might not perfectly handle the selected fields from the join.
      return results as unknown as PatientService[];
    } else {
      // If no patientId is provided, fetch all active services without doctor join
      return db
        .select()
        .from(schema.patientServices)
        .orderBy(desc(schema.patientServices.createdAt))
        .all();
    }
  }

  async getPatientServicesWithFilters(
    filters: PatientServiceFilters,
  ): Promise<PatientService[]> {
    try {
      console.log(
        "Storage: getPatientServicesWithFilters called with filters:",
        filters,
      );

      // Build WHERE conditions based on filters
      const whereConditions: any[] = [];

      if (filters.patientId) {
        whereConditions.push(
          eq(schema.patientServices.patientId, filters.patientId),
        );
      }

      if (filters.serviceType) {
        whereConditions.push(
          eq(schema.patientServices.serviceType, filters.serviceType),
        );
      }

      if (filters.serviceTypes && filters.serviceTypes.length > 0) {
        whereConditions.push(
          inArray(schema.patientServices.serviceType, filters.serviceTypes),
        );
      }

      if (filters.fromDate) {
        whereConditions.push(
          sql`DATE(${schema.patientServices.scheduledDate}) >= DATE(${filters.fromDate})`,
        );
      }

      if (filters.toDate) {
        whereConditions.push(
          sql`DATE(${schema.patientServices.scheduledDate}) <= DATE(${filters.toDate})`,
        );
      }

      if (filters.doctorId) {
        whereConditions.push(
          eq(schema.patientServices.doctorId, filters.doctorId),
        );
      }

      if (filters.serviceName) {
        whereConditions.push(
          eq(schema.patientServices.serviceName, filters.serviceName),
        );
      }

      if (filters.status) {
        whereConditions.push(eq(schema.patientServices.status, filters.status));
      }

      console.log("Storage: Built where conditions:", whereConditions.length);

      // Execute query with joins to get patient and doctor details
      const result = db
        .select({
          // Patient service fields
          id: schema.patientServices.id,
          serviceId: schema.patientServices.serviceId,
          patientId: schema.patientServices.patientId,
          visitId: schema.patientServices.visitId,
          doctorId: schema.patientServices.doctorId,
          serviceType: schema.patientServices.serviceType,
          serviceName: schema.patientServices.serviceName,
          orderId: schema.patientServices.orderId,
          status: schema.patientServices.status,
          scheduledDate: schema.patientServices.scheduledDate,
          scheduledTime: schema.patientServices.scheduledTime,
          completedDate: schema.patientServices.completedDate,
          notes: schema.patientServices.notes,
          price: schema.patientServices.price,
          billingType: schema.patientServices.billingType,
          billingQuantity: schema.patientServices.billingQuantity,
          billingParameters: schema.patientServices.billingParameters,
          calculatedAmount: schema.patientServices.calculatedAmount,
          receiptNumber: schema.patientServices.receiptNumber,
          createdAt: schema.patientServices.createdAt,
          // Patient details
          patientName: schema.patients.name,
          patientPhone: schema.patients.phone,
          patientAge: schema.patients.age,
          patientGender: schema.patients.gender,
          // Doctor details - properly join and return doctor name
          doctorName: schema.doctors.name,
          doctorSpecialization: schema.doctors.specialization,
        })
        .from(schema.patientServices)
        .innerJoin(
          schema.patients,
          eq(schema.patientServices.patientId, schema.patients.id),
        )
        .leftJoin(
          schema.doctors,
          eq(schema.patientServices.doctorId, schema.doctors.id),
        )
        .where(whereConditions.length > 0 ? and(...whereConditions) : sql`1=1`)
        .orderBy(
          desc(schema.patientServices.scheduledDate),
          desc(schema.patientServices.createdAt),
        )
        .all();

      // Log a sample of results to debug doctor name resolution
      const sampleResults = result.slice(0, 3).map((service) => ({
        serviceName: service.serviceName,
        doctorId: service.doctorId,
        doctorName: service.doctorName,
        serviceType: service.serviceType,
      }));
      console.log("Sample patient services with doctor info:", sampleResults);

      return result;
    } catch (error) {
      console.error("Error fetching patient services with filters:", error);
      throw error;
    }
  }

  async getPatientServiceById(id: string): Promise<PatientService | undefined> {
    return db
      .select()
      .from(schema.patientServices)
      .where(eq(schema.patientServices.id, id))
      .get();
  }

  async updatePatientService(
    id: string,
    service: Partial<InsertPatientService>,
  ): Promise<PatientService | undefined> {
    const updated = db
      .update(schema.patientServices)
      .set({ ...service, updatedAt: new Date().toISOString() })
      .where(eq(schema.patientServices.id, id))
      .returning()
      .get();
    return updated;
  }

  async createAdmission(
    admission: InsertAdmission,
    userId?: string,
  ): Promise<Admission> {
    const admissionId = this.generateAdmissionId();
    let admissionDate: string;
    let eventDate: string;

    if (admission.admissionDate) {
      // Frontend should send UTC ISO string (with Z suffix)
      // If it has Z or +, use it directly; otherwise convert to ISO
      if (
        admission.admissionDate.includes("Z") ||
        admission.admissionDate.includes("+")
      ) {
        admissionDate = admission.admissionDate;
      } else {
        // Fallback: convert to ISO if needed
        admissionDate = new Date(admission.admissionDate).toISOString();
      }
      // Extract date part for receipt generation
      eventDate = admissionDate.split("T")[0];
    } else {
      // No admission date provided, use current system time (same as transferRoom)
      const now = new Date();
      admissionDate = now.toISOString();
      eventDate =
        now.getFullYear() +
        "-" +
        String(now.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(now.getDate()).padStart(2, "0");
    }

    return db.transaction((tx) => {
      // CRITICAL VALIDATION: Check if room is already occupied
      if (admission.currentRoomNumber && admission.currentWardType) {
        const existingAdmission = tx
          .select()
          .from(schema.admissions)
          .where(
            and(
              eq(
                schema.admissions.currentRoomNumber,
                admission.currentRoomNumber,
              ),
              eq(schema.admissions.currentWardType, admission.currentWardType),
              eq(schema.admissions.status, "admitted"),
            ),
          )
          .get();

        if (existingAdmission) {
          throw new Error(
            `Room ${admission.currentRoomNumber} in ${admission.currentWardType} is already occupied by another patient. Please select a different room.`,
          );
        }
      }

      // Generate receipt number for admission
      const admissionCount = this.getDailyReceiptCountSync(
        "admission",
        eventDate,
      );
      console.log(
        `[ADMISSION] Date: ${eventDate}, Count from DB: ${admissionCount}, Next receipt will be: ${admissionCount + 1}`,
      );
      const dateObj = new Date(eventDate);
      const yymmdd = dateObj
        .toISOString()
        .slice(2, 10)
        .replace(/-/g, "")
        .slice(0, 6);
      const receiptNumber = `${yymmdd}-ADM-${(admissionCount + 1).toString().padStart(4, "0")}`;
      console.log(`[ADMISSION] Generated receipt number: ${receiptNumber}`);

      // Create the admission episode
      const newAdmission = tx
        .insert(schema.admissions)
        .values({
          ...admission,
          admissionId,
          admissionDate,
          currentWardType: admission.currentWardType,
          currentRoomNumber: admission.currentRoomNumber,
        })
        .returning()
        .get();

      // Create an 'admit' event with UTC timestamp (same as transferRoom)
      const admitEvent = tx
        .insert(schema.admissionEvents)
        .values({
          admissionId: newAdmission.id,
          eventType: "admit",
          eventTime: admissionDate, // UTC ISO format
          roomNumber: admission.currentRoomNumber || null,
          wardType: admission.currentWardType || null,
          notes: `Patient admitted to ${admission.currentWardType} - Room ${admission.currentRoomNumber}`,
          receiptNumber: receiptNumber,
        })
        .returning()
        .get();

      // Increment occupied beds for the room type
      if (admission.currentWardType) {
        const roomType = tx
          .select()
          .from(schema.roomTypes)
          .where(eq(schema.roomTypes.name, admission.currentWardType))
          .get();

        if (roomType) {
          tx.update(schema.roomTypes)
            .set({
              occupiedBeds: (roomType.occupiedBeds || 0) + 1,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(schema.roomTypes.id, roomType.id))
            .run();
        }
      }

      return newAdmission;
    });
  }

  async getAdmissions(
    patientId?: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<any[]> {
    try {
      let conditions: any[] = [];

      if (patientId) {
        conditions.push(eq(schema.admissions.patientId, patientId));
      }

      if (fromDate) {
        conditions.push(gte(schema.admissions.admissionDate, fromDate));
      }

      if (toDate) {
        conditions.push(lte(schema.admissions.admissionDate, toDate));
      }

      let query = db
        .select({
          admission: schema.admissions,
          patient: schema.patients,
          doctor: schema.doctors,
        })
        .from(schema.admissions)
        .leftJoin(
          schema.patients,
          eq(schema.admissions.patientId, schema.patients.id),
        )
        .leftJoin(
          schema.doctors,
          eq(schema.admissions.doctorId, schema.doctors.id),
        );

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const results = query
        .orderBy(desc(schema.admissions.admissionDate))
        .all();

      return results.map((row) => ({
        ...row.admission,
        patient: row.patient,
        doctor: row.doctor,
      }));
    } catch (error) {
      console.error("Error fetching admissions:", error);
      throw error;
    }
  }

  async getAdmissionById(id: string): Promise<Admission | undefined> {
    return db
      .select()
      .from(schema.admissions)
      .where(eq(schema.admissions.id, id))
      .get();
  }

  async updateAdmission(
    id: string,
    admission: Partial<InsertAdmission>,
  ): Promise<Admission | undefined> {
    // Get the current admission to check for status changes
    const currentAdmission = db
      .select()
      .from(schema.admissions)
      .where(eq(schema.admissions.id, id))
      .get();

    const updated = db
      .update(schema.admissions)
      .set({ ...admission, updatedAt: new Date().toISOString() })
      .where(eq(schema.admissions.id, id))
      .returning()
      .get();

    // Handle bed count changes when status changes
    if (
      currentAdmission &&
      admission.status === "discharged" &&
      currentAdmission.status === "admitted"
    ) {
      // Patient is being discharged - decrement occupied beds
      if (currentAdmission.currentWardType) {
        const roomType = db
          .select()
          .from(schema.roomTypes)
          .where(eq(schema.roomTypes.name, currentAdmission.currentWardType))
          .get();

        if (roomType && roomType.occupiedBeds > 0) {
          db.update(schema.roomTypes)
            .set({
              occupiedBeds: roomType.occupiedBeds - 1,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(schema.roomTypes.id, roomType.id))
            .run();
        }
      }
    }

    // Update last_payment_date if a payment is made
    if (admission.status === "paid" && updated) {
      updated.lastPaymentDate = new Date().toISOString();
      await db
        .update(schema.admissions)
        .set({ lastPaymentDate: updated.lastPaymentDate })
        .where(eq(schema.admissions.id, id))
        .run();
    }

    return updated;
  }

  // Patient Payment Methods
  async createPatientPayment(
    paymentData: InsertPatientPayment,
    userId: string,
  ): Promise<PatientPayment> {
    const paymentId = this.generatePaymentId();

    const created = db
      .insert(schema.patientPayments)
      .values({
        ...paymentData,
        paymentId,
        processedBy: userId,
      })
      .returning()
      .get();

    // Log activity
    const patient = db
      .select()
      .from(schema.patients)
      .where(eq(schema.patients.id, paymentData.patientId))
      .get();
    this.logActivity(
      userId,
      "payment_added",
      "Payment Accepted",
      `₹${paymentData.amount} payment for ${patient?.name || "Unknown Patient"}`,
      created.id,
      "patient_payment",
      {
        amount: paymentData.amount,
        paymentMethod: paymentData.paymentMethod,
        patientName: patient?.name,
      },
    );


    return created;
  }

  async getPatientPayments(
    patientId?: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<any[]> {
    try {
      console.log(
        `Fetching patient payments for patientId: ${patientId}, fromDate: ${fromDate}, toDate: ${toDate}`,
      );

      // Get system timezone offset for proper date filtering
      const systemSettings = await this.getSystemSettings();
      const timezoneOffset = systemSettings?.timezoneOffset || "+00:00";

      const whereConditions: any[] = [];

      if (patientId) {
        whereConditions.push(eq(schema.patientPayments.patientId, patientId));
      }

      if (fromDate) {
        whereConditions.push(
          sql`DATE(${schema.patientPayments.paymentDate}, ${timezoneOffset}) >= ${fromDate}`,
        );
      }

      if (toDate) {
        whereConditions.push(
          sql`DATE(${schema.patientPayments.paymentDate}, ${timezoneOffset}) <= ${toDate}`,
        );
      }

      const query = db
        .select({
          id: schema.patientPayments.id,
          paymentId: schema.patientPayments.paymentId,
          patientId: schema.patientPayments.patientId,
          amount: schema.patientPayments.amount,
          paymentMethod: schema.patientPayments.paymentMethod,
          paymentDate: schema.patientPayments.paymentDate,
          reason: schema.patientPayments.reason,
          receiptNumber: schema.patientPayments.receiptNumber,
          processedBy: schema.patientPayments.processedBy,
          createdAt: schema.patientPayments.createdAt,
          updatedAt: schema.patientPayments.updatedAt,
          // Join with patient to get patient name
          patientName: schema.patients.name,
        })
        .from(schema.patientPayments)
        .leftJoin(
          schema.patients,
          eq(schema.patientPayments.patientId, schema.patients.id),
        );

      if (whereConditions.length > 0) {
        query.where(and(...whereConditions));
      }

      const payments = query
        .orderBy(desc(schema.patientPayments.paymentDate))
        .all();

      console.log(`Found ${payments.length} patient payments.`);
      return payments;
    } catch (error) {
      console.error("Error fetching patient payments:", error);
      return [];
    }
  }

  async getPatientPaymentById(id: string): Promise<PatientPayment | undefined> {
    return db
      .select()
      .from(schema.patientPayments)
      .where(eq(schema.patientPayments.id, id))
      .get();
  }

  async getPatientBillableItems(patientId: string): Promise<any[]> {
    const billableItems: any[] = [];

    // Get all payments for this patient to calculate paid amounts
    const payments = db
      .select()
      .from(schema.patientPayments)
      .where(eq(schema.patientPayments.patientId, patientId))
      .all();

    // Calculate total paid per billable item (stored in reason field)
    const paidAmounts = new Map<string, number>();
    payments.forEach((payment) => {
      if (payment.reason) {
        const current = paidAmounts.get(payment.reason) || 0;
        paidAmounts.set(payment.reason, current + (payment.amount || 0));
      }
    });

    // 1. Get all admissions
    const admissions = db
      .select({
        id: schema.admissions.id,
        admissionId: schema.admissions.admissionId,
        admissionDate: schema.admissions.admissionDate,
        status: schema.admissions.status,
        dailyCost: schema.admissions.dailyCost,
      })
      .from(schema.admissions)
      .where(eq(schema.admissions.patientId, patientId))
      .orderBy(desc(schema.admissions.admissionDate))
      .all();

    admissions.forEach((admission) => {
      const itemValue = `Admission - ${admission.admissionId}`;
      const amount = admission.dailyCost || 0;
      const paidAmount = paidAmounts.get(itemValue) || 0;
      const isFullyPaid = paidAmount >= amount;

      billableItems.push({
        type: "admission",
        id: admission.id,
        label: `Admission - ${admission.admissionId}`,
        value: itemValue,
        date: admission.admissionDate,
        amount,
        isFullyPaid,
      });
    });

    // 2. Get all pathology orders
    const pathologyOrders = db
      .select({
        id: schema.pathologyOrders.id,
        orderId: schema.pathologyOrders.orderId,
        receiptNumber: schema.pathologyOrders.receiptNumber,
        orderedDate: schema.pathologyOrders.orderedDate,
        totalPrice: schema.pathologyOrders.totalPrice,
        status: schema.pathologyOrders.status, // Added status for isFullyPaid check
      })
      .from(schema.pathologyOrders)
      .where(eq(schema.pathologyOrders.patientId, patientId))
      .orderBy(desc(schema.pathologyOrders.orderedDate))
      .all();

    for (const order of pathologyOrders) {
      const itemValue = order.orderId;
      const amount = order.totalPrice || 0;
      const paidAmount = paidAmounts.get(itemValue) || 0;
      // CRITICAL: Check order.status === 'paid' FIRST - this is the authoritative source
      // When a pathology payment is made, the order status is updated to 'paid' in routes.ts
      const isFullyPaid = order.status === 'paid' || (paidAmount >= amount && amount > 0);

      billableItems.push({
        type: "pathology",
        id: order.id,
        label: `Pathology - ${order.orderId}`,
        value: itemValue,
        date: order.orderedDate,
        amount,
        isFullyPaid,
      });
    }

    // 3. Get all service orders (grouped by orderId)
    const serviceOrders = db
      .select({
        orderId: schema.patientServices.orderId,
        receiptNumber: schema.patientServices.receiptNumber,
        scheduledDate: schema.patientServices.scheduledDate,
        price: schema.patientServices.price,
      })
      .from(schema.patientServices)
      .where(
        and(
          eq(schema.patientServices.patientId, patientId),
          isNotNull(schema.patientServices.orderId),
        ),
      )
      .orderBy(desc(schema.patientServices.scheduledDate))
      .all();

    const serviceOrderMap = new Map<string, { total: number; receipt?: string; date?: string }>();
    serviceOrders.forEach((order) => {
      if (order.orderId) {
        if (!serviceOrderMap.has(order.orderId)) {
          serviceOrderMap.set(order.orderId, { total: 0, receipt: order.receiptNumber, date: order.scheduledDate });
        }
        const current = serviceOrderMap.get(order.orderId)!;
        current.total += order.price || 0;
      }
    });

    serviceOrderMap.forEach((orderData, orderId) => {
      const identifier = orderData.receipt || orderId;
      const itemValue = `Service Order - ${identifier}`;
      const amount = orderData.total;
      const paidAmount = paidAmounts.get(itemValue) || 0;
      const isFullyPaid = paidAmount >= amount;

      billableItems.push({
        type: "service",
        id: orderId,
        label: `Service Order - ${identifier}`,
        value: itemValue,
        date: orderData.date,
        amount,
        isFullyPaid,
      });
    });

    // 4. Get all OPD visits
    const opdVisits = db
      .select({
        id: schema.patientVisits.id,
        visitId: schema.patientVisits.visitId,
        scheduledDate: schema.patientVisits.scheduledDate,
        consultationFee: schema.patientVisits.consultationFee,
      })
      .from(schema.patientVisits)
      .where(
        and(
          eq(schema.patientVisits.patientId, patientId),
          eq(schema.patientVisits.visitType, "opd"),
        ),
      )
      .orderBy(desc(schema.patientVisits.scheduledDate))
      .all();

    opdVisits.forEach((visit) => {
      const itemValue = `OPD Visit - ${visit.visitId}`;
      const amount = visit.consultationFee || 0;
      const paidAmount = paidAmounts.get(itemValue) || 0;
      const isFullyPaid = paidAmount >= amount;

      billableItems.push({
        type: "opd",
        id: visit.id,
        label: `OPD Visit - ${visit.visitId}`,
        value: itemValue,
        date: visit.scheduledDate,
        amount,
        isFullyPaid,
      });
    });

    // Sort all items by date (most recent first)
    billableItems.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });

    return billableItems;
  }

  // Patient Discount Methods
  async createPatientDiscount(
    discountData: InsertPatientDiscount,
    userId: string,
  ): Promise<PatientDiscount> {
    const discountId = this.generateDiscountId();

    const created = db
      .insert(schema.patientDiscounts)
      .values({
        ...discountData,
        discountId,
        approvedBy: userId,
      })
      .returning()
      .get();

    // Log activity
    const patient = db
      .select()
      .from(schema.patients)
      .where(eq(schema.patients.id, discountData.patientId))
      .get();
    this.logActivity(
      userId,
      "discount_added",
      "Discount added",
      `₹${discountData.amount} discount for ${patient?.name || "Unknown Patient"}`,
      created.id,
      "patient_discount",
      {
        amount: discountData.amount,
        discountType: discountData.discountType,
        reason: discountData,
        patientName: patient?.name,
      },
    );

    return created;
  }

  async getPatientDiscounts(patientId: string): Promise<PatientDiscount[]> {
    return db
      .select()
      .from(schema.patientDiscounts)
      .where(eq(schema.patientDiscounts.patientId, patientId))
      .orderBy(desc(schema.patientDiscounts.discountDate))
      .all();
  }

  async getPatientDiscountById(
    id: string,
  ): Promise<PatientDiscount | undefined> {
    return db
      .select()
      .from(schema.patientDiscounts)
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
    try {
      console.log(`Generating financial summary for patient: ${patientId}`);

      // Calculate total charges from different sources
      let totalCharges = 0;
      let totalPaid = 0;
      let totalDiscounts = 0;

      // 1. OPD Consultation charges from patient_visits table
      const opdVisits = db
        .select({
          consultationFee: schema.patientVisits.consultationFee,
        })
        .from(schema.patientVisits)
        .where(
          and(
            eq(schema.patientVisits.patientId, patientId),
            eq(schema.patientVisits.visitType, "opd"),
          ),
        )
        .all();

      opdVisits.forEach((visit) => {
        const fee = visit.consultationFee || 0;
        totalCharges += fee;
      });

      // 2. OPD Services charges from patient_services table
      const opdServices = db
        .select({
          amount: schema.patientServices.calculatedAmount,
          price: schema.patientServices.price,
        })
        .from(schema.patientServices)
        .where(
          and(
            eq(schema.patientServices.patientId, patientId),
            eq(schema.patientServices.serviceType, "opd"),
          ),
        )
        .all();

      opdServices.forEach((service) => {
        const charge = service.amount || service.price || 0;
        totalCharges += charge;
      });

      // 3. Pathology orders charges
      const pathologyOrders = db
        .select({
          totalPrice: schema.pathologyOrders.totalPrice,
        })
        .from(schema.pathologyOrders)
        .where(eq(schema.pathologyOrders.patientId, patientId))
        .all();

      pathologyOrders.forEach((order) => {
        totalCharges += order.totalPrice || 0;
      });

      // 4. Other patient services charges (with daily calculation for admission services)
      const otherServices = db
        .select({
          id: schema.patientServices.id,
          serviceType: schema.patientServices.serviceType,
          serviceName: schema.patientServices.serviceName,
          amount: schema.patientServices.calculatedAmount,
          price: schema.patientServices.price,
          scheduledDate: schema.patientServices.scheduledDate,
          createdAt: schema.patientServices.createdAt,
        })
        .from(schema.patientServices)
        .where(
          and(
            eq(schema.patientServices.patientId, patientId),
            ne(schema.patientServices.serviceType, "opd"),
          ),
        )
        .all();

      otherServices.forEach((service) => {
        let charge = service.amount || service.price || 0;

        // For admission services, calculate based on stay duration
        if (service.serviceType === "admission") {
          // Get admissions for this patient
          const patientAdmissions = db
            .select()
            .from(schema.admissions)
            .where(eq(schema.admissions.patientId, patientId))
            .all();

          if (patientAdmissions.length > 0) {
            // Find relevant admission
            let relevantAdmission = patientAdmissions[0];

            const matchingAdmission = patientAdmissions.find((admission) => {
              const admissionDate = new Date(
                admission.admissionDate,
              ).toDateString();
              const serviceDate = new Date(
                service.scheduledDate || service.createdAt,
              ).toDateString();
              return admissionDate === serviceDate;
            });

            if (matchingAdmission) {
              relevantAdmission = matchingAdmission;
            }

            // Use the calculateStayDays function that was imported at the top
            const endDate =
              relevantAdmission.dischargeDate || new Date().toISOString();
            const stayDuration = calculateStayDays(
              relevantAdmission.admissionDate,
              endDate,
            );

            if (stayDuration > 0) {
              if (service.serviceName.toLowerCase().includes("bed charges")) {
                // Bed charges: charge for each completed 24-hour period
                charge = (service.price || 0) * stayDuration;
              } else if (
                service.serviceName.toLowerCase().includes("doctor charges") ||
                service.serviceName.toLowerCase().includes("nursing charges") ||
                service.serviceName.toLowerCase().includes("rmo charges")
              ) {
                // Other admission services: charge for each calendar day
                charge = (service.price || 0) * stayDuration;
              }
            }
          }
        }

        totalCharges += charge;
      });

      // 5. Get all payments for this patient
      const payments = db
        .select({
          amount: schema.patientPayments.amount,
        })
        .from(schema.patientPayments)
        .where(eq(schema.patientPayments.patientId, patientId))
        .all();

      payments.forEach((payment) => {
        totalPaid += payment.amount || 0;
      });

      // 6. Include initial deposits and additional payments from admissions
      const admissions = db
        .select({
          initialDeposit: schema.admissions.initialDeposit,
          additionalPayments: schema.admissions.additionalPayments,
        })
        .from(schema.admissions)
        .where(eq(schema.admissions.patientId, patientId))
        .all();

      admissions.forEach((admission) => {
        totalPaid += admission.initialDeposit || 0;
        totalPaid += admission.additionalPayments || 0;
      });

      // 7. Get all discounts for this patient
      const discounts = db
        .select({
          amount: schema.patientDiscounts.amount,
        })
        .from(schema.patientDiscounts)
        .where(eq(schema.patientDiscounts.patientId, patientId))
        .all();

      discounts.forEach((discount) => {
        totalDiscounts += discount.amount || 0;
      });

      const balance = totalCharges - totalPaid - totalDiscounts;

      console.log(
        `Financial summary - Total charges: ${totalCharges}, Total paid: ${totalPaid}, Total discounts: ${totalDiscounts}, Balance: ${balance}`,
      );

      return {
        totalCharges,
        totalPaid,
        totalDiscounts,
        balance,
      };
    } catch (error) {
      console.error("Error generating financial summary:", error);
      return {
        totalCharges: 0,
        totalPaid: 0,
        totalDiscounts: 0,
        balance: 0,
      };
    }
  }

  async logAction(log: InsertAuditLog): Promise<void> {
    db.insert(schema.auditLog).values(log);
  }

  async getDashboardStats(): Promise<any> {
    try {
      // Use Indian timezone (UTC+5:30) for consistent date calculation
      const now = new Date();
      const indianTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
      const today =
        indianTime.getFullYear() +
        "-" +
        String(indianTime.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(indianTime.getDate()).padStart(2, "0");

      console.log(`Dashboard stats - Using today date: ${today}`);

      // Get today's OPD visits - those scheduled for today from patient_visits table
      const todayOpdVisits = db
        .select()
        .from(schema.patientVisits)
        .where(
          and(
            eq(schema.patientVisits.visitType, "opd"),
            eq(schema.patientVisits.scheduledDate, today),
          ),
        )
        .all();

      console.log(`Today OPD visits count: ${todayOpdVisits.length}`);
      if (todayOpdVisits.length > 0) {
        console.log(
          `Sample OPD visits:`,
          todayOpdVisits.slice(0, 3).map((v) => ({
            id: v.id,
            scheduledDate: v.scheduledDate,
            visitType: v.visitType,
            patientId: v.patientId,
            doctorId: v.doctorId,
          })),
        );
      }

      const opdPatients = todayOpdVisits.length;
      console.log(`Dashboard OPD count for today: ${opdPatients}`);

      // Get inpatients count (currently admitted)
      const inpatients = db
        .select()
        .from(schema.admissions)
        .where(eq(schema.admissions.status, "admitted"))
        .all().length;

      // Get lab tests count for today
      const labTests = db
        .select()
        .from(schema.pathologyOrders)
        .where(eq(schema.pathologyOrders.orderedDate, today))
        .all().length;

      // Get diagnostics count (diagnostic services scheduled today)
      const diagnosticServices = db
        .select()
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
            )`,
          ),
        )
        .all();
      const diagnostics = diagnosticServices.length;

      return {
        opdPatients,
        inpatients,
        labTests,
        diagnostics,
      };
    } catch (error) {
      console.error("Dashboard stats error:", error);
      return {
        opdPatients: 0,
        inpatients: 0,
        labTests: 0,
        diagnostics: 0,
      };
    }
  }

  // Room Type Management
  async getAllRoomTypes(): Promise<any[]> {
    return db
      .select()
      .from(schema.roomTypes)
      .orderBy(schema.roomTypes.name)
      .all();
  }

  async createRoomType(data: any): Promise<any> {
    return db.insert(schema.roomTypes).values(data).returning().get();
  }

  async updateRoomType(id: string, data: any): Promise<any> {
    return db
      .update(schema.roomTypes)
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
    return db
      .select()
      .from(schema.rooms)
      .orderBy(schema.rooms.roomNumber)
      .all();
  }

  async createRoom(data: any): Promise<any> {
    return db.insert(schema.rooms).values(data).returning().get();
  }

  async updateRoom(id: string, data: any): Promise<any> {
    return db
      .update(schema.rooms)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(schema.rooms.id, id))
      .returning()
      .get();
  }

  async deleteRoom(id: string): Promise<boolean> {
    try {
      const result = db
        .delete(schema.rooms)
        .where(eq(schema.rooms.id, id))
        .run();
      return result.changes > 0;
    } catch (error) {
      console.error("Error in deleteRoom:", error);
      return false;
    }
  }

  async getRoomById(id: string): Promise<any | undefined> {
    return db.select().from(schema.rooms).where(eq(schema.rooms.id, id)).get();
  }

  async getRoomTypeById(id: string): Promise<any | undefined> {
    return db
      .select()
      .from(schema.roomTypes)
      .where(eq(schema.roomTypes.id, id))
      .get();
  }

  async getRoomsByType(roomTypeId: string): Promise<any[]> {
    return db
      .select()
      .from(schema.rooms)
      .where(eq(schema.rooms.roomTypeId, roomTypeId))
      .all();
  }

  async updateRoomOccupancy(roomId: string, isOccupied: boolean): Promise<any> {
    return db
      .update(schema.rooms)
      .set({ isOccupied, updatedAt: new Date().toISOString() })
      .where(eq(schema.rooms.id, roomId))
      .returning()
      .get();
  }

  // Admission Events
  async createAdmissionEvent(
    event: InsertAdmissionEvent,
  ): Promise<AdmissionEvent> {
    const created = db
      .insert(schema.admissionEvents)
      .values(event)
      .returning()
      .get();
    return created;
  }

  async getAdmissionEvents(admissionId: string): Promise<AdmissionEvent[]> {
    return db
      .select()
      .from(schema.admissionEvents)
      .where(eq(schema.admissionEvents.admissionId, admissionId))
      .orderBy(schema.admissionEvents.eventTime)
      .all();
  }

  async transferRoom(
    admissionId: string,
    roomData: { roomNumber: string; wardType: string },
    userId: string,
  ): Promise<Admission | undefined> {
    return db.transaction((tx) => {
      const eventTime = new Date().toISOString();
      const eventDate = eventTime.split("T")[0];

      // Generate receipt number for room transfer
      const transferCount = this.getDailyReceiptCountSync(
        "room_transfer",
        eventDate,
      );
      const dateObj = new Date(eventDate);
      const yymmdd = dateObj
        .toISOString()
        .slice(2, 10)
        .replace(/-/g, "")
        .slice(0, 6);
      const receiptNumber = `${yymmdd}-RMC-${(transferCount + 1).toString().padStart(4, "0")}`;

      // Get current admission details BEFORE updating
      const currentAdmission = tx
        .select()
        .from(schema.admissions)
        .where(eq(schema.admissions.id, admissionId))
        .get();

      if (!currentAdmission) {
        throw new Error("Admission not found");
      }

      // Update the admission's current room
      const updated = tx
        .update(schema.admissions)
        .set({
          currentRoomNumber: roomData.roomNumber,
          currentWardType: roomData.wardType,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.admissions.id, admissionId))
        .returning()
        .get();

      // Create a room_change event
      const transferEvent = tx
        .insert(schema.admissionEvents)
        .values({
          admissionId: admissionId,
          eventType: "room_change",
          eventTime: new Date().toISOString(), // Store in UTC ISO format
          roomNumber: roomData.roomNumber,
          wardType: roomData.wardType,
          notes: `Patient transferred from ${currentAdmission.currentWardType} (${currentAdmission.currentRoomNumber}) to ${roomData.wardType} (${roomData.roomNumber})`,
          createdBy: userId,
          receiptNumber: receiptNumber,
        })
        .returning()
        .get();

      // Log activity
      this.logActivity(
        userId,
        "room_transfer",
        "Room Transfer",
        `Patient transferred to ${roomData.wardType} - Room ${roomData.roomNumber}`,
        admissionId,
        "admission",
        {
          fromRoom: currentAdmission.currentRoomNumber,
          fromWard: currentAdmission.currentWardType,
          toRoom: roomData.roomNumber,
          toWard: roomData.wardType,
        },
      );

      return updated;
    });
  }

  async dischargePatient(
    admissionId: string,
    userId: string,
    dischargeDateTime?: string,
  ): Promise<Admission | undefined> {
    return db.transaction((tx) => {
      try {
        // Parse discharge date/time - simplified to match transferRoom logic
        let parsedDischargeDateTime: string;

        if (
          !dischargeDateTime ||
          typeof dischargeDateTime !== "string" ||
          dischargeDateTime.trim() === ""
        ) {
          // No discharge datetime provided, use current time (same as transferRoom)
          console.log(`No discharge datetime provided, using current time`);
          parsedDischargeDateTime = new Date().toISOString();
        } else if (
          dischargeDateTime.includes("Z") ||
          dischargeDateTime.includes("+")
        ) {
          // Already in UTC ISO format (frontend converted it) - use directly
          parsedDischargeDateTime = dischargeDateTime;
        } else {
          // Should not happen if frontend converts properly, but handle gracefully
          console.log(
            `Received non-UTC datetime: ${dischargeDateTime}, attempting to parse`,
          );
          parsedDischargeDateTime = new Date(dischargeDateTime).toISOString();
        }

        const admission = tx
          .select()
          .from(schema.admissions)
          .where(eq(schema.admissions.id, admissionId))
          .get();

        if (!admission) {
          throw new Error("Admission not found");
        }

        if (admission.status === "discharged") {
          throw new Error("Patient is already discharged");
        }

        // Calculate total cost based on stay duration and daily cost
        const admissionDate = new Date(admission.admissionDate);
        const stayDays = calculateStayDays(
          admissionDate,
          parsedDischargeDateTime,
        );
        const totalCost =
          stayDays * admission.dailyCost +
          (admission.additionalPayments || 0) -
          (admission.totalDiscount || 0);

        // Update the admission with discharge information
        const updatedAdmission = tx
          .update(schema.admissions)
          .set({
            status: "discharged",
            dischargeDate: parsedDischargeDateTime,
            totalCost,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.admissions.id, admissionId))
          .returning()
          .get();

        // Generate receipt number for discharge event using the parsed UTC datetime
        const eventDate = parsedDischargeDateTime.split("T")[0];
        const dischargeCount = this.getDailyReceiptCountSync(
          "discharge",
          eventDate,
        );
        const dateObj = new Date(eventDate);
        const yymmdd = dateObj
          .toISOString()
          .slice(2, 10)
          .replace(/-/g, "")
          .slice(0, 6);
        const dischargeReceiptNumber = `${yymmdd}-DIS-${(dischargeCount + 1).toString().padStart(4, "0")}`;

        // Create discharge event with UTC timestamp (same as transferRoom)
        const dischargeEvent = tx
          .insert(schema.admissionEvents)
          .values({
            admissionId: admission.id,
            eventType: "discharge",
            eventTime: parsedDischargeDateTime, // UTC ISO format
            notes: `Patient discharged from ${admission.currentWardType} (${admission.currentRoomNumber})`,
            createdBy: userId,
            receiptNumber: dischargeReceiptNumber,
          })
          .returning()
          .get();

        // Decrement occupied beds
        if (admission.currentWardType) {
          const roomType = tx
            .select()
            .from(schema.roomTypes)
            .where(eq(schema.roomTypes.name, admission.currentWardType))
            .get();

          if (roomType && roomType.occupiedBeds > 0) {
            tx.update(schema.roomTypes)
              .set({
                occupiedBeds: roomType.occupiedBeds - 1,
                updatedAt: new Date().toISOString(),
              })
              .where(eq(schema.roomTypes.id, roomType.id))
              .run();
          }
        }

        // Log discharge activity
        setImmediate(() => {
          const patient = db
            .select()
            .from(schema.patients)
            .where(eq(schema.patients.id, admission.patientId))
            .get();

          const doctor = db
            .select()
            .from(schema.doctors)
            .where(eq(schema.doctors.id, admission.doctorId))
            .get();

          if (patient && doctor) {
            const roomNumber = admission.currentRoomNumber || "N/A";
            const wardType = admission.currentWardType || "N/A";

            this.logActivity(
              userId,
              "patient_discharged",
              "Patient Discharged",
              `${patient.name} under ${doctor.name} - discharged from ${roomNumber} (${wardType})`,
              admissionId,
              "admission",
              {
                admissionId: admission.admissionId,
                patientName: patient.name,
                doctorName: doctor.name,
                roomNumber: roomNumber,
                wardType: wardType,
              },
            );
          }
        });

        return updatedAdmission;
      } catch (transactionError) {
        console.error(
          "Transaction error during discharge patient:",
          transactionError,
        );
        throw transactionError;
      }
    });
  }

  async getHospitalSettings(): Promise<any> {
    console.log("=== getHospitalSettings Storage Function ===");
    const settings = db.select().from(schema.hospitalSettings).get();
    console.log("Raw settings from database:", settings);

    if (settings) {
      return settings;
    }

    // Create default settings if none exist
    const defaultSettings = {
      id: "default",
      name: "Health Care Hospital and Diagnostic Center",
      address:
        "In front of Maheshwari Garden, Binjhiya, Jabalpur Road, Mandla, Madhya Pradesh - 482001",
      phone: "8889762101, 9826325958",
      email: "hospital@healthcare.in",
      registrationNumber: "NH/3613/JUL-2021",
      logoPath: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Insert default settings and return them
    db.insert(schema.hospitalSettings).values(defaultSettings).run();
    console.log("Created default hospital settings:", defaultSettings);
    console.log("=== End Storage Function (defaults created) ===");
    return defaultSettings;
  }

  async saveHospitalSettings(settings: any): Promise<any> {
    try {
      // Use Drizzle ORM to update hospital settings
      const updated = db
        .insert(schema.hospitalSettings)
        .values({
          id: "default",
          name: settings.name,
          address: settings.address,
          phone: settings.phone,
          email: settings.email,
          registrationNumber: settings.registrationNumber || null,
          logoPath: settings.logoPath || null,
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: schema.hospitalSettings.id,
          set: {
            name: settings.name,
            address: settings.address,
            phone: settings.phone,
            email: settings.email,
            registrationNumber: settings.registrationNumber || null,
            logoPath: settings.logoPath || null,
            updatedAt: new Date().toISOString(),
          },
        })
        .returning()
        .get();

      return updated;
    } catch (error) {
      console.error("Error saving hospital settings:", error);
      throw error;
    }
  }

  async saveLogo(logoData: string): Promise<string> {
    try {
      // Extract base64 data and file type
      const matches = logoData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches) {
        throw new Error("Invalid image data format");
      }

      const mimeType = matches[1];
      const base64Data = matches[2];
      const extension = mimeType.split("/")[1];

      // Create filename and path
      const filename = `hospital-logo-${Date.now()}.${extension}`;
      const logoPath = `/uploads/${filename}`;

      // For simplicity, we'll store the base64 data directly in the database
      // In a production system, you'd save to filesystem or cloud storage
      return logoData; // Return the original data URL for now
    } catch (error) {
      console.error("Error saving logo:", error);
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
          backupFrequency: "daily",
          backupTime: "02:00",
          lastBackupDate: null,
          backupRetentionDays: 30,
          fiscalYearStartMonth: 4,
          fiscalYearStartDay: 1,
          auditLogRetentionYears: 7,
          lastAuditArchiveDate: null,
          timezone: "UTC",
          timezoneOffset: "+00:00",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        db.insert(schema.systemSettings).values(settings).run();
      }

      return settings;
    } catch (error) {
      console.error("Error fetching system settings:", error);
      throw error;
    }
  }

  async saveSystemSettings(settings: any): Promise<any> {
    try {
      const existingSettings = db.select().from(schema.systemSettings).get();

      if (existingSettings) {
        // Update existing settings
        const updated = db
          .update(schema.systemSettings)
          .set({
            ...settings,
            updatedAt: new Date().toISOString(),
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
          updatedAt: new Date().toISOString(),
        };

        const created = db
          .insert(schema.systemSettings)
          .values(newSettings)
          .returning()
          .get();
        return created;
      }
    } catch (error) {
      console.error("Error saving system settings:", error);
      throw error;
    }
  }

  // Backup functionality
  private generateBackupId(): string {
    const year = new Date().getFullYear();
    const count = db.select().from(schema.backupLogs).all().length + 1;
    return `BACKUP-${year}-${count.toString().padStart(3, "0")}`;
  }

  async createBackup(
    backupType: string = "auto",
    userId?: string,
  ): Promise<any> {
    const backupId = this.generateBackupId();
    const startTime = new Date().toISOString();

    try {
      // Log backup start
      const backupLog = {
        backupId,
        status: "running",
        backupType,
        startTime,
        createdAt: startTime,
      };

      db.insert(schema.backupLogs).values(backupLog).run();

      // Create backup directory if it doesn't exist
      const backupDir = path.join(process.cwd(), "backups");
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
        console.log(`Created backups directory: ${backupDir}`);
      }

      // Generate backup filename with timestamp (ONLY .db format)
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupFileName = `hospital-backup-${timestamp}.db`;
      const backupPath = path.join(backupDir, backupFileName);

      console.log(`Creating backup using VACUUM INTO: ${backupPath}`);

      // Use VACUUM INTO to create a complete database copy
      // This includes ALL tables, indexes, triggers, and data automatically
      const vacuumQuery = `VACUUM INTO '${backupPath}'`;
      console.log(`Executing: ${vacuumQuery}`);

      db.$client.exec(vacuumQuery);
      console.log(`VACUUM INTO completed successfully`);

      // Verify the file was created
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup file was not created at ${backupPath}`);
      }

      const fileStats = fs.statSync(backupPath);
      console.log(`Backup file size: ${fileStats.size} bytes`);

      const endTime = new Date().toISOString();

      // Count total records across all tables for reporting
      let totalRecords = 0;
      const tables = [
        "users",
        "doctors",
        "patients",
        "patient_visits",
        "services",
        "bills",
        "bill_items",
        "pathology_orders",
        "pathology_tests",
        "patient_services",
        "admissions",
        "admission_events",
        "hospital_settings",
        "system_settings",
        "room_types",
        "rooms",
        "backup_logs",
        "audit_log",
        "activities",
        "patient_payments",
        "patient_discounts",
        "pathology_categories",
        "pathology_category_tests",
        "service_categories",
        "doctor_service_rates",
        "doctor_earnings",
        "doctor_payments",
        "schedule_events",
      ];

      for (const tableName of tables) {
        try {
          const result = db.$client
            .prepare(`SELECT COUNT(*) as count FROM ${tableName}`)
            .get() as { count: number };
          totalRecords += result.count;
        } catch (tableError) {
          console.warn(
            `Could not count records in table ${tableName}:`,
            tableError,
          );
        }
      }

      console.log(
        `Total records backed up: ${totalRecords} across ${tables.length} tables`,
      );

      // Update backup log with success
      db.update(schema.backupLogs)
        .set({
          status: "completed",
          filePath: backupPath,
          fileSize: fileStats.size,
          endTime,
          tableCount: tables.length,
          recordCount: totalRecords,
        })
        .where(eq(schema.backupLogs.backupId, backupId))
        .run();

      console.log(`✓ Backup completed successfully: ${backupId}`);

      // Update system settings with last backup date
      const systemSettings = await this.getSystemSettings();
      if (systemSettings) {
        await this.saveSystemSettings({
          ...systemSettings,
          lastBackupDate: new Date().toISOString().split("T")[0],
        });
      }

      return {
        backupId,
        filePath: backupPath,
        fileName: backupFileName,
        fileSize: fileStats.size,
        recordCount: totalRecords,
        tableCount: tables.length,
        status: "completed",
      };
    } catch (error) {
      console.error("❌ Backup creation error:", error);

      // Update backup log with failure
      db.update(schema.backupLogs)
        .set({
          status: "failed",
          endTime: new Date().toISOString(),
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
        })
        .where(eq(schema.backupLogs.backupId, backupId))
        .run();

      throw error;
    }
  }

  async getBackupLogs(): Promise<any[]> {
    try {
      return db
        .select()
        .from(schema.backupLogs)
        .orderBy(desc(schema.backupLogs.createdAt))
        .limit(50)
        .all();
    } catch (error) {
      console.error("Error fetching backup logs:", error);
      return [];
    }
  }

  async getBackupHistory(): Promise<any[]> {
    try {
      const history = db
        .select()
        .from(schema.backupLogs)
        .where(
          and(
            eq(schema.backupLogs.status, "completed"),
            ne(schema.backupLogs.backupType, "restore"),
          ),
        )
        .orderBy(desc(schema.backupLogs.createdAt))
        .limit(20)
        .all();

      console.log(
        "Backup history query result:",
        history.length,
        "backups found",
      );
      console.log(
        "Backup types in history:",
        history.map((h) => `${h.backupType} - ${h.backupId}`),
      );

      return history;
    } catch (error) {
      console.error("Error fetching backup history:", error);
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
      const oldBackups = db
        .select()
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
          console.warn(
            `Failed to delete backup ${backup.backupId}:`,
            deleteError,
          );
        }
      }

      console.log(`Cleaned up ${oldBackups.length} old backup(s)`);
    } catch (error) {
      console.error("Error cleaning old backups:", error);
    }
  }

  async restoreBackup(backupFilePath: string, userId?: string): Promise<any> {
    try {
      console.log(`Starting restore from: ${backupFilePath}`);

      // Verify backup file exists
      if (!fs.existsSync(backupFilePath)) {
        throw new Error(`Backup file not found: ${backupFilePath}`);
      }

      const stats = fs.statSync(backupFilePath);
      console.log(`File size: ${stats.size} bytes`);

      // Create a safety backup of current database before restore in backups folder
      const backupsDir = path.join(process.cwd(), "backups");
      const safetyBackupPath = path.join(
        backupsDir,
        `hospital-before-restore-${Date.now()}.db`,
      );
      console.log(`Created safety backup at: ${safetyBackupPath}`);
      fs.copyFileSync(dbPath, safetyBackupPath);

      // Clean up old safety backups (keep only the 3 most recent)
      try {
        const safetyBackups = fs
          .readdirSync(backupsDir)
          .filter((file) => file.startsWith("hospital-before-restore-"))
          .map((file) => ({
            name: file,
            path: path.join(backupsDir, file),
            time: fs.statSync(path.join(backupsDir, file)).mtime.getTime(),
          }))
          .sort((a, b) => b.time - a.time);

        // Remove all but the 3 most recent
        for (let i = 3; i < safetyBackups.length; i++) {
          fs.unlinkSync(safetyBackups[i].path);
          console.log(`Removed old safety backup: ${safetyBackups[i].name}`);
        }
      } catch (cleanupError) {
        console.error("Error cleaning up old safety backups:", cleanupError);
      }

      // 1. Save current backup history BEFORE closing database
      console.log("Saving current backup history...");
      const currentBackupHistory = db
        .select()
        .from(schema.backupLogs)
        .orderBy(desc(schema.backupLogs.createdAt))
        .all();

      // 2. Close current database connection
      console.log("Closing current database connection...");
      db.$client.close();
      sqlite.close();

      // 3. Replace database file with backup
      console.log("Replacing database file with backup...");
      fs.copyFileSync(backupFilePath, dbPath);

      // 4. Open new database connection
      console.log("Opening new database connection...");
      sqlite = new Database(dbPath);
      db = drizzle(sqlite, { schema });

      // 5. Restore backup history
      console.log("Restoring backup history...");
      for (const log of currentBackupHistory) {
        try {
          db.insert(schema.backupLogs)
            .values({
              ...log,
              id: undefined, // Let database generate new IDs
            })
            .run();
        } catch (error) {
          console.error("Error restoring backup log:", error);
        }
      }

      // 6. Log the restore operation
      console.log("Logging restore operation...");
      await this.createBackupLog({
        backupId: `RESTORE-${Date.now()}`,
        status: "completed",
        backupType: "restore",
        filePath: backupFilePath,
        fileSize: fs.statSync(backupFilePath).size,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
      });

      console.log("✓ Backup restored successfully");

      // 7. Close database connection before restart
      console.log("Closing database connection before restart...");
      db.$client.close();
      sqlite.close();

      // 8. Schedule application restart immediately
      console.log("Triggering application restart...");
      setTimeout(() => {
        console.log("Restarting application now...");
        process.exit(0);
      }, 100);

      return {
        success: true,
        message: "Backup restored successfully. Application will restart.",
        backupFile: backupFilePath,
      };
    } catch (error) {
      console.error("❌ Backup restore error:", error);
      console.error("Error restoring backup:", error);
      throw error;
    }
  }

  async getAvailableBackups(): Promise<any[]> {
    try {
      const backupDir = path.join(process.cwd(), "backups");

      if (!fs.existsSync(backupDir)) {
        console.log("Backups directory does not exist, creating it...");
        fs.mkdirSync(backupDir, { recursive: true });
        return [];
      }

      const files = fs
        .readdirSync(backupDir)
        .filter((file) => file.endsWith(".db")) // Only .db files
        .map((file) => {
          const filePath = path.join(backupDir, file);
          const stats = fs.statSync(filePath);

          // Get backup log info if available by matching file path
          const backupLog = db
            .select()
            .from(schema.backupLogs)
            .where(
              and(
                like(schema.backupLogs.filePath, `%${file}`),
                eq(schema.backupLogs.status, "completed"),
                ne(schema.backupLogs.backupType, "restore"),
              ),
            )
            .get();

          return {
            fileName: file,
            filePath,
            fileSize: stats.size,
            createdAt: backupLog?.createdAt || stats.birthtime.toISOString(),
            modifiedAt: stats.mtime.toISOString(),
            backupLog: backupLog || null,
          };
        })
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );

      console.log(
        `Found ${files.length} backup files (.db format), ${files.filter((f) => f.backupLog).length} with logs`,
      );
      return files;
    } catch (error) {
      console.error("Error getting available backups:", error);
      return [];
    }
  }

  // Pathology category management
  async createPathologyCategory(
    category: InsertPathologyCategory,
  ): Promise<PathologyCategory> {
    const created = db
      .insert(schema.pathologyCategories)
      .values(category)
      .returning()
      .get();
    return created;
  }

  async getPathologyCategories(): Promise<PathologyCategory[]> {
    return db
      .select()
      .from(schema.pathologyCategories)
      .orderBy(asc(schema.pathologyCategories.name))
      .all();
  }

  async getPathologyCategoryById(
    id: string,
  ): Promise<PathologyCategory | undefined> {
    return db
      .select()
      .from(schema.pathologyCategories)
      .where(eq(schema.pathologyCategories.id, id))
      .get();
  }

  async updatePathologyCategory(
    id: string,
    category: Partial<InsertPathologyCategory>,
  ): Promise<PathologyCategory | undefined> {
    const updated = db
      .update(schema.pathologyCategories)
      .set({ ...category, updatedAt: sql`datetime('now')` })
      .where(eq(schema.pathologyCategories.id, id))
      .returning()
      .get();
    return updated;
  }

  async deletePathologyCategory(id: string): Promise<boolean> {
    try {
      // Check if category has any tests first
      const testsCount = db
        .select()
        .from(schema.pathologyCategoryTests)
        .where(eq(schema.pathologyCategoryTests.categoryId, id))
        .all().length;

      if (testsCount > 0) {
        return false; // Cannot delete category with tests
      }

      const result = db
        .delete(schema.pathologyCategories)
        .where(eq(schema.pathologyCategories.id, id))
        .run();
      return result.changes > 0;
    } catch (error) {
      console.error("Error deleting pathology category:", error);
      return false;
    }
  }

  // Dynamic pathology test management
  async createPathologyCategoryTest(
    test: InsertPathologyCategoryTest,
  ): Promise<PathologyCategoryTest> {
    const created = db
      .insert(schema.pathologyCategoryTests)
      .values(test)
      .returning()
      .get();
    return created;
  }

  async getPathologyCategoryTests(): Promise<PathologyCategoryTest[]> {
    return db
      .select()
      .from(schema.pathologyCategoryTests)
      .orderBy(asc(schema.pathologyCategoryTests.testName))
      .all();
  }

  async getPathologyCategoryTestsByCategory(
    categoryId: string,
  ): Promise<PathologyCategoryTest[]> {
    return db
      .select()
      .from(schema.pathologyCategoryTests)
      .where(
        eq(schema.pathologyCategoryTests.categoryId, categoryId),
      )
      .orderBy(asc(schema.pathologyCategoryTests.testName))
      .all();
  }

  async getPathologyCategoryTestById(
    id: string,
  ): Promise<PathologyCategoryTest | undefined> {
    return db
      .select()
      .from(schema.pathologyCategoryTests)
      .where(eq(schema.pathologyCategoryTests.id, id))
      .get();
  }

  async updatePathologyCategoryTest(
    id: string,
    test: Partial<InsertPathologyCategoryTest>,
  ): Promise<PathologyCategoryTest | undefined> {
    const updated = db
      .update(schema.pathologyCategoryTests)
      .set({ ...test, updatedAt: sql`datetime('now')` })
      .where(eq(schema.pathologyCategoryTests.id, id))
      .returning()
      .get();
    return updated;
  }

  async deletePathologyCategoryTest(id: string): Promise<boolean> {
    try {
      const result = db
        .delete(schema.pathologyCategoryTests)
        .where(eq(schema.pathologyCategoryTests.id, id))
        .run();
      return result.changes > 0;
    } catch (error) {
      console.error("Error deleting pathology category test:", error);
      return false;
    }
  }

  async bulkCreatePathologyCategoryTests(
    tests: InsertPathologyCategoryTest[],
  ): Promise<PathologyCategoryTest[]> {
    const createdTests: PathologyCategoryTest[] = [];

    const transaction = db.transaction(() => {
      for (const test of tests) {
        const created = db
          .insert(schema.pathologyCategoryTests)
          .values(test)
          .returning()
          .get();
        createdTests.push(created);
      }
    });

    transaction();
    return createdTests;
  }

  async logActivity(
    userId: string,
    activityType: string,
    title: string,
    description: string,
    entityId?: string,
    entityType?: string,
    metadata?: any,
  ): Promise<void> {
    try {
      let validUserId = userId;

      // If userId is "system", try to use root user ID, or skip if not found
      if (userId === "system") {
        const rootUser = db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.username, "root"))
          .get();

        if (rootUser) {
          validUserId = rootUser.id;
        } else {
          console.warn(
            "Skipping activity log - root user not found for system activity",
          );
          return;
        }
      } else {
        // Check if user exists before logging activity
        const userExists = db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.id, userId))
          .get();

        if (!userExists) {
          console.warn(`Skipping activity log - user ${userId} not found`);
          return;
        }
      }

      db.insert(schema.activities)
        .values({
          userId: validUserId,
          activityType,
          title,
          description,
          entityId,
          entityType,
          metadata: metadata ? JSON.stringify(metadata) : null,
          createdAt: new Date().toISOString(), // Explicitly set UTC timestamp in ISO 8601 format
        })
        .run();
    } catch (error) {
      console.error("Failed to log activity:", error);
    }
  }

  async getRecentActivities(limit: number = 10): Promise<any[]> {
    try {
      const activities = db.$client
        .prepare(
          `
        SELECT
          a.id,
          a.activity_type as activityType,
          a.title,
          a.description,
          a.entity_id as entityId,
          a.entity_type as entityType,
          a.metadata,
          a.created_at as createdAt,
          CASE
            WHEN a.user_id = 'system' THEN 'System'
            ELSE COALESCE(u.full_name, 'Deleted User')
          END as userName
        FROM activities a
        LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC
        LIMIT ?
      `,
        )
        .all(limit);

      return (activities as any[]).map((activity) => ({
        ...activity,
        metadata: activity.metadata ? JSON.parse(activity.metadata) : null,
      }));
    } catch (error) {
      console.error("Error fetching recent activities:", error);
      return [];
    }
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const created = db
      .insert(schema.activities)
      .values({
        ...activity,
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();
    return created;
  }

  async getDailyReceiptCount(
    serviceType: string,
    date: string,
  ): Promise<number> {
    return this.getDailyReceiptCountSync(serviceType, date);
  }

  getDailyReceiptCountSync(serviceType: string, date: string): number {
    try {
      console.log(`Getting daily receipt count for ${serviceType} on ${date}`);

      // Parse the date to ensure we're using the correct format
      const parsedDate = new Date(date);
      const dateStr = parsedDate.toISOString().split("T")[0];

      console.log(`Using date string: ${dateStr} for counting receipts`);

      let count = 0;

      // Count based on service type
      if (serviceType === "opd") {
        // Count OPD visits for the day by checking receipt numbers
        const opdVisits = db
          .select()
          .from(schema.patientVisits)
          .where(
            and(
              eq(schema.patientVisits.visitType, "opd"),
              sql`DATE(${schema.patientVisits.scheduledDate}) = DATE(${dateStr})`,
              isNotNull(schema.patientVisits.receiptNumber),
            ),
          )
          .all();

        // Find the highest receipt number for today
        let maxNumber = 0;
        const yymmdd = dateStr.slice(2).replace(/-/g, "").slice(0, 6);
        const prefix = `${yymmdd}-OPD-`;

        for (const visit of opdVisits) {
          if (visit.receiptNumber && visit.receiptNumber.startsWith(prefix)) {
            const numPart = visit.receiptNumber.split("-")[2];
            const num = parseInt(numPart, 10);
            if (!isNaN(num) && num > maxNumber) {
              maxNumber = num;
            }
          }
        }

        count = maxNumber;
        console.log(
          `Found ${opdVisits.length} OPD visits for ${dateStr}, max number ${maxNumber}, returning ${count + 1}`,
        );
      } else if (serviceType === "pathology") {
        count =
          db.$client
            .prepare(
              `
            SELECT COUNT(*) as count FROM pathology_orders
            WHERE DATE(ordered_date) = DATE(?)
          `,
            )
            .get(dateStr)?.count || 0;
        console.log(
          `[PATHOLOGY COUNT] Found ${count} existing pathology orders for ${dateStr}`,
        );
      } else if (serviceType === "admission") {
        count =
          db.$client
            .prepare(
              `
            SELECT COUNT(*) as count FROM admission_events
            WHERE event_type = 'admit' AND event_time LIKE ?
          `,
            )
            .get(`${dateStr}%`)?.count || 0;
      } else if (serviceType === "room_transfer") {
        count =
          db.$client
            .prepare(
              `
            SELECT COUNT(*) as count FROM admission_events
            WHERE event_type = 'room_change' AND event_time LIKE ?
          `,
            )
            .get(`${dateStr}%`)?.count || 0;
      } else if (serviceType === "discharge") {
        count =
          db.$client
            .prepare(
              `
            SELECT COUNT(*) as count FROM admission_events
            WHERE event_type = 'discharge' AND event_time LIKE ?
          `,
            )
            .get(`${dateStr}%`)?.count || 0;
      } else if (serviceType === "service") {
        count =
          db.$client
            .prepare(
              `
            SELECT COUNT(*) as count FROM patient_services
            WHERE DATE(scheduled_date) = DATE(?)
            AND receipt_number IS NOT NULL
          `,
            )
            .get(dateStr)?.count || 0;
        console.log(
          `[SERVICE COUNT] Found ${count} existing service orders for ${dateStr}`,
        );
      } else {
        // Default case or other service types
        count = 0;
      }

      return count + 1;
    } catch (error) {
      console.error("Error getting daily receipt count sync:", error);
      return 1; // Return 1 as a fallback to ensure a receipt is generated
    }
  }

  // Schedule Event Management
  async getAllScheduleEvents(): Promise<ScheduleEvent[]> {
    return db
      .select()
      .from(schema.scheduleEvents)
      .orderBy(schema.scheduleEvents.startTime)
      .all();
  }

  async createScheduleEvent(
    event: InsertScheduleEvent,
  ): Promise<ScheduleEvent> {
    return db.insert(schema.scheduleEvents).values(event).returning().get();
  }

  async updateScheduleEvent(
    id: string,
    event: Partial<InsertScheduleEvent>,
  ): Promise<ScheduleEvent | undefined> {
    return db
      .update(schema.scheduleEvents)
      .set({ ...event, updatedAt: new Date().toISOString() })
      .where(eq(schema.scheduleEvents.id, id))
      .returning()
      .get();
  }

  async deleteScheduleEvent(id: string): Promise<void> {
    await db
      .delete(schema.scheduleEvents)
      .where(eq(schema.scheduleEvents.id, id))
      .run();
  }

  async getScheduleEventsByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ScheduleEvent[]> {
    return db
      .select()
      .from(schema.scheduleEvents)
      .where(
        and(
          sql`${schema.scheduleEvents.startTime} >= ${startDate}`,
          sql`${schema.scheduleEvents.startTime} <= ${endDate}`,
        ),
      )
      .orderBy(schema.scheduleEvents.startTime)
      .all();
  }

  async getScheduleEventsByDoctor(doctorId: string): Promise<ScheduleEvent[]> {
    return db
      .select()
      .from(schema.scheduleEvents)
      .where(eq(schema.scheduleEvents.doctorId, doctorId))
      .orderBy(schema.scheduleEvents.startTime)
      .all();
  }

  // Inpatient Management Detail Methods (IST-based calculations)
  async getBedOccupancyDetails(): Promise<any[]> {
    try {
      // Get room types with occupancy details
      const roomTypes = db
        .select()
        .from(schema.roomTypes)
        .where(eq(schema.roomTypes.isActive, true))
        .all();

      const bedOccupancyData = roomTypes.map((roomType) => {
        // Get rooms for this room type
        const rooms = db
          .select()
          .from(schema.rooms)
          .where(
            and(
              eq(schema.rooms.roomTypeId, roomType.id),
              eq(schema.rooms.isActive, true),
            ),
          )
          .all();

        // Get current admissions for rooms of this type
        const currentAdmissions = db
          .select({
            admission: schema.admissions,
            patient: schema.patients,
          })
          .from(schema.admissions)
          .leftJoin(
            schema.patients,
            eq(schema.admissions.patientId, schema.patients.id),
          )
          .where(
            and(
              eq(schema.admissions.status, "admitted"),
              eq(schema.admissions.currentWardType, roomType.name),
            ),
          )
          .all();

        // Map rooms with occupancy info
        const roomsWithOccupancy = rooms.map((room) => {
          const occupyingAdmission = currentAdmissions.find(
            (admission) =>
              admission.admission.currentRoomNumber === room.roomNumber,
          );

          return {
            ...room,
            isOccupied: !!occupyingAdmission,
            occupyingPatient: occupyingAdmission
              ? {
                  name: occupyingAdmission.patient?.name || "Unknown",
                  patientId: occupyingAdmission.patient?.patientId || "Unknown",
                }
              : null,
          };
        });

        // Calculate actual occupied beds from rooms that are occupied
        const actualOccupiedBeds = roomsWithOccupancy.filter(
          (room) => room.isOccupied,
        ).length;

        // Calculate total beds from all active rooms for this room type
        const totalBeds = rooms.reduce(
          (sum, room) => sum + (room.capacity || 1),
          0,
        );

        return {
          ...roomType,
          rooms: roomsWithOccupancy,
          occupiedBeds: actualOccupiedBeds,
          totalBeds: totalBeds,
          // Keep these for backwards compatibility
          actualOccupiedBeds: actualOccupiedBeds,
        };
      });

      return bedOccupancyData;
    } catch (error) {
      console.error("Error getting bed occupancy details:", error);
      return [];
    }
  }

  async getCurrentlyAdmittedPatients(): Promise<any[]> {
    try {
      const currentAdmissions = db
        .select({
          admission: schema.admissions,
          patient: schema.patients,
          doctor: schema.doctors,
        })
        .from(schema.admissions)
        .leftJoin(
          schema.patients,
          eq(schema.admissions.patientId, schema.patients.id),
        )
        .leftJoin(
          schema.doctors,
          eq(schema.admissions.doctorId, schema.doctors.id),
        )
        .where(eq(schema.admissions.status, "admitted"))
        .orderBy(desc(schema.admissions.admissionDate))
        .all();

      return currentAdmissions.map((admission) => ({
        ...admission.admission,
        patient: admission.patient,
        doctor: admission.doctor,
      }));
    } catch (error) {
      console.error("Error getting currently admitted patients:", error);
      return [];
    }
  }

  async getTodayAdmissions(): Promise<any[]> {
    try {
      // Use local system time for date calculation
      const now = new Date();
      const today =
        now.getFullYear() +
        "-" +
        String(now.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(now.getDate()).padStart(2, "0");

      // Create start and end of today for range comparison
      // Use SQL date function to extract just the date part for comparison
      const todayAdmissions = db
        .select({
          admission: schema.admissions,
          patient: schema.patients,
          doctor: schema.doctors,
        })
        .from(schema.admissions)
        .leftJoin(
          schema.patients,
          eq(schema.admissions.patientId, schema.patients.id),
        )
        .leftJoin(
          schema.doctors,
          eq(schema.admissions.doctorId, schema.doctors.id),
        )
        .where(sql`DATE(${schema.admissions.admissionDate}) = ${today}`)
        .orderBy(desc(schema.admissions.createdAt))
        .all();

      return todayAdmissions.map((admission) => ({
        ...admission.admission,
        patient: admission.patient,
        doctor: admission.doctor,
      }));
    } catch (error) {
      console.error("Error getting today's admissions:", error);
      return [];
    }
  }

  async getTodayDischarges(): Promise<any[]> {
    try {
      // Use local system time for date calculation
      const now = new Date();
      const today =
        now.getFullYear() +
        "-" +
        String(now.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(now.getDate()).padStart(2, "0");

      // Use SQL date function to extract just the date part for comparison
      const todayDischarges = db
        .select({
          admission: schema.admissions,
          patient: schema.patients,
          doctor: schema.doctors,
        })
        .from(schema.admissions)
        .leftJoin(
          schema.patients,
          eq(schema.admissions.patientId, schema.patients.id),
        )
        .leftJoin(
          schema.doctors,
          eq(schema.admissions.doctorId, schema.doctors.id),
        )
        .where(
          and(
            eq(schema.admissions.status, "discharged"),
            isNotNull(schema.admissions.dischargeDate),
            sql`DATE(${schema.admissions.dischargeDate}) = ${today}`,
          ),
        )
        .orderBy(desc(schema.admissions.updatedAt))
        .all();

      return todayDischarges.map((admission) => ({
        ...admission.admission,
        patient: admission.patient,
        doctor: admission.doctor,
      }));
    } catch (error) {
      console.error("Error getting today's discharges:", error);
      return [];
    }
  }

  // Service Category Management
  async getServiceCategories(): Promise<ServiceCategory[]> {
    return await db
      .select()
      .from(schema.serviceCategories)
      .where(eq(schema.serviceCategories.isActive, true))
      .orderBy(schema.serviceCategories.name);
  }

  async createServiceCategory(
    category: InsertServiceCategory,
  ): Promise<ServiceCategory> {
    const [serviceCategory] = await db
      .insert(schema.serviceCategories)
      .values(category)
      .returning();
    return serviceCategory;
  }

  async updateServiceCategory(
    id: string,
    category: Partial<InsertServiceCategory>,
  ): Promise<ServiceCategory | undefined> {
    const [updated] = await db
      .update(schema.serviceCategories)
      .set({ ...category, updatedAt: new Date().toISOString() })
      .where(eq(schema.serviceCategories.id, id))
      .returning();
    return updated;
  }

  async deleteServiceCategory(id: string): Promise<boolean> {
    // Check if category has services
    const servicesInCategory = await db
      .select()
      .from(schema.services)
      .where(eq(schema.services.category, id))
      .limit(1);

    if (servicesInCategory.length > 0) {
      throw new Error("Cannot delete category that has services");
    }

    const [deleted] = await db
      .update(schema.serviceCategories)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(schema.serviceCategories.id, id))
      .returning();
    return !!deleted;
  }

  // Comprehensive Bill Generation
  async generateComprehensiveBill(patientId: string): Promise<{
    patient: any;
    billItems: Array<{
      type: "service" | "pathology" | "admission" | "payment" | "discount";
      id: string;
      date: string;
      description: string;
      amount: number;
      category: string;
      quantity?: number;
      details: any;
    }>;
    summary: {
      totalCharges: number;
      totalPayments: number;
      totalDiscounts: number;
      remainingBalance: number;
      lastPaymentDate?: string;
      lastDiscountDate?: string;
    };
  }> {
    try {
      // Get patient details
      const patient = await this.getPatientById(patientId);
      if (!patient) {
        throw new Error("Patient not found");
      }

      const billItems: Array<{
        type: "service" | "pathology" | "admission" | "payment" | "discount";
        id: string;
        date: string;
        description: string;
        amount: number;
        category: string;
        details: any;
      }> = [];

      // 1. OPD Visits (consultation fees from patient_visits table)
      const opdVisits = db
        .select({
          id: schema.patientVisits.id,
          visitId: schema.patientVisits.visitId,
          patientId: schema.patientVisits.patientId,
          doctorId: schema.patientVisits.doctorId,
          visitType: schema.patientVisits.visitType,
          scheduledDate: schema.patientVisits.scheduledDate,
          scheduledTime: schema.patientVisits.scheduledTime,
          consultationFee: schema.patientVisits.consultationFee,
          symptoms: schema.patientVisits.symptoms,
          diagnosis: schema.patientVisits.diagnosis,
          createdAt: schema.patientVisits.createdAt,
          // Doctor info
          doctorName: schema.doctors.name,
          doctorSpecialization: schema.doctors.specialization,
          doctorConsultationFee: schema.doctors.consultationFee,
        })
        .from(schema.patientVisits)
        .leftJoin(
          schema.doctors,
          eq(schema.patientVisits.doctorId, schema.doctors.id),
        )
        .where(
          and(
            eq(schema.patientVisits.patientId, patientId),
            eq(schema.patientVisits.visitType, "opd"),
          ),
        )
        .orderBy(desc(schema.patientVisits.scheduledDate))
        .all();

      // 2. Patient Services (all types except pathology which is handled separately)
      const patientServices = db
        .select({
          id: schema.patientServices.id,
          serviceId: schema.patientServices.serviceId,
          patientId: schema.patientServices.patientId,
          doctorId: schema.patientServices.doctorId,
          serviceType: schema.patientServices.serviceType,
          serviceName: schema.patientServices.serviceName,
          scheduledDate: schema.patientServices.scheduledDate,
          scheduledTime: schema.patientServices.scheduledTime,
          price: schema.patientServices.price,
          calculatedAmount: schema.patientServices.calculatedAmount,
          billingQuantity: schema.patientServices.billingQuantity,
          billingType: schema.patientServices.billingType,
          notes: schema.patientServices.notes,
          createdAt: schema.patientServices.createdAt,
          // Doctor info
          doctorName: schema.doctors.name,
          doctorSpecialization: schema.doctors.specialization,
        })
        .from(schema.patientServices)
        .leftJoin(
          schema.doctors,
          eq(schema.patientServices.doctorId, schema.doctors.id),
        )
        .where(eq(schema.patientServices.patientId, patientId))
        .orderBy(desc(schema.patientServices.scheduledDate))
        .all();

      // 3. Get admissions data for calculating admission service durations
      const admissions = db
        .select()
        .from(schema.admissions)
        .where(eq(schema.admissions.patientId, patientId))
        .orderBy(desc(schema.admissions.admissionDate))
        .all();

      // Get admission doctors for context
      const admissionDoctorIds = admissions
        .map((a) => a.doctorId)
        .filter(Boolean) as string[];
      const admissionDoctors = new Map<string, string>();
      if (admissionDoctorIds.length > 0) {
        const doctors = db
          .select()
          .from(schema.doctors)
          .where(inArray(schema.doctors.id, admissionDoctorIds))
          .all();
        doctors.forEach((doctor) => {
          admissionDoctors.set(doctor.id, doctor.name);
        });
      }

      // Add OPD visits as bill items
      opdVisits.forEach((visit) => {
        const amount =
          visit.consultationFee || visit.doctorConsultationFee || 0;
        if (amount > 0) {
          // Handle doctor name to avoid duplicate "Dr." prefix
          const doctorName = visit.doctorName || "Unknown Doctor";
          const formattedDoctorName = doctorName.startsWith("Dr.")
            ? doctorName
            : `Dr. ${doctorName}`;

          billItems.push({
            type: "service",
            id: visit.id,
            date: visit.scheduledDate || visit.createdAt,
            description: `OPD Consultation - ${formattedDoctorName}${visit.symptoms ? ` (${visit.symptoms})` : ""}`,
            amount: amount,
            category: "OPD Consultation",
            details: {
              visitId: visit.visitId,
              doctorName: visit.doctorName,
              doctorSpecialization: visit.doctorSpecialization,
              scheduledTime: visit.scheduledTime,
              symptoms: visit.symptoms,
              diagnosis: visit.diagnosis,
              consultationFee: visit.consultationFee,
              quantity: 1,
              billingQuantity: 1,
            },
          });
        }
      });

      // Add patient services with daily calculation for admission services
      patientServices.forEach((ps) => {
        let serviceAmount =
          (ps.calculatedAmount as number) || (ps.price as number) || 0;
        let serviceQuantity = ps.billingQuantity || 1;

        // For admission services, calculate based on patient's stay duration
        if (ps.serviceType === "admission") {
          // Find the admission for this patient to get stay duration
          const patientAdmissions = admissions.filter(
            (admission) => admission.patientId === patientId,
          );

          if (patientAdmissions.length > 0) {
            // Use the most recent admission or find matching admission by date
            let relevantAdmission = patientAdmissions[0];

            // Try to find admission that matches the service date
            const matchingAdmission = patientAdmissions.find((admission) => {
              const admissionDate = new Date(
                admission.admissionDate,
              ).toDateString();
              const serviceDate = new Date(
                ps.scheduledDate || ps.createdAt,
              ).toDateString();
              return admissionDate === serviceDate;
            });

            if (matchingAdmission) {
              relevantAdmission = matchingAdmission;
            }

            // Calculate stay duration using the calculateStayDays function
            const endDate =
              relevantAdmission.dischargeDate || new Date().toISOString();
            const stayDuration = calculateStayDays(
              relevantAdmission.admissionDate,
              endDate,
            );

            if (stayDuration > 0) {
              if (ps.serviceName.toLowerCase().includes("bed charges")) {
                // Bed charges: charge for each completed 24-hour period
                serviceQuantity = stayDuration;
                serviceAmount = (ps.price || 0) * serviceQuantity;
              } else if (
                ps.serviceName.toLowerCase().includes("doctor charges") ||
                ps.serviceName.toLowerCase().includes("nursing charges") ||
                ps.serviceName.toLowerCase().includes("rmo charges")
              ) {
                // Other admission services: charge for each calendar day
                serviceQuantity = stayDuration;
                serviceAmount = (ps.price || 0) * serviceQuantity;
              }
            }
          }
        }

        if (serviceAmount > 0) {
          billItems.push({
            type: "service",
            id: ps.id,
            date: ps.scheduledDate || ps.createdAt,
            description: ps.serviceName,
            amount: serviceAmount,
            category: "service",
            details: {
              serviceId: ps.serviceId,
              serviceName: ps.serviceName,
              serviceType: ps.serviceType,
              billingType: ps.billingType,
              billingQuantity: ps.billingQuantity,
              unitPrice: ps.price,
              calculatedAmount: serviceAmount,
              notes: ps.notes,
              quantity: serviceQuantity,
            },
          });
        }
      });

      // 3. Pathology Orders
      const pathologyOrders = db
        .select({
          order: schema.pathologyOrders,
          doctor: schema.doctors,
        })
        .from(schema.pathologyOrders)
        .leftJoin(
          schema.doctors,
          eq(schema.pathologyOrders.doctorId, schema.doctors.id),
        )
        .where(eq(schema.pathologyOrders.patientId, patientId))
        .all();

      pathologyOrders.forEach((po) => {
        if (po.order.totalPrice > 0) {
          // Get tests for this order
          const tests = db
            .select()
            .from(schema.pathologyTests)
            .where(eq(schema.pathologyTests.orderId, po.order.id))
            .all();

          billItems.push({
            type: "pathology",
            id: po.order.id,
            date: po.order.orderedDate,
            description: `Pathology Tests - Order ${po.order.orderId}`,
            amount: po.order.totalPrice,
            category: "pathology",
            details: {
              doctor:
                po.doctor?.name ||
                (po.order.doctorId ? "Unknown Doctor" : "No Doctor Assigned"),
              receiptNumber: po.order.receiptNumber,
              status: po.order.status,
              testsCount: tests.length,
              quantity: 1, // Always 1 for pathology orders (one order)
              tests: tests.map((t) => ({
                name: t.testName,
                category: t.testCategory,
                price: t.price,
              })),
            },
          });
        }
      });

      // 4. Admissions and associated events
      // Admissions themselves are not added as bill items, but their payments/discounts are.
      // Thecharges for admission services are handled in `patientServices`.

      // 5. Patient Payments
      const payments = db
        .select()
        .from(schema.patientPayments)
        .where(eq(schema.patientPayments.patientId, patientId))
        .all();

      payments.forEach((payment) => {
        billItems.push({
          type: "payment",
          id: payment.id,
          date: payment.paymentDate,
          description: `Payment - ${payment.paymentMethod.toUpperCase()}`,
          amount: -payment.amount, // Negative for payments
          category: "payment",
          details: {
            paymentId: payment.paymentId,
            paymentMethod: payment.paymentMethod,
            receiptNumber: payment.receiptNumber,
            reason: payment.reason,
            quantity: 1,
          },
        });
      });

      // Add admission payments (initial deposits and additional payments)
      admissions.forEach((admission) => {
        if (admission.initialDeposit && admission.initialDeposit > 0) {
          billItems.push({
            type: "payment",
            id: `${admission.id}-initial-deposit`,
            date: admission.admissionDate,
            description: `Initial Deposit - ${admission.admissionId}`,
            amount: -admission.initialDeposit, // Negative for payments
            category: "payment",
            details: {
              admissionId: admission.admissionId,
              paymentMethod: "cash",
              reason: "Initial admission deposit",
              quantity: 1,
            },
          });
        }

        if (admission.additionalPayments && admission.additionalPayments > 0) {
          billItems.push({
            type: "payment",
            id: `${admission.id}-additional-payments`,
            date: admission.lastPaymentDate || admission.updatedAt,
            description: `Additional Payments - ${admission.admissionId}`,
            amount: -admission.additionalPayments, // Negative for payments
            category: "payment",
            details: {
              admissionId: admission.admissionId,
              paymentMethod: "cash",
              reason: "Additional admission payments",
              quantity: 1,
            },
          });
        }
      });

      // 6. Patient Discounts
      const discounts = db
        .select()
        .from(schema.patientDiscounts)
        .where(eq(schema.patientDiscounts.patientId, patientId))
        .all();

      discounts.forEach((discount) => {
        billItems.push({
          type: "discount",
          id: discount.id,
          date: discount.discountDate,
          description: `Discount - ${discount.discountType.replace("_", " ").toUpperCase()}`,
          amount: -discount.amount, // Negative for discounts
          category: "discount",
          details: {
            discountId: discount.discountId,
            discountType: discount.discountType,
            reason: discount.reason,
            quantity: 1,
          },
        });
      });

      // Add admission discounts for backwards compatibility
      admissions.forEach((admission) => {
        if (admission.totalDiscount && admission.totalDiscount > 0) {
          billItems.push({
            type: "discount",
            id: `${admission.id}-discount`,
            date: admission.lastDiscountDate || admission.updatedAt,
            description: `Admission Discount - ${admission.admissionId}`,
            amount: -admission.totalDiscount, // Negative for discounts
            category: "discount",
            details: {
              admissionId: admission.admissionId,
              discountType: "admission",
              reason: admission.lastDiscountReason || "Admission discount",
              quantity: 1,
            },
          });
        }
      });

      // Sort all items by date (oldest first)
      billItems.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );

      // Calculate summary
      const totalCharges = billItems
        .filter((item) => item.amount > 0)
        .reduce((sum, item) => sum + item.amount, 0);

      const totalPayments = Math.abs(
        billItems
          .filter((item) => item.type === "payment")
          .reduce((sum, item) => sum + item.amount, 0),
      );

      const totalDiscounts = Math.abs(
        billItems
          .filter((item) => item.type === "discount")
          .reduce((sum, item) => sum + item.amount, 0),
      );

      const remainingBalance = totalCharges - totalPayments - totalDiscounts;

      const lastPayment = billItems.find((item) => item.type === "payment");
      const lastDiscount = billItems.find((item) => item.type === "discount");

      return {
        patient,
        billItems,
        summary: {
          totalCharges,
          totalPayments,
          totalDiscounts,
          remainingBalance,
          lastPaymentDate: lastPayment?.date,
          lastDiscountDate: lastDiscount?.date,
        },
      };
    } catch (error) {
      console.error("Error generating comprehensive bill:", error);
      throw error;
    }
  }

  // Doctor Service Rate Management
  async createDoctorServiceRate(
    rate: InsertDoctorServiceRate,
  ): Promise<DoctorServiceRate> {
    const created = db
      .insert(schema.doctorServiceRates)
      .values(rate)
      .returning()
      .get();
    return created;
  }

  async getDoctorServiceRates(doctorId?: string): Promise<DoctorServiceRate[]> {
    const query = db.select().from(schema.doctorServiceRates);
    if (doctorId) {
      return query
        .where(eq(schema.doctorServiceRates.doctorId, doctorId))
        .all();
    }
    return query.all();
  }

  async getDoctorServiceRateById(
    id: string,
  ): Promise<DoctorServiceRate | undefined> {
    return db
      .select()
      .from(schema.doctorServiceRates)
      .where(eq(schema.doctorServiceRates.id === id, id))
      .get();
  }

  async updateDoctorServiceRate(
    id: string,
    rate: Partial<InsertDoctorServiceRate>,
  ): Promise<DoctorServiceRate | undefined> {
    const updated = db
      .update(schema.doctorServiceRates)
      .set({ ...rate, updatedAt: new Date().toISOString() })
      .where(eq(schema.doctorServiceRates.id, id))
      .returning()
      .get();
    return updated;
  }

  async deleteDoctorServiceRate(id: string): Promise<boolean> {
    const deleted = db
      .delete(schema.doctorServiceRates)
      .where(eq(schema.doctorServiceRates.id, id))
      .returning()
      .get();
    return !!deleted;
  }

  async getDoctorPendingEarnings(doctorId: string): Promise<DoctorEarning[]> {
    return db
      .select()
      .from(schema.doctorEarnings)
      .where(
        and(
          eq(schema.doctorEarnings.doctorId, doctorId),
          eq(schema.doctorEarnings.status, "pending"),
        ),
      )
      .orderBy(desc(schema.doctorEarnings.serviceDate))
      .all();
  }

  // Recalculate doctor earnings for services that have doctors assigned but no earnings
  async recalculateDoctorEarnings(
    doctorId?: string,
  ): Promise<{ processed: number; created: number }> {
    console.log(
      `Starting recalculation of doctor earnings${doctorId ? ` for doctor ${doctorId}` : " for all doctors"}`,
    );

    let processed = 0;
    let created = 0;

    try {
      // Get all patient services that have a doctor assigned
      let patientServicesQuery = db
        .select()
        .from(schema.patientServices)
        .where(isNotNull(schema.patientServices.doctorId));

      if (doctorId) {
        patientServicesQuery = patientServicesQuery.where(
          eq(schema.patientServices.doctorId, doctorId),
        );
      }

      const patientServices = patientServicesQuery.all();
      console.log(
        `Found ${patientServices.length} patient services to process`,
      );

      for (const patientService of patientServices) {
        processed++;

        // Check if earning already exists for this patient service
        const existingEarning = db
          .select()
          .from(schema.doctorEarnings)
          .where(eq(schema.doctorEarnings.patientServiceId, patientService.id))
          .get();

        if (existingEarning) {
          console.log(
            `Earning already exists for patient service ${patientService.id}`,
          );
          continue;
        }

        // Get service details
        const service = db
          .select()
          .from(schema.services)
          .where(eq(schema.services.id, patientService.serviceId))
          .get();

        if (!service) {
          console.log(
            `Service not found for patient service ${patientService.id}`,
          );
          continue;
        }

        // Find doctor service rate - check by service ID or by service name for flexible matching
        let doctorRate = db
          .select()
          .from(schema.doctorServiceRates)
          .where(
            and(
              eq(schema.doctorServiceRates.doctorId, patientService.doctorId!),
              eq(schema.doctorServiceRates.serviceId, service.id),
              eq(schema.doctorServiceRates.isActive, true),
            ),
          )
          .get();

        // If no rate found by service ID, try matching by service name (for flexible matching)
        if (!doctorRate) {
          doctorRate = db
            .select()
            .from(schema.doctorServiceRates)
            .where(
              and(
                eq(
                  schema.doctorServiceRates.doctorId,
                  patientService.doctorId!,
                ),
                eq(schema.doctorServiceRates.serviceName, service.name),
                eq(schema.doctorServiceRates.isActive, true),
              ),
            )
            .get();
        }

        if (!doctorRate) {
          console.log(
            `No salary rate found for doctor ${patientService.doctorId} and service ${service.id} (${service.name})`,
          );
          continue;
        }

        // Calculate earning amount based on rate type
        let earnedAmount = 0;
        const servicePrice =
          patientService.calculatedAmount ||
          patientService.price ||
          service.price;

        if (doctorRate.rateType === "percentage") {
          earnedAmount = (servicePrice * doctorRate.rateAmount) / 100;
        } else if (doctorRate.rateType === "amount") {
          earnedAmount = doctorRate.rateAmount;
        } else if (doctorRate.rateType === "fixed_daily") {
          earnedAmount = doctorRate.rateAmount;
        }

        // Create doctor earning record using storage interface method
        try {
          await this.createDoctorEarning({
            doctorId: patientService.doctorId!,
            patientId: patientService.patientId,
            serviceId: service.id,
            patientServiceId: patientService.id,
            serviceName: service.name,
            serviceCategory: doctorRate.serviceCategory,
            serviceDate: patientService.scheduledDate,
            rateType: doctorRate.rateType,
            rateAmount: doctorRate.rateAmount,
            servicePrice,
            earnedAmount,
            status: "pending",
            notes: `Recalculation for ${service.name}`,
          });

          created++;
          console.log(
            `Created earning for doctor ${patientService.doctorId}: ₹${earnedAmount}`,
          );
        } catch (error) {
          console.error(
            `Error creating earning for patient service ${patientService.id}:`,
            error,
          );
        }
      }

      console.log(
        `Recalculation complete: processed ${processed} services, created ${created} new earnings`,
      );
      return { processed, created };
    } catch (error) {
      console.error("Error recalculating doctor earnings:", error);
      throw error;
    }
  }

  // Get doctor earnings by doctor ID and optional status filter
  async getDoctorEarnings(
    doctorId?: string,
    status?: string,
  ): Promise<DoctorEarning[]> {
    try {
      console.log(
        `Fetching doctor earnings - doctorId: ${doctorId}, status: ${status}`,
      );

      const whereConditions: any[] = [];

      if (doctorId) {
        whereConditions.push(eq(schema.doctorEarnings.doctorId, doctorId));
      }

      if (status && status !== "all") {
        whereConditions.push(eq(schema.doctorEarnings.status, status));
      }

      const query =
        whereConditions.length > 0
          ? db
              .select()
              .from(schema.doctorEarnings)
              .where(and(...whereConditions))
          : db.select().from(schema.doctorEarnings);

      const earnings = query
        .orderBy(desc(schema.doctorEarnings.serviceDate))
        .all();

      console.log(`Found ${earnings.length} earnings for doctor ${doctorId}`);
      return earnings;
    } catch (error) {
      console.error("Error fetching doctor earnings:", error);
      return [];
    }
  }

  // Create a new doctor earning record
  async createDoctorEarning(
    earning: InsertDoctorEarning,
  ): Promise<DoctorEarning> {
    try {
      const earningId = this.generateEarningId();

      const created = db
        .insert(schema.doctorEarnings)
        .values({
          ...earning,
          earningId,
        })
        .returning()
        .get();

      console.log(
        `Created doctor earning: ${earningId} for amount ${created.earnedAmount}`,
      );
      return created;
    } catch (error) {
      console.error("Error creating doctor earning:", error);
      throw error;
    }
  }

  // Get a specific doctor earning by ID
  async getDoctorEarningById(id: string): Promise<DoctorEarning | undefined> {
    try {
      return db
        .select()
        .from(schema.doctorEarnings)
        .where(eq(schema.doctorEarnings.id, id))
        .get();
    } catch (error) {
      console.error("Error fetching doctor earning by ID:", error);
      throw error;
    }
  }

  // Update the status of a doctor earning record
  async updateDoctorEarningStatus(
    id: string,
    status: string,
  ): Promise<DoctorEarning | undefined> {
    try {
      const updated = db
        .update(schema.doctorEarnings)
        .set({
          status: status as any,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.doctorEarnings.id, id))
        .returning()
        .get();

      console.log(`Updated doctor earning ${id} status to ${status}`);
      return updated;
    } catch (error) {
      console.error("Error updating doctor earning status:", error);
      throw error;
    }
  }

  // Batch save/update doctor service rates
  async saveDoctorServiceRates(
    doctorId: string,
    rates: any[],
    userId: string,
  ): Promise<void> {
    try {
      console.log(
        `Saving ${rates.length} service rates for doctor ${doctorId}`,
      );

      // Delete all existing rates for this doctor
      db.delete(schema.doctorServiceRates)
        .where(eq(schema.doctorServiceRates.doctorId, doctorId))
        .run();

      // Insert new rates
      for (const rate of rates) {
        if (rate.isSelected && rate.salaryBasis) {
          // Check if serviceId is a placeholder (doesn't exist in services table)
          // Representative entries like opd_consultation_placeholder and pathology_test_placeholder
          let serviceId: string | null = rate.serviceId;
          if (serviceId) {
            const serviceExists = db
              .select()
              .from(schema.services)
              .where(eq(schema.services.id, serviceId))
              .get();

            if (!serviceExists) {
              // Service doesn't exist in the table - it's a placeholder
              // For pathology, use pathology_test_placeholder; for OPD, use opd_consultation_placeholder
              if (rate.serviceCategory === "pathology") {
                serviceId = "pathology_test_placeholder";
              } else if (rate.serviceCategory === "opd") {
                serviceId = "opd_consultation_placeholder";
              } else {
                serviceId = null;
              }
            }
          }

          await this.createDoctorServiceRate({
            doctorId,
            serviceId,
            serviceName: rate.serviceName,
            serviceCategory: rate.serviceCategory,
            rateType: rate.salaryBasis, // 'amount' or 'percentage'
            rateAmount:
              rate.salaryBasis === "amount" ? rate.amount : rate.percentage,
            isActive: true,
            createdBy: userId, // Use authenticated user ID
          });
        }
      }

      console.log(`Successfully saved service rates for doctor ${doctorId}`);
    } catch (error) {
      console.error("Error saving doctor service rates:", error);
      throw error;
    }
  }

  // Mark all pending earnings for a doctor as paid
  async markDoctorEarningsPaid(
    doctorId: string,
    userId: string,
    paymentMethod: string = "cash",
  ): Promise<number> {
    try {
      const pendingEarnings = await this.getDoctorPendingEarnings(doctorId);

      if (pendingEarnings.length === 0) {
        return 0;
      }

      const totalAmount = pendingEarnings.reduce(
        (sum, e) => sum + e.earnedAmount,
        0,
      );
      const earningIds = pendingEarnings.map((e) => e.id);

      // Get date range of earnings
      const dates = pendingEarnings.map((e) => new Date(e.serviceDate));
      const startDate = new Date(Math.min(...dates.map((d) => d.getTime())))
        .toISOString()
        .split("T")[0];
      const endDate = new Date(Math.max(...dates.map((d) => d.getTime())))
        .toISOString()
        .split("T")[0];

      // Create payment record
      const paymentId = this.generateDoctorPaymentId();
      const payment = db
        .insert(schema.doctorPayments)
        .values({
          paymentId,
          doctorId,
          paymentDate: new Date().toISOString().split("T")[0],
          totalAmount,
          paymentMethod,
          earningsIncluded: JSON.stringify(earningIds),
          startDate,
          endDate,
          description: `Payment for ${earningIds.length} service(s)`,
          processedBy: userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .returning()
        .get();

      // Update all pending earnings to paid
      for (const earningId of earningIds) {
        db.update(schema.doctorEarnings)
          .set({
            status: "paid",
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.doctorEarnings.id, earningId))
          .run();
      }

      // Log activity
      await this.logActivity(
        userId,
        "doctor_payment_made",
        "Doctor Payment Settlement Completed",
        `Payment of ₹${totalAmount} made to doctor`,
        payment.id,
        "doctor_payment",
        {
          doctorId,
          paymentId,
          amount: totalAmount,
          earningsCount: earningIds.length,
        },
      );

      return earningIds.length;
    } catch (error) {
      console.error("Error marking doctor earnings as paid:", error);
      throw error;
    }
  }

  // Mark a single earning as paid
  async markEarningAsPaid(
    earningId: string,
    userId: string,
    paymentMethod: string = "individual_earning",
  ): Promise<DoctorEarning | undefined> {
    try {
      // Get the earning by earningId (human-readable ID like "EARN-2025-037")
      const earning = db
        .select()
        .from(schema.doctorEarnings)
        .where(eq(schema.doctorEarnings.earningId, earningId))
        .get();

      if (!earning) {
        console.log(`Earning ${earningId} not found`);
        return undefined;
      }

      // Check if already paid
      if (earning.status === "paid") {
        console.log(`Earning ${earningId} is already marked as paid`);
        return earning;
      }

      // Create payment record to track this individual earning payment
      const paymentId = this.generateDoctorPaymentId();
      const payment = db
        .insert(schema.doctorPayments)
        .values({
          paymentId,
          doctorId: earning.doctorId,
          paymentDate: new Date().toISOString().split("T")[0],
          totalAmount: earning.earnedAmount,
          paymentMethod,
          earningsIncluded: JSON.stringify([earning.id]),
          startDate: earning.serviceDate,
          endDate: earning.serviceDate,
          description: `Payment for 1 service: ${earning.serviceName} (${earning.earningId})`,
          processedBy: userId,
          notes: `Individual earning payment processed`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .returning()
        .get();

      // Update the earning status to paid
      const updated = db
        .update(schema.doctorEarnings)
        .set({
          status: "paid",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.doctorEarnings.earningId, earningId))
        .returning()
        .get();

      // Log activity
      await this.logActivity(
        userId,
        "earning_marked_paid",
        "Earning Marked as Paid",
        `Earning ${earning.earningId} marked as paid (Payment: ${paymentId})`,
        earning.id,
        "doctor_earning",
        {
          earningId: earning.earningId,
          doctorId: earning.doctorId,
          amount: earning.earnedAmount,
          paymentId: paymentId,
        },
      );

      return updated as DoctorEarning;
    } catch (error) {
      console.error("Error marking earning as paid:", error);
      throw error;
    }
  }

  // Calculate and create doctor earning for an OPD visit
  async calculateDoctorEarningForVisit(
    visitId: string,
  ): Promise<DoctorEarning | null> {
    try {
      console.log(`Calculating doctor earning for visit ${visitId}`);

      // Get the visit details by visitId string (e.g., "VIS-2025-000001")
      const visit = db
        .select()
        .from(schema.patientVisits)
        .where(eq(schema.patientVisits.visitId, visitId))
        .get();

      if (!visit) {
        console.log(`Visit ${visitId} not found`);
        return null;
      }

      // Check if visit is OPD
      if (visit.visitType !== "opd") {
        console.log(
          `Visit ${visitId} is not an OPD visit (type: ${visit.visitType})`,
        );
        return null;
      }

      // Check if earning already exists for this visit
      const existingEarning = db
        .select()
        .from(schema.doctorEarnings)
        .where(
          and(
            eq(schema.doctorEarnings.doctorId, visit.doctorId),
            sql`${schema.doctorEarnings.notes} LIKE ${"%" + visit.visitId + "%"}`,
          ),
        )
        .get();

      if (existingEarning) {
        console.log(`Earning already exists for visit ${visitId}`);
        return existingEarning;
      }

      // Get doctor service rate for OPD consultation
      // Look for "opd_consultation_placeholder" or matching OPD service
      const doctorRate = db
        .select()
        .from(schema.doctorServiceRates)
        .where(
          and(
            eq(schema.doctorServiceRates.doctorId, visit.doctorId),
            eq(schema.doctorServiceRates.serviceCategory, "opd"),
            eq(schema.doctorServiceRates.isActive, true),
          ),
        )
        .get();

      if (!doctorRate) {
        console.log(
          `No OPD commission rate found for doctor ${visit.doctorId}`,
        );
        return null;
      }

      // Calculate earning amount
      const consultationFee = visit.consultationFee || 0;
      let earnedAmount = 0;

      if (doctorRate.rateType === "percentage") {
        earnedAmount = (consultationFee * doctorRate.rateAmount) / 100;
      } else if (doctorRate.rateType === "amount") {
        earnedAmount = doctorRate.rateAmount;
      }

      // Create earning record
      const earning = await this.createDoctorEarning({
        doctorId: visit.doctorId,
        patientId: visit.patientId,
        serviceId: doctorRate.serviceId,
        patientServiceId: null,
        serviceName: "OPD Consultation",
        serviceCategory: "opd",
        serviceDate: visit.visitDate,
        rateType: doctorRate.rateType,
        rateAmount: doctorRate.rateAmount,
        servicePrice: consultationFee,
        earnedAmount,
        status: "pending",
        notes: `OPD Visit ${visit.visitId}`,
      });

      console.log(
        `Created earning ${earning.earningId} for visit ${visitId}: ₹${earnedAmount}`,
      );
      return earning;
    } catch (error) {
      console.error("Error calculating doctor earning for visit:", error);
      throw error;
    }
  }

  // New function for bulk pending bills
  async getAllPatientsPendingBills(): Promise<any[]> {
    try {
      console.log("Fetching all patients with pending bills...");

      // Get all active patients
      const allPatients = db
        .select()
        .from(schema.patients)
        .where(eq(schema.patients.isActive, true))
        .all();

      console.log(`Found ${allPatients.length} active patients`);

      // For each patient, use the same calculation as getPatientFinancialSummary
      const patientsWithPending = [];

      for (const patient of allPatients) {
        try {
          // Use the existing financial summary method for consistency
          const summary = await this.getPatientFinancialSummary(patient.id);

          // Only include patients with positive balance
          if (summary.balance > 0) {
            patientsWithPending.push({
              ...patient,
              pendingAmount: summary.balance,
            });
          }
        } catch (error) {
          console.error(
            `Error calculating pending bills for patient ${patient.id}:`,
            error,
          );
          // Skip this patient if there's an error
          continue;
        }
      }

      console.log(
        `Found ${patientsWithPending.length} patients with pending bills`,
      );
      return patientsWithPending;
    } catch (error) {
      console.error("Error fetching patients with pending bills:", error);
      return [];
    }
  }

  // ============ AUDIT LOGGING METHODS ============

  /**
   * Check if audit logging is enabled in system settings
   */
  async isAuditLoggingEnabled(): Promise<boolean> {
    try {
      const settings = await this.getSystemSettings();
      return settings?.auditLogging === true;
    } catch (error) {
      console.error("Error checking audit logging status:", error);
      return false; // Default to disabled on error
    }
  }

  /**
   * Helper function to compare old and new values and identify changed fields
   */
  private getChangedFields(
    oldValues: any,
    newValues: any,
  ): { changedFields: string[]; oldData: any; newData: any } {
    const changed: string[] = [];
    const oldData: any = {};
    const newData: any = {};

    // Get all unique keys from both objects
    const allKeys = new Set([
      ...Object.keys(oldValues || {}),
      ...Object.keys(newValues || {}),
    ]);

    for (const key of allKeys) {
      // Skip metadata fields
      if (["createdAt", "updatedAt", "id"].includes(key)) {
        continue;
      }

      const oldVal = oldValues?.[key];
      const newVal = newValues?.[key];

      // Compare values (handle null/undefined)
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changed.push(key);
        oldData[key] = oldVal;
        newData[key] = newVal;
      }
    }

    return {
      changedFields: changed,
      oldData,
      newData,
    };
  }

  /**
   * Create an audit log entry
   */
  async createAuditLog(params: {
    userId: string;
    username: string;
    action: "create" | "update" | "delete" | "view";
    tableName: string;
    recordId: string;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      // Check if audit logging is enabled
      const isEnabled = await this.isAuditLoggingEnabled();
      if (!isEnabled) {
        return; // Silently skip if disabled
      }

      const { changedFields, oldData, newData } = this.getChangedFields(
        params.oldValues,
        params.newValues,
      );

      // Insert audit log
      db.insert(schema.auditLog)
        .values({
          userId: params.userId,
          username: params.username,
          action: params.action,
          tableName: params.tableName,
          recordId: params.recordId,
          oldValues: params.oldValues ? JSON.stringify(oldData) : null,
          newValues: params.newValues ? JSON.stringify(newData) : null,
          changedFields:
            changedFields.length > 0 ? JSON.stringify(changedFields) : null,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
        })
        .run();

      console.log(
        `Audit log created: ${params.action} on ${params.tableName} by ${params.username}`,
      );
    } catch (error) {
      // Log error but don't throw - audit logging should not break the app
      console.error("Error creating audit log:", error);
    }
  }

  /**
   * Get audit logs with optional filters
   */
  async getAuditLogs(filters: {
    userId?: string;
    tableName?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    try {
      const whereConditions: any[] = [];

      if (filters.userId) {
        whereConditions.push(eq(schema.auditLog.userId, filters.userId));
      }

      if (filters.tableName) {
        whereConditions.push(eq(schema.auditLog.tableName, filters.tableName));
      }

      if (filters.action) {
        whereConditions.push(eq(schema.auditLog.action, filters.action));
      }

      if (filters.startDate) {
        whereConditions.push(
          sql`${schema.auditLog.createdAt} >= ${filters.startDate}`,
        );
      }

      if (filters.endDate) {
        whereConditions.push(
          sql`${schema.auditLog.createdAt} <= ${filters.endDate}`,
        );
      }

      // Get total count
      const countQuery =
        whereConditions.length > 0
          ? db
              .select({ count: sql<number>`count(*)` })
              .from(schema.auditLog)
              .where(and(...whereConditions))
          : db.select({ count: sql<number>`count(*)` }).from(schema.auditLog);

      const countResult = countQuery.get();
      const total = countResult?.count || 0;

      // Get logs with pagination
      const query =
        whereConditions.length > 0
          ? db
              .select()
              .from(schema.auditLog)
              .where(and(...whereConditions))
          : db.select().from(schema.auditLog);

      const logs = query
        .orderBy(desc(schema.auditLog.createdAt))
        .limit(filters.limit || 50)
        .offset(filters.offset || 0)
        .all();

      return { logs, total };
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      return { logs: [], total: 0 };
    }
  }

  /**
   * Archive audit logs to audit_log_backup table based on fiscalyear
   */
  async archiveAuditLogs(fiscalYear: string): Promise<{
    archived: number;
    deleted: number;
  }> {
    try {
      const settings = await this.getSystemSettings();

      // Calculate the date range for the fiscal year
      const [startYear, endYear] = fiscalYear.split("-").map(Number);
      const fiscalStartMonth = settings.fiscalYearStartMonth || 4;
      const fiscalStartDay = settings.fiscalYearStartDay || 1;

      const startDate = new Date(
        startYear,
        fiscalStartMonth - 1,
        fiscalStartDay,
      );
      const endDate = new Date(endYear, fiscalStartMonth - 1, fiscalStartDay);

      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      // Get logs to archive
      const logsToArchive = db
        .select()
        .from(schema.auditLog)
        .where(
          and(
            sql`${schema.auditLog.createdAt} >= ${startDateStr}`,
            sql`${schema.auditLog.createdAt} < ${endDateStr}`,
          ),
        )
        .all();

      if (logsToArchive.length === 0) {
        console.log(`No logs found for fiscal year ${fiscalYear}`);
        return { archived: 0, deleted: 0 };
      }

      // Insert into backup table
      for (const log of logsToArchive) {
        db.insert(schema.auditLogBackup)
          .values({
            userId: log.userId,
            username: log.username,
            action: log.action,
            tableName: log.tableName,
            recordId: log.recordId,
            oldValues: log.oldValues,
            newValues: log.newValues,
            changedFields: log.changedFields,
            ipAddress: log.ipAddress,
            userAgent: log.userAgent,
            fiscalYear,
            createdAt: log.createdAt,
          })
          .run();
      }

      // Delete from active table
      db.delete(schema.auditLog)
        .where(
          and(
            sql`${schema.auditLog.createdAt} >= ${startDateStr}`,
            sql`${schema.auditLog.createdAt} < ${endDateStr}`,
          ),
        )
        .run();

      // Update last archive date
      await this.saveSystemSettings({
        lastAuditArchiveDate: new Date().toISOString(),
      });

      console.log(
        `Archived ${logsToArchive.length} audit logs for fiscal year ${fiscalYear}`,
      );
      return { archived: logsToArchive.length, deleted: logsToArchive.length };
    } catch (error) {
      console.error("Error archiving audit logs:", error);
      throw error;
    }
  }

  /**
   * Get archived audit logs with filters
   */
  async getArchivedAuditLogs(filters: {
    fiscalYear?: string;
    userId?: string;
    tableName?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: any[]; total: number }> {
    try {
      const whereConditions: any[] = [];

      if (filters.fiscalYear) {
        whereConditions.push(
          eq(schema.auditLogBackup.fiscalYear, filters.fiscalYear),
        );
      }

      if (filters.userId) {
        whereConditions.push(eq(schema.auditLogBackup.userId, filters.userId));
      }

      if (filters.tableName) {
        whereConditions.push(
          eq(schema.auditLogBackup.tableName, filters.tableName),
        );
      }

      if (filters.action) {
        whereConditions.push(eq(schema.auditLogBackup.action, filters.action));
      }

      // Get total count
      const countQuery =
        whereConditions.length > 0
          ? db
              .select({ count: sql<number>`count(*)` })
              .from(schema.auditLogBackup)
              .where(and(...whereConditions))
          : db
              .select({ count: sql<number>`count(*)` })
              .from(schema.auditLogBackup);

      const countResult = countQuery.get();
      const total = countResult?.count || 0;

      // Get logs with pagination
      const query =
        whereConditions.length > 0
          ? db
              .select()
              .from(schema.auditLogBackup)
              .where(and(...whereConditions))
          : db.select().from(schema.auditLogBackup);

      const logs = query
        .orderBy(desc(schema.auditLogBackup.createdAt))
        .limit(filters.limit || 50)
        .offset(filters.offset || 0)
        .all();

      return { logs, total };
    } catch (error) {
      console.error("Error fetching archived audit logs:", error);
      return { logs: [], total: 0 };
    }
  }

  /**
   * Clean up old archived audit logs beyond retention period
   */
  async cleanOldArchivedAuditLogs(): Promise<number> {
    try {
      const settings = await this.getSystemSettings();
      const retentionYears = settings.auditLogRetentionYears || 7;

      // Calculate cutoff fiscal year
      const currentYear = new Date().getFullYear();
      const cutoffYear = currentYear - retentionYears;

      // Delete archived logs older than retention period
      const result = db
        .delete(schema.auditLogBackup)
        .where(
          sql`substr(${schema.auditLogBackup.fiscalYear}, 1, 4) < ${cutoffYear.toString()}`,
        )
        .run();

      console.log(`Cleaned up ${result.changes} old archived audit logs`);
      return result.changes || 0;
    } catch (error) {
      console.error("Error cleaning old archived audit logs:", error);
      return 0;
    }
  }
}

export const storage = new SqliteStorage();