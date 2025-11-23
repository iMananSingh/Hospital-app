import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { backupScheduler } from "./backup-scheduler";
import jwt from "jsonwebtoken";
import { z } from "zod";
import {
  insertUserSchema,
  insertPatientSchema,
  insertDoctorSchema,
  insertServiceSchema,
  insertBillSchema,
  insertBillItemSchema,
  insertPathologyTestSchema,
  insertSystemSettingsSchema,
  insertPathologyCategorySchema,
  insertPathologyCategoryTestSchema,
  insertPatientPaymentSchema,
  insertPatientDiscountSchema,
  insertServiceCategorySchema,
  insertDoctorServiceRateSchema,
  insertDoctorEarningSchema,
  insertDoctorPaymentSchema,
  insertAdmissionSchema,
  insertPatientVisitSchema,
  insertPatientServiceSchema,
} from "@shared/schema";
import {
  validatePathologyData,
  excelToPathologyData,
  pathologyDataToExcel,
  generateJsonTemplate,
  generateExcelTemplate,
  type PathologyData,
} from "./utils/pathology-converters";
import * as db from "./storage"; // Alias storage as db for brevity as seen in changes
import * as schema from "@shared/schema"; // Import schema for Drizzle ORM
import { eq, gte, lte, and, inArray, desc, sql } from "drizzle-orm"; // Import Drizzle ORM operators
import { patientServices, patients } from "@shared/schema"; // Import necessary schemas
import { queryClient } from "../react-query-client"; // Assuming queryClient is available
import { randomUUID } from "crypto"; // Import randomUUID

const JWT_SECRET = process.env.JWT_SECRET || "hospital-management-secret-key";

