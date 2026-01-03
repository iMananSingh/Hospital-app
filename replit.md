# HMSync - Hospital Management System

## Overview

HMSync is a comprehensive full-stack web application for efficient hospital management. It provides functionalities for patient registration, billing, pathology management, doctor management, and system administration. The system aims to streamline hospital operations, improve patient care, and enhance administrative efficiency, positioning HMSync as a leading solution in the healthcare IT market. It features a modern, responsive UI built with React and TypeScript, an Express.js API, and SQLite database storage, supporting role-based authentication for various staff members.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**January 3, 2026** - Patient Refund System Implementation
- **New patient_refunds Table**:
  - Stores refunds linked to specific billable items via `billableItemType` and `billableItemId`
  - Auto-generated refund IDs in format REF-YYMM-XXXXX (monthly sequence)
  - Tracks refund amount, reason, and refund date
  - Supported billable item types: `admission`, `pathology`, `service`, `opd_visit`, `admission_service`

- **Refund Logic**:
  - Refund amounts cannot exceed `maxRefundable` (netPaidAmount = paidAmount - existingRefunds)
  - Refunds reduce paid amounts without affecting pending amounts
  - Fully refunded items tracked with `isFullyRefunded` flag and excluded from refundable dropdown
  - Financial summary includes `totalRefunds` and balance calculation: Charges - Discounts - (Payments - Refunds)

- **Frontend Updates**:
  - Refund dialog auto-populates with maxRefundable amount
  - Validation prevents refund exceeding paid amount
  - Refund timeline cards in patient history with red styling
  - Proper cache invalidation for refunds, billable-items, and financial-summary queries

**January 3, 2026** - Discount-to-Billable-Item Mapping
- **Discounts Now Linked to Specific Billable Items**:
  - Added `billableItemType` and `billableItemId` columns to `patient_discounts` table
  - Discount dialog now requires selecting a specific billable item (admission, pathology, service, OPD visit, or admission service)
  - Pending amount calculation: `pendingAmount = amount - discountAmount - paidAmount`
  - Added `maxDiscountable` field to all billable items (remaining amount that can be discounted)
  - Frontend validation prevents discounts from exceeding `maxDiscountable`
  - Admission services now included in billable items dropdown
  - Supported billable item types: `admission`, `pathology`, `service`, `opd_visit`, `admission_service`

**January 3, 2026** - Payment Pending Amount Tracking
- **Enhanced Payment Recording**:
  - Backend now returns `paidAmount` and `pendingAmount` for all billable items (admissions, pathology, services, OPD)
  - Payment dialog auto-populates with pending amount instead of full amount when selecting billable item
  - Added validation preventing payment amounts from exceeding pending balance
  - Dropdown labels now show "Rs.X pending of Rs.Y" format for clarity on partial payments

**January 3, 2026** - Billing Timezone Bug Fix
- **Fixed admission services billing calculation showing 31 days instead of 32 days**
  - Root cause: Duplicate route definition for `/api/patients/:patientId/comprehensive-bill` 
  - The first route was not passing timezone parameter to `generateComprehensiveBill`
  - This caused calculations to use UTC instead of the configured Asia/Kolkata timezone
  - When UTC shows Jan 2 but IST is already Jan 3, the calendar day count was off by 1
  
- **Fix Applied**:
  - Updated the comprehensive-bill route to fetch system settings and pass timezone to billing calculations
  - Removed duplicate route definition that was added later
  - Now all billing calculations consistently use the configured timezone from system settings
  
- **Verification**:
  - For Dec 3 to Jan 3 admission: now correctly shows 32 days (per_date billing)
  - Timezone-aware calculation uses Intl.DateTimeFormat to extract calendar dates in user's timezone

**December 3, 2025** - Admission Services Table Separation
- **New admission_services Table**: Created dedicated table for admission-related services, separate from patient_services
  - Stores services linked to hospital admissions via admissionId
  - Includes all admission-specific fields: serviceName, category, unitPrice, quantity, isPerDiem
  - Auto-calculates daily charges based on stay duration for per-diem services
  
- **Automatic Database Migration**: 
  - Migration runs on server startup to move existing admission services from patient_services
  - Handles duplicates correctly - skips already-migrated records
  - Deletes old records from patient_services after successful migration
  
- **Complete API Implementation**:
  - GET /api/admission-services (with ?admissionId filter)
  - POST /api/admission-services (single service creation with Zod validation)
  - POST /api/admission-services/batch (batch creation with per-item Zod validation)
  - PUT /api/admission-services/:id (update)
  - DELETE /api/admission-services/:id (delete)
  - All routes include authentication, role-based access control, and audit logging
  
- **Updated Billing Calculations**:
  - Billing now sums charges from both patient_services and admission_services tables
  - Admission services calculated separately with stay-duration awareness
  
- **Frontend Updates**:
  - patient-detail.tsx and dashboard.tsx use new /api/admission-services endpoints
  - Proper cache invalidation for admission services queries

