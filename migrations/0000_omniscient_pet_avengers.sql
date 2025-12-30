CREATE TABLE `activities` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`user_id` text,
	`activity_type` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`entity_id` text,
	`entity_type` text,
	`metadata` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `admission_events` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`admission_id` text NOT NULL,
	`event_type` text NOT NULL,
	`event_time` text DEFAULT (datetime('now')) NOT NULL,
	`room_id` text,
	`room_number` text,
	`ward_type` text,
	`notes` text,
	`receipt_number` text,
	`created_by` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`admission_id`) REFERENCES `admissions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `admission_services` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`admission_id` text NOT NULL,
	`service_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`doctor_id` text,
	`service_name` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`scheduled_date` text NOT NULL,
	`scheduled_time` text DEFAULT '09:00' NOT NULL,
	`completed_date` text,
	`notes` text,
	`price` real DEFAULT 0 NOT NULL,
	`billing_type` text DEFAULT 'per_date' NOT NULL,
	`billing_quantity` real DEFAULT 1,
	`calculated_amount` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`admission_id`) REFERENCES `admissions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `admissions` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`admission_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`doctor_id` text,
	`current_room_id` text,
	`current_ward_type` text,
	`current_room_number` text,
	`admission_date` text NOT NULL,
	`discharge_date` text,
	`status` text DEFAULT 'admitted' NOT NULL,
	`reason` text,
	`diagnosis` text,
	`notes` text,
	`daily_cost` real DEFAULT 0 NOT NULL,
	`total_cost` real DEFAULT 0 NOT NULL,
	`initial_deposit` real DEFAULT 0 NOT NULL,
	`additional_payments` real DEFAULT 0 NOT NULL,
	`total_discount` real DEFAULT 0 NOT NULL,
	`last_payment_date` text,
	`last_payment_amount` real DEFAULT 0,
	`last_discount_date` text,
	`last_discount_amount` real DEFAULT 0,
	`last_discount_reason` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admissions_admission_id_unique` ON `admissions` (`admission_id`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`user_id` text NOT NULL,
	`username` text NOT NULL,
	`action` text NOT NULL,
	`table_name` text NOT NULL,
	`record_id` text NOT NULL,
	`old_values` text,
	`new_values` text,
	`changed_fields` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_log_backup` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`user_id` text NOT NULL,
	`username` text NOT NULL,
	`action` text NOT NULL,
	`table_name` text NOT NULL,
	`record_id` text NOT NULL,
	`old_values` text,
	`new_values` text,
	`changed_fields` text,
	`ip_address` text,
	`user_agent` text,
	`fiscal_year` text NOT NULL,
	`archived_at` text DEFAULT (datetime('now')) NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `backup_logs` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`backup_id` text NOT NULL,
	`status` text NOT NULL,
	`backup_type` text DEFAULT 'auto' NOT NULL,
	`file_path` text,
	`file_size` integer,
	`start_time` text NOT NULL,
	`end_time` text,
	`error_message` text,
	`table_count` integer,
	`record_count` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `backup_logs_backup_id_unique` ON `backup_logs` (`backup_id`);--> statement-breakpoint
CREATE TABLE `bill_items` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`bill_id` text NOT NULL,
	`service_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_price` real NOT NULL,
	`total_price` real NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bills` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`bill_number` text NOT NULL,
	`patient_id` text NOT NULL,
	`visit_id` text,
	`subtotal` real NOT NULL,
	`tax_amount` real NOT NULL,
	`discount_amount` real DEFAULT 0 NOT NULL,
	`total_amount` real NOT NULL,
	`payment_method` text NOT NULL,
	`payment_status` text DEFAULT 'pending' NOT NULL,
	`paid_amount` real DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`bill_date` text NOT NULL,
	`due_date` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`visit_id`) REFERENCES `patient_visits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bills_bill_number_unique` ON `bills` (`bill_number`);--> statement-breakpoint
CREATE TABLE `doctor_earnings` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`earning_id` text NOT NULL,
	`doctor_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`service_id` text NOT NULL,
	`patient_service_id` text,
	`service_name` text NOT NULL,
	`service_category` text NOT NULL,
	`service_date` text NOT NULL,
	`rate_type` text NOT NULL,
	`rate_amount` real NOT NULL,
	`service_price` real NOT NULL,
	`earned_amount` real NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_service_id`) REFERENCES `patient_services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `doctor_earnings_earning_id_unique` ON `doctor_earnings` (`earning_id`);--> statement-breakpoint
