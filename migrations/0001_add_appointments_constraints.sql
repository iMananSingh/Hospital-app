CREATE TRIGGER IF NOT EXISTS appointments_source_type_check_insert
BEFORE INSERT ON appointments
FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN NEW.source_type IN ('OPD','PATHOLOGY','SERVICE','ADMISSION') THEN NULL
      ELSE RAISE(ABORT, 'appointments.source_type must be OPD, PATHOLOGY, SERVICE, or ADMISSION')
    END;
END;

CREATE TRIGGER IF NOT EXISTS appointments_source_type_check_update
BEFORE UPDATE ON appointments
FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN NEW.source_type IN ('OPD','PATHOLOGY','SERVICE','ADMISSION') THEN NULL
      ELSE RAISE(ABORT, 'appointments.source_type must be OPD, PATHOLOGY, SERVICE, or ADMISSION')
    END;
END;

CREATE TRIGGER IF NOT EXISTS appointments_status_check_insert
BEFORE INSERT ON appointments
FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN NEW.status IN ('scheduled','completed','cancelled') THEN NULL
      ELSE RAISE(ABORT, 'appointments.status must be scheduled, completed, or cancelled')
    END;
END;

CREATE TRIGGER IF NOT EXISTS appointments_status_check_update
BEFORE UPDATE ON appointments
FOR EACH ROW
BEGIN
  SELECT
    CASE
      WHEN NEW.status IN ('scheduled','completed','cancelled') THEN NULL
      ELSE RAISE(ABORT, 'appointments.status must be scheduled, completed, or cancelled')
    END;
END;
