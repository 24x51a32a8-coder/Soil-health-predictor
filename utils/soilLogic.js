// ============================================
// Soil analysis logic.
// Reference ranges follow commonly used Indian Soil Health Card
// categories (Low / Normal / High). Adjust these to match your
// local soil-testing lab's standards if needed.
// ============================================

const RANGES = {
  ph: { low: 6.5, high: 7.5, unit: '' },
  ec: { low: 0.8, high: 1.6, unit: 'dS/m' },
  oc: { low: 0.5, high: 0.75, unit: '%' },
  n: { low: 280, high: 560, unit: 'kg/ha' },
  p: { low: 10, high: 25, unit: 'kg/ha' },
  k: { low: 110, high: 280, unit: 'kg/ha' },
  s: { low: 10, high: 20, unit: 'ppm' },
  zn: { low: 0.6, high: 1.2, unit: 'ppm' },
  b: { low: 0.5, high: 1.0, unit: 'ppm' },
  fe: { low: 4.5, high: 9.0, unit: 'ppm' },
  mn: { low: 2.0, high: 5.0, unit: 'ppm' },
  cu: { low: 0.2, high: 0.5, unit: 'ppm' }
};

const LABELS = {
  ph: 'Soil pH', ec: 'Electrical Conductivity', oc: 'Organic Carbon',
  n: 'Nitrogen (N)', p: 'Phosphorus (P)', k: 'Potassium (K)',
  s: 'Sulphur (S)', zn: 'Zinc (Zn)', b: 'Boron (B)',
  fe: 'Iron (Fe)', mn: 'Manganese (Mn)', cu: 'Copper (Cu)'
};

