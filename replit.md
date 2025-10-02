# MedCare Pro - Hospital Management System

## Overview

MedCare Pro is a comprehensive hospital management system built as a full-stack web application. The system provides functionality for patient registration, billing and invoicing, pathology test management, doctor management, and system administration. It serves as a complete solution for healthcare facilities to manage their day-to-day operations efficiently.

The application features a modern, responsive user interface built with React and TypeScript, backed by a robust Express.js API server with SQLite database storage. The system supports role-based authentication and provides different access levels for administrators, doctors, receptionists, and billing staff.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### Doctor Salary Management Enhancements - COMPLETED (October 2, 2025)
- **TypeScript Fixes**: Fixed 24+ TypeScript errors by properly typing services and doctorRates queries, resolving ₹0 display issue in earnings table
- **UI Cleanup**: Removed conceptually flawed "Recalculate Earnings" and bulk "Process Payments" buttons from salary management interface
- **Individual Payment Processing**: Implemented individual doctor payment confirmation system with Check icon replacing Wallet icon on payment buttons
- **Backend API**: Added PUT `/api/doctors/:doctorId/mark-paid` endpoint to update all pending earnings to paid status for a specific doctor
- **Frontend Integration**: Implemented mark-as-paid mutation with proper error handling, cache invalidation, and success notifications
- **Service Categorization Fix**: Corrected service categorization to show OPD consultations exclusively under "OPD Consultation" heading
- **Duplication Prevention**: Excluded pathology/lab services from generic "Services" section to prevent duplicate entries across categories
- **Security**: All endpoints use JWT authentication and proper validation to ensure authorized access only
- **Final Status**: ✅ COMPLETE - Doctor salary management feature fully functional with individual payment tracking

