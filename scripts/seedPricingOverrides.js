#!/usr/bin/env node

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const sequelize = require("../config/database");
const { PricingOverride } = require("../models");
const logger = require("../utils/logger");

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function seedPricing(overrides, options = { overwrite: true }) {
  try {
    await sequelize.authenticate();

    // Ensure table exists
    await PricingOverride.sync({ alter: true });

    let created = 0;
    let updated = 0;
    for (const item of overrides) {
      const [row, isCreated] = await PricingOverride.findOrCreate({
        where: { service_code: item.service_code, country_id: item.country_id },
        defaults: {
          price: item.price,
          currency: item.currency || "USD",
          enabled: item.enabled ?? true,
          notes: item.notes || null,
        },
      });

      if (!isCreated) {
        if (options.overwrite) {
          await row.update({
            price: item.price,
            currency: item.currency || row.currency,
            enabled: item.enabled ?? row.enabled,
            notes: item.notes || row.notes,
            updated_at: new Date(),
          });
          updated += 1;
        }
      } else {
        created += 1;
      }
    }

    logger.info(
      `✅ Pricing overrides seeded. New: ${created}, Updated: ${updated}, Total processed: ${overrides.length}`
    );
  } catch (error) {
    logger.error("❌ Failed to seed pricing overrides:", error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

function loadJson(filePath) {
  const full = path.resolve(__dirname, "..", filePath);
  const raw = fs.readFileSync(full, "utf8");
  return JSON.parse(raw);
}

function buildOverridesFromClientJson({ basePrice = 0.5 } = {}) {
  const servicesJson = loadJson("client/src/data/services.json");
  const countriesJson = loadJson("client/src/data/countries.json");

  const overrides = [];

  // services.json is an array of categories, each with services[]
  const serviceItems = [];
  if (Array.isArray(servicesJson)) {
    for (const cat of servicesJson) {
      if (Array.isArray(cat.services)) {
        for (const s of cat.services) {
          if (s && s.code) {
            // Use s.price if provided; else basePrice
            const price = typeof s.price === "number" ? s.price : parseFloat(s.price) || basePrice;
            serviceItems.push({ code: s.code, basePrice: price });
          }
        }
      }
    }
  }

  // countries.json is an array of countries with id and price_multiplier
  const countryItems = Array.isArray(countriesJson)
    ? countriesJson.map((c) => ({ id: c.id, price_multiplier: c.price_multiplier || 1.0 }))
    : [];

  for (const svc of serviceItems) {
    for (const c of countryItems) {
      const finalPrice = round2((svc.basePrice || basePrice) * (c.price_multiplier || 1));
      overrides.push({
        service_code: svc.code,
        country_id: c.id,
        price: finalPrice,
        currency: "USD",
        enabled: true,
      });
    }
  }

  return overrides;
}

function parseArgs(argv) {
  const args = new Set(argv);
  return {
    fromJson: args.has("--from-json"),
    overwrite: args.has("--no-overwrite") ? false : true,
    basePrice: (() => {
      const idx = argv.indexOf("--base-price");
      if (idx !== -1 && argv[idx + 1]) return parseFloat(argv[idx + 1]);
      return 0.5;
    })(),
  };
}

// CLI
if (require.main === module) {
  const argv = process.argv.slice(2);
  const opts = parseArgs(argv);

  if (opts.fromJson) {
    const data = buildOverridesFromClientJson({ basePrice: opts.basePrice });
    seedPricing(data, { overwrite: opts.overwrite });
  } else {
    console.log(
      "Usage: node scripts/seedPricingOverrides.js --from-json [--base-price 0.5] [--no-overwrite]"
    );
    console.log("This will read client/src/data/services.json and countries.json and seed the DB.");
    process.exit(0);
  }
}

module.exports = { seedPricing, buildOverridesFromClientJson };


