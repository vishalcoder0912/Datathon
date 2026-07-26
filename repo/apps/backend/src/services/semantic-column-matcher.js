import { buildSchemaSummary } from './ollama/dataset-schema-summary.js';

export const SEMANTIC_ALIASES = {
  // Gender
  male: ['gender', 'sex', 'male', 'female'],
  female: ['gender', 'sex', 'male', 'female'],
  gender: ['gender', 'sex'],
  sex: ['gender', 'sex'],
  
  // Pay / Salary
  salary: ['salary', 'salary_usd', 'pay', 'income', 'compensation', 'wage', 'earnings'],
  pay: ['salary', 'salary_usd', 'pay', 'income', 'compensation', 'wage', 'earnings'],
  income: ['salary', 'salary_usd', 'pay', 'income', 'compensation', 'wage', 'earnings'],
  compensation: ['salary', 'salary_usd', 'pay', 'income', 'compensation', 'wage', 'earnings'],
  wage: ['salary', 'salary_usd', 'pay', 'income', 'compensation', 'wage', 'earnings'],
  earnings: ['salary', 'salary_usd', 'pay', 'income', 'compensation', 'wage', 'earnings'],
  
  // Geography
  country: ['country', 'region', 'nation', 'location', 'state', 'city'],
  nation: ['country', 'region', 'nation', 'location', 'state', 'city'],
  region: ['country', 'region', 'nation', 'location', 'state', 'city'],
  location: ['country', 'region', 'nation', 'location', 'state', 'city'],
  city: ['country', 'region', 'nation', 'location', 'state', 'city'],
  state: ['country', 'region', 'nation', 'location', 'state', 'city'],
  
  // Other common fields
  age: ['age', 'years'],
  education: ['education', 'degree', 'qualification', 'study'],
  degree: ['education', 'degree', 'qualification', 'study'],
  qualification: ['education', 'degree', 'qualification', 'study'],
  experience: ['experience', 'work_experience', 'years_experience', 'tenure'],
  tenure: ['experience', 'work_experience', 'years_experience', 'tenure'],
  
  // Financials
  revenue: ['revenue', 'sales', 'turnover', 'amount', 'price'],
  sales: ['revenue', 'sales', 'turnover', 'amount', 'price'],
  amount: ['revenue', 'sales', 'turnover', 'amount', 'price', 'cost'],
  cost: ['cost', 'expense', 'price'],
  price: ['price', 'cost', 'amount'],
  
  // Time/Date
  date: ['date', 'time', 'year', 'month', 'created_at', 'updated_at', 'timestamp'],
  time: ['date', 'time', 'year', 'month', 'created_at', 'updated_at', 'timestamp'],
  year: ['year', 'date'],
  month: ['month', 'date'],
};

function normalize(str = '') {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function matchColumn(query = '', schemaColumns = []) {
  const queryLower = query.toLowerCase();
  // Tokenize the query
  const tokens = queryLower.split(/[^a-z0-9]+/).filter(Boolean);

  let bestMatch = null;
  let highestScore = 0;

  for (const col of schemaColumns) {
    const colNameNorm = normalize(col.name);
    let score = 0;

    // Direct match check
    if (tokens.includes(colNameNorm)) {
      score += 15;
    } else if (tokens.some(t => colNameNorm.includes(t) || t.includes(colNameNorm))) {
      score += 8;
    }

    // Alias checks
    for (const token of tokens) {
      const aliases = SEMANTIC_ALIASES[token];
      if (aliases) {
        for (const alias of aliases) {
          const aliasNorm = normalize(alias);
          if (colNameNorm === aliasNorm) {
            score += 12;
          } else if (colNameNorm.includes(aliasNorm) || aliasNorm.includes(colNameNorm)) {
            score += 6;
          }
        }
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = col;
    }
  }

  // Return the best match if score is reasonable, otherwise null
  return highestScore > 0 ? { column: bestMatch, score: highestScore } : null;
}

export function buildCompactSchemaPacket(dataset) {
  const schema = buildSchemaSummary(dataset);
  return {
    datasetName: schema.datasetName,
    rowCount: schema.rowCount,
    columns: schema.columns.map(col => ({
      name: col.name,
      role: col.role,
      type: col.type,
      uniqueCount: col.uniqueCount,
      topValues: col.role === 'dimension' ? col.topValues.slice(0, 5).map(v => v.value) : undefined
    }))
  };
}
