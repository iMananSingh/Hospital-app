import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { backupScheduler } from "./backup-scheduler";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { insertUserSchema, insertPatientSchema, insertDoctorSchema, insertServiceSchema, insertBillSchema, insertBillItemSchema, insertPathologyTestSchema, insertSystemSettingsSchema, insertPathologyCategorySchema, insertDynamicPathologyTestSchema, insertPatientPaymentSchema, insertPatientDiscountSchema, insertServiceCategorySchema, insertDoctorServiceRateSchema, insertDoctorEarningSchema, insertDoctorPaymentSchema, insertAdmissionSchema, insertPatientVisitSchema, insertPatientServiceSchema } from "@shared/schema";
import { pathologyCatalog, getAllPathologyTests, getTestsByCategory, getTestByName, getCategories, addCategoryToFile, addTestToFile, deleteCategoryFromFile, deleteTestFromFile } from "./pathology-catalog";
import { updatePatientSchema } from "../shared/schema";
import * as db from "./storage"; // Alias storage as db for brevity as seen in changes
import * as schema from "@shared/schema"; // Import schema for Drizzle ORM
import { eq, gte, lte, and, inArray } from "drizzle-orm"; // Import Drizzle ORM operators
import { patientServices, patients } from "@shared/schema"; // Import necessary schemas

const JWT_SECRET = process.env.JWT_SECRET || "hospital-management-secret-key";

