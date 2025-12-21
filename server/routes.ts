import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { backupScheduler } from "./backup-scheduler";
import jwt from "jsonwebtoken";
import { z } from "zod";
import * as XLSX from "xlsx";
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
  insertAdmissionServiceSchema,
  insertRoomSchema, // Import Room schema
} from "@shared/schema";
import { updatePatientSchema } from "../shared/schema";
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

export async function registerRoutes(app: Express, upload?: any): Promise<Server> {
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

      // Verify password
      const isPasswordValid = await storage.verifyPassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid credentials" });
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

  // Get server's today date for timezone-consistent filtering
  app.get("/api/today", requireAuth, async (req, res) => {
    try {
      // Use Indian timezone (UTC+5:30) for consistent date calculation
      const now = new Date();
      const indianTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
      const today =
        indianTime.getFullYear() +
        "-" +
        String(indianTime.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(indianTime.getDate()).padStart(2, "0");
      res.json({ today });
    } catch (error) {
      console.error("Error getting today date:", error);
      res.status(500).json({ error: "Failed to get today date" });
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
                    isActive: true,
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
                    price: 0, // Lab tests have variable pricing
                    description: "Pathology and laboratory testing services",
                    isActive: true,
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
              isActive: true,
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


  // Create pathology category
  app.post("/api/pathology-categories", authenticateToken, async (req, res) => {
    try {
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Category name is required" });
      }

      // Check if category with same name already exists
      const existingCategories = await storage.getPathologyCategories();
      if (existingCategories.some(cat => cat.name.toLowerCase() === name.toLowerCase())) {
        return res
          .status(400)
          .json({ message: "A category with this name already exists" });
      }

      const category = await storage.createPathologyCategory({
        name,
        description: description || "",
      });

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "create",
        tableName: "pathology_categories",
        recordId: category.id,
        oldValues: null,
        newValues: category,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json(category);
    } catch (error) {
      console.error("Error creating pathology category:", error);
      res.status(500).json({ message: "Failed to create pathology category" });
    }
  });

  app.put(
    "/api/pathology-categories/:id",
    authenticateToken,
    async (req, res) => {
      try {
        const categoryData = insertPathologyCategorySchema
          .partial()
          .parse(req.body);
        const categoryId = req.params.id;

        // Get category data before update for audit log
        const categoryToUpdate =
          await storage.getPathologyCategoryById(categoryId);

        const category = await storage.updatePathologyCategory(
          categoryId,
          categoryData,
        );
        if (!category) {
          return res
            .status(404)
            .json({ message: "Pathology category not found" });
        }

        // Create audit log
        if (categoryToUpdate) {
          await storage.createAuditLog({
            userId: req.user.id,
            username: req.user.username,
            action: "update",
            tableName: "pathology_categories",
            recordId: categoryId,
            oldValues: categoryToUpdate,
            newValues: category,
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          });
        }

        res.json(category);
      } catch (error) {
        console.error("Error updating pathology category:", error);
        res
          .status(400)
          .json({ message: "Failed to update pathology category" });
      }
    },
  );

  app.delete(
    "/api/pathology-categories/:id",
    authenticateToken,
    async (req, res) => {
      try {
        const { id } = req.params;

        // Get category data before deletion for audit log
        const categoryToDelete = await storage.getPathologyCategoryById(id);

        // All categories are now in the database - handle deletion
        const deleted = await storage.deletePathologyCategory(id);
        if (!deleted) {
          return res.status(404).json({
            message: "Pathology category not found or has associated tests",
          });
        }

        // Create audit log for category deletion
        if (categoryToDelete) {
          await storage.createAuditLog({
            userId: req.user.id,
            username: req.user.username,
            action: "delete",
            tableName: "pathology_categories",
            recordId: id,
            oldValues: categoryToDelete,
            newValues: null,
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          });
        }
        res.json({ message: "Pathology category deleted successfully" });
      } catch (error) {
        console.error("Error deleting pathology category:", error);
        res
          .status(500)
          .json({ message: "Failed to delete pathology category" });
      }
    },
  );

  // Pathology Tests routes
  app.get(
    "/api/dynamic-pathology-tests",
    authenticateToken,
    async (req, res) => {
      try {
        const { categoryId } = req.query;
        let tests;
        if (categoryId && typeof categoryId === "string") {
          tests = await storage.getPathologyCategoryTestsByCategory(categoryId);
        } else {
          tests = await storage.getPathologyCategoryTests();
        }
        res.json(tests);
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to get pathology tests" });
      }
    },
  );

  // Create pathology test
  app.post(
    "/api/dynamic-pathology-tests",
    authenticateToken,
    async (req, res) => {
      try {
        const { testName, price, categoryId, description } = req.body;

        if (!testName || typeof price !== "number" || !categoryId) {
          return res.status(400).json({
            message: "Missing required fields: testName, price, categoryId",
          });
        }

        // Check if category exists in database
        const categories = await storage.getPathologyCategories();
        const categoryExists = categories.some(
          (cat) => cat.id === categoryId,
        );

        if (!categoryExists) {
          return res.status(400).json({ message: "Category not found" });
        }

        // Add test to database
        const test = await storage.createPathologyCategoryTest({
          testName,
          price,
          categoryId,
          description,
        });

        // Create audit log for test creation
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "create",
          tableName: "pathology_category_tests",
          recordId: test.id,
          oldValues: null,
          newValues: test,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });

        res.json(test);
      } catch (error) {
        console.error("Error creating dynamic pathology test:", error);
        res
          .status(400)
          .json({ message: "Failed to create dynamic pathology test" });
      }
    },
  );

  app.put(
    "/api/dynamic-pathology-tests/:id",
    authenticateToken,
    async (req, res) => {
      try {
        const testData = insertPathologyCategoryTestSchema
          .partial()
          .parse(req.body);
        const testId = req.params.id;

        // Get test data before update for audit log
        const testToUpdate = await storage.getPathologyCategoryTestById(testId);

        const test = await storage.updatePathologyCategoryTest(testId, testData);
        if (!test) {
          return res
            .status(404)
            .json({ message: "Dynamic pathology test not found" });
        }

        // Create audit log
        if (testToUpdate) {
          await storage.createAuditLog({
            userId: req.user.id,
            username: req.user.username,
            action: "update",
            tableName: "dynamic_pathology_tests",
            recordId: testId,
            oldValues: testToUpdate,
            newValues: test,
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          });
        }

        res.json(test);
      } catch (error) {
        console.error("Error updating dynamic pathology test:", error);
        res
          .status(400)
          .json({ message: "Failed to update dynamic pathology test" });
      }
    },
  );

  app.delete(
    "/api/dynamic-pathology-tests/:id",
    authenticateToken,
    async (req, res) => {
      try {
        const testId = req.params.id;

        // Get test data before deletion for audit log
        const testToDelete = await storage.getPathologyCategoryTestById(testId);

        const deleted = await storage.deletePathologyCategoryTest(testId);
        if (!deleted) {
          return res
            .status(404)
            .json({ message: "Dynamic pathology test not found" });
        }

        // Create audit log
        if (testToDelete) {
          await storage.createAuditLog({
            userId: req.user.id,
            username: req.user.username,
            action: "delete",
            tableName: "dynamic_pathology_tests",
            recordId: testId,
            oldValues: testToDelete,
            newValues: null,
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          });
        }

        res.json({ message: "Dynamic pathology test deleted successfully" });
      } catch (error) {
        console.error("Error deleting dynamic pathology test:", error);
        res
          .status(500)
          .json({ message: "Failed to delete dynamic pathology test" });
      }
    },
  );

  // Get daily receipt count for a specific service type and date
  app.get(
    "/api/receipts/daily-count/:serviceType/:date",
    authenticateToken,
    async (req, res) => {
      try {
        const { serviceType, date } = req.params;
        console.log(`Getting daily count for ${serviceType} on ${date}`);

        const count = await storage.getDailyReceiptCount(serviceType, date);
        console.log(`Daily count result: ${count}`);

        res.json({ count });
      } catch (error) {
        console.error("Error getting daily receipt count:", error);
        res.status(500).json({ message: "Failed to get daily receipt count" });
      }
    },
  );

  // Bulk upload pathology tests from JSON
  app.post(
    "/api/pathology-tests/bulk-upload",
    authenticateToken,
    async (req, res) => {
      try {
        const { categories } = req.body;

        if (!categories || !Array.isArray(categories)) {
          return res.status(400).json({
            message: "Invalid data format. Expected categories array.",
          });
        }

        const results: any = {
          categories: [],
          tests: [],
          errors: [],
        };

        for (const categoryData of categories) {
          try {
            if (!categoryData.name || !categoryData.tests) {
              results.errors.push(
                `Invalid category data: missing name or tests`,
              );
              continue;
            }

            // Create or get category
            let category;
            try {
              const categoryInsert = insertPathologyCategorySchema.parse({
                name: categoryData.name,
                description: categoryData.description || null,
              });
              category = await storage.createPathologyCategory(categoryInsert);
              results.categories.push(category);
            } catch (error) {
              // Category might already exist, try to find it
              const categories = await storage.getPathologyCategories();
              category = categories.find((c) => c.name === categoryData.name);
              if (!category) {
                results.errors.push(
                  `Failed to create category: ${categoryData.name}`,
                );
                continue;
              }
            }

            // Create tests for this category
            const testsToCreate = categoryData.tests.map((test: any) =>
              insertPathologyCategoryTestSchema.parse({
                categoryId: category.id,
                testName: test.test_name || test.name,
                price: test.price || 0,
                normalRange: test.normal_range || null,
                description: test.description || null,
              }),
            );

            const createdTests =
              await storage.bulkCreatePathologyCategoryTests(testsToCreate);
            results.tests.push(...createdTests);
          } catch (error) {
            results.errors.push(
              `Error processing category ${categoryData.name}: ${error}`,
            );
          }
        }

        // Create audit log for bulk upload
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "bulk_create",
          tableName: "pathology_tests",
          recordId: "bulk_upload", // Generic ID for bulk operations
          oldValues: null,
          newValues: {
            categoriesCreated: results.categories.length,
            testsCreated: results.tests.length,
            errors: results.errors.length > 0 ? results.errors : undefined,
          },
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });

        res.json(results);
      } catch (error) {
        console.error("Error during bulk upload:", error);
        res.status(400).json({
          message: "Failed to bulk upload pathology tests",
          error: error.message,
        });
      }
    },
  );

  // Get combined pathology tests (all from database)
  app.get(
    "/api/pathology-tests/combined",
    authenticateToken,
    async (req, res) => {
      try {
        const categories = await storage.getPathologyCategories();
        const tests = await storage.getPathologyCategoryTests();

        // Create combined categories structure
        const combinedCategories = categories.map((cat) => {
          const testsInCategory = tests.filter(
            (test) => test.categoryId === cat.id,
          );
          return {
            id: cat.id,
            name: cat.name,
            description: cat.description || "",
            tests: testsInCategory.map((test) => ({
              id: test.id,
              test_name: test.testName,
              testName: test.testName,
              name: test.testName,
              price: test.price,
              category: cat.name,
              categoryId: test.categoryId,
              description: test.description,
              subtests: [],
            })),
          };
        });

        res.json({ categories: combinedCategories });
      } catch (error) {
        console.error("Error fetching combined pathology tests:", error);
        res.status(500).json({ message: "Failed to fetch pathology tests" });
      }
    },
  );

  // Bill routes
  app.get("/api/bills", authenticateToken, async (req, res) => {
    try {
      const { fromDate, toDate, paymentStatus } = req.query;

      const bills = await storage.getBillsWithFilters({
        fromDate: fromDate as string,
        toDate: toDate as string,
        paymentStatus: paymentStatus as string,
      });

      console.log(`Retrieved ${bills.length} bills with filters:`, {
        fromDate,
        toDate,
        paymentStatus,
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
        billDate: new Date().toISOString().split("T")[0],
      });

      const itemsData = items.map((item: any) =>
        insertBillItemSchema.parse(item),
      );

      const createdBill = await storage.createBill(
        billData,
        itemsData,
        req.user.id,
      );

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "create",
        tableName: "bills",
        recordId: createdBill.id,
        oldValues: null,
        newValues: { ...createdBill, items: itemsData }, // Include items in newValues for context
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json(createdBill);
    } catch (error) {
      console.error("Error creating bill:", error);
      res
        .status(400)
        .json({ message: "Failed to create bill", error: error.message });
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
      console.error("Error fetching bill:", error);
      res.status(500).json({ message: "Failed to get bill" });
    }
  });


  // Pathology routes
  app.get("/api/pathology", authenticateToken, async (req, res) => {
    try {
      const { fromDate, toDate } = req.query;
      const orders = await storage.getPathologyOrders(
        fromDate as string,
        toDate as string,
      );
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Failed to get pathology orders" });
    }
  });

  app.post("/api/pathology", authenticateToken, async (req: any, res) => {
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
            "Access denied. Billing staff cannot create pathology orders.",
        });
      }

      console.log(
        "Received pathology order request:",
        JSON.stringify(req.body, null, 2),
      );
      const { orderData, tests } = req.body;

      if (!orderData || !tests) {
        return res.status(400).json({ message: "Missing orderData or tests" });
      }

      // Ensure doctorId is null if empty string or "external"
      const processedOrderData = {
        ...orderData,
        doctorId:
          orderData.doctorId === "" || orderData.doctorId === "external"
            ? null
            : orderData.doctorId,
      };

      const order = await storage.createPathologyOrder(
        processedOrderData,
        tests,
        req.user.id,
      );

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "create",
        tableName: "pathology_orders",
        recordId: order.id,
        oldValues: null,
        newValues: { orderData: processedOrderData, tests }, // Include order details and tests for context
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json(order);
    } catch (error: any) {
      console.error("Error creating pathology order:", error);
      res.status(400).json({
        message: "Failed to create pathology order",
        error: error.message,
      });
    }
  });

  app.patch(
    "/api/pathology/:id/status",
    authenticateToken,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
          return res.status(400).json({ message: "Status is required" });
        }

        // Get order details before status update for audit log
        const orderToUpdate = await storage.getPathologyOrderById(id);

        const updatedOrder = await storage.updatePathologyOrderStatus(
          id,
          status,
        );

        // Create audit log
        if (orderToUpdate) {
          await storage.createAuditLog({
            userId: req.user.id,
            username: req.user.username,
            action: "update_status",
            tableName: "pathology_orders",
            recordId: id,
            oldValues: { status: orderToUpdate.status },
            newValues: { status: status },
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          });
        }

        res.json(updatedOrder);
      } catch (error: any) {
        console.error("Error updating pathology order status:", error);
        res.status(400).json({
          message: "Failed to update order status",
          error: error.message,
        });
      }
    },
  );

  app.get("/api/pathology/:id", authenticateToken, async (req, res) => {
    try {
      const orderDetails = await storage.getPathologyOrderById(req.params.id);
      if (!orderDetails) {
        return res.status(404).json({ message: "Pathology order not found" });
      }

      // Create audit log for view access
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "view",
        tableName: "pathology_orders",
        recordId: req.params.id,
        oldValues: null, // No old values for a view operation
        newValues: {
          orderId: req.params.id,
          viewedBy: req.user.username,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json(orderDetails);
    } catch (error) {
      console.error("Error fetching pathology order details:", error);
      res
        .status(500)
        .json({ message: "Failed to get pathology order details" });
    }
  });

  app.get(
    "/api/pathology/patient/:patientId",
    authenticateToken,
    async (req, res) => {
      try {
        const orders = await storage.getPathologyOrdersByPatient(
          req.params.patientId,
        );
        res.json(orders);
      } catch (error) {
        console.error("Error fetching patient pathology orders:", error);
        res
          .status(500)
          .json({ message: "Failed to get patient pathology orders" });
      }
    },
  );

  // Patient Services Routes
  app.get("/api/patient-services", requireAuth, async (req, res) => {
    try {
      const {
        serviceType,
        fromDate,
        toDate,
        doctorId,
        serviceName,
        status,
        patientId,
      } = req.query;

      // Build filters object
      const filters: any = {};

      if (patientId) {
        filters.patientId = patientId as string;
      }

      if (serviceType) {
        // Handle multiple service types (comma-separated)
        if ((serviceType as string).includes(",")) {
          const serviceTypes = (serviceType as string)
            .split(",")
            .map((type) => {
              const serviceTypeMapping: { [key: string]: string } = {
                labtest: "diagnostic",
                lab: "diagnostic",
                opd: "opd",
                diagnostic: "diagnostic",
                diagnostics: "diagnostic",
                procedure: "procedure",
                procedures: "procedure",
                operation: "operation",
                operations: "operation",
                misc: "misc",
              };
              return serviceTypeMapping[type.trim()] || type.trim();
            });
          filters.serviceTypes = serviceTypes;
        } else {
          // Map frontend serviceType values to database values
          const serviceTypeMapping: { [key: string]: string } = {
            labtest: "diagnostic",
            lab: "diagnostic",
            opd: "opd",
            diagnostic: "diagnostic",
            diagnostics: "diagnostic",
            procedure: "procedure",
            procedures: "procedure",
            operation: "operation",
            operations: "operation",
            misc: "misc",
          };

          filters.serviceType =
            serviceTypeMapping[serviceType as string] ||
            (serviceType as string);
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
  app.post(
    "/api/patient-services",
    authenticateToken,
    async (req: any, res) => {
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
              "Access denied. Billing staff cannot create patient services.",
          });
        }

        const serviceData = req.body;

        console.log(
          "Creating patient service with data:",
          JSON.stringify(serviceData, null, 2),
        );

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

        //
        if (serviceData.scheduledDate && serviceData.scheduledTime) {
          const scheduledDateTime = new Date(
            `${serviceData.scheduledDate}T${serviceData.scheduledTime}:00`,
          );
          serviceData.createdAt = scheduledDateTime.toISOString();
          serviceData.updatedAt = scheduledDateTime.toISOString();
        }

        // Special validation for OPD services
        if (serviceData.serviceType === "opd") {
          if (
            !serviceData.doctorId ||
            serviceData.doctorId === "" ||
            serviceData.doctorId === "none" ||
            serviceData.doctorId === "external"
          ) {
            return res
              .status(400)
              .json({ error: "Doctor is required for OPD consultation" });
          }

          if (!serviceData.price || serviceData.price <= 0) {
            return res
              .status(400)
              .json({ error: "Valid consultation fee is required for OPD" });
          }
        }

        console.log("Doctor ID in service data:", serviceData.doctorId);
        const service = await storage.createPatientService(
          serviceData,
          req.user.id,
        );
        console.log(
          "Created patient service:",
          JSON.stringify(service, null, 2),
        );

        // Calculate doctor earning if service has a doctor assigned
        if (service && service.doctorId) {
          try {
            await storage.calculateDoctorEarning(service);
          } catch (earningError) {
            console.error('Error calculating doctor earning:', earningError);
            // Don't fail the request if earning calculation fails
          }
        }

        // Log activity for service scheduling
        const patient = await storage.getPatientById(serviceData.patientId);

        await storage.createActivity({
          userId: req.user.id,
          activityType: "service_scheduled",
          title: "Service Scheduled",
          description: `${serviceData.serviceName} scheduled for ${patient?.name || "Patient"}`,
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

        // Create audit log for patient service creation
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "create",
          tableName: "patient_services",
          recordId: service.id,
          oldValues: null,
          newValues: service,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });

        res.json(service);
      } catch (error) {
        console.error("Error creating patient service:", error);
        res.status(500).json({
          error: "Failed to create patient service",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // Batch service creation - each service gets unique order ID
  app.post(
    "/api/patient-services/batch",
    authenticateToken,
    async (req: any, res) => {
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
              "Access denied. Billing staff cannot create patient services.",
          });
        }

        console.log("=== BATCH SERVICE CREATION API ===");
        console.log("Raw request body:", JSON.stringify(req.body, null, 2));

        // Validate array of services
        if (!Array.isArray(req.body)) {
          return res
            .status(400)
            .json({ message: "Request body must be an array of services" });
        }

        if (req.body.length === 0) {
          return res.status(400).json({ message: "No services provided" });
        }

        // Get daily count for receipt numbering (using first service's date for reference)
        const firstService = req.body[0];
        const serviceType =
          firstService.serviceType === "opd" ? "opd" : "service";
        const eventDate = new Date(firstService.scheduledDate)
          .toISOString()
          .split("T")[0];

        let count;
        try {
          const response = await fetch(
            `http://localhost:5000/api/receipts/daily-count/${serviceType}/${eventDate}`,
            {
              headers: {
                Authorization: `Bearer ${req.headers.authorization?.split(" ")[1]}`,
              },
            },
          );

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
        const yymmdd = dateObj
          .toISOString()
          .slice(2, 10)
          .replace(/-/g, "")
          .slice(0, 6);
        const typeCode = serviceType === "opd" ? "OPD" : "SRV";
        const receiptNumber = `${yymmdd}-${typeCode}-${String(count).padStart(4, "0")}`;

        console.log("Generated receipt number:", receiptNumber);

        // Generate unique order IDs for all services BEFORE the transaction
        const orderIds = storage.generateMultipleServiceOrderIds(req.body.length);
        console.log("Pre-generated order IDs:", orderIds);

        // Add receipt number to all services
        const servicesWithReceipt = req.body.map((service: any) => ({
          ...service,
          receiptNumber: receiptNumber,
        }));

        console.log(
          `Creating batch of ${servicesWithReceipt.length} services with receipt number: ${receiptNumber}`,
        );

        const services = await storage.createPatientServicesBatch(
          servicesWithReceipt,
          req.user.id,
          orderIds,
        );

        console.log(
          `Successfully created ${services.length} services with unique orderIds`
        );
        if (services.length > 0) {
          console.log(
            `Order IDs: ${services.map((s) => s.orderId).join(", ")}`
          );
        }

        // Calculate doctor earnings for all services with assigned doctors
        for (const svc of services) {
          if (svc && svc.doctorId) {
            try {
              await storage.calculateDoctorEarning(svc);
            } catch (earningError) {
              console.error(`Error calculating earning for service ${svc.id}:`, earningError);
              // Don't fail the request if earning calculation fails
            }
          }
        }

        // Log activity for service scheduling
        if (services.length > 0) {
          const patient = await storage.getPatientById(
            servicesWithReceipt[0].patientId,
          );
          const serviceNames = services.map((s) => s.serviceName).join(", ");

          await storage.createActivity({
            userId: req.user.id,
            activityType: "service_scheduled",
            title: "Service Scheduled",
            description: `${serviceNames} scheduled for ${patient?.name || "Patient"}`,
            entityId: services[0].orderId || services[0].id,
            entityType: "patient_service",
            metadata: JSON.stringify({
              patientId: servicesWithReceipt[0].patientId,
              serviceCount: services.length,
              services: services.map((s) => ({
                serviceName: s.serviceName,
                serviceType: s.serviceType,
                scheduledDate: s.scheduledDate,
                scheduledTime: s.scheduledTime,
              })),
            }),
          });
        }

        // Create audit log for batch service creation
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "batch_create",
          tableName: "patient_services",
          recordId: services.length > 0 ? services[0].orderId : "batch_upload", // Use first service's orderId or a generic ID
          oldValues: null,
          newValues: {
            serviceCount: services.length,
            receiptNumber: receiptNumber,
            patientId: servicesWithReceipt[0].patientId,
            services: services.map((s) => ({
              id: s.id,
              serviceName: s.serviceName,
            })), // Log created service IDs
          },
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });

        res.json(services);
      } catch (error: any) {
        console.error("Batch service creation error:", error);
        res.status(400).json({
          message: "Failed to create batch services",
          error: error.message,
        });
      }
    },
  );

  app.put("/api/patient-services/:id", authenticateToken, async (req, res) => {
    try {
      const serviceId = req.params.id;
      // Get service data before update for audit log
      const serviceToUpdate = await storage.getPatientServiceById(serviceId);

      const service = await storage.updatePatientService(
        serviceId,
        req.body,
        req.user.id,
      );

      // Calculate doctor earning if service has a doctor assigned
      if (service && service.doctorId) {
        try {
          await storage.calculateDoctorEarning(service);
        } catch (earningError) {
          console.error('Error calculating doctor earning:', earningError);
          // Don't fail the request if earning calculation fails
        }
      }

      // Log activity if service is being completed
      if (req.body.status === "completed") {
        const patient = await storage.getPatientById(service.patientId);

        await storage.createActivity({
          userId: req.user.id,
          activityType: "service_completed",
          title: "Service Completed",
          description: `${service.serviceName} completed for ${patient?.name || "Patient"}`,
          entityId: service.id,
          entityType: "patient_service",
          metadata: JSON.stringify({
            patientId: service.patientId,
            serviceName: service.serviceName,
            serviceType: service.serviceType,
          }),
        });
      }

      // Create audit log
      if (serviceToUpdate) {
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "update",
          tableName: "patient_services",
          recordId: serviceId,
          oldValues: serviceToUpdate,
          newValues: service,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });
      }

      res.json(service);
    } catch (error) {
      console.error("Error updating patient service:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admission Services Routes (separate from patient_services)
  app.get("/api/admission-services", authenticateToken, async (req, res) => {
    try {
      const { admissionId, patientId } = req.query;
      
      let services;
      if (admissionId) {
        services = await storage.getAdmissionServices(admissionId as string);
      } else if (patientId) {
        services = await storage.getAdmissionServicesByPatient(patientId as string);
      } else {
        services = await storage.getAdmissionServices();
      }
      
      res.json(services);
    } catch (error) {
      console.error("Error fetching admission services:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/admission-services/:id", authenticateToken, async (req, res) => {
    try {
      const service = await storage.getAdmissionServiceById(req.params.id);
      if (!service) {
        return res.status(404).json({ error: "Admission service not found" });
      }
      res.json(service);
    } catch (error) {
      console.error("Error fetching admission service:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post(
    "/api/admission-services",
    authenticateToken,
    async (req: any, res) => {
      try {
        // Check if user has billing staff role and restrict access
        const userRoles = req.user.roles || [req.user.role];
        const isBillingStaff =
          userRoles.includes("billing_staff") &&
          !userRoles.includes("admin") &&
          !userRoles.includes("super_user");

        if (isBillingStaff) {
          return res.status(403).json({
            message:
              "Access denied. Billing staff cannot create admission services.",
          });
        }

        // Validate request body with Zod schema
        const validationResult = insertAdmissionServiceSchema.safeParse(req.body);
        if (!validationResult.success) {
          return res.status(400).json({
            message: "Validation error",
            errors: validationResult.error.errors,
          });
        }

        const service = await storage.createAdmissionService(
          validationResult.data,
          req.user.id,
        );

        // Create audit log
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "create",
          tableName: "admission_services",
          recordId: service.id,
          oldValues: null,
          newValues: service,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });

        res.status(201).json(service);
      } catch (error: any) {
        console.error("Error creating admission service:", error);
        res.status(400).json({
          message: "Failed to create admission service",
          error: error.message,
        });
      }
    },
  );

  app.post(
    "/api/admission-services/batch",
    authenticateToken,
    async (req: any, res) => {
      try {
        // Check if user has billing staff role and restrict access
        const userRoles = req.user.roles || [req.user.role];
        const isBillingStaff =
          userRoles.includes("billing_staff") &&
          !userRoles.includes("admin") &&
          !userRoles.includes("super_user");

        if (isBillingStaff) {
          return res.status(403).json({
            message:
              "Access denied. Billing staff cannot create admission services.",
          });
        }

        // Validate each service in the batch with Zod schema
        if (!Array.isArray(req.body)) {
          return res.status(400).json({
            message: "Validation error",
            error: "Request body must be an array of admission services",
          });
        }

        const validatedServices = [];
        for (let i = 0; i < req.body.length; i++) {
          const validationResult = insertAdmissionServiceSchema.safeParse(req.body[i]);
          if (!validationResult.success) {
            return res.status(400).json({
              message: `Validation error in service at index ${i}`,
              errors: validationResult.error.errors,
            });
          }
          validatedServices.push(validationResult.data);
        }

        const services = await storage.createAdmissionServicesBatch(
          validatedServices,
          req.user.id,
        );

        // Create audit log for batch creation
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "batch_create",
          tableName: "admission_services",
          recordId: services.length > 0 ? services[0].admissionId : "batch",
          oldValues: null,
          newValues: {
            serviceCount: services.length,
            services: services.map((s) => ({
              id: s.id,
              serviceName: s.serviceName,
            })),
          },
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });

        res.json(services);
      } catch (error: any) {
        console.error("Batch admission service creation error:", error);
        res.status(400).json({
          message: "Failed to create batch admission services",
          error: error.message,
        });
      }
    },
  );

  app.put("/api/admission-services/:id", authenticateToken, async (req, res) => {
    try {
      const serviceId = req.params.id;
      const serviceToUpdate = await storage.getAdmissionServiceById(serviceId);

      const service = await storage.updateAdmissionService(serviceId, req.body);

      if (serviceToUpdate) {
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "update",
          tableName: "admission_services",
          recordId: serviceId,
          oldValues: serviceToUpdate,
          newValues: service,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });
      }

      res.json(service);
    } catch (error) {
      console.error("Error updating admission service:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/admission-services/:id", authenticateToken, async (req: any, res) => {
    try {
      const serviceId = req.params.id;
      const serviceToDelete = await storage.getAdmissionServiceById(serviceId);

      if (!serviceToDelete) {
        return res.status(404).json({ error: "Admission service not found" });
      }

      await storage.deleteAdmissionService(serviceId);

      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "delete",
        tableName: "admission_services",
        recordId: serviceId,
        oldValues: serviceToDelete,
        newValues: null,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json({ message: "Admission service deleted successfully" });
    } catch (error) {
      console.error("Error deleting admission service:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Patient Admissions Routes
  app.get("/api/admissions", authenticateToken, async (req, res) => {
    try {
      const { patientId, fromDate, toDate } = req.query;
      const admissions = await storage.getAdmissions(
        patientId as string,
        fromDate as string,
        toDate as string,
      );
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
      const isBillingStaff =
        userRoles.includes("billing_staff") &&
        !userRoles.includes("admin") &&
        !userRoles.includes("super_user");

      if (isBillingStaff) {
        return res.status(403).json({
          message: "Access denied. Billing staff cannot create admissions.",
        });
      }

      // Normalize admission date to ISO format if provided
      const requestBody = { ...req.body };
      if (
        requestBody.admissionDate &&
        typeof requestBody.admissionDate === "string"
      ) {
        try {
          requestBody.admissionDate = new Date(
            requestBody.admissionDate,
          ).toISOString();
        } catch (e) {
          return res
            .status(400)
            .json({ error: "Invalid admission date format" });
        }
      }
      if (
        requestBody.dischargeDate &&
        typeof requestBody.dischargeDate === "string"
      ) {
        try {
          requestBody.dischargeDate = new Date(
            requestBody.dischargeDate,
          ).toISOString();
        } catch (e) {
          return res
            .status(400)
            .json({ error: "Invalid discharge date format" });
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
        description: `${patient?.name || "Patient"} admitted under ${doctor?.name || "Doctor"} - ${admission.currentWardType}`,
        entityId: admission.id,
        entityType: "admission",
        metadata: JSON.stringify({
          patientId: admission.patientId,
          doctorId: admission.doctorId,
          wardType: admission.currentWardType,
          admissionDate: admission.admissionDate,
        }),
      });

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "create",
        tableName: "admissions",
        recordId: admission.id,
        oldValues: null,
        newValues: admission,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
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
      if (
        requestBody.admissionDate &&
        typeof requestBody.admissionDate === "string"
      ) {
        try {
          requestBody.admissionDate = new Date(
            requestBody.admissionDate,
          ).toISOString();
        } catch (e) {
          return res
            .status(400)
            .json({ error: "Invalid admission date format" });
        }
      }
      if (
        requestBody.dischargeDate &&
        typeof requestBody.dischargeDate === "string"
      ) {
        try {
          requestBody.dischargeDate = new Date(
            requestBody.dischargeDate,
          ).toISOString();
        } catch (e) {
          return res
            .status(400)
            .json({ error: "Invalid discharge date format" });
        }
      }

      const admissionId = req.params.id;
      // Get admission data before update for audit log
      const admissionToUpdate = await storage.getAdmissionById(admissionId);

      const admission = await storage.updateAdmission(
        admissionId,
        requestBody,
        req.user.id,
      );

      // Create audit log
      if (admissionToUpdate) {
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "update",
          tableName: "admissions",
          recordId: admissionId,
          oldValues: admissionToUpdate,
          newValues: admission,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });
      }

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
      if (
        requestBody.admissionDate &&
        typeof requestBody.admissionDate === "string"
      ) {
        try {
          requestBody.admissionDate = new Date(
            requestBody.admissionDate,
          ).toISOString();
        } catch (e) {
          return res
            .status(400)
            .json({ error: "Invalid admission date format" });
        }
      }
      if (
        requestBody.dischargeDate &&
        typeof requestBody.dischargeDate === "string"
      ) {
        try {
          requestBody.dischargeDate = new Date(
            requestBody.dischargeDate,
          ).toISOString();
        } catch (e) {
          return res
            .status(400)
            .json({ error: "Invalid discharge date format" });
        }
      }

      const admissionId = req.params.id;
      // Get admission data before update for audit log
      const admissionToUpdate = await storage.getAdmissionById(admissionId);

      const admission = await storage.updateAdmission(
        admissionId,
        requestBody,
        req.user.id,
      );

      // Create audit log
      if (admissionToUpdate) {
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "update", // Using 'update' for patch as well, or could use 'patch'
          tableName: "admissions",
          recordId: admissionId,
          oldValues: admissionToUpdate,
          newValues: admission,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });
      }

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

  app.patch(
    "/api/pathology/:id/status",
    authenticateToken,
    async (req, res) => {
      try {
        const { status } = req.body;
        const orderId = req.params.id;

        // Get order details before status update for audit log
        const orderToUpdate = await storage.getPathologyOrderById(orderId);

        const updated = await storage.updatePathologyOrderStatus(
          orderId,
          status,
        );
        if (!updated) {
          return res.status(404).json({ message: "Pathology order not found" });
        }

        // Create audit log
        if (orderToUpdate) {
          await storage.createAuditLog({
            userId: req.user.id,
            username: req.user.username,
            action: "update_status",
            tableName: "pathology_orders",
            recordId: orderId,
            oldValues: { status: orderToUpdate.status },
            newValues: { status: status },
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          });
        }

        res.json(updated);
      } catch (error) {
        console.error("Error updating pathology order status:", error);
        res
          .status(500)
          .json({ message: "Failed to update pathology order status" });
      }
    },
  );

  app.patch(
    "/api/pathology/test/:id/status",
    authenticateToken,
    async (req: any, res) => {
      try {
        const { status, results } = req.body;
        const testId = req.params.id;

        // Get test details before status update for audit log
        const testToUpdate = await storage.getPathologyTestById(testId); // Assuming getPathologyTestById exists

        const updated = await storage.updatePathologyTestStatus(
          testId,
          status,
          results,
          req.user.id,
        );
        if (!updated) {
          return res.status(404).json({ message: "Pathology test not found" });
        }

        // Create audit log
        if (testToUpdate) {
          await storage.createAuditLog({
            userId: req.user.id,
            username: req.user.username,
            action: "update_status",
            tableName: "pathology_tests", // Assuming a pathology_tests table
            recordId: testId,
            oldValues: {
              status: testToUpdate.status,
              results: testToUpdate.results,
            },
            newValues: { status: status, results: results },
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          });
        }

        res.json(updated);
      } catch (error) {
        console.error("Error updating pathology test status:", error);
        res
          .status(500)
          .json({ message: "Failed to update pathology test status" });
      }
    },
  );

  // ==================== OPD Visits ====================

  // Get OPD visits with filters
  app.get("/api/opd-visits", requireAuth, async (req, res) => {
    try {
      const { doctorId, patientId, scheduledDate, status, fromDate, toDate } =
        req.query;

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

      // If fromDate and toDate are provided, remove scheduledDate filter to use date range instead
      if (fromDate && toDate) {
        delete filters.scheduledDate;
        filters.fromDate = fromDate as string;
        filters.toDate = toDate as string;
      } else if (fromDate) {
        filters.fromDate = fromDate as string;
      } else if (toDate) {
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
  app.post("/api/opd-visits", authenticateToken, async (req: any, res) => {
    try {
      // Check if user has billing staff role and restrict access
      const userRoles = req.user.roles || [req.user.role]; // Backward compatibility
      const isBillingStaff =
        userRoles.includes("billing_staff") &&
        !userRoles.includes("admin") &&
        !userRoles.includes("super_user");

      if (isBillingStaff) {
        return res.status(403).json({
          message: "Access denied. Billing staff cannot create OPD visits.",
        });
      }

      const visitData = insertPatientVisitSchema.parse({
        ...req.body,
        visitType: "opd",
        visitDate: req.body.scheduledDate || new Date().toISOString().split('T')[0],
        status: req.body.status || "scheduled",
      });

      // Generate receipt number for OPD visit
      const scheduledDate = visitData.scheduledDate || new Date().toISOString().split('T')[0];
      const dailyCount = await storage.getDailyReceiptCount("opd", scheduledDate);

      // Format: YYMMDD-OPD-NNNN
      const dateObj = new Date(scheduledDate);
      const yymmdd = dateObj.toISOString().slice(2, 10).replace(/-/g, '').slice(0, 6);
      const receiptNumber = `${yymmdd}-OPD-${String(dailyCount).padStart(4, '0')}`;

      console.log(`[OPD] Date: ${scheduledDate}, Count from DB: ${dailyCount}, Receipt: ${receiptNumber}`);

      const visit = await storage.createOpdVisit({
        ...visitData,
        receiptNumber,
      });

      // Calculate OPD earning for the doctor if consultation fee exists
      await storage.calculateOpdEarning(visit);

      // Log activity for OPD scheduling
      const patient = await storage.getPatientById(visitData.patientId);
      const doctor = await storage.getDoctorById(visitData.doctorId);

      await storage.createActivity({
        userId: req.user.id,
        activityType: "opd_scheduled",
        title: "OPD Appointment Scheduled",
        description: `${patient?.name || "Patient"} scheduled for consultation with ${doctor?.name || "Doctor"}`,
        entityId: visit.id,
        entityType: "patient_visit",
        metadata: JSON.stringify({
          patientId: visitData.patientId,
          doctorId: visitData.doctorId,
          scheduledDate: visitData.scheduledDate,
          scheduledTime: visitData.scheduledTime,
          receiptNumber,
        }),
      });

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "create",
        tableName: "patient_visits", // Assuming patient_visits table for OPD
        recordId: visit.id,
        oldValues: null,
        newValues: visit,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(201).json(visit);
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

      const updated = await storage.updateOpdVisitStatus(
        id,
        status,
        req.user.id,
      );

      if (!updated) {
        return res.status(404).json({ error: "OPD visit not found" });
      }

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "update_status",
        tableName: "patient_visits",
        recordId: id,
        oldValues: {},
        newValues: { status: status },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

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

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "create",
        tableName: "room_types",
        recordId: roomType.id,
        oldValues: null,
        newValues: roomType,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(201).json(roomType);
    } catch (error) {
      console.error("Error creating room type:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/room-types/:id", authenticateToken, async (req: any, res) => {
    try {
      const roomTypeId = req.params.id;
      // Get room type data before update for audit log
      const roomTypeToUpdate = await storage.getRoomTypeById(roomTypeId); // Assuming getRoomTypeById exists

      const updated = await storage.updateRoomType(
        roomTypeId,
        req.body,
        req.user.id,
      );
      if (!updated) {
        return res.status(404).json({ error: "Room type not found" });
      }

      // Create audit log
      if (roomTypeToUpdate) {
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "update",
          tableName: "room_types",
          recordId: roomTypeId,
          oldValues: roomTypeToUpdate,
          newValues: updated,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating room type:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete(
    "/api/room-types/:id",
    authenticateToken,
    async (req: any, res) => {
      try {
        const roomTypeId = req.params.id;
        // Get room type data before deletion for audit log
        const roomTypeToDelete = await storage.getRoomTypeById(roomTypeId); // Assuming getRoomTypeById exists

        await storage.deleteRoomType(roomTypeId, req.user.id);

        // Create audit log
        if (roomTypeToDelete) {
          await storage.createAuditLog({
            userId: req.user.id,
            username: req.user.username,
            action: "delete",
            tableName: "room_types",
            recordId: roomTypeId,
            oldValues: roomTypeToDelete,
            newValues: null,
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          });
        }

        res.status(204).send();
      } catch (error) {
        console.error("Error deleting room type:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    },
  );

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
      const roomData = insertRoomSchema.parse(req.body);
      const room = await storage.createRoom(roomData, req.user.id); // Pass userId

      // Get room type details for activity log
      const roomType = await storage.getRoomTypeById(room.roomTypeId);

      // Create activity log
      await storage.createActivity({
        userId: req.user.id,
        activityType: "room_created",
        title: "Room Created",
        description: `Room ${room.roomNumber} (${roomType?.name || "Unknown Type"}) created`,
        entityId: room.id,
        entityType: "room",
        metadata: JSON.stringify({
          roomNumber: room.roomNumber,
          roomType: roomType?.name,
          floor: room.floor,
          building: room.building,
        }),
      });

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "create",
        tableName: "rooms",
        recordId: room.id,
        oldValues: null,
        newValues: room,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.status(201).json(room);
    } catch (error) {
      console.error("Create room error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors,
        });
      }
      res.status(500).json({ message: "Failed to create room" });
    }
  });

  app.put("/api/rooms/:id", authenticateToken, async (req: any, res) => {
    try {
      const roomId = req.params.id;
      // Get room data before update for audit log
      const roomToUpdate = await storage.getRoomById(roomId); // Assuming getRoomById exists

      const updated = await storage.updateRoom(roomId, req.body, req.user.id);
      if (!updated) {
        return res.status(404).json({ error: "Room not found" });
      }

      // Create audit log
      if (roomToUpdate) {
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "update",
          tableName: "rooms",
          recordId: roomId,
          oldValues: roomToUpdate,
          newValues: updated,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating room:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete room
  app.delete("/api/rooms/:id", authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;

      // Get room details BEFORE deletion for activity log
      const room = await storage.getRoomById(id);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      // Get room type details for better activity description
      const roomType = await storage.getRoomTypeById(room.roomTypeId);

      const deleted = await storage.deleteRoom(id);
      if (!deleted) {
        return res.status(404).json({ error: "Failed to delete room" });
      }

      // Create activity log for room deletion
      await storage.createActivity({
        userId: req.user?.id,
        activityType: "room_deleted",
        title: "Room Deleted",
        description: `Room ${room.roomNumber} (${roomType?.name || 'Unknown Type'}) has been deleted`,
        entityId: id,
        entityType: "room",
        metadata: JSON.stringify({
          roomNumber: room.roomNumber,
          roomType: roomType?.name,
          deletedBy: req.user?.username,
        }),
      });

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "delete",
        tableName: "rooms",
        recordId: id,
        oldValues: room,
        newValues: null,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json({ message: "Room deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting room:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get(
    "/api/rooms/by-type/:roomTypeId",
    authenticateToken,
    async (req, res) => {
      try {
        const rooms = await storage.getRoomsByType(req.params.roomTypeId);
        res.json(rooms);
      } catch (error) {
        console.error("Error fetching rooms by type:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    },
  );

  app.patch("/api/rooms/:id/occupancy", authenticateToken, async (req, res) => {
    try {
      const roomId = req.params.id;
      const { isOccupied } = req.body;
      // Get room data before update for audit log
      const roomToUpdate = await storage.getRoomById(roomId); // Assuming getRoomById exists

      const updated = await storage.updateRoomOccupancy(
        roomId,
        isOccupied,
        req.user.id,
      );
      if (!updated) {
        return res.status(404).json({ error: "Room not found" });
      }

      // Create audit log
      if (roomToUpdate) {
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "update_occupancy",
          tableName: "rooms",
          recordId: roomId,
          oldValues: { isOccupied: roomToUpdate.isOccupied },
          newValues: { isOccupied: isOccupied },
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });
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

  // Save hospital settings
  app.post("/api/settings/hospital", requireAuth, async (req, res) => {
    try {
      const settingsData = req.body;
      // Get hospital settings before update for audit log
      const settingsToUpdate = await storage.getHospitalSettings();
      const result = await storage.saveHospitalSettings(settingsData);

      // Log activity for hospital information change
      await storage.createActivity({
        userId: req.user!.id,
        activityType: "hospital_info_changed",
        title: "Hospital Information Changed",
        description: "Hospital Information Updated",
        entityType: "hospital_settings",
        entityId: result.id,
        metadata: JSON.stringify({
          name: settingsData.name,
          address: settingsData.address,
          phone: settingsData.phone,
          email: settingsData.email,
          registrationNumber: settingsData.registrationNumber,
        }),
      });

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "update",
        tableName: "hospital_settings",
        recordId: result.id, // Assuming result has an id
        oldValues: settingsToUpdate,
        newValues: result,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error saving hospital settings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/settings/upload-logo", authenticateToken, async (req, res) => {
    try {
      const { logo } = req.body;
      const logoPath = await storage.saveLogo(logo, req.user.id);

      // Create audit log for logo upload
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "upload_logo",
        tableName: "hospital_settings", // Assuming logo is part of hospital settings
        recordId: req.user.id, // User ID as record ID for this action
        oldValues: null, // No old logo path available directly here
        newValues: { logoPath: logoPath },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

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
      if (!userRoles.includes("admin") && !userRoles.includes("super_user")) {
        return res.status(403).json({
          message: "Access denied. Admin or super user role required.",
        });
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
      if (!userRoles.includes("admin") && !userRoles.includes("super_user")) {
        return res.status(403).json({
          message: "Access denied. Admin or super user role required.",
        });
      }

      // Get current settings to compare changes
      const currentSettings = await storage.getSystemSettings();
      const newSettings = req.body;

      // Track what changed
      const changes: string[] = [];

      if (
        currentSettings.emailNotifications !== newSettings.emailNotifications
      ) {
        changes.push(
          `Email Notifications ${newSettings.emailNotifications ? "enabled" : "disabled"}`,
        );
      }

      if (currentSettings.smsNotifications !== newSettings.smsNotifications) {
        changes.push(
          `SMS Notifications ${newSettings.smsNotifications ? "enabled" : "disabled"}`,
        );
      }

      if (currentSettings.autoBackup !== newSettings.autoBackup) {
        changes.push(
          `Auto Backup ${newSettings.autoBackup ? "enabled" : "disabled"}`,
        );
      }

      if (currentSettings.auditLogging !== newSettings.auditLogging) {
        changes.push(
          `Audit Logging ${newSettings.auditLogging ? "enabled" : "disabled"}`,
        );
      }

      if (currentSettings.timezone !== newSettings.timezone) {
        changes.push(`System Timezone changed to ${newSettings.timezone}`);
      }

      const settings = await storage.saveSystemSettings(req.body, req.user.id);

      // Update backup scheduler based on new settings
      if (settings.autoBackup) {
        await backupScheduler.enableAutoBackup(
          settings.backupFrequency,
          settings.backupTime,
        );
      } else {
        await backupScheduler.disableAutoBackup();
      }

      // Log activity if any changes were made
      if (changes.length > 0) {
        await storage.createActivity({
          userId: req.user.id,
          activityType: "system_config_changed",
          title: "System Configuration Changed",
          description: changes.join(", "),
          entityId: settings.id,
          entityType: "system_settings",
          metadata: JSON.stringify({
            changes: changes,
            updatedBy: req.user.username,
          }),
        });
      }

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "update",
        tableName: "system_settings",
        recordId: settings.id,
        oldValues: currentSettings,
        newValues: settings,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

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
      if (!userRoles.includes("admin") && !userRoles.includes("super_user")) {
        return res.status(403).json({
          message: "Access denied. Admin or super user role required.",
        });
      }

      const { backupType = "manual" } = req.body;
      console.log(`Creating backup with type: ${backupType}`);

      const backup = await storage.createBackup(backupType, req.user.id);
      console.log(`Backup created successfully:`, backup);

      // Log activity for manual backup creation
      if (backupType === "manual") {
        await storage.createActivity({
          userId: req.user.id,
          activityType: "backup_created",
          title: "Backup Created",
          description: "Manual Backup Created",
          entityId: backup.backupId,
          entityType: "backup",
          metadata: JSON.stringify({
            backupId: backup.backupId,
            fileName: backup.filePath
              ? backup.filePath.split("/").pop()
              : "unknown",
            fileSize: backup.fileSize,
            createdBy: req.user.username,
          }),
        });
      }

      // Create audit log for backup creation
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "create",
        tableName: "backups",
        recordId: backup.backupId,
        oldValues: null,
        newValues: {
          backupId: backup.backupId,
          filePath: backup.filePath,
          fileSize: backup.fileSize,
          backupType: backupType,
          createdBy: req.user.id,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json(backup);
    } catch (error) {
      console.error("Error creating backup:", error);
      res.status(500).json({
        error: "Failed to create backup",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/backup/logs", authenticateToken, async (req: any, res) => {
    try {
      // Allow admin and super_user roles to view backup logs
      const userRoles = req.user.roles || [req.user.role];
      if (!userRoles.includes("admin") && !userRoles.includes("super_user")) {
        return res.status(403).json({
          message: "Access denied. Admin or super user role required.",
        });
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
      if (!userRoles.includes("admin") && !userRoles.includes("super_user")) {
        return res.status(403).json({
          message: "Access denied. Admin or super user role required.",
        });
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
      if (!userRoles.includes("admin") && !userRoles.includes("super_user")) {
        return res.status(403).json({
          message: "Access denied. Admin or super user role required.",
        });
      }

      const cleanupResult = await storage.cleanOldBackups(req.user.id);

      // Create audit log for backup cleanup
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "cleanup",
        tableName: "backups",
        recordId: "cleanup_operation", // Generic ID for cleanup operation
        oldValues: null, // No specific old values to log for a cleanup operation
        newValues: {
          deletedCount: cleanupResult.deletedCount,
          message: cleanupResult.message,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json({
        message: "Old backups cleaned up successfully",
        ...cleanupResult,
      });
    } catch (error) {
      console.error("Error cleaning up backups:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/backup/available", authenticateToken, async (req: any, res) => {
    try {
      // Allow admin and super_user roles to view available backups
      const userRoles = req.user.roles || [req.user.role];
      if (!userRoles.includes("admin") && !userRoles.includes("super_user")) {
        return res.status(403).json({
          message: "Access denied. Admin or super user role required.",
        });
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
      if (!userRoles.includes("admin") && !userRoles.includes("super_user")) {
        return res.status(403).json({
          message: "Access denied. Admin or super user role required.",
        });
      }

      const { backupFilePath } = req.body;

      if (!backupFilePath) {
        return res.status(400).json({ error: "Backup file path is required" });
      }

      // Create audit log before initiating restore
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "restore_backup",
        tableName: "backups",
        recordId: backupFilePath, // Use file path as record identifier
        oldValues: null, // No specific old values to log before restore
        newValues: {
          backupFilePath: backupFilePath,
          initiatedBy: req.user.username,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      // Send response immediately, then restore in background
      res.json({
        success: true,
        message: "Backup restore initiated. Application will restart shortly.",
      });

      // Perform restore after response is sent
      setImmediate(async () => {
        try {
          await storage.restoreBackup(backupFilePath);
        } catch (error) {
          console.error("Background restore error:", error);
          // Optionally log this error to audit logs or a separate error logging system
        }
      });
    } catch (error) {
      console.error("Error restoring backup:", error);
      res.status(500).json({
        error: "Failed to restore backup",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ============ AUDIT LOG ROUTES ============

  // Get audit logs with filters
  app.get("/api/audit-logs", authenticateToken, async (req: any, res) => {
    try {
      // Allow admin and super_user roles to view audit logs
      const userRoles = req.user.roles || [req.user.role];
      if (!userRoles.includes("admin") && !userRoles.includes("super_user")) {
        return res.status(403).json({
          message: "Access denied. Admin or super user role required.",
        });
      }

      const filters = {
        userId: req.query.userId as string | undefined,
        tableName: req.query.tableName as string | undefined,
        action: req.query.action as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const result = await storage.getAuditLogs(filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get archived audit logs with filters
  app.get(
    "/api/audit-logs/archived",
    authenticateToken,
    async (req: any, res) => {
      try {
        // Allow admin and super_user roles to view archived logs
        const userRoles = req.user.roles || [req.user.role];
        if (!userRoles.includes("admin") && !userRoles.includes("super_user")) {
          return res.status(403).json({
            message: "Access denied. Admin or super user role required.",
          });
        }

        const filters = {
          fiscalYear: req.query.fiscalYear as string | undefined,
          userId: req.query.userId as string | undefined,
          tableName: req.query.tableName as string | undefined,
          action: req.query.action as string | undefined,
          limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
          offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
        };

        const result = await storage.getArchivedAuditLogs(filters);
        res.json(result);
      } catch (error) {
        console.error("Error fetching archived audit logs:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    },
  );

  // Manually trigger audit log archival for a fiscal year
  app.post(
    "/api/audit-logs/archive",
    authenticateToken,
    async (req: any, res) => {
      try {
        // Allow admin and super_user roles to archive logs
        const userRoles = req.user.roles || [req.user.role];
        if (!userRoles.includes("admin") && !userRoles.includes("super_user")) {
          return res.status(403).json({
            message: "Access denied. Admin or super user role required.",
          });
        }

        const { fiscalYear } = req.body;

        if (!fiscalYear || !/^\d{4}-\d{4}$/.test(fiscalYear)) {
          return res.status(400).json({
            error:
              "Invalid fiscal year format. Use YYYY-YYYY (e.g., 2024-2025)",
          });
        }

        const result = await storage.archiveAuditLogs(fiscalYear);

        // Log activity
        await storage.createActivity({
          userId: req.user.id,
          activityType: "audit_logs_archived",
          title: "Audit Logs Archived",
          description: `Archived ${result.archived} audit logs for fiscal year ${fiscalYear}`,
          entityId: fiscalYear,
          entityType: "audit_archive",
          metadata: JSON.stringify({
            fiscalYear,
            archived: result.archived,
            archivedBy: req.user.username,
          }),
        });

        // Create audit log for the archival operation itself
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "archive",
          tableName: "audit_logs",
          recordId: fiscalYear, // Use fiscal year as record identifier
          oldValues: null, // Not applicable for the operation itself
          newValues: {
            fiscalYear: fiscalYear,
            archivedCount: result.archived,
            archivedBy: req.user.username,
          },
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });

        res.json(result);
      } catch (error) {
        console.error("Error archiving audit logs:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    },
  );

  // Daily receipt count for receipt numbering
  app.get(
    "/api/receipts/daily-count/:serviceType/:date",
    authenticateToken,
    async (req, res) => {
      try {
        const { serviceType, date } = req.params;
        const count = await storage.getDailyReceiptCount(serviceType, date);
        res.json({ count });
      } catch (error) {
        console.error("Error getting daily receipt count:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    },
  );

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

  app.post(
    "/api/admissions/:id/transfer",
    authenticateToken,
    async (req: any, res) => {
      try {
        const admissionId = req.params.id;
        const { roomNumber, wardType } = req.body;
        // Get admission data before transfer for audit log
        const admissionToUpdate = await storage.getAdmissionById(admissionId);

        const updated = await storage.transferRoom(
          admissionId,
          { roomNumber, wardType },
          req.user.id,
        );
        if (!updated) {
          return res.status(404).json({ error: "Admission not found" });
        }

        // Create audit log
        if (admissionToUpdate) {
          await storage.createAuditLog({
            userId: req.user.id,
            username: req.user.username,
            action: "transfer_room",
            tableName: "admissions",
            recordId: admissionId,
            oldValues: {
              roomNumber: admissionToUpdate.roomNumber,
              wardType: admissionToUpdate.currentWardType,
            },
            newValues: { roomNumber, wardType },
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          });
        }

        res.json(updated);
      } catch (error) {
        console.error("Error transferring room:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    },
  );

  app.post(
    "/api/admissions/:id/discharge",
    authenticateToken,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const { dischargeDateTime } = req.body;

        // Get admission data before discharge for audit log
        const admissionToUpdate = await storage.getAdmissionById(id);

        const admission = await storage.dischargePatient(
          id,
          req.user.id,
          dischargeDateTime,
        );
        if (!admission) {
          return res.status(404).json({ error: "Admission not found" });
        }

        // Create audit log for discharge
        if (admissionToUpdate) {
          await storage.createAuditLog({
            userId: req.user.id,
            username: req.user.username,
            action: "discharge",
            tableName: "admissions",
            recordId: id,
            oldValues: {
              ...admissionToUpdate,
              dischargeDateTime: admissionToUpdate.dischargeDateTime,
            }, // Include relevant old values
            newValues: {
              ...admission,
              dischargeDateTime: admission.dischargeDateTime,
            }, // Include relevant new values
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          });
        }

        // Activity logging is already handled in storage.dischargePatient()
        res.json(admission);
      } catch (error) {
        console.error("Error discharging patient:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    },
  );

  // Comprehensive Bill Generation
  app.get(
    "/api/patients/:patientId/comprehensive-bill",
    authenticateToken,
    async (req, res) => {
      try {
        const { patientId } = req.params;
        const comprehensiveBill =
          await storage.generateComprehensiveBill(patientId);
        res.json(comprehensiveBill);
      } catch (error) {
        console.error("Error generating comprehensive bill:", error);
        res
          .status(500)
          .json({ error: "Failed to generate comprehensive bill" });
      }
    },
  );

  // Inpatient Management Detail Routes (IST-based calculations)
  app.get(
    "/api/inpatients/bed-occupancy",
    authenticateToken,
    async (req, res) => {
      try {
        res.set("Cache-Control", "no-cache, no-store, must-revalidate");
        const bedOccupancy = await storage.getBedOccupancyDetails();
        res.json(bedOccupancy);
      } catch (error) {
        console.error("Error fetching bed occupancy:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    },
  );

  app.get(
    "/api/inpatients/currently-admitted",
    authenticateToken,
    async (req, res) => {
      try {
        res.set("Cache-Control", "no-cache, no-store, must-revalidate");
        const admittedPatients = await storage.getCurrentlyAdmittedPatients();
        res.json(admittedPatients);
      } catch (error) {
        console.error("Error fetching currently admitted patients:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    },
  );

  app.get(
    "/api/inpatients/admitted-today",
    authenticateToken,
    async (req, res) => {
      try {
        res.set("Cache-Control", "no-cache, no-store, must-revalidate");
        const todayAdmissions = await storage.getTodayAdmissions();
        res.json(todayAdmissions);
      } catch (error) {
        console.error("Error fetching today's admissions:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    },
  );

  app.get(
    "/api/inpatients/discharged-today",
    authenticateToken,
    async (req, res) => {
      try {
        res.set("Cache-Control", "no-cache, no-store, must-revalidate");
        const todayDischarges = await storage.getTodayDischarges();
        res.json(todayDischarges);
      } catch (error) {
        console.error("Error fetching today's discharges:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    },
  );

  // Patient Payment Routes
  app.post(
    "/api/patients/:patientId/payments",
    authenticateToken,
    async (req: any, res) => {
      try {
        const { patientId } = req.params;
        const { amount, paymentMethod, reason, paymentDate } = req.body;

        // Verify user ID exists
        if (!req.user?.id) {
          return res
            .status(401)
            .json({ message: "User authentication required" });
        }

        const validatedData = insertPatientPaymentSchema.parse({
          patientId,
          amount,
          paymentMethod,
          reason: reason || "Payment",
          paymentDate: paymentDate || new Date().toISOString(),
          processedBy: req.user.id,
        });


        const payment = await storage.createPatientPayment(
          validatedData,
          req.user.id,
        );

        // Create audit log
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "create",
          tableName: "patient_payments",
          recordId: payment.id,
          oldValues: null,
          newValues: payment,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });

        // Log activity for payment
        const patient = await storage.getPatientById(patientId);

        console.log("=== Payment created ===");
        console.log('Reason:', reason);
        console.log('Patient ID:', patientId);

        // Check if payment is for OPD visit and trigger commission calculation
        if (reason && reason.startsWith("OPD Visit - VIS-")) {
          try {
            // Extract visit ID from reason (e.g., "OPD Visit - VIS-2025-000001")
            const visitIdMatch = reason.match(/VIS-\d{4}-\d+/);
            if (visitIdMatch) {
              const visitId = visitIdMatch[0];
              console.log(`Payment for OPD visit ${visitId}, calculating commission`);

              // Calculate and create doctor earning for this visit
              // This method also updates the visit status to completed
              const earning = await storage.calculateDoctorEarningForVisit(visitId);
              if (earning) {
                console.log(`Created doctor earning: ${earning.earningId} for ₹${earning.earnedAmount}`);
              }
            }
          } catch (earningError) {
            // Log error but don't fail the payment creation
            console.error("Error calculating doctor earning:", earningError);
          }
        }

        // Check if payment is for pathology order and trigger earning calculation
        console.log(`Checking if reason includes "Pathology": ${reason?.includes("Pathology")}`);
        if (reason && reason.includes("Pathology")) {
          console.log(`✓ Pathology payment detected`);
          try {
            // Extract pathology order ID from reason (e.g., "Pathology - LAB-2025-000001")
            const orderIdMatch = reason.match(/LAB-[\d\-]+/);
            console.log(`Order ID match result: ${JSON.stringify(orderIdMatch)}`);

            if (orderIdMatch) {
              const orderId = orderIdMatch[0];
              console.log(`🔍 Extracted order ID: ${orderId}`);

              // Get all pathology orders and find by orderId
              const allOrders = await storage.getPathologyOrders();
              console.log(`📋 Found ${allOrders.length} total pathology orders`);

              const pathologyOrder = allOrders.find((order: any) => order.order?.orderId === orderId);
              console.log(`🔍 Searching for order with ID: ${orderId}`);
              console.log(`Order found: ${!!pathologyOrder}`);

              if (pathologyOrder && pathologyOrder.order) {
                const order = pathologyOrder.order;
                console.log(`✓ Order found! Database ID: ${order.id}, Total: ₹${order.totalPrice}`);

                // Calculate doctor earnings if order has a doctor
                if (order.doctorId) {
                  try {
                    await storage.calculatePathologyOrderEarning(order.id);
                    console.log(`✓ Created doctor earning for pathology order ${orderId}`);
                  } catch (earningError) {
                    console.error('Error creating doctor earning:', earningError);
                  }
                }

                // Calculate total payments made for this specific pathology order
                const allPatientPayments = await storage.getPatientPayments(patientId);
                const pathologyPaymentsForOrder = allPatientPayments.filter((p: any) =>
                  p.reason && p.reason.includes(orderId)
                );
                const totalPaid = pathologyPaymentsForOrder.reduce((sum: number, p: any) => sum + p.amount, 0);

                console.log(`💰 Total payments for order ${orderId}: ₹${totalPaid} (including current payment of ₹${amount})`);
                console.log(`📊 Order total: ₹${order.totalPrice}`);

                // Check if total payments match or exceed order total to mark as paid
                if (totalPaid >= order.totalPrice) {
                  console.log(`✓ Total payments (₹${totalPaid}) meet or exceed order total (₹${order.totalPrice}), updating status to "paid"`);
                  try {
                    await storage.updatePathologyOrderStatus(order.id, 'paid');
                    console.log(`✓ Updated order status to "paid" for ${orderId}`);
                  } catch (statusError) {
                    console.error('Error updating order status:', statusError);
                  }
                } else {
                  console.log(`ℹ️ Total payments (₹${totalPaid}) still less than order total (₹${order.totalPrice}), remaining: ₹${order.totalPrice - totalPaid}`);
                }
              } else {
                console.log(`⚠️  Could not find pathology order with ID: ${orderId}`);
              }
            } else {
              console.log(`✗ Failed to extract order ID from reason: "${reason}"`);
            }
          } catch (earningError) {
            // Log error but don't fail the payment creation
            console.error("❌ Error calculating pathology order earning:", earningError);
          }
        } else {
          console.log(`✗ Not a pathology payment`);
        }

        // Check if payment is for services (Services, Diagnostics, Admissions) and trigger earning calculation
        // Format: "Service - SER-YYYY-NNNNN" or "Diagnostic - DIA-..." or "Admission - ADM-..."
        const isServicePayment = reason && (reason.includes("Service - SER-") || reason.includes("Diagnostic - ") || reason.includes("Admission - "));
        
        if (isServicePayment) {
          console.log(`✓ Service/Diagnostic/Admission payment detected`);
          try {
            // Extract order ID or service identifier from reason
            let orderId: string | null = null;
            
            if (reason.includes("Service - SER-")) {
              const match = reason.match(/SER-\d{4}-\d+/);
              orderId = match ? match[0] : null;
            } else if (reason.includes("Diagnostic - ")) {
              const match = reason.match(/DIA-[\d\-]+/);
              orderId = match ? match[0] : null;
            } else if (reason.includes("Admission - ")) {
              const match = reason.match(/ADM-\d{4}-\d+/);
              orderId = match ? match[0] : null;
            }
            
            console.log(`Order/Service ID extracted: ${orderId}`);
            
            if (orderId) {
              // Get all patient services and find those matching the orderId
              const allServices = await storage.getPatientServices(patientId);
              console.log(`Found ${allServices.length} services for patient`);
              
              const matchingServices = allServices.filter((service: any) => {
                // Check if service matches the order criteria
                if (reason.includes("Service - SER-")) {
                  return service.orderId === orderId;
                } else if (reason.includes("Diagnostic - ")) {
                  return service.serviceCategory === "diagnostics" && service.orderId === orderId;
                } else if (reason.includes("Admission - ")) {
                  return service.serviceCategory === "admission" && service.orderId === orderId;
                }
                return false;
              });
              
              console.log(`Found ${matchingServices.length} matching services for ${orderId}`);
              
              // Calculate and create earnings for the service order
              try {
                await storage.calculateServiceOrderEarning(orderId);
                console.log(`✓ Calculated earnings for service order ${orderId}`);
              } catch (earningError) {
                console.error("Error calculating service order earning:", earningError);
              }
            }
          } catch (earningError) {
            console.error("Error calculating service earnings:", earningError);
          }
        }

        res.json(payment);
      } catch (error: any) {
        console.error("Error creating patient payment:", error);
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Validation error", details: error.errors });
        }
        res
          .status(500)
          .json({ message: "Failed to create payment", error: error.message });
      }
    },
  );

  // Get all patient payments with optional date filtering
  app.get("/api/patient-payments", authenticateToken, async (req, res) => {
    try {
      const { patientId, fromDate, toDate } = req.query;

      // Use the storage method that already exists
      const payments = await storage.getPatientPayments(
        patientId as string | undefined,
        fromDate as string | undefined,
        toDate as string | undefined
      );

      res.json(payments);
    } catch (error) {
      console.error("Error fetching patient payments:", error);
      res.status(500).json({ error: "Failed to fetch patient payments" });
    }
  });

  app.get(
    "/api/patients/:patientId/payments",
    authenticateToken,
    async (req, res) => {
      try {
        const { patientId } = req.params;
        const payments = await storage.getPatientPayments(patientId);
        res.json(payments);
      } catch (error) {
        console.error("Error fetching patient payments:", error);
        res.status(500).json({ message: "Failed to fetch payments" });
      }
    },
  );

  app.get(
    "/api/patients/:patientId/financial-summary",
    authenticateToken,
    async (req, res) => {
      try {
        const { patientId } = req.params;
        console.log(`Generating financial summary for patient: ${patientId}`);
        const summary = await storage.getPatientFinancialSummary(patientId);
        console.log(
          `Financial summary - Total charges: ${summary.totalCharges}, Total paid: ${summary.totalPaid}`,
        );
        res.json(summary);
      } catch (error) {
        console.error("Error fetching patient financial summary:", error);
        res.status(500).json({ message: "Failed to fetch financial summary" });
      }
    },
  );

  app.get(
    "/api/patients/:patientId/billable-items",
    authenticateToken,
    async (req, res) => {
      try {
        const { patientId } = req.params;
        const billableItems = await storage.getPatientBillableItems(patientId);
        res.json(billableItems);
      } catch (error) {
        console.error("Error fetching billable items:", error);
        res.status(500).json({ message: "Failed to fetch billable items" });
      }
    },
  );

  app.get(
    "/api/patients/:patientId/comprehensive-bill",
    authenticateToken,
    async (req, res) => {
      try {
        const { patientId } = req.params;
        // Disable caching to ensure fresh data
        res.set("Cache-Control", "no-cache, no-store, must-revalidate");
        res.set("Pragma", "no-cache");
        res.set("Expires", "0");

        console.log(`Generating comprehensive bill for patient: ${patientId}`);
        const comprehensiveBill =
          await storage.generateComprehensiveBill(patientId);
        console.log(
          `Generated comprehensive bill with ${comprehensiveBill.billItems.length} items`,
        );

        res.json(comprehensiveBill);
      } catch (error) {
        console.error("Error generating comprehensive bill:", error);
        res
          .status(500)
          .json({ message: "Failed to generate comprehensive bill" });
      }
    },
  );

  // Patient Discount Routes
  app.post(
    "/api/patients/:patientId/discounts",
    authenticateToken,
    async (req: any, res) => {
      try {
        const { patientId } = req.params;
        const { amount, reason, discountType, discountDate } = req.body;

        // Verify user ID exists
        if (!req.user?.id) {
          return res
            .status(401)
            .json({ message: "User authentication required" });
        }

        const discount = await storage.createPatientDiscount(
          {
            patientId,
            amount,
            reason,
            discountType: discountType || "manual",
            discountDate: discountDate || new Date().toISOString(),
            approvedBy: req.user.id,
          },
          req.user.id,
        );

        // Create audit log
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "create",
          tableName: "patient_discounts",
          recordId: discount.id,
          oldValues: null,
          newValues: discount,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });

        // Log activity for discount
        const patient = await storage.getPatientById(patientId);

        res.json(discount);
      } catch (error: any) {
        console.error("Error creating patient discount:", error);
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Validation error", details: error.errors });
        }
        res
          .status(500)
          .json({ message: "Failed to create discount", error: error.message });
      }
    },
  );

  app.get(
    "/api/patients/:patientId/discounts",
    authenticateToken,
    async (req, res) => {
      try {
        const { patientId } = req.params;
        const discounts = await storage.getPatientDiscounts(patientId);
        res.json(discounts);
      } catch (error) {
        console.error("Error fetching patient discounts:", error);
        res.status(500).json({ message: "Failed to fetch discounts" });
      }
    },
  );

  // Bulk pending bills endpoint - optimized for performance
  app.get(
    "/api/patients/pending-bills/bulk",
    authenticateToken,
    async (req, res) => {
      try {
        const pendingBills = await storage.getAllPatientsPendingBills();
        res.json(pendingBills);
      } catch (error) {
        console.error("Error fetching pending bills:", error);
        res.status(500).json({ message: "Failed to fetch pending bills" });
      }
    },
  );

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

  app.post(
    "/api/service-categories",
    authenticateToken,
    async (req: any, res) => {
      try {
        const categoryData = insertServiceCategorySchema.parse(req.body);
        const category = await storage.createServiceCategory(
          categoryData,
          req.user.id,
        );

        // Create audit log
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "create",
          tableName: "service_categories",
          recordId: category.id,
          oldValues: null,
          newValues: category,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });

        res.json(category);
      } catch (error: any) {
        console.error("Error creating service category:", error);
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Validation error", details: error.errors });
        }
        res.status(500).json({
          message: "Failed to create service category",
          error: error.message,
        });
      }
    },
  );

  app.put(
    "/api/service-categories/:id",
    authenticateToken,
    async (req: any, res) => {
      try {
        const categoryId = req.params.id;
        const categoryData = insertServiceCategorySchema
          .partial()
          .parse(req.body);
        // Get category data before update for audit log
        const categoryToUpdate =
          await storage.getServiceCategoryById(categoryId); // Assuming getServiceCategoryById exists

        const category = await storage.updateServiceCategory(
          categoryId,
          categoryData,
          req.user.id,
        );
        if (!category) {
          return res
            .status(404)
            .json({ message: "Service category not found" });
        }

        // Create audit log
        if (categoryToUpdate) {
          await storage.createAuditLog({
            userId: req.user.id,
            username: req.user.username,
            action: "update",
            tableName: "service_categories",
            recordId: categoryId,
            oldValues: categoryToUpdate,
            newValues: category,
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          });
        }

        res.json(category);
      } catch (error: any) {
        console.error("Error updating service category:", error);
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Validation error", details: error.errors });
        }
        res.status(500).json({
          message: "Failed to update service category",
          error: error.message,
        });
      }
    },
  );

  app.delete(
    "/api/service-categories/:id",
    authenticateToken,
    async (req: any, res) => {
      try {
        const { id } = req.params;

        // Get the service category to find its name
        const categories = await storage.getServiceCategories();
        const categoryToDelete = categories.find((cat) => cat.id === id);

        if (!categoryToDelete) {
          return res
            .status(404)
            .json({ message: "Service category not found" });
        }

        // Check if there are any services using this category
        const services = await storage.getServices();
        const servicesInCategory = services.filter(
          (service) => service.category === categoryToDelete.name,
        );

        if (servicesInCategory.length > 0) {
          return res.status(400).json({
            message: `Cannot delete category "${categoryToDelete.label}". There are ${servicesInCategory.length} service(s) still using this category. Please delete or move these services to another category first.`,
            servicesCount: servicesInCategory.length,
            services: servicesInCategory.map((s) => ({
              id: s.id,
              name: s.name,
            })),
          });
        }

        const deleted = await storage.deleteServiceCategory(id, req.user.id);
        if (!deleted) {
          return res
            .status(404)
            .json({ message: "Service category not found" });
        }

        // Create audit log
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "delete",
          tableName: "service_categories",
          recordId: id,
          oldValues: categoryToDelete,
          newValues: null,
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });

        res.json({ message: "Service category deleted successfully" });
      } catch (error: any) {
        console.error("Error deleting service category:", error);
        res.status(500).json({
          message: error.message || "Failed to delete service category",
        });
      }
    },
  );

  // Doctor Earnings Routes
  app.get(
    "/api/doctors/:doctorId/earnings",
    authenticateToken,
    async (req, res) => {
      try {
        const { doctorId } = req.params;
        const { status } = req.query;
        console.log(
          `GET /api/doctors/${doctorId}/earnings - status filter: ${status || "all"}`,
        );
        const earnings = await storage.getDoctorEarnings(
          doctorId,
          status as string | undefined,
        );
        console.log(
          `Returning ${earnings.length} earnings for doctor ${doctorId}`,
        );
        res.json(earnings);
      } catch (error) {
        console.error("Error fetching doctor earnings:", error);
        res.status(500).json({ message: "Failed to fetch doctor earnings" });
      }
    },
  );

  app.post(
    "/api/doctors/recalculate-earnings",
    authenticateToken,
    async (req: any, res) => {
      try {
        const { doctorId } = req.body;
        const result = await storage.recalculateDoctorEarnings(
          doctorId,
          req.user.id,
        );

        // Create audit log for recalculation
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "recalculate_earnings",
          tableName: "doctor_earnings",
          recordId: doctorId, // Doctor ID is the primary identifier for this operation
          oldValues: null, // No specific old values logged here, as it's a recalculation
          newValues: {
            processed: result.processed,
            created: result.created,
            message: `Recalculation complete: processed ${result.processed} services, created ${result.created} new earnings`,
          },
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });

        res.json({
          message: `Recalculation complete: processed ${result.processed} services, created ${result.created} new earnings`,
          ...result,
        });
      } catch (error) {
        console.error("Error recalculating doctor earnings:", error);
        res
          .status(500)
          .json({ message: "Failed to recalculate doctor earnings" });
      }
    },
  );

  app.put(
    "/api/doctors/:doctorId/mark-paid",
    authenticateToken,
    async (req, res) => {
      try {
        const { doctorId } = req.params;

        // Get all pending earnings for this doctor before marking as paid
        const pendingEarnings = await storage.getDoctorEarnings(
          doctorId,
          "pending",
        );

        if (pendingEarnings.length === 0) {
          return res
            .status(400)
            .json({ message: "No pending earnings found for this doctor" });
        }

        // Mark all pending earnings as paid
        const updatedEarnings = [];
        for (const earning of pendingEarnings) {
          const updatedEarning = await storage.updateDoctorEarningStatus(
            earning.id,
            "paid",
            req.user.id,
          );
          updatedEarnings.push(updatedEarning);
        }

        // Create audit log for marking earnings as paid
        await storage.createAuditLog({
          userId: req.user.id,
          username: req.user.username,
          action: "mark_paid",
          tableName: "doctor_earnings",
          recordId: doctorId, // Doctor ID as the identifier for this batch operation
          oldValues: pendingEarnings.map((e) => ({
            id: e.id,
            status: e.status,
          })), // Log the statuses before update
          newValues: updatedEarnings.map((e) => ({
            id: e.id,
            status: e.status,
          })), // Log the statuses after update
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
        });

        res.json({
          message: `Successfully marked ${pendingEarnings.length} earnings as paid`,
          count: pendingEarnings.length,
          earnings: updatedEarnings, // Optionally return the updated earnings
        });
      } catch (error) {
        console.error("Error marking earnings as paid:", error);
        res.status(500).json({ message: "Failed to mark earnings as paid" });
      }
    },
  );

  // ==================== PATHOLOGY IMPORT/EXPORT ENDPOINTS ====================

  // Import pathology data from JSON
  app.post("/api/pathology-data/import/json", authenticateToken, async (req, res) => {
    try {
      const jsonData = req.body;

      if (!jsonData || !jsonData.categories) {
        return res.status(400).json({ message: "JSON data with categories is required" });
      }

      // Parse and validate JSON
      const { parsePathologyJSON, jsonToDatabase } = await import(
        "./utils/pathology-conversion"
      );
      const parsedData = parsePathologyJSON(
        typeof jsonData === "string" ? jsonData : JSON.stringify(jsonData),
      );

      // Convert to database format
      const { categories, tests } = jsonToDatabase(parsedData);

      // Get all existing categories and delete them (complete override)
      const existingCategories = await storage.getPathologyCategories();
      for (const category of existingCategories) {
        // Delete all tests in this category
        const categoryTests = await storage.getPathologyCategoryTestsByCategory(category.id);
        for (const test of categoryTests) {
          await storage.deletePathologyCategoryTest(test.id);
        }
        // Delete the category
        await storage.deletePathologyCategory(category.id);
      }

      // Create new categories and tests
      const createdCategories = [];
      const createdTests = [];

      for (const category of categories) {
        const created = await storage.createPathologyCategory(category);
        createdCategories.push(created);

        // Create tests for this category
        const categoryTests = tests.filter((t) => t.categoryName === category.name);
        for (const test of categoryTests) {
          const { categoryName, ...testData } = test;
          const createdTest = await storage.createPathologyCategoryTest({
            ...testData,
            categoryId: created.id,
          });
          createdTests.push(createdTest);
        }
      }

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "import",
        tableName: "pathology_categories",
        recordId: "batch_import",
        oldValues: null,
        newValues: {
          categoriesCount: createdCategories.length,
          testsCount: createdTests.length,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json({
        message: `Pathology data imported successfully`,
        categoriesCount: categories.length,
        testsCount: tests.length,
      });
    } catch (error) {
      console.error("Error importing pathology data:", error);
      const message =
        error instanceof Error ? error.message : "Failed to import pathology data";
      res.status(400).json({ message });
    }
  });

  // Import pathology data from Excel
  app.post("/api/pathology-data/import/excel", authenticateToken, upload?.single("file") || ((req: any, res: any, next: any) => next()), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Excel file is required" });
      }

      // Parse and validate Excel
      const { parsePathologyExcel, jsonToDatabase } = await import(
        "./utils/pathology-conversion"
      );
      const parsedData = parsePathologyExcel(req.file.buffer);

      // Convert to database format
      const { categories, tests } = jsonToDatabase(parsedData);

      // Get all existing categories and delete them (complete override)
      const existingCategories = await storage.getPathologyCategories();
      for (const category of existingCategories) {
        // Delete all tests in this category
        const categoryTests = await storage.getPathologyCategoryTestsByCategory(category.id);
        for (const test of categoryTests) {
          await storage.deletePathologyCategoryTest(test.id);
        }
        // Delete the category
        await storage.deletePathologyCategory(category.id);
      }

      // Create new categories and tests
      const createdCategories = [];
      const createdTests = [];

      for (const category of categories) {
        const created = await storage.createPathologyCategory(category);
        createdCategories.push(created);

        // Create tests for this category
        const categoryTests = tests.filter((t) => t.categoryName === category.name);
        for (const test of categoryTests) {
          const { categoryName, ...testData } = test;
          const createdTest = await storage.createPathologyCategoryTest({
            ...testData,
            categoryId: created.id,
          });
          createdTests.push(createdTest);
        }
      }

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "import",
        tableName: "pathology_categories",
        recordId: "batch_import",
        oldValues: null,
        newValues: {
          categoriesCount: createdCategories.length,
          testsCount: createdTests.length,
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json({
        message: `Pathology data imported successfully`,
        categoriesCount: categories.length,
        testsCount: tests.length,
      });
    } catch (error) {
      console.error("Error importing pathology data from Excel:", error);
      const message =
        error instanceof Error ? error.message : "Failed to import pathology data";
      res.status(400).json({ message });
    }
  });

  // Export pathology data as JSON
  app.get("/api/pathology-data/export/json", authenticateToken, async (req, res) => {
    try {
      const { pathologyToJSON } = await import("./utils/pathology-conversion");

      // Get all categories
      const categories = await storage.getPathologyCategories();

      // Get tests for each category
      const categoriesWithTests = await Promise.all(
        categories.map(async (category) => ({
          ...category,
          tests: await storage.getPathologyCategoryTestsByCategory(category.id),
        })),
      );

      // Convert to JSON format
      const jsonData = pathologyToJSON(categoriesWithTests);

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "export",
        tableName: "pathology_categories",
        recordId: "batch_export",
        oldValues: null,
        newValues: {
          categoriesCount: categories.length,
          testsCount: categoriesWithTests.reduce((sum, c) => sum + c.tests.length, 0),
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      res.json(jsonData);
    } catch (error) {
      console.error("Error exporting pathology data:", error);
      res.status(500).json({ message: "Failed to export pathology data" });
    }
  });

  // Export pathology data as Excel
  app.get("/api/pathology-data/export/excel", authenticateToken, async (req, res) => {
    try {
      const { generateStyledPathologyExport } = await import("./utils/pathology-conversion");

      // Get all categories
      const categories = await storage.getPathologyCategories();

      // Get tests for each category
      const categoriesWithTests = await Promise.all(
        categories.map(async (category) => ({
          ...category,
          tests: await storage.getPathologyCategoryTestsByCategory(category.id),
        })),
      );

      // Generate styled Excel export with ExcelJS
      const buffer = await generateStyledPathologyExport(categoriesWithTests);

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "export",
        tableName: "pathology_categories",
        recordId: "batch_export",
        oldValues: null,
        newValues: {
          categoriesCount: categories.length,
          testsCount: categoriesWithTests.reduce((sum, c) => sum + c.tests.length, 0),
        },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      // Send Excel file
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="pathology-data-${new Date().toISOString().split("T")[0]}.xlsx"`,
      );

      res.send(buffer);
    } catch (error) {
      console.error("Error exporting pathology data to Excel:", error);
      res.status(500).json({ message: "Failed to export pathology data" });
    }
  });

  // Get blank template for pathology data
  app.get("/api/pathology-data/template", authenticateToken, async (req, res) => {
    try {
      const { generateStyledPathologyTemplate } = await import("./utils/pathology-conversion");

      // Generate styled template with ExcelJS
      const buffer = await generateStyledPathologyTemplate();

      // Create audit log
      await storage.createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        action: "download_template",
        tableName: "pathology_categories",
        recordId: "template",
        oldValues: null,
        newValues: { templateType: "blank" },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      // Send Excel file
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="pathology-template-${new Date().toISOString().split("T")[0]}.xlsx"`,
      );

      res.send(buffer);
    } catch (error) {
      console.error("Error generating template:", error);
      res.status(500).json({ message: "Failed to generate template" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}