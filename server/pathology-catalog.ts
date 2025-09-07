import fs from 'fs';
import path from 'path';

// Load pathology catalog from JSON file
const catalogPath = path.join(__dirname, 'pathology-catalog.json');
let pathologyCatalogData: any;

try {
  const catalogJson = fs.readFileSync(catalogPath, 'utf8');
  pathologyCatalogData = JSON.parse(catalogJson);
} catch (error) {
  console.error('Error loading pathology catalog:', error);
  pathologyCatalogData = { categories: [] };
}

export const pathologyCatalog = pathologyCatalogData;

export interface PathologyTestCatalog {
  test_name: string;
  price: number;
  category: string;
  subtests: any[];
}

export function getAllPathologyTests(): PathologyTestCatalog[] {
  const allTests: PathologyTestCatalog[] = [];

  pathologyCatalog.categories.forEach((category: any) => {
    category.tests.forEach((test: any) => {
      allTests.push({
        ...test,
        category: category.name
      });
    });
  });

  return allTests;
}

export function getTestsByCategory(categoryName: string): PathologyTestCatalog[] {
  const category = pathologyCatalog.categories.find((cat: any) => cat.name === categoryName);
  if (!category) return [];

  return category.tests.map((test: any) => ({
    ...test,
    category: categoryName
  }));
}

export function getTestByName(testName: string): PathologyTestCatalog | undefined {
  for (const category of pathologyCatalog.categories) {
    const test = category.tests.find((t: any) => t.test_name === testName);
    if (test) {
      return {
        ...test,
        category: category.name
      };
    }
  }
  return undefined;
}

export function getCategories(): string[] {
  return pathologyCatalog.categories.map((cat: any) => cat.name);
}

// Function to add a new category to the JSON file
export function addCategoryToFile(categoryName: string, description?: string): void {
  try {
    const newCategory = {
      name: categoryName,
      description: description || '',
      tests: []
    };

    pathologyCatalog.categories.push(newCategory);

    fs.writeFileSync(catalogPath, JSON.stringify(pathologyCatalog, null, 2));
  } catch (error) {
    console.error('Error adding category to file:', error);
    throw error;
  }
}

// Function to add a new test to a category in the JSON file
export function addTestToFile(categoryName: string, testData: any): void {
  try {
    const categoryIndex = pathologyCatalog.categories.findIndex((cat: any) => cat.name === categoryName);

    if (categoryIndex === -1) {
      throw new Error(`Category "${categoryName}" not found`);
    }

    pathologyCatalog.categories[categoryIndex].tests.push({
      test_name: testData.test_name,
      price: testData.price,
      subtests: testData.subtests || []
    });

    fs.writeFileSync(catalogPath, JSON.stringify(pathologyCatalog, null, 2));
  } catch (error) {
    console.error('Error adding test to file:', error);
    throw error;
  }
}