### Fresh GitHub Clone Setup - COMPLETED (October 2, 2025)
- **Project Import**: Successfully imported fresh GitHub clone of MedCare Pro hospital management system
- **Environment Analysis**: Analyzed codebase structure, confirmed full-stack Express + Vite + React + TypeScript setup with SQLite database
- **Workflow Configuration**: Configured "Start application" workflow on port 5000 with webview output type for Replit environment
- **Vite Configuration Verified**: Confirmed existing Vite config has host: "0.0.0.0", port: 5000, and allowedHosts: true (line 26 in server/vite.ts)
- **Server Configuration Verified**: Confirmed server binds to 0.0.0.0:5000 with proper PORT environment variable handling
- **Deployment Configuration**: Verified autoscale deployment with npm run build and npm run start commands already configured
- **Database Status**: Verified existing hospital.db (964KB) with demo data is functional
- **Build Testing**: Successfully tested production build (dist/index.js + dist/public), confirmed build process works
- **Application Status**: Server running successfully on port 5000, Vite HMR connected, login page rendering correctly
- **Known Issues**: TypeScript errors related to unused scheduleEvents feature (doesn't affect functionality or build)
- **Final Status**: ✅ COMPLETE - Hospital management system fully operational in Replit environment

### GitHub Import to Replit Setup - COMPLETED (September 30, 2025)
- **Project Import**: Successfully imported fresh clone of MedCare Pro from GitHub repository
- **Dependencies Fix**: Removed unnecessary cross-env dependency and updated dev script to use native NODE_ENV
- **Build Configuration**: Fixed production build command to output server file to dist/index.js with proper esbuild flags
- **Workflow Setup**: Configured development workflow on port 5000 with webview output type for Replit environment
- **Vite Configuration Verified**: Confirmed existing configuration has host: "0.0.0.0", port: 5000, and allowedHosts: true
- **Server Configuration Verified**: Confirmed server binds to 0.0.0.0:5000 with proper PORT environment variable handling
- **Deployment Configuration**: Set up autoscale deployment with npm run build and npm run start commands
- **SQLite Database**: Verified existing hospital.db (952KB) with demo data is functioning correctly
- **Application Status**: Server running successfully, responding to HTTP requests, Vite HMR connected
- **Final Status**: ✅ COMPLETE - Hospital management system fully operational in Replit environment

### Self-Profile Editing Feature - COMPLETED (September 28, 2025)
- **Security Enhancement**: Implemented secure self-profile editing allowing all users to modify their own username, full name, and password
- **API Endpoint**: Created `/api/profile` PUT endpoint with JWT authentication and Zod validation preventing cross-user profile editing
- **UI Integration**: Made sidebar profile section clickable to open profile edit dialog with intuitive user experience
- **Form Validation**: Added React Hook Form with password confirmation, minimum length requirements, and real-time validation
- **Error Handling**: Comprehensive error handling with username uniqueness checks, loading states, and success/error toast notifications
- **Cache Management**: Implemented proper cache invalidation to ensure UI reflects profile changes immediately
- **Security Audit**: Verified users can only edit their own profiles with no privilege escalation risks
- **Final Status**: ✅ COMPLETE - All users can now safely edit their own profile information

### Fresh GitHub Import Setup - COMPLETED (September 25, 2025)
- **Project Import**: Successfully imported MedCare Pro hospital management system from GitHub repository
- **Dependencies Resolution**: Fixed missing cross-env dependency that was preventing application startup
- **Workflow Configuration**: Configured development workflow on port 5000 with webview output type for proper frontend display
- **Host Settings Verification**: Confirmed Vite configuration includes `allowedHosts: true` for Replit proxy compatibility  
- **Server Configuration**: Verified server binds to 0.0.0.0:5000 as required for Replit environment
- **Deployment Configuration**: Set up autoscale deployment target with proper build and start commands for production
- **Application Testing**: Confirmed application starts successfully and server responds to HTTP requests
- **Database Status**: Verified SQLite database and demo data initialization working correctly
- **Backup System**: Confirmed backup scheduler initializes and runs automatically
- **Final Status**: ✅ COMPLETE - Hospital management system fully operational in Replit environment

### OPD Management System Enhancements (August 2025)
- **Dynamic OPD consultation fees**: Implemented automatic fee calculation based on selected doctor with ₹0 default when no doctor selected
- **Time-based scheduling**: Added HTML5 time input field with native clock popup interface for precise appointment scheduling  
- **Doctor-segregated OPD listings**: Created dedicated /opd-list page that groups OPD appointments by doctor with filtering capabilities
- **Clickable dashboard statistics**: Made OPD patient count on dashboard clickable to navigate to doctor-segregated OPD page
- **Real-time dashboard updates**: Dashboard OPD count now reflects actual scheduled appointments and updates when new patients are added
- **Enhanced form validation**: OPD scheduling requires mandatory doctor selection with proper error handling
- **Database schema improvements**: Added scheduledTime field to patient_services table and initialDeposit to admissions table

## System Architecture

### Frontend Architecture

The frontend is built using React with TypeScript and follows a modern component-based architecture:

- **Framework**: React 18 with TypeScript for type safety
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management and caching
- **UI Components**: Radix UI primitives with custom styling using Tailwind CSS
- **Form Handling**: React Hook Form with Zod for validation
- **Build Tool**: Vite for fast development and optimized production builds

The frontend implements a protected route system with authentication middleware, ensuring secure access to different application sections based on user roles. The UI uses a sidebar navigation layout with responsive design principles.

### Backend Architecture

The backend follows a RESTful API architecture using Express.js:

- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: JWT-based authentication with bcrypt for password hashing
- **API Structure**: Route-based organization with middleware for authentication and logging
- **Error Handling**: Centralized error handling with proper HTTP status codes

The server implements comprehensive logging for API requests and includes middleware for request timing and response capture for debugging purposes.

### Data Storage Solutions

The system uses SQLite as the primary database with the following design decisions:

- **Database**: SQLite for simplicity and ease of deployment
- **ORM**: Drizzle ORM providing type-safe queries and schema management
- **Schema Design**: Normalized relational design with proper foreign key relationships
- **Migration System**: Drizzle Kit for database schema migrations

Key database tables include:
- Users (authentication and roles)
- Patients (patient information and registration)
- Doctors (doctor profiles and specializations)
- Patient Visits (OPD and inpatient tracking)
- Bills and Bill Items (billing and invoicing)
- Services (hospital services and pricing)
- Pathology Tests (lab test management)
- Audit Logs (system activity tracking)

### Authentication and Authorization

The system implements a robust security model:

- **Authentication Method**: JWT tokens with configurable expiration
- **Password Security**: bcrypt hashing with salt rounds
- **Role-Based Access**: Multiple user roles (admin, doctor, receptionist, billing_staff)
- **Session Management**: Token-based sessions with client-side storage
- **Route Protection**: Frontend and backend route guards based on authentication status

### External Dependencies

#### Third-Party Services
- **Neon Database**: PostgreSQL serverless database option (@neondatabase/serverless)
- **Replit Integration**: Development environment integration with cartographer and runtime error handling

#### UI and Component Libraries
- **Radix UI**: Complete set of UI primitives for accessibility and customization
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **Lucide Icons**: Modern icon library for consistent iconography
- **TanStack Query**: Server state management and caching
- **React Hook Form**: Form handling with validation
- **Zod**: Runtime type validation and schema definition

#### Development and Build Tools
- **Vite**: Build tool and development server
- **TypeScript**: Static type checking
- **ESBuild**: Fast bundler for production builds
- **PostCSS**: CSS processing with Tailwind
- **Drizzle Kit**: Database migration and schema management tools

#### Database and Storage
- **better-sqlite3**: SQLite database driver
- **Drizzle ORM**: Type-safe database operations
- **connect-pg-simple**: PostgreSQL session store option

The architecture prioritizes type safety, developer experience, and maintainability while providing a scalable foundation for healthcare management operations.