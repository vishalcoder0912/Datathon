import {
  humanize,
  normalizeDimensionLabel,
  normalizeText,
  sortLabels,
} from "@insightflow/shared-analytics";
import type { ChartConfig,DataColumn,Dataset,DatasetRow,KPI } from "@/features/data/model/dataStore";

export interface ValidationSummary {
  totalRows:number;
  validRows:number;
  missingPercentage:number;
  duplicateCount:number;
  outlierCount:number;
}

export interface DataValidationResult {
  cleanedDataset:Dataset;
  validationSummary:ValidationSummary;
  missingByColumn:Record<string,number>;
  outlierColumns:Record<string,number>;
}

export interface DashboardMetricSummary {
  integrityScore:number;
  riskLevel:"LOW"|"MEDIUM"|"HIGH";
  missingPercentage:number;
  duplicateCount:number;
  outlierCount:number;
  validRows:number;
  totalRows:number;
}

export interface AnalyticsHealthSummary {
  validation:ValidationSummary;
  missingByColumn:Record<string,number>;
  outlierColumns:Record<string,number>;
  metrics:DashboardMetricSummary;
}

export interface AnalyticsDashboardBundle {
  cleanedDataset:Dataset;
  validationSummary:ValidationSummary;
  charts:ChartConfig[];
  kpis:KPI[];
  insights:string[];
  health:AnalyticsHealthSummary;
  structuredData:{
    salaryByCountry:Array<Record<string,string|number>>;
    experienceByCountry:Array<Record<string,string|number>>;
    languages:Array<Record<string,string|number>>;
    educationDistribution:Array<Record<string,string|number>>;
    salaryByEducation:Array<Record<string,string|number>>;
    experienceSalaryScatter:Array<Record<string,string|number>>;
  };
}

export interface SmartKPI {
  id:string;
  title:string;
  value:string;
  delta?:string;
  trend?:"up"|"down"|"stable";
  status:"good"|"warning"|"critical"|"stable";
  insight:string;
  priority:number;
  icon:string;
}

const EMPTY_TEXT_VALUES = new Set(["","n/a","na","null","undefined","none","nil","unknown","not available","-","--"]);
const EDUCATION_ORDER = [
  "No Formal Education",
  "Primary School",
  "Secondary School",
  "High School",
  "Diploma",
  "Associate",
  "Bachelor",
  "Master",
  "MBA",
  "Professional",
  "Doctorate",
  "PhD",
  "Postdoc",
];

const NUMERIC_HINTS = {
  salary:["salary","compensation","income","pay","wage","earnings","remuneration","ctc"],
  experience:["experience","years_experience","years of experience","yoe","exp"],
  country:["country","location","nation","region"],
  education:["education","degree","qualification","academic"],
  languages:["language","languages","programming_language","programming_languages","tech_stack","skills"],
};

