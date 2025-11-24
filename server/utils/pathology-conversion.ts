import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { z } from "zod";
import {
  PathologyCategory,
  PathologyCategoryTest,
  InsertPathologyCategory,
  InsertPathologyCategoryTest,
} from "../../shared/schema";

/**
 * JSON Format Types for import/export
 */
export interface PathologyTestJSON {
  testName: string;
  price: number;
  description?: string;
}

export interface PathologyCategoryJSON {
  name: string;
  description?: string;
  tests: PathologyTestJSON[];
}

export interface PathologyDataJSON {
  categories: PathologyCategoryJSON[];
}

/**
 * Validation Schemas
 */
const PathologyTestJSONSchema = z.object({
  testName: z.string().min(1, "Test name is required"),
  price: z.number().min(0, "Price must be non-negative"),
  description: z.string().optional(),
});

const PathologyCategoryJSONSchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().optional(),
  tests: z.array(PathologyTestJSONSchema).min(1, "At least one test required"),
});

const PathologyDataJSONSchema = z.object({
  categories: z.array(PathologyCategoryJSONSchema),
});

export type PathologyTestJSONInput = z.infer<typeof PathologyTestJSONSchema>;
export type PathologyCategoryJSONInput = z.infer<
  typeof PathologyCategoryJSONSchema
>;
export type PathologyDataJSONInput = z.infer<typeof PathologyDataJSONSchema>;

/**
 * Convert database records to JSON format
 * Takes categories with nested tests and converts to exportable JSON
 */
export function pathologyToJSON(
  categoriesWithTests: (PathologyCategory & {
    tests: PathologyCategoryTest[];
  })[],
): PathologyDataJSON {
  return {
    categories: categoriesWithTests.map((category) => ({
      name: category.name,
      description: category.description || undefined,
      tests: category.tests.map((test) => ({
        testName: test.testName,
        price: test.price,
        description: test.description || undefined,
      })),
    })),
  };
}

/**
 * Convert database records to Excel workbook
 * Creates two sheets: Categories and Tests for easy manipulation
 */