const SOLUTIONS = {
  ph_low: { reason: 'Soil is too acidic, which limits nutrient availability to roots.', fertilizer: 'Agricultural lime (calcium carbonate)', quantity: '200-400 kg/acre depending on severity', priority: 'High', expected: 'pH rises toward neutral within one cropping season' },
  ph_high: { reason: 'Soil is too alkaline, reducing micronutrient uptake.', fertilizer: 'Gypsum (calcium sulphate) + organic matter', quantity: '200-300 kg/acre', priority: 'High', expected: 'Gradual reduction in alkalinity over 2-3 seasons' },
  ec_high: { reason: 'High salt concentration stresses roots and reduces germination.', fertilizer: 'Improve drainage, apply gypsum, flush with fresh irrigation', quantity: 'As per drainage plan', priority: 'High', expected: 'Reduced salinity after proper leaching' },
  oc_low: { reason: 'Low organic carbon means poor soil structure and nutrient retention.', fertilizer: 'Farmyard manure / compost / green manure', quantity: '2-4 tonnes/acre', priority: 'Medium', expected: 'Improved soil structure and fertility over 1-2 seasons' },
  n_low: { reason: 'Nitrogen deficiency limits vegetative growth and leaf development.', fertilizer: 'Urea (46% N)', quantity: '50-65 kg/acre in split doses', priority: 'High', expected: 'Visible improvement in plant growth within 2-3 weeks' },
  n_high: { reason: 'Excess nitrogen causes excessive vegetative growth, delayed maturity, pest susceptibility.', fertilizer: 'Reduce nitrogen application; balance with P and K', quantity: 'Skip next 1-2 nitrogen doses', priority: 'Medium', expected: 'Balanced growth in following season' },
  p_low: { reason: 'Phosphorus deficiency stunts root development and delays flowering.', fertilizer: 'Single Super Phosphate (SSP) or DAP', quantity: '40-50 kg/acre at sowing', priority: 'High', expected: 'Stronger root system and improved flowering' },
  p_high: { reason: 'Excess phosphorus can lock up micronutrients like zinc and iron.', fertilizer: 'Avoid further phosphatic fertilizer this season', quantity: 'None required', priority: 'Low', expected: 'Levels normalize naturally over time' },
  k_low: { reason: 'Potassium deficiency weakens stems and reduces disease resistance.', fertilizer: 'Muriate of Potash (MOP)', quantity: '30-40 kg/acre', priority: 'High', expected: 'Improved stem strength and fruit quality' },
  k_high: { reason: 'Excess potassium can interfere with magnesium and calcium uptake.', fertilizer: 'Skip potash application this season', quantity: 'None required', priority: 'Low', expected: 'Balanced nutrient uptake in next cycle' },
  s_low: { reason: 'Sulphur deficiency reduces protein synthesis and oil content in crops.', fertilizer: 'Gypsum or Ammonium Sulphate', quantity: '20-25 kg/acre', priority: 'Medium', expected: 'Improved chlorophyll and oil content' },
  s_high: { reason: 'Excess sulphur is uncommon but can affect soil pH balance.', fertilizer: 'Avoid sulphur-based fertilizers', quantity: 'None required', priority: 'Low', expected: 'Levels stabilize naturally' },
  zn_low: { reason: 'Zinc deficiency causes stunted growth and interveinal yellowing.', fertilizer: 'Zinc Sulphate', quantity: '10 kg/acre (soil) or 0.5% foliar spray', priority: 'Medium', expected: 'Greener leaves within 2 weeks' },
  zn_high: { reason: 'Excess zinc can be toxic and interfere with iron uptake.', fertilizer: 'Avoid zinc application', quantity: 'None required', priority: 'Low', expected: 'Self-corrects over time' },
  b_low: { reason: 'Boron deficiency affects flower and fruit set.', fertilizer: 'Borax', quantity: '4-5 kg/acre', priority: 'Medium', expected: 'Improved flowering and fruit set' },
  b_high: { reason: 'Excess boron is toxic to most crops.', fertilizer: 'Leach soil with irrigation water, avoid boron inputs', quantity: 'As per irrigation plan', priority: 'High', expected: 'Toxicity symptoms reduce over 1-2 seasons' },
  fe_low: { reason: 'Iron deficiency causes yellowing between leaf veins (chlorosis).', fertilizer: 'Ferrous Sulphate', quantity: '25 kg/acre (soil) or foliar spray', priority: 'Medium', expected: 'Greener foliage within 10-15 days' },
  fe_high: { reason: 'Excess iron is uncommon but can occur in waterlogged soils.', fertilizer: 'Improve drainage', quantity: 'N/A', priority: 'Low', expected: 'Levels normalize with better drainage' },
  mn_low: { reason: 'Manganese deficiency reduces photosynthesis efficiency.', fertilizer: 'Manganese Sulphate', quantity: '10 kg/acre', priority: 'Low', expected: 'Improved leaf color and vigor' },
  mn_high: { reason: 'Excess manganese can be toxic in acidic soils.', fertilizer: 'Apply lime to raise pH slightly', quantity: 'As per pH correction plan', priority: 'Medium', expected: 'Reduced toxicity as pH normalizes' },
  cu_low: { reason: 'Copper deficiency affects enzyme activity and grain formation.', fertilizer: 'Copper Sulphate', quantity: '5 kg/acre', priority: 'Low', expected: 'Improved grain filling' },
  cu_high: { reason: 'Excess copper can be toxic to soil microorganisms.', fertilizer: 'Avoid copper-based fungicides/fertilizers', quantity: 'None required', priority: 'Low', expected: 'Levels normalize over time' }
};

function classify(nutrient, value) {
  const r = RANGES[nutrient];
  if (value === undefined || value === null || isNaN(value)) return null;
  const v = parseFloat(value);
  if (v < r.low) return 'low';
  if (v > r.high) return 'high';
  return 'normal';
}

function analyzeSoil(soilData) {
  const status = {};
  const solutions = [];
  let normalCount = 0;
  let total = 0;

  for (const nutrient of Object.keys(RANGES)) {
    const value = soilData[nutrient];
    const level = classify(nutrient, value);
    if (level === null) continue;
    total++;
    status[nutrient] = level;
    if (level === 'normal') {
      normalCount++;
    } else {
      const key = `${nutrient}_${level}`;
      const sol = SOLUTIONS[key];
      if (sol) {
        solutions.push({
          nutrient,
          label: LABELS[nutrient],
          level,
          value,
          unit: RANGES[nutrient].unit,
          problem: `${LABELS[nutrient]} is ${level}`,
          ...sol
        });
      }
    }
  }

  const score = total > 0 ? Math.round((normalCount / total) * 100) : 0;

  return { status, solutions, score };
}

module.exports = { analyzeSoil, RANGES, LABELS };