CREATE TABLE `doctor_payments` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`payment_id` text NOT NULL,
	`doctor_id` text NOT NULL,
	`payment_date` text NOT NULL,
	`total_amount` real NOT NULL,
	`payment_method` text NOT NULL,
	`earnings_included` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`description` text,
	`processed_by` text NOT NULL,
	`receipt_number` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`processed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `doctor_payments_payment_id_unique` ON `doctor_payments` (`payment_id`);--> statement-breakpoint
CREATE TABLE `doctor_service_rates` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`doctor_id` text NOT NULL,
	`service_id` text,
	`service_name` text NOT NULL,
	`service_category` text NOT NULL,
	`rate_type` text DEFAULT 'per_instance' NOT NULL,
	`rate_amount` real NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `doctors` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`specialization` text NOT NULL,
	`qualification` text NOT NULL,
	`consultation_fee` real NOT NULL,
	`profile_picture` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hospital_settings` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`name` text DEFAULT 'HMSync Hospital' NOT NULL,
	`address` text DEFAULT '123 Healthcare Street, Medical District, City - 123456' NOT NULL,
	`phone` text DEFAULT '+91 98765 43210' NOT NULL,
	`email` text DEFAULT 'info@hmsync.com' NOT NULL,
	`registration_number` text,
	`logo_path` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pathology_categories` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pathology_categories_name_unique` ON `pathology_categories` (`name`);--> statement-breakpoint