const roundTo = (value:number,decimals:number=2)=>{
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const detectOutliers = (values:number[])=>{
  if (values.length < 4) return { outlierCount:0, extremeHigh:0, extremeLow:0 };
  const sorted = [...values].sort((a,b)=>a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  const extremeLower = q1 - 3 * iqr;
  const extremeUpper = q3 + 3 * iqr;
  
  const outliers = values.filter((v)=> v < lower || v > upper);
  const extremeHigh = values.filter((v)=> v > extremeUpper).length;
  const extremeLow = values.filter((v)=> v < extremeLower).length;
  
  return {
    outlierCount:outliers.length,
    extremeHigh,
    extremeLow,
  };
};

const linearRegression = (pairs:Array<{x:number; y:number}>)=>{
  if (pairs.length < 2) return { slope:0, intercept:0, r2:0 };
  
  const n = pairs.length;
  const sumX = pairs.reduce((s,p)=>s + p.x,0);
  const sumY = pairs.reduce((s,p)=>s + p.y,0);
  const sumXY = pairs.reduce((s,p)=>s + p.x * p.y,0);
  const sumX2 = pairs.reduce((s,p)=>s + p.x ** 2,0);
  const sumY2 = pairs.reduce((s,p)=>s + p.y ** 2,0);
  
  const denominator = n * sumX2 - sumX ** 2;
  if (denominator === 0) return { slope:0, intercept:0, r2:0 };
  
  const slope = roundTo((n * sumXY - sumX * sumY) / denominator,2);
  const intercept = roundTo((sumY - slope * sumX) / n,2);
  
  const meanY = sumY / n;
  const ssTotal = pairs.reduce((s,p)=>s + (p.y - meanY) ** 2,0);
  const ssRes = pairs.reduce((s,p)=>s + (p.y - (slope * p.x + intercept)) ** 2,0);
  const r2 = ssTotal > 0 ? roundTo(1 - ssRes / ssTotal,3) : 0;
  
  return { slope, intercept, r2 };
};

const predictSalary = (experience:number, slope:number, intercept:number)=>{
  return roundTo(slope * experience + intercept);
};

const computeCorrelation = (pairs:Array<{x:number; y:number}>)=>{
  if (pairs.length < 2) return null;
  const { r2 } = linearRegression(pairs);
  const sign = linearRegression(pairs).slope >= 0 ? 1 : -1;
  return sign * Math.sqrt(Math.abs(r2));
};

const correlationInsight = (corr:number | null)=>{
  if (corr == null) return "Correlation unavailable — insufficient data pairs";
  if (Math.abs(corr) > 0.7) return corr > 0 ? "Strong positive correlation — experience heavily impacts salary" : "Strong negative correlation detected";
  if (Math.abs(corr) > 0.4) return corr > 0 ? "Moderate positive correlation — salary generally rises with experience" : "Moderate negative correlation";
  if (Math.abs(corr) > 0.2) return corr > 0 ? "Weak positive correlation — other factors drive salary" : "Weak negative correlation";
  return "No meaningful linear relationship between experience and salary";
};

type Segment = "Junior" | "Mid" | "Senior";
const segmentByExperience = (years:number):Segment=>{
  if (years <= 3) return "Junior";
  if (years <= 8) return "Mid";
  return "Senior";
};

const segmentData = (rows:DatasetRow[], expCol:string, salCol:string)=>{
  const groups:Record<Segment, {total:number; count:number}> = {
    Junior:{total:0,count:0},
    Mid:{total:0,count:0},
    Senior:{total:0,count:0},
  };
  
  rows.forEach((row)=>{
    const exp = Number(row[expCol]);
    const sal = Number(row[salCol]);
    if (!Number.isFinite(exp) || !Number.isFinite(sal)) return;
    const segment = segmentByExperience(exp);
    groups[segment].total += sal;
    groups[segment].count += 1;
  });
  
  return {
    Junior:groups.Junior.count > 0 ? roundTo(groups.Junior.total / groups.Junior.count) : 0,
    Mid:groups.Mid.count > 0 ? roundTo(groups.Mid.total / groups.Mid.count) : 0,
    Senior:groups.Senior.count > 0 ? roundTo(groups.Senior.total / groups.Senior.count) : 0,
    counts:groups,
  };
};

const distributionIntelligence = (values:number[])=>{
  if (values.length === 0) return { mean:0, median:0, skew:0 };
  const mean = values.reduce((s,v)=>s + v,0) / values.length;
  const sorted = [...values].sort((a,b)=>a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const skew = mean - median;
  return { mean:roundTo(mean), median:roundTo(median), skew:roundTo(skew) };
};

const generateSmartInsights = ({
  salaryByCountry,
  languageData,
  segments,
  outliers,
  slope,
  skew,
}:{
  salaryByCountry:Array<Record<string,string|number>>;
  languageData:Array<Record<string,string|number>>;
  segments:Record<Segment,number>;
  outliers:ReturnType<typeof detectOutliers>;
  slope:number;
  skew:number;
})=>{
  const insights:string[] = [];
  
  if (slope > 5000) {
    insights.push(`Salary growth accelerates after 8+ years ($${roundTo(slope)}/yr)`);
  }
  
  if (outliers.extremeHigh > 0) {
    insights.push(`${outliers.extremeHigh} extreme salary outliers inflating average`);
  }
  
  if (skew > 10000) {
    insights.push("Right-skewed — few high earners inflating average");
  }
  
  const segmentValues = Object.entries(segments).filter(([k])=>k !== "counts");
  const sortedSegs = segmentValues.sort((a,b)=>Number(b[1]) - Number(a[1]));
  if (sortedSegs.length >= 2) {
    const [top] = sortedSegs;
    const [bottom] = sortedSegs.slice(-1);
    if (Number(top[1]) > 0 && Number(bottom[1]) > 0) {
      const ratio = roundTo(Number(top[1]) / Number(bottom[1]));
      if (ratio > 1) {
        insights.push(`${top[0]} segment earns ${ratio.toFixed(1)}x more than ${bottom[0]}`);
      }
    }
  }
  
  if (salaryByCountry.length > 0) {
    const topCountry = salaryByCountry[0];
    insights.push(`${String(topCountry.country)} leads compensation at ${formatMetricValue("salary", Number(topCountry.salary_usd))}`);
  }
  
  if (languageData.length > 0) {
    const topLang = languageData[0];
    insights.push(`${String(topLang.languages)} dominates ${Number(topLang.percentage).toFixed(1)}% of tech mentions`);
  }
  
  return insights.slice(0,6);
};

const normalizeMissingValue = (value:unknown)=>{
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (EMPTY_TEXT_VALUES.has(trimmed.toLowerCase())) return null;
    return trimmed;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "boolean") return value;
  return String(value).trim() || null;
};

const parseNumericValue = (value:unknown)=>{
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed
    .replace(/[$€£₹,%]/g,"")
    .replace(/,/g,"")
    .replace(/\s+/g,"");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeRowValue = (column:DataColumn,value:unknown)=>{
  const normalized = normalizeMissingValue(value);
  if (normalized == null) return null;
  if (column.type === "number") {
    return parseNumericValue(normalized);
  }
  return normalized;
};

const normalizeRow = (row:DatasetRow,columns:DataColumn[])=>{
  const nextRow:DatasetRow = {};
  columns.forEach((column)=>{
    nextRow[column.name] = normalizeRowValue(column,row[column.name]);
  });
  if (row.__rowId != null) {
    nextRow.__rowId = row.__rowId;
  }
  return nextRow;
};

const serializeRow = (row:DatasetRow,columns:DataColumn[])=>JSON.stringify(
  columns.map((column)=>[column.name,row[column.name] ?? null]),
);

const quantile = (values:number[],ratio:number)=>{
  if (values.length === 0) return null;
  const sorted = [...values].sort((left,right)=>left - right);
  const position = (sorted.length - 1) * ratio;
  const base = Math.floor(position);
  const remainder = position - base;
  const lower = sorted[base];
  const upper = sorted[Math.min(base + 1,sorted.length - 1)];
  return lower + (upper - lower) * remainder;
};

const detectColumnOutliers = (values:number[])=>{
  if (values.length < 4) {
    return { lower:null,upper:null };
  }
  const q1 = quantile(values,0.25);
  const q3 = quantile(values,0.75);
  if (q1 == null || q3 == null) {
    return { lower:null,upper:null };
  }
  const iqr = q3 - q1;
  return {
    lower:q1 - (1.5 * iqr),
    upper:q3 + (1.5 * iqr),
  };
};

const findColumnByHints = (columns:DataColumn[],hints:string[])=>{
  for (const hint of hints) {
    const matched = columns.find((column)=>normalizeText(column.name).includes(normalizeText(hint)));
    if (matched) return matched;
  }
  return null;
};

const getNumericColumns = (dataset:Dataset)=>dataset.columns.filter((column)=>column.type === "number");
const getCategoricalColumns = (dataset:Dataset)=>dataset.columns.filter((column)=>column.type !== "number");

const average = (values:number[])=>values.length > 0 ? values.reduce((sum,value)=>sum + value,0) / values.length : 0;

const computeRiskLevel = ({ missingPercentage,duplicateCount,outlierCount,totalRows }:{
  missingPercentage:number;
  duplicateCount:number;
  outlierCount:number;
  totalRows:number;
})=>{
  const duplicateRate = totalRows > 0 ? (duplicateCount / totalRows) * 100 : 0;
  const outlierRate = totalRows > 0 ? (outlierCount / totalRows) * 100 : 0;
  const riskScore = missingPercentage + duplicateRate + outlierRate;

  if (riskScore >= 30) return "HIGH";
  if (riskScore >= 10) return "MEDIUM";
  return "LOW";
};

const countByColumn = (rows:DatasetRow[],columnName:string)=>{
  const counts = new Map<string,number>();
  rows.forEach((row)=>{
    const label = normalizeDimensionLabel(columnName,row[columnName]);
    if (!label) return;
    counts.set(label,(counts.get(label) ?? 0) + 1);
  });
  return counts;
};

export const cleanDatasetForAnalytics = (dataset:Dataset):DataValidationResult=>{
  const missingByColumn = Object.fromEntries(dataset.columns.map((column)=>[column.name,0]));
  const normalizedRows = dataset.rows.map((row)=>normalizeRow(row,dataset.columns));

  normalizedRows.forEach((row)=>{
    dataset.columns.forEach((column)=>{
      if (row[column.name] == null) {
        missingByColumn[column.name] += 1;
      }
    });
  });

  console.info("[analytics] missing values by column",missingByColumn);

  const duplicateKeys = new Set<string>();
  const dedupedRows:DatasetRow[] = [];
  let duplicateCount = 0;

  normalizedRows.forEach((row)=>{
    const hasMeaningfulValue = dataset.columns.some((column)=>row[column.name] != null);
    if (!hasMeaningfulValue) {
      return;
    }

    const key = serializeRow(row,dataset.columns);
    if (duplicateKeys.has(key)) {
      duplicateCount += 1;
      return;
    }
    duplicateKeys.add(key);
    dedupedRows.push(row);
  });

  const numericColumns = getNumericColumns(dataset);
  const salaryColumn = findColumnByHints(numericColumns,NUMERIC_HINTS.salary);
  const experienceColumn = findColumnByHints(numericColumns,NUMERIC_HINTS.experience);
  const outlierRanges = new Map<string,{ lower:number|null; upper:number|null }>();

  numericColumns.forEach((column)=>{
    const values = dedupedRows
      .map((row)=>typeof row[column.name] === "number" ? Number(row[column.name]) : null)
      .filter((value):value is number=>value != null);
    outlierRanges.set(column.name,detectColumnOutliers(values));
  });

  const outlierColumns = Object.fromEntries(numericColumns.map((column)=>[column.name,0]));
  const cleanedRows:DatasetRow[] = [];
  let outlierCount = 0;

  dedupedRows.forEach((row)=>{
    let isOutlierRow = false;

    numericColumns.forEach((column)=>{
      const value = typeof row[column.name] === "number" ? Number(row[column.name]) : null;
      if (value == null) return;

      const range = outlierRanges.get(column.name);
      const isIqrOutlier = range?.lower != null && range?.upper != null && (value < range.lower || value > range.upper);
      const isExperienceRuleOutlier = experienceColumn?.name === column.name && (value < 0 || value > 50);
      const isSalaryRuleOutlier = salaryColumn?.name === column.name && value <= 0;

      if (isIqrOutlier || isExperienceRuleOutlier || isSalaryRuleOutlier) {
        outlierColumns[column.name] += 1;
        isOutlierRow = true;
      }
    });

    if (isOutlierRow) {
      outlierCount += 1;
      return;
    }

    cleanedRows.push(row);
  });

  const totalCells = dataset.rows.length * Math.max(dataset.columns.length,1);
  const missingCount = Object.values(missingByColumn).reduce((sum,value)=>sum + value,0);
  const validationSummary:ValidationSummary = {
    totalRows:dataset.rows.length,
    validRows:cleanedRows.length,
    missingPercentage:totalCells > 0 ? roundTo((missingCount / totalCells) * 100,2) : 0,
    duplicateCount,
    outlierCount,
  };

  return {
    cleanedDataset:{
      ...dataset,
      rows:cleanedRows,
      rowCount:cleanedRows.length,
    },
    validationSummary,
    missingByColumn,
    outlierColumns,
  };
};

export const aggregateAverageByDimension = (
  rows:DatasetRow[],
  dimensionColumn:DataColumn,
  metricColumn:DataColumn,
  options?:{ normalizeByTotalEntries?:boolean },
)=>{
  const groups = new Map<string,{ total:number; count:number }>();

  rows.forEach((row)=>{
    const label = normalizeDimensionLabel(dimensionColumn.name,row[dimensionColumn.name]);
    const value = typeof row[metricColumn.name] === "number" ? Number(row[metricColumn.name]) : null;
    if (!label || value == null) return;

    const current = groups.get(label) ?? { total:0,count:0 };
    current.total += value;
    current.count += 1;
    groups.set(label,current);
  });

  const totalEntries = rows.length || 1;
  return [...groups.entries()]
    .map(([label,group])=>{
      const averageValue = group.count > 0 ? group.total / group.count : 0;
      const entry:Record<string,string|number> = {
        [dimensionColumn.name]:label,
        [metricColumn.name]:roundTo(averageValue,2),
        sampleSize:group.count,
      };
      if (options?.normalizeByTotalEntries) {
        entry.normalizedValue = roundTo(averageValue / totalEntries,4);
      }
      return entry;
    })
    .sort((left,right)=>Number(right[metricColumn.name]) - Number(left[metricColumn.name]));
};

const splitMultiValueCell = (value:unknown)=>{
  if (typeof value !== "string") return [];
  return value
    .split(/[;,/|]+/)
    .map((entry)=>entry.trim())
    .filter((entry)=>entry.length > 0);
};

export const aggregateMultivalueFrequency = (rows:DatasetRow[],column:DataColumn)=>{
  const counts = new Map<string,number>();
  rows.forEach((row)=>{
    const uniqueValues = new Set(splitMultiValueCell(row[column.name]));
    uniqueValues.forEach((entry)=>{
      counts.set(entry,(counts.get(entry) ?? 0) + 1);
    });
  });

  const total = [...counts.values()].reduce((sum,value)=>sum + value,0);
  return [...counts.entries()]
    .map(([label,count])=>({
      [column.name]:label,
      count,
      percentage:total > 0 ? roundTo((count / total) * 100,2) : 0,
    }))
    .sort((left,right)=>Number(right.count) - Number(left.count));
};

const normalizeEducationLabel = (label:string)=>{
  const normalized = normalizeText(label);
  if (normalized.includes("phd") || normalized.includes("doctor")) return "PhD";
  if (normalized.includes("master") || normalized.includes("msc") || normalized.includes("mtech")) return "Master";
  if (normalized.includes("mba")) return "MBA";
  if (normalized.includes("bachelor") || normalized.includes("bsc") || normalized.includes("btech") || normalized.includes("be ")) return "Bachelor";
  if (normalized.includes("associate")) return "Associate";
  if (normalized.includes("diploma")) return "Diploma";
  if (normalized.includes("professional")) return "Professional";
  if (normalized.includes("high school") || normalized.includes("secondary")) return "High School";
  return label.trim();
};

const compareEducationLevels = (left:string,right:string)=>{
  const leftIndex = EDUCATION_ORDER.indexOf(left);
  const rightIndex = EDUCATION_ORDER.indexOf(right);
  if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
  if (leftIndex >= 0) return -1;
  if (rightIndex >= 0) return 1;
  return left.localeCompare(right);
};

export const aggregateEducationDistribution = (rows:DatasetRow[],column:DataColumn)=>{
  const counts = new Map<string,number>();
  rows.forEach((row)=>{
    const raw = normalizeDimensionLabel(column.name,row[column.name]);
    if (!raw) return;
    const label = normalizeEducationLabel(raw);
    counts.set(label,(counts.get(label) ?? 0) + 1);
  });

  const total = [...counts.values()].reduce((sum,value)=>sum + value,0);
  return [...counts.entries()]
    .map(([label,count])=>({
      [column.name]:label,
      count,
      percentage:total > 0 ? roundTo((count / total) * 100,2) : 0,
    }))
    .sort((left,right)=>compareEducationLevels(String(left[column.name]),String(right[column.name])));
};

export const buildScatterDataset = (rows:DatasetRow[],xColumn:DataColumn,yColumn:DataColumn,labelColumn?:DataColumn|null)=>{
  return rows
    .map((row)=>{
      const xRaw = row[xColumn.name];
      const yRaw = row[yColumn.name];
      const x = xRaw != null && !isNaN(Number(xRaw)) ? Number(xRaw) : null;
      const y = yRaw != null && !isNaN(Number(yRaw)) ? Number(yRaw) : null;
      if (x == null || y == null) return null;
      return {
        [xColumn.name]:x,
        [yColumn.name]:y,
        label:labelColumn ? normalizeDimensionLabel(labelColumn.name,row[labelColumn.name]) ?? "Observation" : "Observation",
      };
    })
    .filter((entry): entry is { [key: string]: string | number; label: string } => entry !== null)
    .slice(0,500);
};

const formatMetricValue = (columnName:string,value:number)=>{
  const normalized = columnName.toLowerCase();
  if (NUMERIC_HINTS.salary.some((hint)=>normalized.includes(hint))) {
    return `$${Math.round(value).toLocaleString()}`;
  }
  return value.toLocaleString(undefined,{ maximumFractionDigits:value % 1 === 0 ? 0 : 2 });
};

const calculateMedian = (values:number[])=>{
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a,b)=>a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const getSmartStatus = (healthScore:number):"good"|"warning"|"critical"|"stable"=>{
  if (healthScore > 95) return "stable";
  if (healthScore > 80) return "warning";
  return "critical";
};

const computeDelta = (current:number,baseline:number):{ delta:string; trend:"up"|"down"|"stable" }=>{
  if (baseline === 0) return { delta:"--", trend:"stable" };
  const deltaPercent = ((current - baseline) / baseline) * 100;
  const sign = deltaPercent >= 0 ? "+" : "";
  return {
    delta:`${sign}${deltaPercent.toFixed(1)}%`,
    trend:deltaPercent > 2 ? "up" : deltaPercent < -2 ? "down" : "stable",
  };
};

const generateSmartKPIs = ({
  salaryColumn,
  experienceColumn,
  countryColumn,
  languageColumn,
  salaryByCountry,
  languageData,
  integrityScore,
  removedRows,
  totalRows,
  experienceSalaryPairs,
  salaryDistribution,
  segments,
  outliers,
  slope,
  correlation,
}:{
  salaryColumn:DataColumn|null;
  experienceColumn:DataColumn|null;
  countryColumn:DataColumn|null;
  languageColumn:DataColumn|null;
  salaryByCountry:Array<Record<string,string|number>>;
  languageData:Array<Record<string,string|number>>;
  integrityScore:number;
  removedRows:number;
  totalRows:number;
  experienceSalaryPairs:Array<{x:number; y:number}>;
  salaryDistribution:ReturnType<typeof distributionIntelligence>;
  segments:ReturnType<typeof segmentData>;
  outliers:ReturnType<typeof detectOutliers>;
  slope:number;
  correlation:number | null;
}):SmartKPI[]=>{
  const kpis:SmartKPI[] = [];

  if (salaryColumn) {
    const avgSalary = salaryDistribution.mean;
    const medianSalary = salaryDistribution.median;
    const { delta, trend } = computeDelta(avgSalary, medianSalary);
    
    kpis.push({
      id:"salary-signal",
      title:"Salary Signal",
      value:`$${(avgSalary / 1000).toFixed(1)}K`,
      delta,
      trend,
      status:trend === "up" ? "good" : trend === "down" ? "warning" : "stable",
      insight:salaryDistribution.skew > 10000 ? "Right-skewed — few high earners inflating average" : "Growth accelerates after 8+ years experience",
      priority:1,
      icon:"dollar",
    });
    
    if (experienceColumn && slope > 0) {
      const predicted10yr = predictSalary(10, slope, salaryDistribution.median);
      kpis.push({
        id:"prediction-10y",
        title:"Prediction (10Y)",
        value:`$${(predicted10yr / 1000).toFixed(0)}K`,
        status:slope > 5000 ? "good" : slope > 2000 ? "warning" : "critical",
        insight:slope > 0 ? `Linear growth trend ($${roundTo(slope)}/yr)` : "No clear growth trend detected",
        priority:2,
        icon:"trending-up",
      });
    }
    
    if (outliers.outlierCount > 0) {
      kpis.push({
        id:"anomalies",
        title:"Anomalies",
        value:`${outliers.outlierCount} detected`,
        status:outliers.extremeHigh > 0 ? "warning" : "stable",
        insight:outliers.extremeHigh > 0 ? `${outliers.extremeHigh} extreme salary outliers above statistical bounds` : `${outliers.outlierCount} outliers detected in salary data`,
        priority:3,
        icon:"alert-triangle",
      });
    }
    
    const segmentEntries = Object.entries(segments).filter(([k])=>k !== "counts");
    const sortedSegs = segmentEntries.sort((a,b)=>Number(b[1]) - Number(a[1]));
    if (sortedSegs.length >= 2) {
      const [topKey, topVal] = sortedSegs[0];
      const [bottomKey, bottomVal] = sortedSegs[sortedSegs.length - 1];
      if (Number(topVal) > 0 && Number(bottomVal) > 0) {
        const ratio = roundTo(Number(topVal) / Number(bottomVal));
        kpis.push({
          id:"top-segment",
          title:"Top Segment",
          value:topKey,
          delta:`${ratio.toFixed(1)}x`,
          trend:"up",
          status:ratio > 1.5 ? "good" : "warning",
          insight:`Earns ${ratio.toFixed(1)}x more than ${bottomKey} segment`,
          priority:4,
          icon:"users",
        });
      }
    }
  }

  kpis.push({
    id:"data-health",
    title:"Data Health",
    value:`${integrityScore.toFixed(1)}%`,
    delta:removedRows > 0 ? `-${removedRows}` : undefined,
    status:getSmartStatus(integrityScore),
    insight:removedRows > 0 ? `${removedRows.toLocaleString()} rows filtered during cleaning` : "Dataset is pristine",
    priority:5,
    icon:"shield",
  });

  if (countryColumn && salaryByCountry.length > 0 && salaryColumn) {
    const topCountry = salaryByCountry[0];
    const topSalary = Number(topCountry[salaryColumn.name]);
    kpis.push({
      id:"market-leader",
      title:"Market Leader",
      value:`${String(topCountry[countryColumn.name]).slice(0,3).toUpperCase()}`,
      delta:formatMetricValue(salaryColumn.name, topSalary),
      trend:"up",
      status:"good",
      insight:`${String(topCountry[countryColumn.name])} leads with ${formatMetricValue(salaryColumn.name, topSalary)} avg salary`,
      priority:6,
      icon:"globe",
    });
  }

  if (languageColumn && languageData.length > 0) {
    const topLang = languageData[0];
    const pct = Number(topLang.percentage);
    kpis.push({
      id:"skill-dominance",
      title:"Skill Dominance",
      value:String(topLang[languageColumn.name]).slice(0,8),
      delta:`${pct.toFixed(2)}%`,
      trend:pct > 30 ? "up" : "stable",
      status:pct > 30 ? "good" : "warning",
      insight:`${String(topLang[languageColumn.name])} dominates ${pct.toFixed(1)}% of tech mentions`,
      priority:7,
      icon:"code",
    });
  }

  if (experienceColumn && correlation !== null) {
    kpis.push({
      id:"correlation",
      title:"Exp-Salary Link",
      value:correlation.toFixed(2),
      status:Math.abs(correlation) > 0.6 ? "good" : Math.abs(correlation) > 0.3 ? "warning" : "critical",
      insight:correlationInsight(correlation),
      priority:8,
      icon:"link",
    });
  }

  return kpis.sort((a,b)=>a.priority - b.priority);
};

const buildInsights = ({
  rows,
  salaryColumn,
  experienceColumn,
  countryColumn,
  educationColumn,
  languageColumn,
  salaryByCountry,
  languageData,
  educationDistribution,
}:{
  rows:DatasetRow[];
  salaryColumn:DataColumn|null;
  experienceColumn:DataColumn|null;
  countryColumn:DataColumn|null;
  educationColumn:DataColumn|null;
  languageColumn:DataColumn|null;
  salaryByCountry:Array<Record<string,string|number>>;
  languageData:Array<Record<string,string|number>>;
  educationDistribution:Array<Record<string,string|number>>;
})=>{
  const insights:string[] = [];

  if (salaryColumn && experienceColumn) {
    const early = rows.filter((row)=>typeof row[experienceColumn.name] === "number" && Number(row[experienceColumn.name]) <= 5)
      .map((row)=>Number(row[salaryColumn.name]))
      .filter((value)=>Number.isFinite(value));
    const late = rows.filter((row)=>typeof row[experienceColumn.name] === "number" && Number(row[experienceColumn.name]) > 5)
      .map((row)=>Number(row[salaryColumn.name]))
      .filter((value)=>Number.isFinite(value));
    const earlyAvg = average(early);
    const lateAvg = average(late);
    if (earlyAvg > 0 && lateAvg > 0) {
      const increase = ((lateAvg - earlyAvg) / earlyAvg) * 100;
      insights.push(`Average salary changes by ${roundTo(increase,1)}% after 5 years experience.`);
    }
  }

  if (countryColumn && salaryByCountry.length > 0 && salaryColumn) {
    const topCountry = salaryByCountry[0];
    insights.push(`Country ${String(topCountry[countryColumn.name])} has the highest average salary at ${formatMetricValue(salaryColumn.name,Number(topCountry[salaryColumn.name]))}.`);
  }

  if (languageColumn && languageData.length > 0) {
    const topLanguage = languageData[0];
    insights.push(`Language ${String(topLanguage[languageColumn.name])} leads usage with ${Number(topLanguage.percentage).toFixed(1)}% of observed mentions.`);
  }

  if (educationColumn && educationDistribution.length > 0) {
    const topEducation = [...educationDistribution].sort((left,right)=>Number(right.count) - Number(left.count))[0];
    insights.push(`Education level ${String(topEducation[educationColumn.name])} is the largest cohort at ${Number(topEducation.percentage).toFixed(1)}% of valid records.`);
  }

  return insights.slice(0,4);
};

export const buildAnalyticsDashboard = (dataset:Dataset):AnalyticsDashboardBundle=>{
  const validation = cleanDatasetForAnalytics(dataset);
  const cleanedDataset = validation.cleanedDataset;
  const numericColumns = getNumericColumns(cleanedDataset);
  const categoricalColumns = getCategoricalColumns(cleanedDataset);

  const salaryColumn = findColumnByHints(numericColumns,NUMERIC_HINTS.salary);
  const experienceColumn = findColumnByHints(numericColumns,NUMERIC_HINTS.experience);
  const countryColumn = findColumnByHints(categoricalColumns,NUMERIC_HINTS.country);
  const educationColumn = findColumnByHints(categoricalColumns,NUMERIC_HINTS.education);
  const languageColumn = findColumnByHints(categoricalColumns,NUMERIC_HINTS.languages);

  const salaryByCountry = salaryColumn && countryColumn
    ? aggregateAverageByDimension(cleanedDataset.rows,countryColumn,salaryColumn,{ normalizeByTotalEntries:true })
    : [];

  const experienceByCountry = experienceColumn && countryColumn
    ? aggregateAverageByDimension(cleanedDataset.rows,countryColumn,experienceColumn,{ normalizeByTotalEntries:true })
    : [];

  const languageData = languageColumn ? aggregateMultivalueFrequency(cleanedDataset.rows,languageColumn) : [];
  const educationDistribution = educationColumn ? aggregateEducationDistribution(cleanedDataset.rows,educationColumn) : [];
  const salaryByEducation = salaryColumn && educationColumn
    ? aggregateAverageByDimension(
      cleanedDataset.rows.map((row)=>({
        ...row,
        [educationColumn.name]:typeof row[educationColumn.name] === "string" ? normalizeEducationLabel(String(row[educationColumn.name])) : row[educationColumn.name],
      })),
      educationColumn,
      salaryColumn,
    ).sort((left,right)=>compareEducationLevels(String(left[educationColumn.name]),String(right[educationColumn.name])))
    : [];
  const experienceSalaryScatter = salaryColumn && experienceColumn
    ? buildScatterDataset(cleanedDataset.rows,experienceColumn,salaryColumn,countryColumn)
    : [];

  const integrityScore = validation.validationSummary.totalRows > 0
    ? roundTo((validation.validationSummary.validRows / validation.validationSummary.totalRows) * 100,2)
    : 0;
  const riskLevel = computeRiskLevel({
    missingPercentage:validation.validationSummary.missingPercentage,
    duplicateCount:validation.validationSummary.duplicateCount,
    outlierCount:validation.validationSummary.outlierCount,
    totalRows:validation.validationSummary.totalRows,
  });

  const salaryValues = cleanedDataset.rows
    .map((row)=>salaryColumn ? Number(row[salaryColumn.name]) : null)
    .filter((v):v is number=>v != null && Number.isFinite(v));
  const salaryDistribution = distributionIntelligence(salaryValues);
  
  const experienceSalaryPairs = cleanedDataset.rows
    .map((row)=>({
      x:experienceColumn ? Number(row[experienceColumn.name]) : 0,
      y:salaryColumn ? Number(row[salaryColumn.name]) : 0,
    }))
    .filter((p)=>Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0);
  
  const { slope, intercept } = linearRegression(experienceSalaryPairs);
  const correlation = computeCorrelation(experienceSalaryPairs);
  
  const segments = experienceColumn && salaryColumn
    ? segmentData(cleanedDataset.rows, experienceColumn.name, salaryColumn.name)
    : { Junior:0, Mid:0, Senior:0, counts:{Junior:{total:0,count:0},Mid:{total:0,count:0},Senior:{total:0,count:0}} };
  
  const outliers = detectOutliers(salaryValues);

  const metrics:DashboardMetricSummary = {
    integrityScore,
    riskLevel,
    missingPercentage:validation.validationSummary.missingPercentage,
    duplicateCount:validation.validationSummary.duplicateCount,
    outlierCount:validation.validationSummary.outlierCount,
    validRows:validation.validationSummary.validRows,
    totalRows:validation.validationSummary.totalRows,
  };

  const smartKPIs = generateSmartKPIs({
    salaryColumn,
    experienceColumn,
    countryColumn,
    languageColumn,
    salaryByCountry,
    languageData,
    integrityScore,
    removedRows:validation.validationSummary.duplicateCount + validation.validationSummary.outlierCount,
    totalRows:validation.validationSummary.totalRows,
    experienceSalaryPairs,
    salaryDistribution,
    segments,
    outliers,
    slope,
    correlation,
  });

  const kpis:KPI[] = smartKPIs.map((sk)=>({
    title:sk.title,
    value:sk.value,
    change:sk.delta ? parseFloat(sk.delta.replace(/[+%]/g,"")) : undefined,
    trend:sk.trend,
    status:sk.status === "good" ? "good" : sk.status === "warning" ? "warning" : "critical",
    insight:sk.insight,
    icon:sk.icon,
  }));

  const charts:ChartConfig[] = [];
  if (salaryByCountry.length > 0 && countryColumn && salaryColumn) {
    charts.push({
      type:"bar",
      title:`Average ${humanize(salaryColumn.name)} by ${humanize(countryColumn.name)}`,
      xKey:countryColumn.name,
      yKey:salaryColumn.name,
      data:salaryByCountry,
    });
  }
  if (experienceByCountry.length > 0 && countryColumn && experienceColumn) {
    charts.push({
      type:"bar",
      title:`Average ${humanize(experienceColumn.name)} by ${humanize(countryColumn.name)}`,
      xKey:countryColumn.name,
      yKey:experienceColumn.name,
      data:experienceByCountry,
    });
  }
  if (languageData.length > 0 && languageColumn) {
    charts.push({
      type:"bar",
      title:`Language Frequency`,
      xKey:languageColumn.name,
      yKey:"count",
      data:languageData,
    });
  }
  if (educationDistribution.length > 0 && educationColumn) {
    charts.push({
      type:"pie",
      title:`Education Distribution`,
      xKey:educationColumn.name,
      yKey:"percentage",
      data:educationDistribution,
    });
  }
  if (salaryByEducation.length > 0 && educationColumn && salaryColumn) {
    charts.push({
      type:"line",
      title:`Average ${humanize(salaryColumn.name)} by ${humanize(educationColumn.name)}`,
      xKey:educationColumn.name,
      yKey:salaryColumn.name,
      data:salaryByEducation,
    });
  }
  if (experienceSalaryScatter.length > 0 && experienceColumn && salaryColumn) {
    charts.push({
      type:"scatter",
      title:`${humanize(salaryColumn.name)} vs ${humanize(experienceColumn.name)}`,
      xKey:experienceColumn.name,
      yKey:salaryColumn.name,
      data:experienceSalaryScatter,
    });
  }

  const insights = buildInsights({
    rows:cleanedDataset.rows,
    salaryColumn,
    experienceColumn,
    countryColumn,
    educationColumn,
    languageColumn,
    salaryByCountry,
    languageData,
    educationDistribution,
  });

  return {
    cleanedDataset,
    validationSummary:validation.validationSummary,
    charts,
    kpis,
    insights,
    health:{
      validation:validation.validationSummary,
      missingByColumn:validation.missingByColumn,
      outlierColumns:validation.outlierColumns,
      metrics,
    },
    structuredData:{
      salaryByCountry,
      experienceByCountry,
      languages:languageData,
      educationDistribution,
      salaryByEducation,
      experienceSalaryScatter,
    },
  };
};
