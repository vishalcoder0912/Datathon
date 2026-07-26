// apps/backend/src/kavach/services/profiler.js
// KAVACH Schema Profiler and Semantic Column Classifier

export function profileColumn(sourceName, values, totalRows) {
  const nonNulls = values.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
  const nullCount = totalRows - nonNulls.length;
  const nullablePercentage = totalRows > 0 ? (nullCount / totalRows) * 100 : 0;
  
  const uniqueValues = [...new Set(nonNulls)];
  const uniquenessPercentage = totalRows > 0 ? (uniqueValues.length / totalRows) * 100 : 0;
  const sampleValues = uniqueValues.slice(0, 10);
  
  // Inferred data type detection
  let inferredDataType = 'string';
  let isNumeric = nonNulls.length > 0 && nonNulls.every(v => !isNaN(Number(v)));
  let isBoolean = nonNulls.length > 0 && nonNulls.every(v => {
    const s = String(v).toLowerCase().trim();
    return s === 'true' || s === 'false' || s === '1' || s === '0' || s === 'y' || s === 'n';
  });
  let isDate = nonNulls.length > 0 && nonNulls.every(v => {
    const d = Date.parse(String(v));
    return !isNaN(d) && isNaN(Number(v)) && String(v).includes('-');
  });

  if (isNumeric) inferredDataType = 'number';
  else if (isBoolean) inferredDataType = 'boolean';
  else if (isDate) inferredDataType = 'date';

  // Math stats
  let min = null;
  let max = null;
  let avg = null;
  if (inferredDataType === 'number' && nonNulls.length > 0) {
    const nums = nonNulls.map(Number);
    min = Math.min(...nums);
    max = Math.max(...nums);
    avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  }

  // Date range
  let dateRange = null;
  if (inferredDataType === 'date' && nonNulls.length > 0) {
    const dates = nonNulls.map(v => new Date(v).getTime());
    dateRange = {
      start: new Date(Math.min(...dates)).toISOString().split('T')[0],
      end: new Date(Math.max(...dates)).toISOString().split('T')[0]
    };
  }

  const normalizedName = sourceName.toLowerCase().replace(/[\s_-]/g, '');

  // Geographic format & semantic meaning
  let geographicFormat = null;
  let detectedSemanticMeaning = 'IGNORED';
  let confidenceScore = 0.0;
  let possibleForeignKeyRole = null;
  let isLikelyIdentifier = false;
  let isPotentialPII = false;

  // Semantic column classification
  if (normalizedName.includes('fir') || normalizedName.includes('crimeno') || normalizedName.includes('caseno') || normalizedName.includes('incidentid')) {
    detectedSemanticMeaning = 'fir_number';
    confidenceScore = 0.95;
    isLikelyIdentifier = true;
  } else if (normalizedName.includes('date') || normalizedName.includes('occurred')) {
    detectedSemanticMeaning = 'incident_date';
    confidenceScore = 0.90;
  } else if (normalizedName.includes('time')) {
    detectedSemanticMeaning = 'incident_time';
    confidenceScore = 0.90;
  } else if (normalizedName.includes('district')) {
    detectedSemanticMeaning = 'district';
    confidenceScore = 0.95;
    geographicFormat = 'district';
  } else if (normalizedName.includes('station') || normalizedName.includes('psname')) {
    detectedSemanticMeaning = 'police_station';
    confidenceScore = 0.95;
    geographicFormat = 'police_station';
  } else if (normalizedName.includes('latitude') || normalizedName.includes('lat')) {
    detectedSemanticMeaning = 'latitude';
    confidenceScore = 0.95;
    geographicFormat = 'latitude';
  } else if (normalizedName.includes('longitude') || normalizedName.includes('lng') || normalizedName.includes('long')) {
    detectedSemanticMeaning = 'longitude';
    confidenceScore = 0.95;
    geographicFormat = 'longitude';
  } else if (normalizedName.includes('category') || normalizedName.includes('crimetype')) {
    detectedSemanticMeaning = 'crime_type';
    confidenceScore = 0.90;
  } else if (normalizedName.includes('modus') || normalizedName.includes('mo')) {
    detectedSemanticMeaning = 'modus_operandi';
    confidenceScore = 0.90;
  } else if (normalizedName.includes('severity')) {
    detectedSemanticMeaning = 'severity';
    confidenceScore = 0.90;
  } else if (normalizedName.includes('status')) {
    detectedSemanticMeaning = 'status';
    confidenceScore = 0.90;
  } else if (normalizedName.includes('description') || normalizedName.includes('facts')) {
    detectedSemanticMeaning = 'description';
    confidenceScore = 0.90;
  } else if (normalizedName.includes('accused') || normalizedName.includes('suspect')) {
    detectedSemanticMeaning = 'accused_name';
    confidenceScore = 0.85;
    isPotentialPII = true;
  } else if (normalizedName.includes('victim')) {
    detectedSemanticMeaning = 'victim_name';
    confidenceScore = 0.85;
    isPotentialPII = true;
  } else if (normalizedName.includes('phone') || normalizedName.includes('mobile')) {
    detectedSemanticMeaning = 'phone';
    confidenceScore = 0.90;
    isPotentialPII = true;
  } else if (normalizedName.includes('vehicle') || normalizedName.includes('registration')) {
    detectedSemanticMeaning = 'vehicle';
    confidenceScore = 0.90;
    isPotentialPII = true;
  }

  // Failsafe for potential PII
  if (normalizedName.includes('name') || normalizedName.includes('phone') || normalizedName.includes('mobile') || normalizedName.includes('address') || normalizedName.includes('dob') || normalizedName.includes('age')) {
    isPotentialPII = true;
  }

  // FK role suggestions
  if (normalizedName.endsWith('id') || normalizedName.endsWith('code')) {
    possibleForeignKeyRole = sourceName;
  }

  return {
    sourceName,
    normalizedName: sourceName.toLowerCase().replace(/[\s-]/g, '_'),
    inferredDataType,
    nullablePercentage: Number(nullablePercentage.toFixed(2)),
    uniquenessPercentage: Number(uniquenessPercentage.toFixed(2)),
    sampleValues,
    min: min !== null ? Number(min.toFixed(2)) : null,
    max: max !== null ? Number(max.toFixed(2)) : null,
    avg: avg !== null ? Number(avg.toFixed(2)) : null,
    dateRange,
    geographicFormat,
    isLikelyIdentifier,
    possibleForeignKeyRole,
    isPotentialPII,
    confidenceScore,
    detectedSemanticMeaning
  };
}

export function profileDataset(rows) {
  if (!rows || rows.length === 0) return [];
  const columns = Object.keys(rows[0]);
  return columns.map(col => {
    const values = rows.map(r => r[col]);
    return profileColumn(col, values, rows.length);
  });
}