**November 25, 2025** - Logo Replacement & Toast Notification System Redesign
- **New HMSync Logo Integration**
  - Replaced Hospital icon with custom HMSync logo on login page (stored as `attached_assets/hmsync-logo.svg`)
  - Replaced Hospital icon with custom logo in sidebar next to "HMSync Hospital Management"
  - Logo sized appropriately: 56x56px (w-14 h-14) on login, 32x32px (w-8 h-8) on sidebar

- **Toast Notification System Improvements**
  - **Removed login error toast** - Replaced with inline validation (red alert box on form)
  - **Icon-based toasts** - Success (green checkmark), Error (red alert), Warning (amber triangle), Info (blue icon)
  - **Color-coded backgrounds** - Success: green bg with dark text, Error: red bg, Warning: amber bg, Info: blue bg
  - **Compact positioning** - Fixed top-right (below navbar), 320px max-width
  - **Auto-dismiss timing** - Success: 2.5s, Error/Warning: 5s

- **Shortened Toast Messages** - Updated all long descriptions for 320px width constraints

**November 24, 2025** - Complete System/Custom Labeling Removed - All Tests Treated Equally ✅
- **Eliminated All Distinction Logic**
  - Removed all `isHardcoded`, `isSystem`, `isCustom` flags from backend and frontend
  - Removed all "System" vs "Custom" badges and labels from UI  
  - Removed special edit/delete logic treating system tests differently
  - Removed old system test deletion endpoint (`/api/pathology-tests/system/:categoryName/:testName`)
  
- **Unified Test Handling**
  - All tests now deleted via same database endpoint: `/api/dynamic-pathology-tests/{id}`
  - No distinction between demo, seeded, and user-created tests
  - All tests function identically regardless of creation source (UI, bulk upload, or initialization)
  - Removed all conditional rendering based on test origin
  
- **Backend Changes**
  - Removed `isHardcoded`, `isSystem` from combined endpoint responses
  - Simplified test creation to treat all categories uniformly
  - Removed system-specific comments and special handling code
  - All CRUD operations use unified database functions
  
- **Frontend Changes (services.tsx)**
  - Removed `isSystemTest` detection logic from delete function
  - Removed `isSystem` flags from predefined service categories
  - Removed conditional delete buttons hiding for "system" categories
  - Removed "(System)/(Custom)" labels from category/test displays and dropdowns
  - Simplified all category/test rendering without type badges
  
- **Result: Complete Parity**
  - Demo data (2 tests in category 1, empty category 2) seeded on startup
  - All tests work identically - no internal system vs custom distinction
  - No way to distinguish test origin - pure functional equality

## System Architecture

### Frontend Architecture

The frontend uses React 18 with TypeScript, Wouter for routing, and TanStack Query for server state management. UI components are built with Radix UI and styled using Tailwind CSS. Form handling is managed by React Hook Form with Zod validation. Vite is used for development and optimized production builds. It incorporates a protected route system with authentication middleware and a responsive sidebar navigation layout.

### Backend Architecture

The backend is a RESTful API built with Express.js and TypeScript. It utilizes Drizzle ORM for type-safe SQLite database operations. Authentication is JWT-based with bcrypt for password hashing. The API is organized route-wise with middleware for authentication and logging, and features centralized error handling.

### Data Storage Solutions

SQLite serves as the primary database, managed by Drizzle ORM for type-safe queries and schema management. It employs a normalized relational design with foreign key relationships. Drizzle Kit is used for database schema migrations. Key tables include Users, Patients, Doctors, Patient Visits, Bills, Services, Pathology Tests, and Audit Logs.

### Authentication and Authorization

The system implements JWT-based authentication with bcrypt for password hashing and supports role-based access control for administrators, doctors, receptionists, and billing staff. Token-based sessions are used, with both frontend and backend route guards ensuring secure access.

### UI/UX Decisions

The application prioritizes a modern and responsive user interface using Radix UI primitives for accessible components and Tailwind CSS for styling. Lucide Icons provide consistent iconography. The design emphasizes intuitive navigation and clear information presentation, including dynamic OPD consultation fees and time-based scheduling.

### Feature Specifications

Key features include:
- Patient registration and management
- Billing and invoicing with automated doctor earnings calculation
- Pathology test management, including import/export of data
- Doctor management with salary tracking and individual payment processing
- OPD management with dynamic consultation fees and doctor-segregated listings
- Secure self-profile editing for all users
- Role-based access control for different user types
- Configurable Timezone Support: System timezone can be configured in settings for international deployment, with all database timestamps stored in UTC and frontend utilities formatting them for the configured timezone.

## External Dependencies

### Third-Party Services
- **Neon Database**: PostgreSQL serverless database option (for potential future scaling)

### UI and Component Libraries
- **Radix UI**: UI primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide Icons**: Icon library
- **TanStack Query**: Server state management and caching
- **React Hook Form**: Form handling
- **Zod**: Runtime type validation

### Development and Build Tools
- **Vite**: Build tool and development server
- **TypeScript**: Static type checking
- **ESBuild**: Fast bundler
- **PostCSS**: CSS processing
- **Drizzle Kit**: Database migration and schema management tools

### Database and Storage
- **better-sqlite3**: SQLite database driver
- **Drizzle ORM**: Type-safe database operations