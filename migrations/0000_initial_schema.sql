CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  roles TEXT NOT NULL DEFAULT '["user"]',
  primary_role TEXT NOT NULL,
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
  billable_item_type TEXT,
  billable_item_id TEXT,
  approved_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS patient_refunds (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  refund_id TEXT NOT NULL UNIQUE,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  amount REAL NOT NULL,
  reason TEXT NOT NULL,
  refund_date TEXT NOT NULL,
  billable_item_type TEXT NOT NULL,
  billable_item_id TEXT NOT NULL,
  service_line_id TEXT,
  allocation TEXT NOT NULL DEFAULT 'hospital',
  deducted_from_doctor REAL NOT NULL DEFAULT 0,
  doctor_id TEXT,
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
  service_id TEXT REFERENCES services(id),
  patient_service_id TEXT REFERENCES patient_services(id),
  visit_id TEXT,
  pathology_order_id TEXT,
  admission_id TEXT,
  admission_service_id TEXT,
  refund_id TEXT,
  service_name TEXT NOT NULL,
  service_category TEXT NOT NULL,
  service_date TEXT NOT NULL,
  rate_type TEXT NOT NULL,
  rate_amount REAL NOT NULL,
  service_price REAL NOT NULL,
  earned_amount REAL NOT NULL,
  refunded_amount REAL NOT NULL DEFAULT 0,
  deducted_amount REAL NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS appointments (
id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
doctor_id TEXT NOT NULL REFERENCES doctors(id),
patient_id TEXT NOT NULL REFERENCES patients(id),
start_datetime TEXT NOT NULL,
end_datetime TEXT NOT NULL,
source_type TEXT NOT NULL,
source_id TEXT,
status TEXT NOT NULL DEFAULT 'scheduled',
notes TEXT,
created_at TEXT NOT NULL DEFAULT (datetime('now')),
updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
