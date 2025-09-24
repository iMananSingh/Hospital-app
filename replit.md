# MedCare Pro - Hospital Management System

## Overview

MedCare Pro is a comprehensive hospital management system built as a full-stack web application. The system provides functionality for patient registration, billing and invoicing, pathology test management, doctor management, and system administration. It serves as a complete solution for healthcare facilities to manage their day-to-day operations efficiently.

The application features a modern, responsive user interface built with React and TypeScript, backed by a robust Express.js API server with SQLite database storage. The system supports role-based authentication and provides different access levels for administrators, doctors, receptionists, and billing staff.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### Replit Environment Setup - COMPLETED (September 24, 2025)
- **Fresh Import Setup**: Successfully imported hospital management system from GitHub and configured for Replit environment
- **Dependencies Resolution**: All npm dependencies installed and available, cross-env working correctly
- **Workflow Configuration**: Set up development workflow on port 5000 with proper webview output type for frontend display
- **Proxy Compatibility**: Confirmed Vite configuration includes `allowedHosts: true` for Replit's proxy environment
- **Host Configuration**: Server properly configured to bind to 0.0.0.0:5000 for Replit's proxy environment
- **Deployment Setup**: Configured autoscale deployment with proper build and start commands for production
- **Database Initialization**: Verified SQLite database and demo data are properly initialized and accessible
- **Backup Scheduler**: Confirmed backup system is initialized and running on schedule
- **Application Status**: Hospital management system is fully operational with all core features working
- **Import Status**: ✅ COMPLETE - Application successfully running in Replit environment

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