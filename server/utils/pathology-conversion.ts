import * as XLSX from "xlsx-js-style";
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
  version: string;
  timestamp: string;
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
  version: z.string(),
  timestamp: z.string(),
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
    version: "1.0",
    timestamp: new Date().toISOString(),
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
      version: "1.0",
      timestamp: new Date().toISOString(),
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
 * Generate Excel template for users to fill in
 * Creates a blank template with instructions and visual styling
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

  // Build sheet manually to enable styling support
  const ws: any = {};

  // Add column widths
  ws["!cols"] = [{ wch: 20 }, { wch: 30 }, { wch: 25 }, { wch: 12 }, { wch: 30 }];

  // Column mapping
  const cols = ["A", "B", "C", "D", "E"];
  const headers = ["Category", "Description", "Test Name", "Price", "Test Description"];

  // Category colors (RGB format without FF prefix for xlsx-js-style)
  const categoryColors: { [key: string]: string } = {
    Biochemistry: "C5D9F1", // Light blue
    Hematology: "FFE8CC",   // Light orange
  };

  // Header styling
  const headerStyle = {
    fill: { fgColor: { rgb: "FF003366" }, patternType: "solid" },
    font: { bold: true, color: { rgb: "FFFFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
  };

  // Add headers (row 1)
  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const cellRef = `${cols[colIdx]}1`;
    ws[cellRef] = { v: headers[colIdx], t: "s", s: headerStyle };
  }

  // Add data rows with styling
  for (let rowIdx = 0; rowIdx < templateData.length; rowIdx++) {
    const row = templateData[rowIdx];
    const excelRow = rowIdx + 2;
    const categoryName = row.Category;
    const categoryColor = categoryColors[categoryName] || "E8F4F8";

    // Define fills for this row
    const categoryStyle = {
      fill: { fgColor: { rgb: `FF${categoryColor}` }, patternType: "solid" },
    };

    const greenStyle = {
      fill: { fgColor: { rgb: "FF90EE90" }, patternType: "solid" },
      font: { bold: true, color: { rgb: "FF000000" } },
    };

    const blueStyle = {
      fill: { fgColor: { rgb: "FF87CEEB" }, patternType: "solid" },
      font: { bold: true, color: { rgb: "FF000000" } },
    };

    // Category column (A)
    ws[`A${excelRow}`] = { v: row.Category, t: "s", s: categoryStyle };

    // Description column (B)
    ws[`B${excelRow}`] = { v: row.Description, t: "s", s: categoryStyle };

    // Test Name column (C) - GREEN
    ws[`C${excelRow}`] = { v: row["Test Name"], t: "s", s: greenStyle };

    // Price column (D) - BLUE
    ws[`D${excelRow}`] = { v: row.Price, t: "n", s: blueStyle };

    // Test Description column (E)
    ws[`E${excelRow}`] = { v: row["Test Description"], t: "s", s: categoryStyle };
  }

  // Set range for data
  ws["!ref"] = `A1:E${templateData.length + 1}`;

  XLSX.utils.book_append_sheet(workbook, ws, "Template");

  return workbook;
}
