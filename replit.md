# HMSync - Hospital Management System

## Overview

HMSync is a comprehensive full-stack web application for efficient hospital management. It provides functionalities for patient registration, billing, pathology management, doctor management, and system administration. The system aims to streamline hospital operations, improve patient care, and enhance administrative efficiency, positioning HMSync as a leading solution in the healthcare IT market. It features a modern, responsive UI built with React and TypeScript, an Express.js API, and SQLite database storage, supporting role-based authentication for various staff members.

## User Preferences

Preferred communication style: Simple, everyday language.

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