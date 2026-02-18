CREATE TABLE IF NOT EXISTS doctor_service_durations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  doctor_id TEXT NOT NULL REFERENCES doctors(id),
  service_type TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT doctor_service_durations_service_type_check
    CHECK (service_type IN ('OPD','PATHOLOGY','SERVICE','ADMISSION')),
  CONSTRAINT doctor_service_durations_doctor_service_unique
    UNIQUE (doctor_id, service_type)
);
