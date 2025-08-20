import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { insertUserSchema, insertPatientSchema, insertDoctorSchema, insertServiceSchema, insertBillSchema, insertBillItemSchema, insertPathologyTestSchema } from "@shared/schema";
import { getAllPathologyTests, getTestsByCategory, getTestByName, getCategories, PathologyTestCatalog } from "./pathology-catalog";

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

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValid = await storage.verifyPassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign({ 
        id: user.id, 
        username: user.username, 
        role: user.role 
      }, JWT_SECRET, { expiresIn: '8h' });

      res.json({ 
        token, 
        user: { 
          id: user.id, 
          username: user.username, 
          fullName: user.fullName, 
          role: user.role 
        } 
      });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.json({ id: user.id, username: user.username, fullName: user.fullName, role: user.role });
    } catch (error) {
      res.status(400).json({ message: "Registration failed" });
    }
  });

  // User routes
  app.get("/api/users/me", authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ id: user.id, username: user.username, fullName: user.fullName, role: user.role });
    } catch (error) {
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Dashboard routes
  app.get("/api/dashboard/stats", authenticateToken, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to get dashboard stats" });
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

  app.post("/api/patients", authenticateToken, async (req, res) => {
    try {
      const patientData = insertPatientSchema.parse(req.body);
      const patient = await storage.createPatient(patientData);
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

  // Doctor routes
  app.get("/api/doctors", authenticateToken, async (req, res) => {
    try {
      const doctors = await storage.getDoctors();
      res.json(doctors);
    } catch (error) {
      res.status(500).json({ message: "Failed to get doctors" });
    }
  });

  app.post("/api/doctors", authenticateToken, async (req, res) => {
    try {
      const doctorData = insertDoctorSchema.parse(req.body);
      const doctor = await storage.createDoctor(doctorData);
      res.json(doctor);
    } catch (error) {
      console.error("Doctor creation error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      res.status(400).json({ message: "Failed to create doctor" });
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

  app.post("/api/services", authenticateToken, async (req, res) => {
    try {
      const serviceData = insertServiceSchema.parse(req.body);
      const service = await storage.createService(serviceData);
      res.json(service);
    } catch (error) {
      res.status(400).json({ message: "Failed to create service" });
    }
  });

  // Bill routes
  app.get("/api/bills", authenticateToken, async (req, res) => {
    try {
      const bills = await storage.getBillsWithPatients();
      res.json(bills);
    } catch (error) {
      res.status(500).json({ message: "Failed to get bills" });
    }
  });

  app.post("/api/bills", authenticateToken, async (req: any, res) => {
    try {
      const { bill, items } = req.body;
      
      const billData = insertBillSchema.parse({
        ...bill,
        createdBy: req.user.id,
        billDate: new Date().toISOString().split('T')[0],
      });
      
      const itemsData = items.map((item: any) => insertBillItemSchema.parse(item));
      
      const createdBill = await storage.createBill(billData, itemsData);
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
      const tests = await storage.getPathologyTests();
      res.json(tests);
    } catch (error) {
      res.status(500).json({ message: "Failed to get pathology tests" });
    }
  });

  app.post("/api/pathology", authenticateToken, async (req, res) => {
    try {
      const testData = insertPathologyTestSchema.parse(req.body);
      const test = await storage.createPathologyTest(testData);
      res.json(test);
    } catch (error) {
      res.status(400).json({ message: "Failed to create pathology test" });
    }
  });

  app.get("/api/pathology/patient/:patientId", authenticateToken, async (req, res) => {
    try {
      const tests = await storage.getPathologyTestsByPatient(req.params.patientId);
      res.json(tests);
    } catch (error) {
      res.status(500).json({ message: "Failed to get patient pathology tests" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
