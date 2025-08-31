import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { insertUserSchema, insertPatientSchema, insertDoctorSchema, insertServiceSchema, insertBillSchema, insertBillItemSchema, insertPathologyTestSchema } from "@shared/schema";
import { getAllPathologyTests, getTestsByCategory, getTestByName, getCategories, PathologyTestCatalog } from "./pathology-catalog";
import { updatePatientSchema } from "../shared/schema";

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


  app.patch("/api/patients/:id", authenticateToken, async (req, res) => {
    try {
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

  app.put("/api/services/:id", authenticateToken, async (req, res) => {
    try {
      const serviceData = insertServiceSchema.parse(req.body);
      const service = await storage.updateService(req.params.id, serviceData);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }
      res.json(service);
    } catch (error) {
      res.status(400).json({ message: "Failed to update service" });
    }
  });

  app.delete("/api/services/:id", authenticateToken, async (req, res) => {
    try {
      const deleted = await storage.deleteService(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Service not found" });
      }
      res.json({ message: "Service deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete service" });
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
      const orders = await storage.getPathologyOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Failed to get pathology orders" });
    }
  });

  app.post("/api/pathology", authenticateToken, async (req, res) => {
    try {
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

      const order = await storage.createPathologyOrder(processedOrderData, tests);
      res.json(order);
    } catch (error: any) {
      console.error("Error creating pathology order:", error);
      res.status(400).json({ message: "Failed to create pathology order", error: error.message });
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
  app.get("/api/patient-services", authenticateToken, async (req, res) => {
    try {
      const { patientId } = req.query;
      const services = await storage.getPatientServices(patientId as string);
      res.json(services);
    } catch (error) {
      console.error("Error fetching patient services:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Patient Services Management
  app.post("/api/patient-services", authenticateToken, async (req, res) => {
    try {
      const service = await storage.createPatientService(req.body);
      res.json(service);
    } catch (error) {
      console.error("Error creating patient service:", error);
      res.status(500).json({ error: "Failed to create patient service" });
    }
  });


  app.put("/api/patient-services/:id", authenticateToken, async (req, res) => {
    try {
      const service = await storage.updatePatientService(req.params.id, req.body);
      res.json(service);
    } catch (error) {
      console.error("Error updating patient service:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Patient Admissions Routes
  app.get("/api/admissions", authenticateToken, async (req, res) => {
    try {
      const { patientId } = req.query;
      const admissions = await storage.getAdmissions(patientId as string);
      res.json(admissions);
    } catch (error) {
      console.error("Error fetching admissions:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admissions", authenticateToken, async (req, res) => {
    try {
      const admission = await storage.createAdmission(req.body);
      res.json(admission);
    } catch (error) {
      console.error("Error creating admission:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/admissions/:id", authenticateToken, async (req, res) => {
    try {
      const admission = await storage.updateAdmission(req.params.id, req.body);
      res.json(admission);
    } catch (error) {
      console.error("Error updating admission:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/admissions/:id", authenticateToken, async (req, res) => {
    try {
      const admission = await storage.updateAdmission(req.params.id, req.body);
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

  app.patch("/api/pathology/test/:id/status", authenticateToken, async (req, res) => {
    try {
      const { status, results } = req.body;
      const updated = await storage.updatePathologyTestStatus(req.params.id, status, results);
      if (!updated) {
        return res.status(404).json({ message: "Pathology test not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update pathology test status" });
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

  app.post("/api/room-types", authenticateToken, async (req, res) => {
    try {
      const roomType = await storage.createRoomType(req.body);
      res.status(201).json(roomType);
    } catch (error) {
      console.error("Error creating room type:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/room-types/:id", authenticateToken, async (req, res) => {
    try {
      const updated = await storage.updateRoomType(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Room type not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating room type:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/room-types/:id", authenticateToken, async (req, res) => {
    try {
      await storage.deleteRoomType(req.params.id);
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

  app.post("/api/rooms", authenticateToken, async (req, res) => {
    try {
      const room = await storage.createRoom(req.body);
      res.status(201).json(room);
    } catch (error) {
      console.error("Error creating room:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/rooms/:id", authenticateToken, async (req, res) => {
    try {
      const updated = await storage.updateRoom(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Room not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating room:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/rooms/:id", authenticateToken, async (req, res) => {
    try {
      await storage.deleteRoom(req.params.id);
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
      const updated = await storage.updateRoomOccupancy(req.params.id, isOccupied);
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
      const settings = await storage.getHospitalSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching hospital settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/settings/hospital", authenticateToken, async (req, res) => {
    try {
      const settings = await storage.saveHospitalSettings(req.body);
      res.json(settings);
    } catch (error) {
      console.error("Error saving hospital settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/settings/upload-logo", authenticateToken, async (req, res) => {
    try {
      const { logo } = req.body;
      const logoPath = await storage.saveLogo(logo);
      res.json({ logoPath });
    } catch (error) {
      console.error("Error uploading logo:", error);
      res.status(500).json({ error: "Internal server error" });
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
      const updated = await storage.dischargePatient(req.params.id, req.user.id);
      if (!updated) {
        return res.status(404).json({ error: "Admission not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error discharging patient:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}