// Middleware for authentication
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Alias for authenticateToken to match the change snippet
const requireAuth = authenticateToken;

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check if user account is active
      if (!user.isActive) {
        return res.status(401).json({ message: "Account has been deactivated" });
      }

      const rolesArray = JSON.parse(user.roles);

      const token = jwt.sign({
        id: user.id,
        username: user.username,
        roles: rolesArray,
        role: rolesArray[0] // Use first role for backward compatibility
      }, JWT_SECRET, { expiresIn: '8h' });

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          roles: rolesArray,
          role: rolesArray[0] // Use first role for backward compatibility
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/register", async (req: any, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);

      // Ensure roles is properly formatted
      if (userData.roles && Array.isArray(userData.roles)) {
        userData.roles = JSON.stringify(userData.roles);
      } else if (userData.roles && typeof userData.roles === 'string') {
        // If it's already a string, try to parse and re-stringify to validate
        try {
          const parsed = JSON.parse(userData.roles);
          userData.roles = JSON.stringify(parsed);
        } catch {
          // If parsing fails, treat as single role
          userData.roles = JSON.stringify([userData.roles]);
        }
      } else {
        // Default to admin role if no roles provided
        userData.roles = JSON.stringify(['admin']);
      }

      // Parse roles if it's a string, and set primaryRole to the first role in the array
      let parsedRoles = userData.roles;
      if (typeof userData.roles === 'string') {
        try {
          parsedRoles = JSON.parse(userData.roles);
        } catch {
          parsedRoles = [userData.roles];
        }
      }

      // Ensure parsedRoles is an array
      if (!Array.isArray(parsedRoles)) {
        parsedRoles = [parsedRoles];
      }

      // Set primaryRole to the first role in the array
      const userDataWithPrimaryRole = {
        ...userData,
        roles: parsedRoles,
        primaryRole: parsedRoles[0]
      };

      const user = await storage.createUser(userDataWithPrimaryRole);

      // Log activity for user creation (use the creator's ID if available, otherwise use the new user's ID)
      const actorUserId = req.user?.id || user.id;
      await storage.createActivity({
        userId: actorUserId,
        activityType: "user_created",
        title: "New User Created",
        description: `User ${user.username} (${user.fullName}) created with role: ${parsedRoles.join(', ')}`,
        entityId: user.id,
        entityType: "user",
        metadata: JSON.stringify({
          username: user.username,
          fullName: user.fullName,
          roles: parsedRoles,
          createdBy: req.user?.username || 'self-registration'
        }),
      });

      res.json({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        roles: user.rolesArray,
        role: user.rolesArray[0] // Use first role for backward compatibility
      });
    } catch (error) {
      console.error("User registration error:", error);
      res.status(400).json({ message: "Registration failed", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // User routes
  app.get("/api/users/me", authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        roles: user.rolesArray,
        role: user.rolesArray[0] // Use first role for backward compatibility
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Profile routes - Allow users to edit their own profile
  app.put("/api/profile", authenticateToken, async (req: any, res) => {
    try {
      // Import the schema for validation
      const { updateProfileSchema } = await import("@shared/schema");

      // Validate request body with Zod schema
      const validatedData = updateProfileSchema.parse(req.body);
      const userId = req.user.id;

      // If username is being changed, check if it's already taken
      if (validatedData.username) {
        const existingUser = await storage.getUserByUsername(validatedData.username);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ message: "Username already taken" });
        }
      }

      // Update the user's own profile (storage.updateUser handles password hashing)
      const updatedUser = await storage.updateUser(userId, validatedData);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: updatedUser.id,
        username: updatedUser.username,
        fullName: updatedUser.fullName,
        roles: updatedUser.rolesArray,
        role: updatedUser.rolesArray[0] // Use first role for backward compatibility
      });
    } catch (error) {
      console.error("Profile update error:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors
        });
      }
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.get("/api/users", authenticateToken, async (req, res) => {
    try {
      // Check if user has admin or super_user role
      const userRoles = req.user.roles || [req.user.role]; // Backward compatibility
      if (!userRoles.includes('admin') && !userRoles.includes('super_user')) {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      const users = await storage.getAllUsers();
      res.json(users.map(user => ({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        roles: user.rolesArray,
        role: user.rolesArray[0] // Use first role for backward compatibility
      })));
    } catch (error) {
      res.status(500).json({ message: "Failed to get users" });
    }
  });

  app.put("/api/users/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const userData = req.body;
      const userRoles = req.user.roles || [req.user.role]; // Backward compatibility

      // Get user to check if it's the root user
      const userToUpdate = await storage.getUserById(id);
      if (!userToUpdate) {
        return res.status(404).json({ message: "User not found" });
      }

      const targetUserRoles = userToUpdate.rolesArray || [];
      const isEditingSelf = req.user.id === id;
      const currentUserIsAdmin = userRoles.includes('admin');
      const currentUserIsSuperUser = userRoles.includes('super_user');
      const targetIsAdmin = targetUserRoles.includes('admin');
      const targetIsSuperUser = targetUserRoles.includes('super_user');

      // Prevent editing root user unless the current user is a super_user
      if (userToUpdate.username === 'root' && !currentUserIsSuperUser) {
        return res.status(403).json({ message: "Cannot edit the root user" });
      }

      // Permission checks based on user roles
      if (currentUserIsSuperUser) {
        // Super users can edit anyone (no restrictions)
      } else if (currentUserIsAdmin) {
        // Admins can edit themselves and non-admin users
        if (!isEditingSelf && targetIsAdmin) {
          return res.status(403).json({ message: "Admins cannot edit other administrator accounts" });
        }
        if (!isEditingSelf && targetIsSuperUser) {
          return res.status(403).json({ message: "Admins cannot edit super user accounts" });
        }

        // Role restrictions for admin users
        if (isEditingSelf && userData.roles) {
          return res.status(403).json({ message: "Cannot modify your own roles" });
        }

        // Prevent admin from granting admin or super_user roles to others
        if (!isEditingSelf && userData.roles) {
          if (userData.roles.includes('admin') || userData.roles.includes('super_user')) {
            return res.status(403).json({ message: "Cannot grant admin or super user roles" });
          }
        }
      } else {
        // Non-admin, non-super users
        if (!isEditingSelf && (targetIsAdmin || targetIsSuperUser)) {
          return res.status(403).json({ message: "Cannot edit administrator or super user accounts" });
        }

        // Role restrictions for non-admin users
        if (isEditingSelf && userData.roles) {
          return res.status(403).json({ message: "Cannot modify your own roles" });
        }

        // Prevent non-admin from granting admin or super_user roles to others
        if (!isEditingSelf && userData.roles) {
          if (userData.roles.includes('admin') || userData.roles.includes('super_user')) {
            return res.status(403).json({ message: "Cannot grant admin or super user roles" });
          }
        }
      }

      const updatedUser = await storage.updateUser(id, userData);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: updatedUser.id,
        username: updatedUser.username,
        fullName: updatedUser.fullName,
        roles: updatedUser.rolesArray,
        role: updatedUser.rolesArray[0] // Use first role for backward compatibility
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", authenticateToken, async (req, res) => {
    try {
      // Check if user has admin or super_user role
      const userRoles = req.user.roles || [req.user.role]; // Backward compatibility
      if (!userRoles.includes('admin') && !userRoles.includes('super_user')) {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      const { id } = req.params;

      // Prevent deleting self
      if (req.user.id === id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      // Get user to check if it's the root user
      const userToDelete = await storage.getUserById(id);
      if (!userToDelete) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent deleting root user unless the current user is a super_user
      if (userToDelete.username === 'root' && !userRoles.includes('super_user')) {
        return res.status(403).json({ message: "Cannot delete the root user" });
      }

      // Only super users can delete admin users
      const targetUserRoles = userToDelete.rolesArray || [];
      if (targetUserRoles.includes('admin') && !userRoles.includes('super_user')) {
        return res.status(403).json({ message: "Only super users can delete administrator accounts" });
      }

      const deleted = await storage.deleteUser(id);
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Dashboard routes
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      // Prevent caching to ensure fresh data
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/dashboard/recent-activities", requireAuth, async (req, res) => {
    try {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      const activities = await storage.getRecentActivities(5);
      res.json(activities);
    } catch (error) {
      console.error('Recent activities error:', error);
      res.status(500).json({ error: "Failed to fetch recent activities" });
    }
  });

  // Patient routes
  app.get("/api/patients", authenticateToken, async (req, res) => {
    try {
      const patients = await storage.getPatients();
      res.json(patients);
    } catch (error) {
      res.status(500).json({ message: "Failed to get patients" });
    }
  });

  app.get("/api/patients/search", authenticateToken, async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ message: "Search query required" });
      }
      const patients = await storage.searchPatients(q);
      res.json(patients);
    } catch (error) {
      res.status(500).json({ message: "Failed to search patients" });
    }
  });

  app.post("/api/patients", authenticateToken, async (req: any, res) => {
    try {
      // Check if user has billing staff role and restrict access
      const userRoles = req.user.roles || [req.user.role]; // Backward compatibility
      const isBillingStaff = userRoles.includes('billing_staff') && !userRoles.includes('admin') && !userRoles.includes('super_user');

      if (isBillingStaff) {
        return res.status(403).json({ message: "Access denied. Billing staff cannot create patients." });
      }

      const patientData = insertPatientSchema.parse(req.body);
      // Set createdAt to current time in Indian timezone (UTC+5:30)
      const now = new Date();
      // Add 5.5 hours (5 hours 30 minutes) to UTC to get Indian time
      const indianTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      patientData.createdAt = indianTime.toISOString();

      const patient = await storage.createPatient(patientData, req.user.id);
      res.json(patient);
    } catch (error) {
      console.error("Patient creation error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      res.status(400).json({ message: "Failed to create patient" });
    }
  });

  app.get("/api/patients/:id", authenticateToken, async (req, res) => {
    try {
      const patient = await storage.getPatientById(req.params.id);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      res.json(patient);
    } catch (error) {
      res.status(500).json({ message: "Failed to get patient" });
    }
  });


  app.patch("/api/patients/:id", authenticateToken, async (req: any, res) => {
    try {
      // Check if user has billing staff role and restrict access
      const userRoles = req.user.roles || [req.user.role]; // Backward compatibility
      const isBillingStaff = userRoles.includes('billing_staff') && !userRoles.includes('admin') && !userRoles.includes('super_user');

      if (isBillingStaff) {
        return res.status(403).json({ message: "Access denied. Billing staff cannot update patient information." });
      }

      const { id } = req.params;

      // Validate incoming data (allow partial updates)
      const patientData = updatePatientSchema.parse(req.body);

      const updated = await storage.updatePatient(id, patientData);

      if (!updated) {
        return res.status(404).json({ message: "Patient not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Patient update error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      res.status(400).json({ message: "Failed to update patient" });
    }
  });

  // Doctor routes
  app.get("/api/doctors", authenticateToken, async (req, res) => {
    try {
      const doctors = await storage.getDoctors();
      res.json(doctors);
    } catch (error) {
      console.error("Doctors fetch error:", error);
      res.status(500).json({ message: "Failed to fetch doctors" });
    }
  });

  app.get("/api/doctors/deleted", authenticateToken, async (req, res) => {
    try {
      const deletedDoctors = await storage.getDeletedDoctors();
      res.json(deletedDoctors);
    } catch (error) {
      console.error("Deleted doctors fetch error:", error);
      res.status(500).json({ message: "Failed to fetch deleted doctors" });
    }
  });

  app.post("/api/doctors", authenticateToken, async (req: any, res) => {
    try {
      const doctorData = insertDoctorSchema.parse(req.body);
      const doctor = await storage.createDoctor(doctorData, req.user?.id);
      res.json(doctor);
    } catch (error) {
      console.error("Doctor creation error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      res.status(400).json({ message: "Failed to create doctor" });
    }
  });

  app.put("/api/doctors/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const doctorData = insertDoctorSchema.parse(req.body);
      const doctor = await storage.updateDoctor(id, doctorData);
      res.json(doctor);
    } catch (error) {
      console.error("Doctor update error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      res.status(400).json({ message: "Failed to update doctor" });
    }
  });

  app.delete("/api/doctors/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;

      // Get doctor details before deletion for activity log
      const doctor = await storage.getDoctorById(id);
      if (!doctor) {
        return res.status(404).json({ message: "Doctor not found" });
      }

      const deleted = await storage.deleteDoctor(id, req.user?.id);
      if (!deleted) {
        return res.status(404).json({ message: "Doctor not found" });
      }

      // Create activity log for doctor deactivation
      await storage.createActivity({
        userId: req.user?.id,
        activityType: 'doctor_deactivated',
        title: 'Doctor Deactivated',
        description: `${doctor.name} has been deactivated`,
        entityId: id,
        entityType: "doctor",
        metadata: JSON.stringify({
          doctorId: id,
          deactivatedBy: req.user?.username,
        }),
      });

      res.json({ message: "Doctor deactivated successfully" });
    } catch (error) {
      console.error("Doctor deactivation error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to deactivate doctor" });
    }
  });

  app.get("/api/doctors/:id", authenticateToken, async (req, res) => {
    try {
      const doctor = await storage.getDoctorById(req.params.id);
      if (!doctor) {
        return res.status(404).json({ message: "Doctor not found" });
      }
      res.json(doctor);
    } catch (error) {
      res.status(500).json({ message: "Failed to get doctor" });
    }
  });

  // Added restore doctor route
  app.put("/api/doctors/:id/restore", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const restored = await storage.restoreDoctor(id, req.user?.id);
      if (!restored) {
        return res.status(404).json({ message: "Doctor not found" });
      }
      res.json({ message: "Doctor restored successfully", doctor: restored });
    } catch (error) {
      console.error("Doctor restoration error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to restore doctor" });
    }
  });

  // Added permanent delete endpoint for doctors
  app.delete("/api/doctors/:id/permanent", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User authentication required" });
      }

      const deleted = await storage.permanentlyDeleteDoctor(req.params.id, userId);
      if (deleted) {
        res.json({ message: "Doctor permanently deleted" });
      } else {
        res.status(404).json({ message: "Doctor not found" });
      }
    } catch (error: any) {
      console.error("Error permanently deleting doctor:", error);
      res.status(500).json({ message: error.message || "Failed to permanently delete doctor" });
    }
  });

  // Doctor Service Rate routes
  app.get("/api/doctors/:doctorId/salary-rates", authenticateToken, async (req, res) => {
    try {
      const { doctorId } = req.params;
      const rates = await storage.getDoctorServiceRates(doctorId);
      res.json(rates);
    } catch (error) {
      res.status(500).json({ message: "Failed to get doctor service rates" });
    }
  });

  app.put("/api/doctors/:doctorId/salary-rates", authenticateToken, async (req: any, res) => {
    try {
      const { doctorId } = req.params;
      const { rates } = req.body;


      if (!Array.isArray(rates)) {
        return res.status(400).json({ message: "Rates must be an array" });
      }

      // Verify the authenticated user exists
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Verify the doctor exists
      const doctor = await storage.getDoctorById(doctorId);
      if (!doctor) {
        return res.status(404).json({ message: "Doctor not found" });
      }

      // First, delete existing rates for this doctor
      const existingRates = await storage.getDoctorServiceRates(doctorId);
      for (const existingRate of existingRates) {
        await storage.deleteDoctorServiceRate(existingRate.id);
      }

      // Then create new rates
      const createdRates = [];
      for (const rate of rates) {
        if (rate.isSelected && rate.salaryBasis && (rate.amount > 0 || rate.percentage > 0)) {
          let actualServiceId = rate.serviceId;
          let actualServiceName = rate.serviceName;

          // Handle special service IDs that might need mapping
          if (rate.serviceId === 'opd_placeholder' || rate.serviceId === 'opd_consultation_placeholder') {
            // Try to find an actual OPD/consultation service
            const services = await storage.getServices();
            let opdService = services.find(s =>
              s.category?.toLowerCase() === 'consultation'
            );

            if (!opdService) {
              opdService = services.find(s =>
                s.name?.toLowerCase().includes('opd') ||
                s.name?.toLowerCase().includes('consultation') ||
                s.name?.toLowerCase().includes('visit')
              );
            }

            if (opdService) {
              actualServiceId = opdService.id;
              actualServiceName = opdService.name;
            } else {
              // Create a generic OPD service record if none exists
              try {
                const newOpdService = await storage.createService({
                  name: 'OPD Consultation',
                  category: 'consultation',
                  price: 500, // Default consultation fee
                  description: 'General OPD consultation service',
                  isActive: true,
                  createdBy: req.user.id
                });
                actualServiceId = newOpdService.id;
                actualServiceName = newOpdService.name;
              } catch (serviceCreationError) {
                console.error('Failed to create OPD service:', serviceCreationError);
                continue; // Skip this rate if service creation fails
              }
            }
          } else if (rate.serviceId === 'lab_tests_all') {
            // Handle Lab Tests placeholder - create a generic lab service if none exists
            const services = await storage.getServices();
            let labService = services.find(s =>
              s.category?.toLowerCase() === 'pathology' ||
              s.category?.toLowerCase() === 'lab_tests' ||
              s.name?.toLowerCase().includes('lab') ||
              s.name?.toLowerCase().includes('pathology')
            );

            if (labService) {
              actualServiceId = labService.id;
              actualServiceName = labService.name;
            } else {
              // Create a generic lab service record if none exists
              try {
                const newLabService = await storage.createService({
                  name: 'Lab Tests',
                  category: 'pathology',
                  price: 0, // Lab tests have variable pricing
                  description: 'Pathology and laboratory testing services',
                  isActive: true,
                  createdBy: req.user.id
                });
                actualServiceId = newLabService.id;
                actualServiceName = newLabService.name;
              } catch (serviceCreationError) {
                console.error('Failed to create Lab service:', serviceCreationError);
                continue; // Skip this rate if service creation fails
              }
            }
          } else {
            // For regular services, verify they exist
            const service = await storage.getServiceById(rate.serviceId);
            if (!service) {
              console.warn(`Service not found: ${rate.serviceId}, skipping rate creation`);
              continue;
            }
          }

          const rateData = {
            doctorId,
            serviceId: actualServiceId,
            serviceName: actualServiceName,
            serviceCategory: rate.serviceCategory,
            rateType: rate.salaryBasis === 'percentage' ? 'percentage' : 'amount',
            rateAmount: rate.salaryBasis === 'percentage' ? rate.percentage : rate.amount,
            isActive: true,
            notes: null,
            createdBy: req.user.id,
          };

          try {
            const validatedData = insertDoctorServiceRateSchema.parse(rateData);
            const created = await storage.createDoctorServiceRate(validatedData);
            createdRates.push(created);
          } catch (createError) {
            console.error(`Failed to create rate for service ${rate.serviceId}:`, createError);
            if (createError instanceof z.ZodError) {
              console.error(`Validation errors:`, createError.errors);
            }
            // Continue with other rates instead of failing completely
          }
        }
      }

      res.json({ message: "Doctor service rates updated successfully", rates: createdRates });
    } catch (error) {
      console.error("Update doctor service rates error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors,
        });
      }
      res.status(500).json({ message: "Failed to update doctor service rates" });
    }
  });

  // Service routes
  app.get("/api/services", authenticateToken, async (req, res) => {
    try {
      const services = await storage.getServices();
      res.json(services);
    } catch (error) {
      res.status(500).json({ message: "Failed to get services" });
    }
  });

  app.get("/api/services/search", authenticateToken, async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ message: "Search query required" });
      }
      const services = await storage.searchServices(q);
      res.json(services);
    } catch (error) {
      res.status(500).json({ message: "Failed to search services" });
    }
  });

  // Services
  app.post("/api/services", authenticateToken, async (req: any, res) => {
    try {
      // Check if user has billing staff role and restrict access
      const userRoles = req.user.roles || [req.user.role]; // Backward compatibility
      const isBillingStaff = userRoles.includes('billing_staff') && !userRoles.includes('admin') && !userRoles.includes('super_user');

      if (isBillingStaff) {
        return res.status(403).json({ message: "Access denied. Billing staff cannot create services." });
      }

      console.log("Creating service with data:", req.body);

      // Ensure all required fields are present with defaults
      const serviceData = {
        name: req.body.name,
        category: req.body.category || 'misc',
        price: req.body.price || 0,
        description: req.body.description || '',
        isActive: req.body.isActive !== undefined ? req.body.isActive : true,
        billingType: req.body.billingType || 'per_instance',
        billingParameters: req.body.billingParameters || null
      };

      console.log("Processed service data:", serviceData);

      // Validate with schema
      const validatedData = insertServiceSchema.parse(serviceData);
      const service = await storage.createService(validatedData, req.user?.id);
      res.json(service);
    } catch (error) {
      console.error("Create service error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors,
        });
      }
      res.status(500).json({ message: "Failed to create service" });
    }
  });

  app.put("/api/services/:id", authenticateToken, async (req: any, res) => {
    try {
      console.log("Updating service with data:", req.body);

      // Ensure all required fields are present with defaults
      const serviceData = {
        name: req.body.name,
        category: req.body.category || 'misc',
        price: req.body.price || 0,
        description: req.body.description || '',
        isActive: req.body.isActive !== undefined ? req.body.isActive : true,
        billingType: req.body.billingType || 'per_instance',
        billingParameters: req.body.billingParameters || null
      };

      console.log("Processed service update data:", serviceData);

      // Validate with schema
      const validatedData = insertServiceSchema.parse(serviceData);
      const service = await storage.updateService(req.params.id, validatedData, req.user?.id);

      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }

      res.json(service);
    } catch (error) {
      console.error("Update service error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors,
        });
      }
      res.status(500).json({ message: "Failed to update service" });
    }
  });

  app.delete("/api/services/:id", authenticateToken, async (req: any, res) => {
    try {
      const deleted = await storage.deleteService(req.params.id, req.user.id);
      if (!deleted) {
        return res.status(404).json({ message: "Service not found" });
      }
      res.json({ message: "Service deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete service" });
    }
  });

  // Pathology Categories routes
  app.get("/api/pathology-categories", authenticateToken, async (req, res) => {
    try {
      const categories = await storage.getPathologyCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to get pathology categories" });
    }
  });

  // Create pathology category (creates custom categories in database)
  app.post("/api/pathology-categories", authenticateToken, async (req, res) => {
    try {
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Category name is required" });
      }

      // Check if system category with same name exists
      const systemCategories = getCategories();
      if (systemCategories.includes(name)) {
        return res.status(400).json({ message: "A system category with this name already exists" });
      }

      const category = await storage.createPathologyCategory({
        name,
        description: description || '',
        isActive: true
      });

      res.json(category);
    } catch (error) {
      console.error("Error creating pathology category:", error);
      res.status(500).json({ message: "Failed to create pathology category" });
    }
  });

  app.put("/api/pathology-categories/:id", authenticateToken, async (req, res) => {
    try {
      const categoryData = insertPathologyCategorySchema.partial().parse(req.body);
      const category = await storage.updatePathologyCategory(req.params.id, categoryData);
      if (!category) {
        return res.status(404).json({ message: "Pathology category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(400).json({ message: "Failed to update pathology category" });
    }
  });

  app.delete("/api/pathology-categories/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;

      // Check if it's a system category (categoryId is a string that matches system category name)
      const systemCategories = getCategories();
      const isSystemCategory = systemCategories.includes(id);

      if (isSystemCategory) {
        try {
          deleteCategoryFromFile(id);
          res.json({ message: "System pathology category deleted successfully" });
        } catch (error) {
          res.status(500).json({ message: "Failed to delete system pathology category" });
        }
      } else {
        // Handle custom category deletion
        const deleted = await storage.deletePathologyCategory(id);
        if (!deleted) {
          return res.status(404).json({ message: "Pathology category not found or has associated tests" });
        }
        res.json({ message: "Pathology category deleted successfully" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to delete pathology category" });
    }
  });

  // Dynamic Pathology Tests routes
  app.get("/api/dynamic-pathology-tests", authenticateToken, async (req, res) => {
    try {
      const { categoryId } = req.query;
      let tests;
      if (categoryId && typeof categoryId === 'string') {
        tests = await storage.getDynamicPathologyTestsByCategory(categoryId);
      } else {
        tests = await storage.getDynamicPathologyTests();
      }
      res.json(tests);
    } catch (error) {
      res.status(500).json({ message: "Failed to get dynamic pathology tests" });
    }
  });

  // Create dynamic pathology test (works for both system and custom categories)
  app.post("/api/dynamic-pathology-tests", authenticateToken, async (req, res) => {
    try {
      const { testName, price, categoryId } = req.body;

      if (!testName || typeof price !== 'number' || !categoryId) {
        return res.status(400).json({ message: "Missing required fields: testName, price, categoryId" });
      }

      // Check if it's a system category (categoryId is a string that matches system category name)
      const systemCategories = getCategories();
      const isSystemCategory = systemCategories.includes(categoryId);

      if (isSystemCategory) {
        // Add test to the JSON file for system categories
        try {
          addTestToFile(categoryId, {
            test_name: testName,
            price: price,
            subtests: []
          });

          // Return a mock response that matches the expected format
          res.json({
            id: `system-${Date.now()}`,
            testName,
            price,
            categoryId,
            isActive: true
          });
        } catch (fileError) {
          console.error("Error adding test to system category:", fileError);
          res.status(500).json({ message: "Failed to add test to system category" });
        }
      } else {
        // Check if custom category exists
        const customCategories = await storage.getPathologyCategories();
        const categoryExists = customCategories.some(cat => cat.id === categoryId);

        if (!categoryExists) {
          return res.status(400).json({ message: "Category not found" });
        }

        // Add test to database for custom categories
        const test = await storage.createDynamicPathologyTest({
          testName,
          price,
          categoryId,
          isActive: true
        });

        res.json(test);
      }
    } catch (error) {
      console.error("Error creating dynamic pathology test:", error);
      res.status(400).json({ message: "Failed to create dynamic pathology test" });
    }
  });


  app.put("/api/dynamic-pathology-tests/:id", authenticateToken, async (req, res) => {
    try {
      const testData = insertDynamicPathologyTestSchema.partial().parse(req.body);
      const test = await storage.updateDynamicPathologyTest(req.params.id, testData);
      if (!test) {
        return res.status(404).json({ message: "Dynamic pathology test not found" });
      }
      res.json(test);
    } catch (error) {
      res.status(400).json({ message: "Failed to update dynamic pathology test" });
    }
  });

  app.delete("/api/dynamic-pathology-tests/:id", authenticateToken, async (req, res) => {
    try {
      const deleted = await storage.deleteDynamicPathologyTest(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Dynamic pathology test not found" });
      }
      res.json({ message: "Dynamic pathology test deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete dynamic pathology test" });
    }
  });

  // Delete system pathology test
  app.delete("/api/pathology-tests/system/:categoryName/:testName", authenticateToken, async (req, res) => {
    try {
      const { categoryName, testName } = req.params;

      deleteTestFromFile(categoryName, testName);
      res.json({ message: "System pathology test deleted successfully" });
    } catch (error) {
      console.error("Error deleting system pathology test:", error);
      res.status(500).json({ message: "Failed to delete system pathology test" });
    }
  });

  // Bulk upload pathology tests from JSON
  app.post("/api/pathology-tests/bulk-upload", authenticateToken, async (req, res) => {
    try {
      const { categories } = req.body;

      if (!categories || !Array.isArray(categories)) {
        return res.status(400).json({ message: "Invalid data format. Expected categories array." });
      }

      const results: any = {
        categories: [],
        tests: [],
        errors: []
      };

      for (const categoryData of categories) {
        try {
          if (!categoryData.name || !categoryData.tests) {
            results.errors.push(`Invalid category data: missing name or tests`);
            continue;
          }

          // Create or get category
          let category;
          try {
            const categoryInsert = insertPathologyCategorySchema.parse({
              name: categoryData.name,
              description: categoryData.description || null
            });
            category = await storage.createPathologyCategory(categoryInsert);
            results.categories.push(category);
          } catch (error) {
            // Category might already exist, try to find it
            const categories = await storage.getPathologyCategories();
            category = categories.find(c => c.name === categoryData.name);
            if (!category) {
              results.errors.push(`Failed to create category: ${categoryData.name}`);
              continue;
            }
          }

          // Create tests for this category
          const testsToCreate = categoryData.tests.map((test: any) =>
            insertDynamicPathologyTestSchema.parse({
              categoryId: category.id,
              testName: test.test_name || test.name,
              price: test.price || 0,
              normalRange: test.normal_range || null,
              description: test.description || null
            })
          );

          const createdTests = await storage.bulkCreateDynamicPathologyTests(testsToCreate);
          results.tests.push(...createdTests);

        } catch (error) {
          results.errors.push(`Error processing category ${categoryData.name}: ${error}`);
        }
      }

      res.json(results);
    } catch (error) {
      res.status(400).json({ message: "Failed to bulk upload pathology tests" });
    }
  });

  // Get combined pathology tests (system + custom)
  app.get("/api/pathology-tests/combined", authenticateToken, async (req, res) => {
    try {
      const systemCategories = getCategories();
      const customCategories = await storage.getPathologyCategories();
      const customTests = await storage.getDynamicPathologyTests();

      // Create combined categories structure
      const combinedCategories = [...systemCategories.map(name => ({
        id: name,
        name,
        description: '',
        isHardcoded: true,
        isSystem: true,
        tests: getTestsByCategory(name).map(test => ({
          ...test,
          id: `system-${name}-${test.test_name}`,
          isHardcoded: true,
          name: test.test_name,
          testName: test.test_name
        }))
      }))];

      // Add custom categories
      for (const customCat of customCategories) {
        const testsInCategory = customTests.filter(test => test.categoryId === customCat.id);
        combinedCategories.push({
          id: customCat.id,
          name: customCat.name,
          description: customCat.description || '',
          isHardcoded: false,
          isSystem: false,
          tests: testsInCategory.map(test => ({
            id: test.id,
            test_name: test.testName,
            testName: test.testName,
            name: test.testName,
            price: test.price,
            category: customCat.name,
            categoryId: test.categoryId,
            normalRange: test.normalRange,
            description: test.description,
            isActive: test.isActive,
            isHardcoded: false,
            subtests: []
          }))
        });
      }

      res.json({ categories: combinedCategories });
    } catch (error) {
      console.error("Error fetching combined pathology tests:", error);
      res.status(500).json({ message: "Failed to fetch pathology tests" });
    }
  });

  // Bill routes
  app.get("/api/bills", authenticateToken, async (req, res) => {
    try {
      const { fromDate, toDate, paymentStatus } = req.query;

      const bills = await storage.getBillsWithFilters({
        fromDate: fromDate as string,
        toDate: toDate as string,
        paymentStatus: paymentStatus as string
      });

      console.log(`Retrieved ${bills.length} bills with filters:`, {
        fromDate,
        toDate,
        paymentStatus
      });

      res.json(bills);
    } catch (error) {
      console.error("Error fetching bills:", error);
      res.status(500).json({ message: "Failed to get bills" });
    }
  });

  app.post("/api/bills", authenticateToken, async (req, res) => {
    try {
      const { bill, items } = req.body;

      const billData = insertBillSchema.parse({
        ...bill,
        createdBy: req.user.id,
        billDate: new Date().toISOString().split('T')[0],
      });

      const itemsData = items.map((item: any) => insertBillItemSchema.parse(item));

      const createdBill = await storage.createBill(billData, itemsData, req.user.id);
      res.json(createdBill);
    } catch (error) {
      res.status(400).json({ message: "Failed to create bill" });
    }
  });

  app.get("/api/bills/:id", authenticateToken, async (req, res) => {
    try {
      const bill = await storage.getBillById(req.params.id);
      if (!bill) {
        return res.status(404).json({ message: "Bill not found" });
      }
      const items = await storage.getBillItems(req.params.id);
      res.json({ ...bill, items });
    } catch (error) {
      res.status(500).json({ message: "Failed to get bill" });
    }
  });

  // Pathology Test Catalog routes
  app.get("/api/pathology/catalog", authenticateToken, async (req, res) => {
    try {
      const tests = getAllPathologyTests();
      res.json(tests);
    } catch (error) {
      res.status(500).json({ message: "Failed to get pathology catalog" });
    }
  });

  app.get("/api/pathology/catalog/categories", authenticateToken, async (req, res) => {
    try {
      const categories = getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to get pathology categories" });
    }
  });

  app.get("/api/pathology/catalog/category/:categoryName", authenticateToken, async (req, res) => {
    try {
      const tests = getTestsByCategory(req.params.categoryName);
      res.json(tests);
    } catch (error) {
      res.status(500).json({ message: "Failed to get tests for category" });
    }
  });

  // Pathology routes
  app.get("/api/pathology", authenticateToken, async (req, res) => {
    try {
      const { fromDate, toDate } = req.query;
      const orders = await storage.getPathologyOrders(fromDate as string, toDate as string);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Failed to get pathology orders" });
    }
  });

  app.post("/api/pathology", authenticateToken, async (req: any, res) => {
    try {
      // Check if user has billing staff role and restrict access
      const userRoles = req.user.roles || [req.user.role]; // Backward compatibility
      const isBillingStaff = userRoles.includes('billing_staff') && !userRoles.includes('admin') && !userRoles.includes('super_user');

      if (isBillingStaff) {
        return res.status(403).json({ message: "Access denied. Billing staff cannot create pathology orders." });
      }

      console.log("Received pathology order request:", JSON.stringify(req.body, null, 2));
      const { orderData, tests } = req.body;

      if (!orderData || !tests) {
        return res.status(400).json({ message: "Missing orderData or tests" });
      }

      // Ensure doctorId is null if empty string or "external"
      const processedOrderData = {
        ...orderData,
        doctorId: orderData.doctorId === "" || orderData.doctorId === "external" ? null : orderData.doctorId
      };

      const order = await storage.createPathologyOrder(processedOrderData, tests, req.user.id);
      res.json(order);
    } catch (error: any) {
      console.error("Error creating pathology order:", error);
      res.status(400).json({ message: "Failed to create pathology order", error: error.message });
    }
  });

  app.patch("/api/pathology/:id/status", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }

      const updatedOrder = await storage.updatePathologyOrderStatus(id, status);
      res.json(updatedOrder);
    } catch (error: any) {
      console.error("Error updating pathology order status:", error);
      res.status(400).json({ message: "Failed to update order status", error: error.message });
    }
  });

  app.get("/api/pathology/:id", authenticateToken, async (req, res) => {
    try {
      const orderDetails = await storage.getPathologyOrderById(req.params.id);
      if (!orderDetails) {
        return res.status(404).json({ message: "Pathology order not found" });
      }
      res.json(orderDetails);
    } catch (error) {
      res.status(500).json({ message: "Failed to get pathology order details" });
    }
  });

  app.get("/api/pathology/patient/:patientId", authenticateToken, async (req, res) => {
    try {
      const orders = await storage.getPathologyOrdersByPatient(req.params.patientId);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Failed to get patient pathology orders" });
    }
  });

  // Patient Services Routes
  app.get("/api/patient-services", requireAuth, async (req, res) => {
    try {
      const { serviceType, fromDate, toDate, doctorId, serviceName, status, patientId } = req.query;

      // Build filters object
      const filters: any = {};

      if (patientId) {
        filters.patientId = patientId as string;
      }

      if (serviceType) {
        // Handle multiple service types (comma-separated)
        if ((serviceType as string).includes(',')) {
          const serviceTypes = (serviceType as string).split(',').map(type => {
            const serviceTypeMapping: { [key: string]: string } = {
              'labtest': 'diagnostic',
              'lab': 'diagnostic',
              'opd': 'opd',
              'diagnostic': 'diagnostic',
              'diagnostics': 'diagnostic',
              'procedure': 'procedure',
              'procedures': 'procedure',
              'operation': 'operation',
              'operations': 'operation',
              'misc': 'misc'
            };
            return serviceTypeMapping[type.trim()] || type.trim();
          });
          filters.serviceTypes = serviceTypes;
        } else {
          // Map frontend serviceType values to database values
          const serviceTypeMapping: { [key: string]: string } = {
            'labtest': 'diagnostic',
            'lab': 'diagnostic',
            'opd': 'opd',
            'diagnostic': 'diagnostic',
            'diagnostics': 'diagnostic',
            'procedure': 'procedure',
            'procedures': 'procedure',
            'operation': 'operation',
            'operations': 'operation',
            'misc': 'misc'
          };

          filters.serviceType = serviceTypeMapping[serviceType as string] || serviceType as string;
        }
      }

      if (fromDate) {
        filters.fromDate = fromDate as string;
      }

      if (toDate) {
        filters.toDate = toDate as string;
      }

      if (doctorId && doctorId !== "all") {
        filters.doctorId = doctorId as string;
      }

      if (serviceName && serviceName !== "all") {
        filters.serviceName = serviceName as string;
      }

      if (status) {
        filters.status = status as string;
      }

      // Use storage method with filters - this already includes patient and doctor names
      const services = await storage.getPatientServicesWithFilters(filters);
      res.json(services);
    } catch (error) {
      console.error("Error fetching patient services:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Patient Services Management
  // Single service creation
  app.post("/api/patient-services", authenticateToken, async (req: any, res) => {
    try {
      // Check if user has billing staff role and restrict access
      const userRoles = req.user.roles || [req.user.role]; // Backward compatibility
      const isBillingStaff = userRoles.includes('billing_staff') && !userRoles.includes('admin') && !userRoles.includes('super_user');

      if (isBillingStaff) {
        return res.status(403).json({ message: "Access denied. Billing staff cannot create patient services." });
      }

      const serviceData = req.body;

      console.log('Creating patient service with data:', JSON.stringify(serviceData, null, 2));

      // Validate required fields
      if (!serviceData.patientId) {
        return res.status(400).json({ error: "Patient ID is required" });
      }

      if (!serviceData.serviceType) {
        return res.status(400).json({ error: "Service type is required" });
      }

      if (!serviceData.serviceName) {
        return res.status(400).json({ error: "Service name is required" });
      }

      if (!serviceData.scheduledDate) {
        return res.status(400).json({ error: "Scheduled date is required" });
      }

      if (!serviceData.scheduledTime) {
        return res.status(400).json({ error: "Scheduled time is required" });
      }

      // Convert scheduled date/time to IST and store as ISO string
      if (serviceData.scheduledDate && serviceData.scheduledTime) {
        const scheduledDateTime = new Date(`${serviceData.scheduledDate}T${serviceData.scheduledTime}:00`);
        // Add 5.5 hours to convert to IST and store
        const istDateTime = new Date(scheduledDateTime.getTime() + (5.5 * 60 * 60 * 1000));
        serviceData.createdAt = istDateTime.toISOString();
        serviceData.updatedAt = istDateTime.toISOString();
      }

      // Special validation for OPD services
      if (serviceData.serviceType === "opd") {
        if (!serviceData.doctorId || serviceData.doctorId === "" || serviceData.doctorId === "none" || serviceData.doctorId === "external") {
          return res.status(400).json({ error: "Doctor is required for OPD consultation" });
        }

        if (!serviceData.price || serviceData.price <= 0) {
          return res.status(400).json({ error: "Valid consultation fee is required for OPD" });
        }
      }

      console.log('Doctor ID in service data:', serviceData.doctorId);
      const service = await storage.createPatientService(serviceData, req.user.id);
      console.log('Created patient service:', JSON.stringify(service, null, 2));

      // Log activity for service scheduling
      const patient = await storage.getPatientById(serviceData.patientId);

      await storage.createActivity({
        userId: req.user.id,
        activityType: "service_scheduled",
        title: "Service Scheduled",
        description: `${serviceData.serviceName} scheduled for ${patient?.name || 'Patient'}`,
        entityId: service.id,
        entityType: "patient_service",
        metadata: JSON.stringify({
          patientId: serviceData.patientId,
          serviceType: serviceData.serviceType,
          serviceName: serviceData.serviceName,
          scheduledDate: serviceData.scheduledDate,
          scheduledTime: serviceData.scheduledTime,
        }),
      });
      res.json(service);
    } catch (error) {
      console.error("Error creating patient service:", error);
      res.status(500).json({
        error: "Failed to create patient service",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Batch service creation - multiple services with same order ID
  app.post("/api/patient-services/batch", authenticateToken, async (req: any, res) => {
    try {
      // Check if user has billing staff role and restrict access
      const userRoles = req.user.roles || [req.user.role]; // Backward compatibility
      const isBillingStaff = userRoles.includes('billing_staff') && !userRoles.includes('admin') && !userRoles.includes('super_user');

      if (isBillingStaff) {
        return res.status(403).json({ message: "Access denied. Billing staff cannot create patient services." });
      }

      console.log("=== BATCH SERVICE CREATION API ===");
      console.log("Raw request body:", JSON.stringify(req.body, null, 2));

      // Validate array of services
      if (!Array.isArray(req.body)) {
        return res.status(400).json({ message: "Request body must be an array of services" });
      }

      if (req.body.length === 0) {
        return res.status(400).json({ message: "No services provided" });
      }

      // Generate a single receipt number and orderId for the entire batch
      const firstService = req.body[0];
      const serviceType = firstService.serviceType === "opd" ? "opd" : "service";
      const eventDate = new Date(firstService.scheduledDate).toISOString().split("T")[0];

      // Get daily count for receipt numbering
      let count;
      try {
        const response = await fetch(`http://localhost:5000/api/receipts/daily-count/${serviceType}/${eventDate}`, {
          headers: {
            Authorization: `Bearer ${req.headers.authorization?.split(' ')[1]}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          count = data.count;
        } else {
          count = 1;
        }
      } catch (error) {
        console.error("Error fetching daily count:", error);
        count = 1;
      }

      // Generate receipt number
      const dateObj = new Date(eventDate);
      const yymmdd = dateObj.toISOString().slice(2, 10).replace(/-/g, "").slice(0, 6);
      const typeCode = serviceType === "opd" ? "OPD" : "SRV";
      const receiptNumber = `${yymmdd}-${typeCode}-${String(count).padStart(4, "0")}`;

      console.log("Generated receipt number:", receiptNumber);

      // Add receipt number to all services (orderId will be generated by storage)
      const servicesWithReceipt = req.body.map((service: any) => ({
        ...service,
        receiptNumber: receiptNumber,
      }));

      console.log(`Creating batch of ${servicesWithReceipt.length} services with receipt number: ${receiptNumber}`);

      const services = await storage.createPatientServicesBatch(servicesWithReceipt, req.user.id);

      console.log(`Successfully created ${services.length} services with shared orderId: ${services[0]?.orderId}`);

      // Log activity for service scheduling
      if (services.length > 0) {
        const patient = await storage.getPatientById(servicesWithReceipt[0].patientId);
        const serviceNames = services.map(s => s.serviceName).join(", ");

        await storage.createActivity({
          userId: req.user.id,
          activityType: "service_scheduled",
          title: "Service Scheduled",
          description: `${serviceNames} scheduled for ${patient?.name || 'Patient'}`,
          entityId: services[0].orderId || services[0].id,
          entityType: "patient_service",
          metadata: JSON.stringify({
            patientId: servicesWithReceipt[0].patientId,
            serviceCount: services.length,
            services: services.map(s => ({
              serviceName: s.serviceName,
              serviceType: s.serviceType,
              scheduledDate: s.scheduledDate,
              scheduledTime: s.scheduledTime,
            })),
          }),
        });
      }

      res.json(services);
    } catch (error: any) {
      console.error("Batch service creation error:", error);
      res.status(400).json({ message: "Failed to create batch services", error: error.message });
    }
  });


  app.put("/api/patient-services/:id", authenticateToken, async (req, res) => {
    try {
      const service = await storage.updatePatientService(req.params.id, req.body, req.user.id);

      // Log activity if service is being completed
      if (req.body.status === "completed") {
        const patient = await storage.getPatientById(service.patientId);

        await storage.createActivity({
          userId: req.user.id,
          activityType: "service_completed",
          title: "Service Completed",
          description: `${service.serviceName} completed for ${patient?.name || 'Patient'}`,
          entityId: service.id,
          entityType: "patient_service",
          metadata: JSON.stringify({
            patientId: service.patientId,
            serviceName: service.serviceName,
            serviceType: service.serviceType,
          }),
        });
      }
      res.json(service);
    } catch (error) {
      console.error("Error updating patient service:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Patient Admissions Routes
  app.get("/api/admissions", authenticateToken, async (req, res) => {
    try {
      const { patientId, fromDate, toDate } = req.query;
      const admissions = await storage.getAdmissions(patientId as string, fromDate as string, toDate as string);
      res.json(admissions);
    } catch (error) {
      console.error("Error fetching admissions:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admissions", authenticateToken, async (req: any, res) => {
    try {
      // Check if user has billing staff role and restrict access
      const userRoles = req.user.roles || [req.user.role]; // Backward compatibility
      const isBillingStaff = userRoles.includes('billing_staff') && !userRoles.includes('admin') && !userRoles.includes('super_user');

      if (isBillingStaff) {
        return res.status(403).json({ message: "Access denied. Billing staff cannot create admissions." });
      }

      // Normalize admission date to ISO format if provided
      const requestBody = { ...req.body };
      if (requestBody.admissionDate && typeof requestBody.admissionDate === 'string') {
        try {
          requestBody.admissionDate = new Date(requestBody.admissionDate).toISOString();
        } catch (e) {
          return res.status(400).json({ error: "Invalid admission date format" });
        }
      }
      if (requestBody.dischargeDate && typeof requestBody.dischargeDate === 'string') {
        try {
          requestBody.dischargeDate = new Date(requestBody.dischargeDate).toISOString();
        } catch (e) {
          return res.status(400).json({ error: "Invalid discharge date format" });
        }
      }

      const admission = await storage.createAdmission(requestBody, req.user.id);

      // Log activity for admission
      const patient = await storage.getPatientById(admission.patientId);
      const doctor = await storage.getDoctorById(admission.doctorId);

      await storage.createActivity({
        userId: req.user.id,
        activityType: "patient_admitted",
        title: "Patient Admitted",
        description: `${patient?.name || 'Patient'} admitted under ${doctor?.name || 'Doctor'} - ${admission.currentWardType}`,
        entityId: admission.id,
        entityType: "admission",
        metadata: JSON.stringify({
          patientId: admission.patientId,
          doctorId: admission.doctorId,
          wardType: admission.currentWardType,
          admissionDate: admission.admissionDate,
        }),
      });

      res.json(admission);
    } catch (error) {
      console.error("Error creating admission:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/admissions/:id", authenticateToken, async (req, res) => {
    try {
      // Normalize admission date to ISO format if provided
      const requestBody = { ...req.body };
      if (requestBody.admissionDate && typeof requestBody.admissionDate === 'string') {
        try {
          requestBody.admissionDate = new Date(requestBody.admissionDate).toISOString();
        } catch (e) {
          return res.status(400).json({ error: "Invalid admission date format" });
        }
      }
      if (requestBody.dischargeDate && typeof requestBody.dischargeDate === 'string') {
        try {
          requestBody.dischargeDate = new Date(requestBody.dischargeDate).toISOString();
        } catch (e) {
          return res.status(400).json({ error: "Invalid discharge date format" });
        }
      }

      const admission = await storage.updateAdmission(req.params.id, requestBody, req.user.id);
      res.json(admission);
    } catch (error) {
      console.error("Error updating admission:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/admissions/:id", authenticateToken, async (req, res) => {
    try {
      // Normalize admission date to ISO format if provided
      const requestBody = { ...req.body };
      if (requestBody.admissionDate && typeof requestBody.admissionDate === 'string') {
        try {
          requestBody.admissionDate = new Date(requestBody.admissionDate).toISOString();
        } catch (e) {
          return res.status(400).json({ error: "Invalid admission date format" });
        }
      }
      if (requestBody.dischargeDate && typeof requestBody.dischargeDate === 'string') {
        try {
          requestBody.dischargeDate = new Date(requestBody.dischargeDate).toISOString();
        } catch (e) {
          return res.status(400).json({ error: "Invalid discharge date format" });
        }
      }

      const admission = await storage.updateAdmission(req.params.id, requestBody, req.user.id);
      res.json(admission);
    } catch (error) {
      console.error("Error updating admission:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get individual patient details
  app.get("/api/patients/:id", authenticateToken, async (req, res) => {
    try {
      const patient = await storage.getPatientById(req.params.id);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      res.json(patient);
    } catch (error) {
      console.error("Error fetching patient:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/pathology/:id/status", authenticateToken, async (req, res) => {
    try {
      const { status } = req.body;
      const updated = await storage.updatePathologyOrderStatus(req.params.id, status);
      if (!updated) {
        return res.status(404).json({ message: "Pathology order not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update pathology order status" });
    }
  });

  app.patch("/api/pathology/test/:id/status", authenticateToken, async (req: any, res) => {
    try {
      const { status, results } = req.body;
      const updated = await storage.updatePathologyTestStatus(req.params.id, status, results, req.user.id);
      if (!updated) {
        return res.status(404).json({ message: "Pathology test not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update pathology test status" });
    }
  });

  // ==================== OPD Visits ====================

  // Get OPD visits with filters
  app.get("/api/opd-visits", requireAuth, async (req, res) => {
    try {
      const { doctorId, patientId, scheduledDate, status, fromDate, toDate } = req.query;

      const filters: any = {};

      if (doctorId && doctorId !== "all") {
        filters.doctorId = doctorId as string;
      }

      if (patientId) {
        filters.patientId = patientId as string;
      }

      if (scheduledDate) {
        filters.scheduledDate = scheduledDate as string;
      }

      if (status && status !== "all") {
        filters.status = status as string;
      }

      if (fromDate) {
        filters.fromDate = fromDate as string;
      }

      if (toDate) {
        filters.toDate = toDate as string;
      }

      const opdVisits = await storage.getOpdVisits(filters);
      res.json(opdVisits);
    } catch (error) {
      console.error("Error fetching OPD visits:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create new OPD visit
  app.post("/api/opd-visits", requireAuth, async (req: any, res) => {
    try {
      // Check if user has billing staff role and restrict access
      const userRoles = req.user.roles || [req.user.role]; // Backward compatibility
      const isBillingStaff = userRoles.includes('billing_staff') && !userRoles.includes('admin') && !userRoles.includes('super_user');

      if (isBillingStaff) {
        return res.status(403).json({ message: "Access denied. Billing staff cannot create OPD visits." });
      }

      const visitData = req.body;

      // Validate required fields
      if (!visitData.patientId) {
        return res.status(400).json({ error: "Patient ID is required" });
      }

      if (!visitData.doctorId) {
        return res.status(400).json({ error: "Doctor is required for OPD consultation" });
      }

      if (!visitData.scheduledDate) {
        return res.status(400).json({ error: "Scheduled date is required" });
      }

      // Ensure consultation fee is a valid number
      const consultationFee = typeof visitData.consultationFee === 'number' && visitData.consultationFee >= 0
        ? visitData.consultationFee
        : 0;

      // Create the OPD visit - storage will handle timestamps correctly
      const opdVisit = await storage.createOpdVisit({
        patientId: visitData.patientId,
        doctorId: visitData.doctorId,
        visitDate: visitData.scheduledDate,
        scheduledDate: visitData.scheduledDate,
        scheduledTime: visitData.scheduledTime || "09:00",
        symptoms: visitData.symptoms || null,
        diagnosis: visitData.diagnosis || null,
        prescription: visitData.prescription || null,
        consultationFee: consultationFee,
        status: "scheduled"
      }, req.user.id);

      // Log activity for OPD scheduling
      const patient = await storage.getPatientById(visitData.patientId);
      const doctor = await storage.getDoctorById(visitData.doctorId);

      await storage.createActivity({
        userId: req.user.id,
        activityType: "opd_scheduled",
        title: "OPD Appointment Scheduled",
        description: `${patient?.name || 'Patient'} scheduled for consultation with ${doctor?.name || 'Doctor'}`,
        entityId: opdVisit.id,
        entityType: "patient_visit",
        metadata: JSON.stringify({
          patientId: visitData.patientId,
          doctorId: visitData.doctorId,
          scheduledDate: visitData.scheduledDate,
          scheduledTime: visitData.scheduledTime,
        }),
      });

      res.status(201).json(opdVisit);
    } catch (error) {
      console.error("Error creating OPD visit:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update OPD visit status
  app.patch("/api/opd-visits/:id/status", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }

      const updated = await storage.updateOpdVisitStatus(id, status, req.user.id);

      if (!updated) {
        return res.status(404).json({ error: "OPD visit not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating OPD visit status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Room Type Management Routes
  app.get("/api/room-types", authenticateToken, async (req, res) => {
    try {
      const roomTypes = await storage.getAllRoomTypes();
      res.json(roomTypes);
    } catch (error) {
      console.error("Error fetching room types:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/room-types", authenticateToken, async (req: any, res) => {
    try {
      const roomType = await storage.createRoomType(req.body, req.user.id);
      res.status(201).json(roomType);
    } catch (error) {
      console.error("Error creating room type:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/room-types/:id", authenticateToken, async (req: any, res) => {
    try {
      const updated = await storage.updateRoomType(req.params.id, req.body, req.user.id);
      if (!updated) {
        return res.status(404).json({ error: "Room type not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating room type:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/room-types/:id", authenticateToken, async (req: any, res) => {
    try {
      await storage.deleteRoomType(req.params.id, req.user.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting room type:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Room Management Routes
  app.get("/api/rooms", authenticateToken, async (req, res) => {
    try {
      const rooms = await storage.getAllRooms();
      res.json(rooms);
    } catch (error) {
      console.error("Error fetching rooms:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/rooms", authenticateToken, async (req: any, res) => {
    try {
      const room = await storage.createRoom(req.body, req.user.id);
      res.status(201).json(room);
    } catch (error) {
      console.error("Error creating room:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/rooms/:id", authenticateToken, async (req: any, res) => {
    try {
      const updated = await storage.updateRoom(req.params.id, req.body, req.user.id);
      if (!updated) {
        return res.status(404).json({ error: "Room not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating room:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/rooms/:id", authenticateToken, async (req: any, res) => {
    try {
      await storage.deleteRoom(req.params.id, req.user.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting room:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/rooms/by-type/:roomTypeId", authenticateToken, async (req, res) => {
    try {
      const rooms = await storage.getRoomsByType(req.params.roomTypeId);
      res.json(rooms);
    } catch (error) {
      console.error("Error fetching rooms by type:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/rooms/:id/occupancy", authenticateToken, async (req, res) => {
    try {
      const { isOccupied } = req.body;
      const updated = await storage.updateRoomOccupancy(req.params.id, isOccupied, req.user.id);
      if (!updated) {
        return res.status(404).json({ error: "Room not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating room occupancy:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Hospital Settings Routes
  app.get("/api/settings/hospital", authenticateToken, async (req, res) => {
    try {
      console.log("=== Hospital Settings API Call ===");
      const settings = await storage.getHospitalSettings();
      console.log("Hospital settings from storage:", settings);
      console.log("=== End Hospital Settings API ===");
      res.json(settings);
    } catch (error) {
      console.error("Error fetching hospital settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/settings/hospital", authenticateToken, async (req, res) => {
    try {
      const settings = await storage.saveHospitalSettings(req.body, req.user.id);
      res.json(settings);
    } catch (error) {
      console.error("Error saving hospital settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/settings/upload-logo", authenticateToken, async (req, res) => {
    try {
      const { logo } = req.body;
      const logoPath = await storage.saveLogo(logo, req.user.id);
      res.json({ logoPath });
    } catch (error) {
      console.error("Error uploading logo:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // System Settings Routes
  app.get("/api/settings/system", authenticateToken, async (req: any, res) => {
    try {
      // Allow admin and super_user roles to access system settings
      const userRoles = req.user.roles || [req.user.role];
      if (!userRoles.includes('admin') && !userRoles.includes('super_user')) {
        return res.status(403).json({ message: "Access denied. Admin or super user role required." });
      }

      const settings = await storage.getSystemSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching system settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/settings/system", authenticateToken, async (req: any, res) => {
    try {
      // Allow admin and super_user roles to modify system settings
      const userRoles = req.user.roles || [req.user.role];
      if (!userRoles.includes('admin') && !userRoles.includes('super_user')) {
        return res.status(403).json({ message: "Access denied. Admin or super user role required." });
      }

      const settings = await storage.saveSystemSettings(req.body, req.user.id);

      // Update backup scheduler based on new settings
      if (settings.autoBackup) {
        await backupScheduler.enableAutoBackup(settings.backupFrequency, settings.backupTime);
      } else {
        await backupScheduler.disableAutoBackup();
      }

      res.json(settings);
    } catch (error) {
      console.error("Error saving system settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Backup Routes
  app.post("/api/backup/create", authenticateToken, async (req: any, res) => {
    try {
      // Allow admin and super_user roles to create backups
      const userRoles = req.user.roles || [req.user.role];
      if (!userRoles.includes('admin') && !userRoles.includes('super_user')) {
        return res.status(403).json({ message: "Access denied. Admin or super user role required." });
      }

      const { backupType = 'manual' } = req.body;
      console.log(`Creating backup with type: ${backupType}`);

      const backup = await storage.createBackup(backupType, req.user.id);
      console.log(`Backup created successfully:`, backup);

      res.json(backup);
    } catch (error) {
      console.error("Error creating backup:", error);
      res.status(500).json({ error: "Failed to create backup", message: error instanceof Error ? error.message : "Unknown error" });
    }
  });



  app.get("/api/backup/logs", authenticateToken, async (req: any, res) => {
    try {
      // Allow admin and super_user roles to view backup logs
      const userRoles = req.user.roles || [req.user.role];
      if (!userRoles.includes('admin') && !userRoles.includes('super_user')) {
        return res.status(403).json({ message: "Access denied. Admin or super user role required." });
      }

      const logs = await storage.getBackupLogs();
      res.json(logs);
    } catch (error) {
      console.error("Error fetching backup logs:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/backup/history", authenticateToken, async (req: any, res) => {
    try {
      // Allow admin and super_user roles to view backup history
      const userRoles = req.user.roles || [req.user.role];
      if (!userRoles.includes('admin') && !userRoles.includes('super_user')) {
        return res.status(403).json({ message: "Access denied. Admin or super user role required." });
      }

      const history = await storage.getBackupHistory();
      res.json(history);
    } catch (error) {
      console.error("Error fetching backup history:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/backup/cleanup", authenticateToken, async (req: any, res) => {
    try {
      // Allow admin and super_user roles to cleanup old backups
      const userRoles = req.user.roles || [req.user.role];
      if (!userRoles.includes('admin') && !userRoles.includes('super_user')) {
        return res.status(403).json({ message: "Access denied. Admin or super user role required." });
      }

      await storage.cleanOldBackups(req.user.id);
      res.json({ message: "Old backups cleaned up successfully" });
    } catch (error) {
      console.error("Error cleaning up backups:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/backup/available", authenticateToken, async (req: any, res) => {
    try {
      // Allow admin and super_user roles to view available backups
      const userRoles = req.user.roles || [req.user.role];
      if (!userRoles.includes('admin') && !userRoles.includes('super_user')) {
        return res.status(403).json({ message: "Access denied. Admin or super user role required." });
      }

      const backups = await storage.getAvailableBackups();
      res.json(backups);
    } catch (error) {
      console.error("Error fetching available backups:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/backup/restore", authenticateToken, async (req: any, res) => {
    try {
      // Allow admin and super_user roles to restore backups
      const userRoles = req.user.roles || [req.user.role];
      if (!userRoles.includes('admin') && !userRoles.includes('super_user')) {
        return res.status(403).json({ message: "Access denied. Admin or super user role required." });
      }

      const { backupFilePath } = req.body;

      if (!backupFilePath) {
        return res.status(400).json({ error: "Backup file path is required" });
      }

      const result = await storage.restoreBackup(backupFilePath, req.user.id);
      res.json(result);
    } catch (error) {
      console.error("Error restoring backup:", error);
      res.status(500).json({
        error: "Failed to restore backup",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Daily receipt count for receipt numbering
  app.get("/api/receipts/daily-count/:serviceType/:date", authenticateToken, async (req, res) => {
    try {
      const { serviceType, date } = req.params;
      const count = await storage.getDailyReceiptCount(serviceType, date);
      res.json({ count });
    } catch (error) {
      console.error("Error getting daily receipt count:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admission Events Routes
  app.get("/api/admissions/:id/events", authenticateToken, async (req, res) => {
    try {
      const events = await storage.getAdmissionEvents(req.params.id);
      res.json(events);
    } catch (error) {
      console.error("Error fetching admission events:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admissions/:id/transfer", authenticateToken, async (req: any, res) => {
    try {
      const { roomNumber, wardType } = req.body;
      const updated = await storage.transferRoom(req.params.id, { roomNumber, wardType }, req.user.id);
      if (!updated) {
        return res.status(404).json({ error: "Admission not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error transferring room:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admissions/:id/discharge", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { dischargeDateTime } = req.body;

      const admission = await storage.dischargePatient(id, req.user.id, dischargeDateTime);
      if (!admission) {
        return res.status(404).json({ error: "Admission not found" });
      }

      // Activity logging is already handled in storage.dischargePatient()
      res.json(admission);
    } catch (error) {
      console.error("Error discharging patient:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Comprehensive Bill Generation
  app.get("/api/patients/:patientId/comprehensive-bill", authenticateToken, async (req, res) => {
    try {
      const { patientId } = req.params;
      const comprehensiveBill = await storage.generateComprehensiveBill(patientId);
      res.json(comprehensiveBill);
    } catch (error) {
      console.error("Error generating comprehensive bill:", error);
      res.status(500).json({ error: "Failed to generate comprehensive bill" });
    }
  });

  // Inpatient Management Detail Routes (IST-based calculations)
  app.get("/api/inpatients/bed-occupancy", authenticateToken, async (req, res) => {
    try {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      const bedOccupancy = await storage.getBedOccupancyDetails();
      res.json(bedOccupancy);
    } catch (error) {
      console.error("Error fetching bed occupancy:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/inpatients/currently-admitted", authenticateToken, async (req, res) => {
    try {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      const admittedPatients = await storage.getCurrentlyAdmittedPatients();
      res.json(admittedPatients);
    } catch (error) {
      console.error("Error fetching currently admitted patients:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/inpatients/admitted-today", authenticateToken, async (req, res) => {
    try {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      const todayAdmissions = await storage.getTodayAdmissions();
      res.json(todayAdmissions);
    } catch (error) {
      console.error("Error fetching today's admissions:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/inpatients/discharged-today", authenticateToken, async (req, res) => {
    try {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      const todayDischarges = await storage.getTodayDischarges();
      res.json(todayDischarges);
    } catch (error) {
      console.error("Error fetching today's discharges:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });



  // Patient Payment Routes
  app.post("/api/patients/:patientId/payments", authenticateToken, async (req: any, res) => {
    try {
      const { patientId } = req.params;
      const { amount, paymentMethod, reason, paymentDate } = req.body;

      // Verify user ID exists
      if (!req.user?.id) {
        return res.status(401).json({ message: "User authentication required" });
      }

      const payment = await storage.createPatientPayment({
        patientId,
        amount,
        paymentMethod,
        reason: reason || "Payment",
        paymentDate: paymentDate || new Date().toISOString(),
        processedBy: req.user.id,
      }, req.user.id);

      // Log activity for payment
      const patient = await storage.getPatientById(patientId);

      res.json(payment);
    } catch (error: any) {
      console.error("Error creating patient payment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", details: error.errors });
      }
      res.status(500).json({ message: "Failed to create payment", error: error.message });
    }
  });

  app.get("/api/patients/:patientId/payments", authenticateToken, async (req, res) => {
    try {
      const { patientId } = req.params;
      const payments = await storage.getPatientPayments(patientId);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching patient payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.get("/api/patients/:patientId/financial-summary", authenticateToken, async (req, res) => {
    try {
      const { patientId } = req.params;
      console.log(`Generating financial summary for patient: ${patientId}`);
      const summary = await storage.getPatientFinancialSummary(patientId);
      console.log(`Financial summary - Total charges: ${summary.totalCharges}, Total paid: ${summary.totalPaid}`);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching patient financial summary:", error);
      res.status(500).json({ message: "Failed to fetch financial summary" });
    }
  });

  app.get("/api/patients/:patientId/comprehensive-bill", authenticateToken, async (req, res) => {
    try {
      const { patientId } = req.params;
      // Disable caching to ensure fresh data
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      console.log(`Generating comprehensive bill for patient: ${patientId}`);
      const comprehensiveBill = await storage.generateComprehensiveBill(patientId);
      console.log(`Generated comprehensive bill with ${comprehensiveBill.billItems.length} items`);

      res.json(comprehensiveBill);
    } catch (error) {
      console.error("Error generating comprehensive bill:", error);
      res.status(500).json({ message: "Failed to generate comprehensive bill" });
    }
  });

  // Patient Discount Routes
  app.post("/api/patients/:patientId/discounts", authenticateToken, async (req: any, res) => {
    try {
      const { patientId } = req.params;
      const { amount, reason, discountType, discountDate } = req.body;

      // Verify user ID exists
      if (!req.user?.id) {
        return res.status(401).json({ message: "User authentication required" });
      }

      const discount = await storage.createPatientDiscount({
        patientId,
        amount,
        reason,
        discountType: discountType || "manual",
        discountDate: discountDate || new Date().toISOString(),
        approvedBy: req.user.id,
      }, req.user.id);

      // Log activity for discount
      const patient = await storage.getPatientById(patientId);

      res.json(discount);
    } catch (error: any) {
      console.error("Error creating patient discount:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", details: error.errors });
      }
      res.status(500).json({ message: "Failed to create discount", error: error.message });
    }
  });

  app.get("/api/patients/:patientId/discounts", authenticateToken, async (req, res) => {
    try {
      const { patientId } = req.params;
      const discounts = await storage.getPatientDiscounts(patientId);
      res.json(discounts);
    } catch (error) {
      console.error("Error fetching patient discounts:", error);
      res.status(500).json({ message: "Failed to fetch discounts" });
    }
  });

  // Bulk pending bills endpoint - optimized for performance
  app.get("/api/patients/pending-bills/bulk", authenticateToken, async (req, res) => {
    try {
      const pendingBills = await storage.getAllPatientsPendingBills();
      res.json(pendingBills);
    } catch (error) {
      console.error("Error fetching pending bills:", error);
      res.status(500).json({ message: "Failed to fetch pending bills" });
    }
  });

  // Service Categories Routes
  app.get("/api/service-categories", authenticateToken, async (req, res) => {
    try {
      const categories = await storage.getServiceCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching service categories:", error);
      res.status(500).json({ message: "Failed to fetch service categories" });
    }
  });



  app.post("/api/service-categories", authenticateToken, async (req: any, res) => {
    try {
      const categoryData = insertServiceCategorySchema.parse(req.body);
      const category = await storage.createServiceCategory(categoryData, req.user.id);
      res.json(category);
    } catch (error: any) {
      console.error("Error creating service category:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", details: error.errors });
      }
      res.status(500).json({ message: "Failed to create service category", error: error.message });
    }
  });

  app.put("/api/service-categories/:id", authenticateToken, async (req: any, res) => {
    try {
      const categoryData = insertServiceCategorySchema.partial().parse(req.body);
      const category = await storage.updateServiceCategory(req.params.id, categoryData, req.user.id);
      if (!category) {
        return res.status(404).json({ message: "Service category not found" });
      }
      res.json(category);
    } catch (error: any) {
      console.error("Error updating service category:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", details: error.errors });
      }
      res.status(500).json({ message: "Failed to update service category", error: error.message });
    }
  });

  app.delete("/api/service-categories/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;

      // Get the service category to find its name
      const categories = await storage.getServiceCategories();
      const categoryToDelete = categories.find(cat => cat.id === id);

      if (!categoryToDelete) {
        return res.status(404).json({ message: "Service category not found" });
      }

      // Check if there are any services using this category
      const services = await storage.getServices();
      const servicesInCategory = services.filter(service => service.category === categoryToDelete.name);

      if (servicesInCategory.length > 0) {
        return res.status(400).json({
          message: `Cannot delete category "${categoryToDelete.label}". There are ${servicesInCategory.length} service(s) still using this category. Please delete or move these services to another category first.`,
          servicesCount: servicesInCategory.length,
          services: servicesInCategory.map(s => ({ id: s.id, name: s.name }))
        });
      }

      const deleted = await storage.deleteServiceCategory(id, req.user.id);
      if (!deleted) {
        return res.status(404).json({ message: "Service category not found" });
      }
      res.json({ message: "Service category deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting service category:", error);
      res.status(500).json({ message: error.message || "Failed to delete service category" });
    }
  });

  // Doctor Earnings Routes
  app.get("/api/doctors/:doctorId/earnings", authenticateToken, async (req, res) => {
    try {
      const { doctorId } = req.params;
      const { status } = req.query;
      console.log(`GET /api/doctors/${doctorId}/earnings - status filter: ${status || 'all'}`);
      const earnings = await storage.getDoctorEarnings(doctorId, status as string | undefined);
      console.log(`Returning ${earnings.length} earnings for doctor ${doctorId}`);
      res.json(earnings);
    } catch (error) {
      console.error("Error fetching doctor earnings:", error);
      res.status(500).json({ message: "Failed to fetch doctor earnings" });
    }
  });

  app.post("/api/doctors/recalculate-earnings", authenticateToken, async (req: any, res) => {
    try {
      const { doctorId } = req.body;
      const result = await storage.recalculateDoctorEarnings(doctorId, req.user.id);
      res.json({
        message: `Recalculation complete: processed ${result.processed} services, created ${result.created} new earnings`,
        ...result
      });
    } catch (error) {
      console.error("Error recalculating doctor earnings:", error);
      res.status(500).json({ message: "Failed to recalculate doctor earnings" });
    }
  });

  app.put("/api/doctors/:doctorId/mark-paid", authenticateToken, async (req, res) => {
    try {
      const { doctorId } = req.params;

      // Get all pending earnings for this doctor
      const pendingEarnings = await storage.getDoctorEarnings(doctorId, 'pending');

      if (pendingEarnings.length === 0) {
        return res.status(400).json({ message: "No pending earnings found for this doctor" });
      }

      // Mark all pending earnings as paid
      for (const earning of pendingEarnings) {
        await storage.updateDoctorEarningStatus(earning.id, 'paid', req.user.id);
      }

      res.json({
        message: `Successfully marked ${pendingEarnings.length} earnings as paid`,
        count: pendingEarnings.length
      });
    } catch (error) {
      console.error("Error marking earnings as paid:", error);
      res.status(500).json({ message: "Failed to mark earnings as paid" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}