export function pathologyToExcel(
  categoriesWithTests: (PathologyCategory & {
    tests: PathologyCategoryTest[];
  })[],
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Categories with inline tests
  const categoryData: any[] = [];
  for (const category of categoriesWithTests) {
    for (let i = 0; i < category.tests.length; i++) {
      const test = category.tests[i];
      categoryData.push({
        Category: i === 0 ? category.name : "", // Only show category name for first test
        Description: i === 0 ? category.description || "" : "",
        "Test Name": test.testName,
        Price: test.price,
        "Test Description": test.description || "",
      });
    }
  }

  const categorySheet = XLSX.utils.json_to_sheet(categoryData);
  categorySheet["!cols"] = [{ wch: 20 }, { wch: 30 }, { wch: 25 }, { wch: 12 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(workbook, categorySheet, "Categories");

  // Sheet 2: Template for adding new categories
  const templateData = [
    {
      Category: "Example Category",
      Description: "Optional description",
      "Test Name": "Example Test",
      Price: 100,
      "Test Description": "Optional test description",
    },
  ];
  const templateSheet = XLSX.utils.json_to_sheet(templateData);
  templateSheet["!cols"] = [{ wch: 20 }, { wch: 30 }, { wch: 25 }, { wch: 12 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(workbook, templateSheet, "Template");

  return workbook;
}

/**
 * Parse and validate JSON data for import
 * Throws error if validation fails - entire upload is rejected on any error
 */
export function parsePathologyJSON(jsonString: string): PathologyDataJSON {
  try {
    const parsed = JSON.parse(jsonString);
    const validated = PathologyDataJSONSchema.parse(parsed);
    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      throw new Error(`Invalid JSON format: ${messages}`);
    }
    throw new Error("Failed to parse JSON: Invalid JSON syntax");
  }
}

/**
 * Parse and validate Excel data for import
 * Reads the Categories sheet and validates all entries
 * Throws error if validation fails - entire upload is rejected on any error
 */
export function parsePathologyExcel(fileBuffer: Buffer): PathologyDataJSON {
  try {
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    // Check for either "Template" (from blank download) or "Categories" (from data export)
    const sheet = workbook.Sheets["Template"] || workbook.Sheets["Categories"];

    if (!sheet) {
      throw new Error('Excel file must contain either a "Template" or "Categories" sheet');
    }

    const data = XLSX.utils.sheet_to_json(sheet);

    if (!data || data.length === 0) {
      throw new Error("No data found in Categories sheet");
    }

    // Parse the Excel data into categories with tests
    const categoriesMap = new Map<
      string,
      { description?: string; tests: PathologyTestJSON[] }
    >();

    for (const row of data as any[]) {
      const categoryName = (row.Category || "").trim();
      const testName = (row["Test Name"] || "").trim();
      const price = parseFloat(row.Price);
      const description = (row.Description || "").trim() || undefined;
      const testDescription = (row["Test Description"] || "").trim() || undefined;

      if (!categoryName) {
        throw new Error("Category name cannot be empty");
      }

      if (!testName) {
        throw new Error(`Test name cannot be empty in category "${categoryName}"`);
      }

      if (isNaN(price) || price < 0) {
        throw new Error(`Invalid price "${row.Price}" in test "${testName}"`);
      }

      if (!categoriesMap.has(categoryName)) {
        categoriesMap.set(categoryName, {
          description,
          tests: [],
        });
      }

      const category = categoriesMap.get(categoryName)!;
      category.tests.push({
        testName,
        price,
        description: testDescription,
      });
    }

    // Convert map to array and validate
    const categories = Array.from(categoriesMap.entries()).map(([name, data]) => ({
      name,
      description: data.description,
      tests: data.tests,
    }));

    // Validate against schema
    const validated = z
      .array(PathologyCategoryJSONSchema)
      .parse(categories);

    return {
      categories: validated,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      throw new Error(`Invalid Excel data: ${messages}`);
    }
    throw error;
  }
}

/**
 * Convert JSON data to database insert operations
 * Returns categories and tests ready for database insertion
 * Validates all data - throws if any data is invalid
 */
export function jsonToDatabase(
  jsonData: PathologyDataJSON,
): {
  categories: InsertPathologyCategory[];
  tests: (InsertPathologyCategoryTest & { categoryName: string })[];
} {
  const categories: InsertPathologyCategory[] = [];
  const tests: (InsertPathologyCategoryTest & { categoryName: string })[] = [];

  for (const category of jsonData.categories) {
    categories.push({
      name: category.name,
      description: category.description,
    });

    for (const test of category.tests) {
      tests.push({
        categoryId: "", // Will be filled in by caller after category is created
        testName: test.testName,
        price: test.price,
        description: test.description,
        categoryName: category.name, // Temporary reference for matching
      });
    }
  }

  return { categories, tests };
}

/**
 * Generate Excel template for users to fill in (using plain XLSX - no styling)
 * Creates a blank template with instructions
 */
export function generatePathologyTemplate(): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  const instructionData = [
    {
      "NOTE:": "Use the Template sheet to add new pathology tests and categories",
      "":
        "Each row represents one test. Tests with the same Category name will be grouped together",
      "":
        "",
    },
  ];

  const instructionSheet = XLSX.utils.json_to_sheet(instructionData);
  instructionSheet["!cols"] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(workbook, instructionSheet, "Instructions");

  const templateData = [
    {
      Category: "Biochemistry",
      Description: "Blood chemistry tests",
      "Test Name": "Blood Glucose",
      Price: 150,
      "Test Description": "Fasting blood glucose test",
    },
    {
      Category: "Biochemistry",
      Description: "Blood chemistry tests",
      "Test Name": "Liver Function Test",
      Price: 200,
      "Test Description": "LFT panel",
    },
    {
      Category: "Hematology",
      Description: "Blood cell analysis",
      "Test Name": "Complete Blood Count",
      Price: 250,
      "Test Description": "CBC with differential",
    },
  ];

  const templateSheet = XLSX.utils.json_to_sheet(templateData);
  templateSheet["!cols"] = [{ wch: 20 }, { wch: 30 }, { wch: 25 }, { wch: 12 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(workbook, templateSheet, "Template");

  return workbook;
}

/**
 * Generate styled Excel template using ExcelJS with full styling support
 * Returns a Buffer directly ready to send as response
 */
export async function generateStyledPathologyTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  // Sheet 1: Instructions
  const instructionSheet = workbook.addWorksheet("Instructions");
  instructionSheet.columns = [{ header: "NOTE:", key: "note", width: 80 }];
  instructionSheet.addRows([
    {
      note: "Use the Template sheet to add new pathology tests and categories",
    },
    {
      note: "Each row represents one test. Tests with the same Category name will be grouped together",
    },
  ]);

  // Sheet 2: Template with styling
  const templateSheet = workbook.addWorksheet("Template");
  templateSheet.columns = [
    { header: "Category", key: "Category", width: 20 },
    { header: "Description", key: "Description", width: 30 },
    { header: "Test Name", key: "Test Name", width: 25 },
    { header: "Price", key: "Price", width: 12 },
    { header: "Test Description", key: "Test Description", width: 30 },
  ];

  // Style the header row
  const headerRow = templateSheet.getRow(1);
  headerRow.height = 25;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF003366" },
    };
    cell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 11,
    };
    cell.alignment = { horizontal: "center", vertical: "center", wrapText: true };
  });

  // Template data
  const templateData = [
    {
      Category: "Biochemistry",
      Description: "Blood chemistry tests",
      "Test Name": "Blood Glucose",
      Price: 150,
      "Test Description": "Fasting blood glucose test",
    },
    {
      Category: "Biochemistry",
      Description: "Blood chemistry tests",
      "Test Name": "Liver Function Test",
      Price: 200,
      "Test Description": "LFT panel",
    },
    {
      Category: "Hematology",
      Description: "Blood cell analysis",
      "Test Name": "Complete Blood Count",
      Price: 250,
      "Test Description": "CBC with differential",
    },
  ];

  // Category color map
  const categoryColors: { [key: string]: string } = {
    Biochemistry: "FFC5D9F1", // Light blue
    Hematology: "FFFFE8CC",   // Light orange
  };

  // Add data rows with styling
  let currentRow = 2;
  for (const row of templateData) {
    const categoryColor = categoryColors[row.Category] || "FFFFE8F8";

    const newRow = templateSheet.insertRow(currentRow, row);
    newRow.height = 20;

    // Category column (A) - category color
    newRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: categoryColor } };
    newRow.getCell(1).alignment = { horizontal: "left", vertical: "center" };

    // Description column (B) - category color
    newRow.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: categoryColor } };
    newRow.getCell(2).alignment = { horizontal: "left", vertical: "center" };

    // Test Name column (C) - GREEN
    newRow.getCell(3).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF90EE90" },
    };
    newRow.getCell(3).font = { bold: true, color: { argb: "FF000000" } };
    newRow.getCell(3).alignment = { horizontal: "left", vertical: "center" };

    // Price column (D) - BLUE
    newRow.getCell(4).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF87CEEB" },
    };
    newRow.getCell(4).font = { bold: true, color: { argb: "FF000000" } };
    newRow.getCell(4).alignment = { horizontal: "center", vertical: "center" };
    newRow.getCell(4).numFmt = "0";

    // Test Description column (E) - category color
    newRow.getCell(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: categoryColor } };
    newRow.getCell(5).alignment = { horizontal: "left", vertical: "center", wrapText: true };

    currentRow++;
  }

  // Add some empty rows for user to fill
  for (let i = 0; i < 10; i++) {
    const emptyRow = templateSheet.insertRow(currentRow, {});
    emptyRow.height = 20;

    for (let col = 1; col <= 5; col++) {
      const cell = emptyRow.getCell(col);
      cell.alignment = { horizontal: "left", vertical: "center" };
    }

    currentRow++;
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as Buffer;
}

