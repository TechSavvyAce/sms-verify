// Import data from JSON files
import servicesData from "./services.json";
import countriesData from "./countries.json";
import rentalServicesData from "./rental-services.json";
import durationOptionsData from "./duration-options.json";

// Service categories from JSON
export const serviceCategories = servicesData;

// Countries from JSON
export const countries = countriesData;

// Rental services from JSON
export const rentalServices = rentalServicesData;

// Duration options from JSON
export const durationOptions = durationOptionsData;

// Service statuses
export const serviceStatuses = {
  PENDING: "pending",
  ACTIVE: "active",
  COMPLETED: "completed",
  FAILED: "failed",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
};

// Service types
export const serviceTypes = {
  ACTIVATION: "activation",
  RENTAL: "rental",
};

// Utility function to fix floating-point precision issues
const roundToTwoDecimals = (num: number): number => {
  return Math.round(num * 100) / 100;
};

// Price calculation function
export const calculatePrice = (
  basePrice: number,
  duration: number,
  countryMultiplier: number = 1.0
): number => {
  let durationMultiplier = 1.0;

  if (duration > 72) durationMultiplier = 7.0;
  else if (duration > 48) durationMultiplier = 5.0;
  else if (duration > 24) durationMultiplier = 3.0;
  else if (duration > 12) durationMultiplier = 2.0;
  else if (duration > 6) durationMultiplier = 1.5;

  const result = basePrice * durationMultiplier * countryMultiplier;
  return roundToTwoDecimals(result);
};

// Get service information by ID
export const getServiceById = (serviceId: string) => {
  for (const category of serviceCategories) {
    const service = category.services.find((s: any) => s.code === serviceId);
    if (service)
      return {
        ...service,
        category: category.name,
        category_cn: category.name_cn,
      };
  }
  return null;
};

// Get rental service information by ID
export const getRentalServiceById = (serviceId: string) => {
  return rentalServices.find((s: any) => s.code === serviceId) || null;
};

// Get country information by ID
export const getCountryById = (countryId: string) => {
  return countries.find((c: any) => c.id === countryId) || null;
};

// Get services by category
export const getServicesByCategory = (categoryCode: string) => {
  const category = serviceCategories.find((c: any) => c.code === categoryCode);
  return category ? category.services : [];
};

// Get popular services (high popularity)
export const getPopularServices = () => {
  const popularServices: any[] = [];
  serviceCategories.forEach((category) => {
    const popular = category.services.filter(
      (s: any) => s.popularity === "high"
    );
    popularServices.push(
      ...popular.map((s) => ({
        ...s,
        category: category.name,
        category_cn: category.name_cn,
      }))
    );
  });
  return popularServices;
};

// Get services by difficulty
export const getServicesByDifficulty = (difficulty: string) => {
  const services: any[] = [];
  serviceCategories.forEach((category) => {
    const filtered = category.services.filter(
      (s: any) => s.difficulty === difficulty
    );
    services.push(
      ...filtered.map((s) => ({
        ...s,
        category: category.name,
        category_cn: category.name_cn,
      }))
    );
  });
  return services;
};

// Get countries by region
export const getCountriesByRegion = (region: string) => {
  return countries.filter((c: any) => c.region === region);
};

// Get popular countries
export const getPopularCountries = () => {
  return countries.filter((c: any) => c.popularity === "high");
};

// Search services by name or code
export const searchServices = (query: string) => {
  const results: any[] = [];
  const lowerQuery = query.toLowerCase();

  serviceCategories.forEach((category) => {
    const matches = category.services.filter(
      (s: any) =>
        s.name.toLowerCase().includes(lowerQuery) ||
        s.name_cn.toLowerCase().includes(lowerQuery) ||
        s.code.toLowerCase().includes(lowerQuery)
    );
    results.push(
      ...matches.map((s) => ({
        ...s,
        category: category.name,
        category_cn: category.name_cn,
      }))
    );
  });

  return results;
};

// Get service statistics
export const getServiceStats = () => {
  const totalServices = serviceCategories.reduce(
    (acc, cat) => acc + cat.services.length,
    0
  );
  const totalCategories = serviceCategories.length;
  const totalCountries = countries.length;

  const avgPrice =
    serviceCategories.reduce((acc, cat) => {
      const catAvg =
        cat.services.reduce((sum, s) => sum + s.price, 0) / cat.services.length;
      return acc + catAvg;
    }, 0) / totalCategories;

  return {
    totalServices,
    totalCategories,
    totalCountries,
    averagePrice: avgPrice.toFixed(2),
  };
};
