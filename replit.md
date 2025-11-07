# HMSync - Hospital Management System

## Overview

HMSync is a comprehensive full-stack web application designed for efficient hospital management. It provides functionalities for patient registration, billing, pathology management, doctor management, and system administration. The system aims to be a complete solution for healthcare facilities, featuring a modern, responsive UI built with React and TypeScript, an Express.js API, and SQLite database storage. It supports role-based authentication for administrators, doctors, receptionists, and billing staff. The business vision is to streamline hospital operations, improve patient care, and enhance administrative efficiency, positioning HMSync as a leading solution in the healthcare IT market.

## Demo Credentials

The system comes pre-configured with demo users for testing:

- **Root User (Super Admin)**
  - Username: `root`
  - Password: `root123`
  - Roles: Super User

- **Doctor**
  - Username: `doctor`
  - Password: `doctor123`
  - Roles: Doctor, Billing Staff

- **Billing Staff**
  - Username: `billing`
  - Password: `billing123`
  - Roles: Billing Staff

- **Reception Staff**
  - Username: `reception`
  - Password: `reception123`
  - Roles: Receptionist

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**November 7, 2025** - Doctor Payroll & OPD Commission System Backend
- Implemented complete backend for automatic doctor commission calculation system
- Added three new storage methods:
  - `saveDoctorServiceRates(doctorId, rates, userId)` - Batch save/update doctor service rates with proper user authentication
  - `markDoctorEarningsPaid(doctorId)` - Mark all pending earnings as paid for payroll processing
  - `calculateDoctorEarningForVisit(visitId)` - Automatically calculate and create doctor earnings for OPD visits
- Created 5 new API endpoints:
  - GET /api/doctors/:doctorId/salary-rates - Fetch doctor's commission configuration
  - PUT /api/doctors/:doctorId/salary-rates - Save doctor's commission rates
  - GET /api/doctors/:doctorId/earnings - Get doctor's earnings with optional status filter (pending/paid)
  - PUT /api/doctors/:doctorId/mark-paid - Mark all pending earnings as paid
  - GET /api/doctors/all-earnings - Get all doctors' earnings for administrative overview
- Enhanced payment creation flow to automatically trigger commission calculations when OPD visit payments are received
- System automatically updates visit status from "scheduled" to "completed" when payment is processed
- Supports both percentage-based and fixed-amount commission rates per service
- Includes duplicate earning prevention and proper foreign key constraints
- All earnings tracked with earningId for payroll reconciliation

**October 15, 2025** - Timezone Display Enhancement
- Implemented centralized timezone-aware date/time formatting across the application
- Created useTimezone hook with formatDateTime, formatDate, and formatTime utilities
- Updated all patient-related pages (patients list, patient details, OPD, pathology, services, admission) to use timezone-aware formatting
- Removed hardcoded timezone conversions (IST corrections) in favor of configurable timezone support
- Enhanced settings page to invalidate React Query cache when timezone changes, ensuring immediate UI updates
- All timestamps now dynamically adjust based on the configured hospital timezone setting

**October 2, 2025** - Replit Environment Setup Completed
- Successfully imported GitHub repository into Replit environment
- Verified all dependencies and configurations are working correctly
- Workflow configured: "Start application" running `npm run dev` on port 5000
- Deployment configuration set up for autoscale deployment
- Vite already properly configured with `allowedHosts: true` and `host: "0.0.0.0"` for Replit proxy compatibility
- Application successfully running and accessible via web preview
- SQLite database (hospital.db) present with demo data

## System Architecture

### Frontend Architecture

The frontend uses React 18 with TypeScript, Wouter for routing, and TanStack Query for server state management. UI components are built with Radix UI and styled using Tailwind CSS. Form handling is managed by React Hook Form with Zod validation. Vite is used for development and optimized production builds. The frontend incorporates a protected route system with authentication middleware and a responsive sidebar navigation layout.

### Backend Architecture

The backend is a RESTful API built with Express.js and TypeScript. It utilizes Drizzle ORM for type-safe SQLite database operations. Authentication is JWT-based with bcrypt for password hashing. The API is organized route-wise with middleware for authentication and logging, and features centralized error handling.

### Data Storage Solutions

SQLite serves as the primary database, managed by Drizzle ORM for type-safe queries and schema management. It employs a normalized relational design with foreign key relationships. Drizzle Kit is used for database schema migrations. Key tables include Users, Patients, Doctors, Patient Visits, Bills, Services, Pathology Tests, and Audit Logs.

### Authentication and Authorization

The system implements JWT-based authentication with bcrypt for password hashing. It supports role-based access control for administrators, doctors, receptionists, and billing staff. Token-based sessions are used, with both frontend and backend route guards ensuring secure access.

### UI/UX Decisions

The application prioritizes a modern and responsive user interface. Radix UI primitives are used for accessible and customizable components, complemented by Tailwind CSS for a utility-first styling approach. Lucide Icons provide consistent iconography. The design emphasizes intuitive navigation and clear presentation of information, such as dynamic OPD consultation fees and time-based scheduling.

### Feature Specifications

Key features include:
- Patient registration and management
- Billing and invoicing with automated doctor earnings calculation
- Pathology test management
- Doctor management with salary tracking and individual payment processing
- OPD management with dynamic consultation fees and doctor-segregated listings
- Secure self-profile editing for all users
- Role-based access control for different user types
- **Configurable Timezone Support**: System timezone can be configured in settings for international deployment
  - All database timestamps are stored in UTC for consistency and reliability
  - Frontend utilities format timestamps for display in the configured timezone
  - Supports major global timezones with DST handling via Intl.DateTimeFormat
  - Timezone cache invalidation ensures immediate propagation of timezone changes

## External Dependencies

### Third-Party Services
- **Neon Database**: PostgreSQL serverless database option (used for potential future scaling)

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