/**
 * Generate styled Excel export of existing pathology data using ExcelJS
 * Exports current data with same styling as template
 */
export async function generateStyledPathologyExport(
  categoriesWithTests: (PathologyCategory & {
    tests: PathologyCategoryTest[];
  })[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  // Sheet 1: Instructions
  const instructionSheet = workbook.addWorksheet("Instructions");
  instructionSheet.columns = [{ header: "NOTE:", key: "note", width: 80 }];
  instructionSheet.addRows([
    {
      note: "This is your current pathology data. You can edit any values and re-upload.",
    },
    {
      note: "Each row represents one test. Tests with the same Category name will be grouped together.",
    },
  ]);

  // Sheet 2: Template with all current data
  const templateSheet = workbook.addWorksheet("Template");
  templateSheet.columns = [
    { header: "Category", key: "Category", width: 20 },
    { header: "Description", key: "Description", width: 30 },
    { header: "Test Name", key: "Test Name", width: 25 },
    { header: "Price", key: "Price", width: 12 },
    { header: "Test Description", key: "Test Description", width: 30 },
  ];

  // Style the header row
  const headerRow = templateSheet.getRow(1);
  headerRow.height = 25;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF003366" },
    };
    cell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 11,
    };
    cell.alignment = { horizontal: "center", vertical: "center", wrapText: true };
  });

  // Category color map
  const categoryColors: { [key: string]: string } = {};
  const colorPalette = [
    "FFC5D9F1", // Light blue
    "FFFFE8CC", // Light orange
    "FFC6EFCE", // Light green
    "FFFFC7CE", // Light red
    "FFE2EFDA", // Light teal
    "FFFFF2CC", // Light yellow
  ];

  // Assign colors to categories dynamically
  categoriesWithTests.forEach((category, index) => {
    if (!categoryColors[category.name]) {
      categoryColors[category.name] = colorPalette[index % colorPalette.length];
    }
  });

  // Add data rows with styling
  let currentRow = 2;
  for (const category of categoriesWithTests) {
    const categoryColor = categoryColors[category.name];

    for (const test of category.tests) {
      const newRow = templateSheet.insertRow(currentRow, {
        Category: category.name,
        Description: category.description || "",
        "Test Name": test.testName,
        Price: test.price,
        "Test Description": test.description || "",
      });

      newRow.height = 20;

      // Category column (A) - category color
      newRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: categoryColor } };
      newRow.getCell(1).alignment = { horizontal: "left", vertical: "center" };

      // Description column (B) - category color
      newRow.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: categoryColor } };
      newRow.getCell(2).alignment = { horizontal: "left", vertical: "center" };

      // Test Name column (C) - GREEN
      newRow.getCell(3).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF90EE90" },
      };
      newRow.getCell(3).font = { bold: true, color: { argb: "FF000000" } };
      newRow.getCell(3).alignment = { horizontal: "left", vertical: "center" };

      // Price column (D) - BLUE
      newRow.getCell(4).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF87CEEB" },
      };
      newRow.getCell(4).font = { bold: true, color: { argb: "FF000000" } };
      newRow.getCell(4).alignment = { horizontal: "center", vertical: "center" };
      newRow.getCell(4).numFmt = "0";

      // Test Description column (E) - category color
      newRow.getCell(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: categoryColor } };
      newRow.getCell(5).alignment = { horizontal: "left", vertical: "center", wrapText: true };

      currentRow++;
    }
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as Buffer;
}