// Middleware for authentication
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token" });
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
        return res
          .status(401)
          .json({ message: "Account has been deactivated" });
      }

      const rolesArray = JSON.parse(user.roles);

      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          roles: rolesArray,
          role: rolesArray[0], // Use first role for backward compatibility
        },
        JWT_SECRET,
        { expiresIn: "8h" },
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          profilePicture: user.profilePicture,
          roles: rolesArray,
          role: rolesArray[0], // Use first role for backward compatibility
        },
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
      } else if (userData.roles && typeof userData.roles === "string") {
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
        userData.roles = JSON.stringify(["admin"]);
      }

      // Parse roles if it's a string, and set primaryRole to the first role in the array
      let parsedRoles = userData.roles;
      if (typeof userData.roles === "string") {
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
        primaryRole: parsedRoles[0],
      };

      const user = await storage.createUser(userDataWithPrimaryRole);

      // Log activity for user creation (use the creator's ID if available, otherwise use the new user's ID)
      const actorUserId = req.user?.id || user.id;
      await storage.createActivity({
        userId: actorUserId,
        activityType: "user_created",
        title: "New User Created",
        description: `User ${user.username} (${user.fullName}) created with role: ${parsedRoles.join(", ")}`,
        entityId: user.id,
        entityType: "user",
        metadata: JSON.stringify({
          username: user.username,
          fullName: user.fullName,
          roles: parsedRoles,
          createdBy: req.user?.username || "self-registration",
        }),
      });

      res.json({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        roles: user.rolesArray,
        role: user.rolesArray[0], // Use first role for backward compatibility
      });
    } catch (error) {
      console.error("User registration error:", error);
      res.status(400).json({
        message: "Registration failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
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
        profilePicture: user.profilePicture,
        roles: user.rolesArray,
        role: user.rolesArray[0], // Use first role for backward compatibility
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
        const existingUser = await storage.getUserByUsername(
          validatedData.username,
        );
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
        profilePicture: updatedUser.profilePicture,
        roles: updatedUser.rolesArray,
        role: updatedUser.rolesArray[0], // Use first role for backward compatibility
      });
    } catch (error) {
      console.error("Profile update error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors,
        });
      }
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.get("/api/users", authenticateToken, async (req, res) => {
    try {
      // Check if user has admin or super_user role
      const userRoles = req.user.roles || [req.user.role]; // Backward compatibility
      if (!userRoles.includes("admin") && !userRoles.includes("super_user")) {
        return res
          .status(403)
          .json({ message: "Access denied. Admin role required." });
      }

      const users = await storage.getAllUsers();
      res.json(
        users.map((user) => ({
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          roles: user.rolesArray,
          role: user.rolesArray[0], // Use first role for backward compatibility
        })),
      );
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
      const currentUserIsAdmin = userRoles.includes("admin");
      const currentUserIsSuperUser = userRoles.includes("super_user");
      const targetIsAdmin = targetUserRoles.includes("admin");
      const targetIsSuperUser = targetUserRoles.includes("super_user");

      // Prevent editing root user unless the current user is a super_user
      if (userToUpdate.username === "root" && !currentUserIsSuperUser) {
        return res.status(403).json({ message: "Cannot edit the root user" });
      }

      // Permission checks based on user roles
      if (currentUserIsSuperUser) {
        // Super users can edit anyone (no restrictions)
      } else if (currentUserIsAdmin) {
        // Admins can edit themselves and non-admin users
        if (!isEditingSelf && targetIsAdmin) {
          return res.status(403).json({
            message: "Admins cannot edit other administrator accounts",
          });
        }
        if (!isEditingSelf && targetIsSuperUser) {
          return res
            .status(403)
            .json({ message: "Admins cannot edit super user accounts" });
        }

        // Role restrictions for admin users
        if (isEditingSelf && userData.roles) {
          return res
            .status(403)
            .json({ message: "Cannot modify your own roles" });
        }

        // Prevent admin from granting admin or super_user roles to others
        if (!isEditingSelf && userData.roles) {
          if (
            userData.roles.includes("admin") ||
            userData.roles.includes("super_user")
          ) {
            return res
              .status(403)
              .json({ message: "Cannot grant admin or super user roles" });
          }
        }
      } else {
        // Non-admin, non-super users
        if (!isEditingSelf && (targetIsAdmin || targetIsSuperUser)) {
          return res.status(403).json({
            message: "Cannot edit administrator or super user accounts",
          });
        }

        // Role restrictions for non-admin users
        if (isEditingSelf && userData.roles) {
          return res
            .status(403)
            .json({ message: "Cannot modify your own roles" });
        }

        // Prevent non-admin from granting admin or super_user roles to others
        if (!isEditingSelf && userData.roles) {
          if (
            userData.roles.includes("admin") ||
            userData.roles.includes("super_user")
          ) {
            return res
              .status(403)
              .json({ message: "Cannot grant admin or super user roles" });
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
        role: updatedUser.rolesArray[0], // Use first role for backward compatibility
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Delete user
  app.delete("/api/users/:id", authenticateToken, async (req: any, res) => {
    try {
      const userRoles = req.user.roles || [req.user.role];
      if (!userRoles.includes("admin") && !userRoles.includes("super_user")) {
        return res.status(403).json({
          message: "Access denied. Admin or super user role required.",
        });
      }

      const userId = req.params.id;

      // Prevent deleting yourself
      if (userId === req.user.id) {
        return res
          .status(400)
          .json({ message: "Cannot delete your own account" });
      }

      // Get user data before deletion for audit log
      const userToDelete = await storage.getUserById(userId);

      const result = await storage.deleteUser(userId);

      // Create audit log
      if (userToDelete) {
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "delete",
          tableName: "users",
          recordId: userId,
          oldValues: userToDelete,
          newValues: null,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });
      }

      res.json(result);
    } catch (error: any) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Dashboard routes
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      // Prevent caching to ensure fresh data
      res.set("Cache-Control", "no-cache, no-store, must-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");

      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/dashboard/recent-activities", requireAuth, async (req, res) => {
    try {
      res.set("Cache-Control", "no-cache, no-store, must-revalidate");
      const activities = await storage.getRecentActivities(100);
      res.json(activities);
    } catch (error) {
      console.error("Recent activities error:", error);
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
      if (!q || typeof q !== "string") {
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
      const isBillingStaff =
        userRoles.includes("billing_staff") &&
        !userRoles.includes("admin") &&
        !userRoles.includes("super_user");

      if (isBillingStaff) {
        return res.status(403).json({
          message: "Access denied. Billing staff cannot create patients.",
        });
      }

      const patientData = insertPatientSchema.parse(req.body);
      // Set createdAt to current time in Indian timezone (UTC+5:30)
      const now = new Date();
      // Add 5.5 hours (5 hours 30 minutes) to UTC to get Indian time
      patientData.createdAt = new Date().toISOString();

      const patient = await storage.createPatient(patientData, req.user.id);

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "create",
        tableName: "patients",
        recordId: patient.id,
        oldValues: null,
        newValues: patient,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

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
      const isBillingStaff =
        userRoles.includes("billing_staff") &&
        !userRoles.includes("admin") &&
        !userRoles.includes("super_user");

      if (isBillingStaff) {
        return res.status(403).json({
          message:
            "Access denied. Billing staff cannot update patient information.",
        });
      }

      const { id } = req.params;

      // Validate incoming data (allow partial updates)
      const patientData = updatePatientSchema.parse(req.body);

      // Get patient data before update for audit log
      const patientToUpdate = await storage.getPatientById(id);

      const updated = await storage.updatePatient(id, patientData);

      if (!updated) {
        return res.status(404).json({ message: "Patient not found" });
      }

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "update",
        tableName: "patients",
        recordId: id,
        oldValues: patientToUpdate,
        newValues: updated,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

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
  // IMPORTANT: /api/doctors/payments MUST come before /api/doctors/:id routes
  // to prevent :id from matching "payments" as a doctor ID
  app.get(
    "/api/doctors/payments",
    authenticateToken,
    async (req, res) => {
      try {
        const payments = await storage.getAllDoctorPayments();
        res.json(payments);
      } catch (error) {
        console.error("Get all doctor payments error:", error);
        res.status(500).json({ message: "Failed to get doctor payments" });
      }
    },
  );

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

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "create",
        tableName: "doctors",
        recordId: doctor.id,
        oldValues: null,
        newValues: doctor,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json(doctor);
    } catch (error) {
      console.error("Doctor creation error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      res.status(400).json({ message: "Failed to create doctor" });
    }
  });

  app.put("/api/doctors/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const doctorData = insertDoctorSchema.parse(req.body);

      // Get doctor data before update for audit log
      const doctorToUpdate = await storage.getDoctorById(id);

      const doctor = await storage.updateDoctor(id, doctorData, req.user?.id);
      res.json(doctor);

      // Create audit log
      if (doctorToUpdate && doctor) {
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "update",
          tableName: "doctors",
          recordId: id,
          oldValues: doctorToUpdate,
          newValues: doctor,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });
      }
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
        activityType: "doctor_deactivated",
        title: "Doctor Deactivated",
        description: `${doctor.name} has been deactivated`,
        entityId: id,
        entityType: "doctor",
        metadata: JSON.stringify({
          doctorId: id,
          deactivatedBy: req.user?.username,
        }),
      });

      // Create audit log for doctor deletion
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "delete",
        tableName: "doctors",
        recordId: id,
        oldValues: doctor,
        newValues: null,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
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

  // Get doctor payment history
  app.get("/api/doctors/:id/payments", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const payments = await storage.getDoctorPayments(id);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching doctor payments:", error);
      res.status(500).json({ message: "Failed to fetch doctor payments" });
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

  app.put("/api/doctors/:id/profile-picture", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { profilePicture } = req.body;

      const doctor = await storage.getDoctorById(id);
      if (!doctor) {
        return res.status(404).json({ message: "Doctor not found" });
      }

      const updatedDoctor = await storage.updateDoctorProfilePicture(id, profilePicture, req.user?.id);
      res.json(updatedDoctor);
    } catch (error) {
      console.error("Doctor profile picture update error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to update doctor profile picture" });
    }
  });

  // Doctor Salary/Commission Routes
  app.get("/api/doctors/:doctorId/salary-rates", authenticateToken, async (req, res) => {
    try {
      const { doctorId } = req.params;
      const rates = await storage.getDoctorServiceRates(doctorId);
      res.json(rates);
    } catch (error) {
      console.error("Error fetching doctor salary rates:", error);
      res.status(500).json({ message: "Failed to fetch salary rates" });
    }
  });

  app.put("/api/doctors/:doctorId/salary-rates", authenticateToken, async (req: any, res) => {
    try {
      const { doctorId } = req.params;
      const { rates } = req.body;

      if (!Array.isArray(rates)) {
        return res.status(400).json({ message: "Rates must be an array" });
      }

      // Verify user ID exists
      if (!req.user?.id) {
        return res.status(401).json({ message: "User authentication required" });
      }

      await storage.saveDoctorServiceRates(doctorId, rates, req.user.id);

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "update",
        tableName: "doctor_service_rates",
        recordId: doctorId,
        oldValues: null,
        newValues: { rates },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json({ message: "Salary rates saved successfully" });
    } catch (error) {
      console.error("Error saving doctor salary rates:", error);
      res.status(500).json({ message: "Failed to save salary rates" });
    }
  });

  app.get("/api/doctors/:doctorId/earnings", authenticateToken, async (req, res) => {
    try {
      const { doctorId } = req.params;
      const { status } = req.query;
      const earnings = await storage.getDoctorEarnings(doctorId, status as string);
      res.json(earnings);
    } catch (error) {
      console.error("Error fetching doctor earnings:", error);
      res.status(500).json({ message: "Failed to fetch earnings" });
    }
  });

  app.put("/api/doctors/:doctorId/mark-paid", authenticateToken, async (req: any, res) => {
    try {
      const { doctorId } = req.params;
      const { paymentMethod = 'cash' } = req.body;

      const count = await storage.markDoctorEarningsPaid(doctorId, req.user.id, paymentMethod);

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "update",
        tableName: "doctor_payments",
        recordId: doctorId,
        oldValues: null,
        newValues: { status: "paid", count, paymentMethod },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json({ message: `${count} earnings marked as paid`, count });
    } catch (error) {
      console.error("Error marking earnings as paid:", error);
      res.status(500).json({ message: "Failed to mark earnings as paid" });
    }
  });

  app.put("/api/doctors/earnings/:earningId/mark-paid", authenticateToken, async (req: any, res) => {
    try {
      const { earningId } = req.params;

      if (!req.user) {
        return res.status(401).json({ message: "User authentication required" });
      }

      const updated = await storage.markEarningAsPaid(earningId, req.user.id);

      if (!updated) {
        return res.status(404).json({ message: "Earning not found" });
      }

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "update",
        tableName: "doctor_earnings",
        recordId: earningId,
        oldValues: { status: "pending" },
        newValues: { status: "paid" },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json({ message: "Earning marked as paid", earning: updated });
    } catch (error) {
      console.error("Error marking earning as paid:", error);
      res.status(500).json({ message: "Failed to mark earning as paid" });
    }
  });

  app.get("/api/doctors/all-earnings", authenticateToken, async (req, res) => {
    try {
      const { status } = req.query;
      const earnings = await storage.getDoctorEarnings(undefined, status as string);
      res.json(earnings);
    } catch (error) {
      console.error("Error fetching all doctor earnings:", error);
      res.status(500).json({ message: "Failed to fetch earnings" });
    }
  });

  // Added restore doctor route
  app.put(
    "/api/doctors/:id/restore",
    authenticateToken,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const restored = await storage.restoreDoctor(id, req.user?.id);
        if (!restored) {
          return res.status(404).json({ message: "Doctor not found" });
        }

        // Create audit log
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "restore",
          tableName: "doctors",
          recordId: id,
          oldValues: { status: "deleted" }, // Assuming deleted doctors have a 'deleted' status
          newValues: restored,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });

        res.json({ message: "Doctor restored successfully", doctor: restored });
      } catch (error) {
        console.error("Doctor restoration error:", error);
        if (error instanceof Error) {
          return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Failed to restore doctor" });
      }
    },
  );

  // Added permanent delete endpoint for doctors
  app.delete(
    "/api/doctors/:id/permanent",
    authenticateToken,
    async (req: any, res) => {
      try {
        const { id } = req.params;

        // Get doctor details before deletion for activity log
        const doctor = await storage.getDoctorById(id);
        if (!doctor) {
          return res.status(404).json({ message: "Doctor not found" });
        }

        const deleted = await storage.permanentlyDeleteDoctor(id, req.user?.id);
        if (!deleted) {
          return res.status(404).json({ message: "Doctor not found" });
        }

        // Create activity log for permanent deletion
        await storage.createActivity({
          userId: req.user?.id,
          activityType: "doctor_permanently_deleted",
          title: "Doctor Permanently Deleted",
          description: `${doctor.name} - ${doctor.specialization} has been permanently deleted`,
          entityId: id,
          entityType: "doctor",
          metadata: JSON.stringify({
            doctorId: id,
            doctorName: doctor.name,
            specialization: doctor.specialization,
            deletedBy: req.user?.username,
          }),
        });

        // Create audit log for permanent doctor deletion
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "permanent_delete",
          tableName: "doctors",
          recordId: id,
          oldValues: doctor,
          newValues: null,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });

        res.json({ message: "Doctor permanently deleted successfully" });
      } catch (error) {
        console.error("Doctor permanent deletion error:", error);
        if (error instanceof Error) {
          return res.status(400).json({ message: error.message });
        }
        res
          .status(500)
          .json({ message: "Failed to permanently delete doctor" });
      }
    },
  );

  // Doctor Service Rate routes
  app.get(
    "/api/doctors/:doctorId/salary-rates",
    authenticateToken,
    async (req, res) => {
      try {
        const { doctorId } = req.params;
        const rates = await storage.getDoctorServiceRates(doctorId);
        res.json(rates);
      } catch (error) {
        res.status(500).json({ message: "Failed to get doctor service rates" });
      }
    },
  );

  app.put(
    "/api/doctors/:doctorId/salary-rates",
    authenticateToken,
    async (req: any, res) => {
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
          if (
            rate.isSelected &&
            rate.salaryBasis &&
            (rate.amount > 0 || rate.percentage > 0)
          ) {
            let actualServiceId = rate.serviceId;
            let actualServiceName = rate.serviceName;

            // Handle special service IDs that might need mapping
            if (
              rate.serviceId === "opd_placeholder" ||
              rate.serviceId === "opd_consultation_placeholder"
            ) {
              // Try to find an actual OPD/consultation service
              const services = await storage.getServices();
              let opdService = services.find(
                (s) => s.category?.toLowerCase() === "consultation",
              );

              if (!opdService) {
                opdService = services.find(
                  (s) =>
                    s.name?.toLowerCase().includes("opd") ||
                    s.name?.toLowerCase().includes("consultation") ||
                    s.name?.toLowerCase().includes("visit"),
                );
              }

              if (opdService) {
                actualServiceId = opdService.id;
                actualServiceName = opdService.name;
              } else {
                // Create a generic OPD service record if none exists
                try {
                  const newOpdService = await storage.createService({
                    name: "OPD Consultation",
                    category: "consultation",
                    price: 500, // Default consultation fee
                    description: "General OPD consultation service",
                    createdBy: req.user.id,
                  });
                  actualServiceId = newOpdService.id;
                  actualServiceName = newOpdService.name;
                } catch (serviceCreationError) {
                  console.error(
                    "Failed to create OPD service:",
                    serviceCreationError,
                  );
                  continue; // Skip this rate if service creation fails
                }
              }
            } else if (rate.serviceId === "lab_tests_all") {
              // Handle Lab Tests placeholder - create a generic lab service if none exists
              const services = await storage.getServices();
              let labService = services.find(
                (s) =>
                  s.category?.toLowerCase() === "pathology" ||
                  s.category?.toLowerCase() === "lab_tests" ||
                  s.name?.toLowerCase().includes("lab") ||
                  s.name?.toLowerCase().includes("pathology"),
              );

              if (labService) {
                actualServiceId = labService.id;
                actualServiceName = labService.name;
              } else {
                // Create a generic lab service record if none exists
                try {
                  const newLabService = await storage.createService({
                    name: "Lab Tests",
                    category: "pathology",
                    price: 0,
                    description: "Pathology and laboratory testing services",
                    createdBy: req.user.id,
                  });
                  actualServiceId = newLabService.id;
                  actualServiceName = newLabService.name;
                } catch (serviceCreationError) {
                  console.error(
                    "Failed to create Lab service:",
                    serviceCreationError,
                  );
                  continue; // Skip this rate if service creation fails
                }
              }
            } else {
              // For regular services, verify they exist
              const service = await storage.getServiceById(rate.serviceId);
              if (!service) {
                console.warn(
                  `Service not found: ${rate.serviceId}, skipping rate creation`,
                );
                continue;
              }
            }

            const rateData = {
              doctorId,
              serviceId: actualServiceId,
              serviceName: actualServiceName,
              serviceCategory: rate.serviceCategory,
              rateType:
                rate.salaryBasis === "percentage" ? "percentage" : "amount",
              rateAmount:
                rate.salaryBasis === "percentage"
                  ? rate.percentage
                  : rate.amount,
              description,
              notes: null,
              createdBy: req.user.id,
            };

            try {
              const validatedData =
                insertDoctorServiceRateSchema.parse(rateData);
              const created =
                await storage.createDoctorServiceRate(validatedData);
              createdRates.push(created);
            } catch (createError) {
              console.error(
                `Failed to create rate for service ${rate.serviceId}:`,
                createError,
              );
              if (createError instanceof z.ZodError) {
                console.error(`Validation errors:`, createError.errors);
              }
              // Continue with other rates instead of failing completely
            }
          }
        }

        // Create audit log for updating doctor service rates
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "update",
          tableName: "doctor_service_rates",
          recordId: doctorId, // doctorId as the primary identifier for this update
          oldValues: { existingRates }, // Log the rates that were present before update
          newValues: { createdRates }, // Log the newly created rates
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });

        res.json({
          message: "Doctor service rates updated successfully",
          rates: createdRates,
        });
      } catch (error) {
        console.error("Update doctor service rates error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            message: "Validation failed",
            errors: error.errors,
          });
        }
        res
          .status(500)
          .json({ message: "Failed to update doctor service rates" });
      }
    },
  );

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
      if (!q || typeof q !== "string") {
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
      const isBillingStaff =
        userRoles.includes("billing_staff") &&
        !userRoles.includes("admin") &&
        !userRoles.includes("super_user");

      if (isBillingStaff) {
        return res.status(403).json({
          message: "Access denied. Billing staff cannot create services.",
        });
      }

      console.log("Creating service with data:", req.body);

      // Ensure all required fields are present with defaults
      const serviceData = {
        name: req.body.name,
        category: req.body.category || "misc",
        price: req.body.price || 0,
        description: req.body.description || "",
        isActive: req.body.isActive !== undefined ? req.body.isActive : true,
        billingType: req.body.billingType || "per_instance",
        billingParameters: req.body.billingParameters || null,
      };

      console.log("Processed service data:", serviceData);

      // Validate with schema
      const validatedData = insertServiceSchema.parse(serviceData);
      const service = await storage.createService(validatedData, req.user?.id);

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "create",
        tableName: "services",
        recordId: service.id,
        oldValues: null,
        newValues: service,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

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
        category: req.body.category || "misc",
        price: req.body.price || 0,
        description: req.body.description || "",
        isActive: req.body.isActive !== undefined ? req.body.isActive : true,
        billingType: req.body.billingType || "per_instance",
        billingParameters: req.body.billingParameters || null,
      };

      console.log("Processed service update data:", serviceData);

      // Validate with schema
      const validatedData = insertServiceSchema.parse(serviceData);

      // Get service data before update for audit log
      const serviceToUpdate = await storage.getServiceById(req.params.id);

      const service = await storage.updateService(
        req.params.id,
        validatedData,
        req.user?.id,
      );

      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }

      // Create audit log
      if (serviceToUpdate) {
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "update",
          tableName: "services",
          recordId: req.params.id,
          oldValues: serviceToUpdate,
          newValues: service,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });
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
      // Get service data before deletion for audit log
      const serviceToDelete = await storage.getServiceById(req.params.id);

      const deleted = await storage.deleteService(req.params.id, req.user.id);
      if (!deleted) {
        return res.status(404).json({ message: "Service not found" });
      }

      // Create audit log
      if (serviceToDelete) {
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "delete",
          tableName: "services",
          recordId: req.params.id,
          oldValues: serviceToDelete,
          newValues: null,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });
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

  // All pathology tests from database
  app.get("/api/pathology-tests/combined", authenticateToken, async (req, res) => {
    try {
      const categories = await storage.getPathologyCategories();
      const tests = await storage.getDynamicPathologyTests();

      const testsByCategory: { [key: string]: any[] } = {};
      for (const category of categories) {
        testsByCategory[category.id] = tests.filter(t => t.categoryId === category.id);
      }

      const combinedCategories = categories.map(cat => ({
        name: cat.name,
        description: cat.description,
        tests: testsByCategory[cat.id]?.map(t => ({
          name: t.name,
          price: t.price,
          description: t.description,
        })) || []
      }));

      res.json({ categories: combinedCategories });
    } catch (error) {
      console.error("Error fetching pathology tests:", error);
      res.status(500).json({ message: "Failed to get pathology tests" });
    }
  });