CREATE TABLE `pathology_category_tests` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`category_id` text NOT NULL,
	`test_name` text NOT NULL,
	`price` real DEFAULT 0 NOT NULL,
	`description` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `pathology_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pathology_orders` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`order_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`visit_id` text,
	`doctor_id` text,
	`status` text DEFAULT 'ordered' NOT NULL,
	`ordered_date` text NOT NULL,
	`collected_date` text,
	`report_date` text,
	`remarks` text,
	`total_price` real DEFAULT 0 NOT NULL,
	`receipt_number` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`visit_id`) REFERENCES `patient_visits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pathology_orders_order_id_unique` ON `pathology_orders` (`order_id`);--> statement-breakpoint
CREATE TABLE `pathology_tests` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`order_id` text NOT NULL,
	`service_id` text,
	`test_name` text NOT NULL,
	`test_category` text NOT NULL,
	`status` text DEFAULT 'ordered' NOT NULL,
	`results` text,
	`normal_range` text,
	`price` real NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `pathology_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `patient_discounts` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`discount_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`amount` real NOT NULL,
	`discount_type` text DEFAULT 'manual' NOT NULL,
	`reason` text NOT NULL,
	`discount_date` text NOT NULL,
	`approved_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patient_discounts_discount_id_unique` ON `patient_discounts` (`discount_id`);--> statement-breakpoint
CREATE TABLE `patient_payments` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`payment_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`amount` real NOT NULL,
	`payment_method` text NOT NULL,
	`payment_date` text NOT NULL,
	`reason` text,
	`receipt_number` text,
	`billable_type` text,
	`billable_id` text,
	`processed_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`processed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patient_payments_payment_id_unique` ON `patient_payments` (`payment_id`);--> statement-breakpoint
CREATE TABLE `patient_refunds` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`refund_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`amount` real NOT NULL,
	`refund_method` text NOT NULL,
	`refund_date` text NOT NULL,
	`reason` text,
	`original_billable_item_id` text,
	`receipt_number` text,
	`processed_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`processed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patient_refunds_refund_id_unique` ON `patient_refunds` (`refund_id`);--> statement-breakpoint
CREATE TABLE `patient_services` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`service_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`visit_id` text,
	`doctor_id` text,
	`service_type` text NOT NULL,
	`service_name` text NOT NULL,
	`order_id` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`scheduled_date` text NOT NULL,
	`scheduled_time` text DEFAULT '09:00' NOT NULL,
	`completed_date` text,
	`notes` text,
	`price` real DEFAULT 0 NOT NULL,
	`billing_type` text DEFAULT 'per_instance' NOT NULL,
	`billing_quantity` real DEFAULT 1,
	`billing_parameters` text,
	`calculated_amount` real DEFAULT 0 NOT NULL,
	`receipt_number` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`visit_id`) REFERENCES `patient_visits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `patient_visits` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`visit_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`doctor_id` text NOT NULL,
	`visit_type` text NOT NULL,
	`visit_date` text NOT NULL,
	`scheduled_date` text,
	`scheduled_time` text DEFAULT '09:00',
	`symptoms` text,
	`diagnosis` text,
	`prescription` text,
	`consultation_fee` real DEFAULT 0,
	`receipt_number` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`admission_date` text,
	`discharge_date` text,
	`room_number` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patient_visits_visit_id_unique` ON `patient_visits` (`visit_id`);--> statement-breakpoint
CREATE TABLE `patients` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`patient_id` text NOT NULL,
	`name` text NOT NULL,
	`age` integer NOT NULL,
	`gender` text NOT NULL,
	`phone` text NOT NULL,
	`address` text,
	`email` text,
	`emergency_contact` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patients_patient_id_unique` ON `patients` (`patient_id`);--> statement-breakpoint
CREATE TABLE `room_types` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`daily_cost` real DEFAULT 0 NOT NULL,
	`total_beds` integer DEFAULT 0 NOT NULL,
	`occupied_beds` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `room_types_name_unique` ON `room_types` (`name`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`room_number` text NOT NULL,
	`room_type_id` text NOT NULL,
	`floor` text,
	`building` text,
	`capacity` integer DEFAULT 1 NOT NULL,
	`is_occupied` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`room_type_id`) REFERENCES `room_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_room_number_unique` ON `rooms` (`room_number`);--> statement-breakpoint
CREATE TABLE `service_categories` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`name` text NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`icon` text DEFAULT 'Settings' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_categories_name_unique` ON `service_categories` (`name`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`price` real NOT NULL,
	`description` text,
	`billing_type` text DEFAULT 'per_instance' NOT NULL,
	`billing_parameters` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`email_notifications` integer DEFAULT false NOT NULL,
	`sms_notifications` integer DEFAULT false NOT NULL,
	`auto_backup` integer DEFAULT true NOT NULL,
	`audit_logging` integer DEFAULT true NOT NULL,
	`backup_frequency` text DEFAULT 'daily' NOT NULL,
	`backup_time` text DEFAULT '02:00' NOT NULL,
	`backup_day` text DEFAULT 'Sunday' NOT NULL,
	`backup_date` text DEFAULT '1' NOT NULL,
	`last_backup_date` text,
	`backup_retention_days` integer DEFAULT 30 NOT NULL,
	`fiscal_year_start_month` integer DEFAULT 4 NOT NULL,
	`fiscal_year_start_day` integer DEFAULT 1 NOT NULL,
	`audit_log_retention_years` integer DEFAULT 7 NOT NULL,
	`last_audit_archive_date` text,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`timezone_offset` text DEFAULT '+00:00' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`full_name` text NOT NULL,
	`profile_picture` text,
	`roles` text NOT NULL,
	`primary_role` text NOT NULL,
	`role` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);