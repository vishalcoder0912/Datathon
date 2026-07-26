import { useMemo } from "react";
import type { Dataset,KPI,DataColumn } from "@/features/data/model/dataStore";
import { buildAnalyticsDashboard } from "@/features/data/model/analyticsEngine";

interface ColumnInfo {
  name:string;
  type:"number"|"string"|"date";
  role:"metric"|"dimension";
  isNumeric:boolean;
  isCategorical:boolean;
  isDate:boolean;
  uniqueCount:number;
  sampleValues:string[];
}

interface DatasetSchema {
  columns:ColumnInfo[];
  numericColumns:ColumnInfo[];
  categoricalColumns:ColumnInfo[];
  dateColumns:ColumnInfo[];
  primaryMetric:ColumnInfo | null;
  primaryDimension:ColumnInfo | null;
}

const _STORAGE_PREFIX = "insightflow-kpi-snapshot";

const roundTo = (value:number,decimals:number=2)=>{
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const formatValue = (value:number,columnType:string):string=>{
  if (columnType === "currency" || columnType.includes("salary") || columnType.includes("price") || columnType.includes("cost") || columnType.includes("amount") || columnType.includes("revenue") || columnType.includes("profit")) {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  }
  if (columnType.includes("percent") || columnType.includes("rate") || columnType.includes("score")) {
    return `${value.toFixed(1)}%`;
  }
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
  if (Math.abs(value) < 1 && value !== 0) return value.toFixed(3);
  return value.toLocaleString();
};

const detectColumnType = (column:DataColumn):{type:string;role:"metric"|"dimension"}=>{
  const name = column.name.toLowerCase();
  const type = column.type || "string";
  
  if (["number","numeric","integer","decimal","float"].includes(type)) {
    if (name.includes("salary") || name.includes("price") || name.includes("cost") || name.includes("amount") || name.includes("revenue") || name.includes("profit") || name.includes("income") || name.includes("budget")) {
      return { type:"currency",role:"metric" };
    }
    if (name.includes("percent") || name.includes("rate") || name.includes("score") || name.includes("rating") || name.includes("probability")) {
      return { type:"percent",role:"metric" };
    }
    if (name.includes("count") || name.includes("quantity") || name.includes("total") || name.includes("number") || name.includes("id")) {
      return { type:"count",role:"metric" };
    }
    if (name.includes("age") || name.includes("year") || name.includes("experience") || name.includes("tenure") || name.includes("seniority")) {
      return { type:"years",role:"metric" };
    }
    return { type:"numeric",role:"metric" };
  }
  
  if (name.includes("country") || name.includes("region") || name.includes("city") || name.includes("location")) {
    return { type:"category",role:"dimension" };
  }
  if (name.includes("education") || name.includes("degree") || name.includes("qualification")) {
    return { type:"category",role:"dimension" };
  }
  if (name.includes("job") || name.includes("title") || name.includes("role") || name.includes("position")) {
    return { type:"category",role:"dimension" };
  }
  if (name.includes("company") || name.includes("organization") || name.includes("employer")) {
    return { type:"category",role:"dimension" };
  }
  if (name.includes("industry") || name.includes("sector") || name.includes("field")) {
    return { type:"category",role:"dimension" };
  }
  if (name.includes("language") || name.includes("framework") || name.includes("skill") || name.includes("tech") || name.includes("technology")) {
    return { type:"category",role:"dimension" };
  }
  if (name.includes("gender") || name.includes("sex")) {
    return { type:"category",role:"dimension" };
  }
  
  return { type:"string",role:"dimension" };
};

const analyzeDatasetSchema = (dataset:Dataset):DatasetSchema=>{
  const columns:ColumnInfo[] = [];
  const numericColumns:ColumnInfo[] = [];
  const categoricalColumns:ColumnInfo[] = [];
  const dateColumns:ColumnInfo[] = [];
  
  const _sampleRow = dataset.rows[0] || {};
  
  for (const col of dataset.columns) {
    const colType = detectColumnType(col);
    const values = dataset.rows.map(r => r[col.name]).filter(v => v != null && v !== "");
    const uniqueValues = new Set(values);
    
    const isNumeric = ["number","numeric","integer","decimal","float"].includes(col.type || "") || 
      (col.type === "string" && values.length > 0 && values.filter(v => !isNaN(Number(v))).length / values.length > 0.7);
    const isDate = col.type === "date" || /date|time|timestamp|created|updated/.test(col.name.toLowerCase());
    const isCategorical = !isNumeric && uniqueValues.size < 50;
    
    const columnInfo:ColumnInfo = {
      name:col.name,
      type:isNumeric ? "number" : isDate ? "date" : "string",
      role:colType.role,
      isNumeric,
      isCategorical,
      isDate,
      uniqueCount:uniqueValues.size,
      sampleValues:Array.from(uniqueValues).slice(0,5).map(String),
    };
    
    columns.push(columnInfo);
    if (isNumeric) numericColumns.push(columnInfo);
    if (isCategorical) categoricalColumns.push(columnInfo);
    if (isDate) dateColumns.push(columnInfo);
  }
  
  const primaryMetric = numericColumns.find(c => c.role === "metric") || numericColumns[0] || null;
  const primaryDimension = categoricalColumns.find(c => c.role === "dimension") || categoricalColumns[0] || null;
  
  return { columns,numericColumns,categoricalColumns,dateColumns,primaryMetric,primaryDimension };
};

const calculateCorrelation = (x:number[],y:number[])=>{
  if (x.length < 2 || y.length < 2) return null;
  const n = Math.min(x.length,y.length);
  const xMean = x.slice(0,n).reduce((a,b)=>a+b,0)/n;
  const yMean = y.slice(0,n).reduce((a,b)=>a+b,0)/n;
  
  let numerator = 0,xVar = 0,yVar = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - xMean;
    const dy = y[i] - yMean;
    numerator += dx * dy;
    xVar += dx * dx;
    yVar += dy * dy;
  }
  
  const denom = Math.sqrt(xVar * yVar);
  return denom === 0 ? null : roundTo(numerator / denom,2);
};

const buildSparkline = (values:number[])=>{
  if (values.length >= 2) return values.slice(0,8);
  return values.length > 0 ? [...values,...Array(8 - values.length).fill(values[0])] : [0,0,0,0,0,0,0,0];
};

const buildKPI = ({
  title,
  value,
  change,
  status,
  insight,
  icon,
  sparkline,
}:{
  title:string;
  value:string;
  change?:number;
  status:"good"|"warning"|"critical";
  insight:string;
  icon:string;
  sparkline:number[];
}):KPI=>({
  title,
  value,
  change,
  trend:change != null ? (change > 0 ? "up" : change < 0 ? "down" : "stable") : undefined,
  status,
  insight,
  icon,
  sparkline,
});

export const useKPIEngine = (data:Dataset | null)=>{
  const analyticsBundle = useMemo(()=>data ? buildAnalyticsDashboard(data) : null,[data]);

  const schema = useMemo(()=>data ? analyzeDatasetSchema(data) : null,[data]);

  const kpis = useMemo(()=>{
    if (!data || !analyticsBundle || !schema) return [] as KPI[];

    const kpiList:KPI[] = [];
    const { numericColumns,categoricalColumns,primaryMetric,primaryDimension } = schema;
    const rows = data.rows;
    const totalRows = rows.length;
    const qualityScore = analyticsBundle.validationSummary 
      ? roundTo((analyticsBundle.validationSummary.validRows / totalRows) * 100,2)
      : 100;

    kpiList.push(buildKPI({
      title:"Data Quality",
      value:`${qualityScore.toFixed(2)}%`,
      status:qualityScore >= 90 ? "good" : qualityScore >= 80 ? "warning" : "critical",
      insight:qualityScore >= 90 ? "High data integrity with minimal missing values." : "Some missing values detected but data remains usable.",
      icon:"shield",
      sparkline:buildSparkline([qualityScore,qualityScore + 5]),
      change:0,
    }));

    const salaryCol = schema.numericColumns.find(c => c.name.toLowerCase().includes("salary"));
    if (salaryCol) {
      const salaryValues = rows.map(r => Number(r[salaryCol.name])).filter(v => !isNaN(v) && v > 0 && v < 10000000);
      if (salaryValues.length > 0) {
        const avgSalary = salaryValues.reduce((a,b)=>a+b,0) / salaryValues.length;
        kpiList.push(buildKPI({
          title:"Avg Salary",
          value:formatValue(avgSalary,"currency"),
          status:"good",
          insight:`Average salary is ${formatValue(avgSalary,"currency")} across ${salaryValues.toLocaleString()} valid records.`,
          icon:"trending-up",
          sparkline:buildSparkline(salaryValues.slice(0,20)),
        }));
      }
    }

    const experienceCol = schema.numericColumns.find(c => c.name.toLowerCase().includes("experience"));
    if (salaryCol && experienceCol) {
      const pairs = rows.slice(0,500).map(r => ({
        x:Number(r[experienceCol.name]),
        y:Number(r[salaryCol.name]),
      })).filter(p => !isNaN(p.x) && !isNaN(p.y) && p.y > 0 && p.y < 10000000);
      
      if (pairs.length >= 10) {
        const correlation = calculateCorrelation(
          pairs.map(p=>p.x),
          pairs.map(p=>p.y)
        );
        
        if (correlation !== null) {
          kpiList.push(buildKPI({
            title:"Experience-Salary Correlation",
            value:correlation >= 0 ? `+${correlation.toFixed(2)}` : correlation.toFixed(2),
            status:Math.abs(correlation) >= 0.6 ? "good" : Math.abs(correlation) >= 0.3 ? "warning" : "critical",
            insight:Math.abs(correlation) >= 0.6 
              ? "Strong positive correlation between experience and salary."
              : Math.abs(correlation) >= 0.3
              ? "Moderate correlation between experience and salary."
              : "Weak correlation between experience and salary.",
            icon:"git-branch",
            sparkline:buildSparkline(pairs.slice(0,8).map(p=>p.y)),
          }));
        }
      }
    }

    if (primaryMetric && !primaryMetric.name.toLowerCase().includes("salary")) {
      const metricValues = rows.map(r => Number(r[primaryMetric.name])).filter(v => !isNaN(v));
      if (metricValues.length > 0) {
        const sum = metricValues.reduce((a,b)=>a+b,0);
        const avg = sum / metricValues.length;
        const min = Math.min(...metricValues);
        const max = Math.max(...metricValues);
        
        const colType = detectColumnType({ name:primaryMetric.name,type:primaryMetric.type as DataColumn["type"],sample:[] }).type;
        
        kpiList.push(buildKPI({
          title:`Avg ${primaryMetric.name}`,
          value:formatValue(avg,colType),
          status:"good",
          insight:`Average ${primaryMetric.name} is ${formatValue(avg,colType)} across ${metricValues.toLocaleString()} records. Range: ${formatValue(min,colType)} - ${formatValue(max,colType)}`,
          icon:"trending-up",
          sparkline:buildSparkline(metricValues.slice(0,20)),
        }));
      }
    }

    const countryCol = categoricalColumns.find(c => c.name.toLowerCase() === "country");
    if (countryCol) {
      const countryCounts:Record<string,number> = {};
      rows.forEach(r => {
        const val = String(r.country || "Unknown");
        countryCounts[val] = (countryCounts[val] || 0) + 1;
      });
      const sorted = Object.entries(countryCounts).sort((a,b)=>b[1] - a[1]);
      const topValue = sorted[0]?.[0] || "N/A";
      const topCount = sorted[0]?.[1] || 0;
      const topPercent = roundTo((topCount / totalRows) * 100,1);
      
      kpiList.push(buildKPI({
        title:"Top Country",
        value:topValue,
        status:topPercent >= 30 ? "good" : topPercent >= 15 ? "warning" : "critical",
        insight:`${topValue} is the most common country with ${topCount.toLocaleString()} records (${topPercent}%).`,
        icon:"pie-chart",
        sparkline:buildSparkline(sorted.slice(0,5).map(([_,count])=>count)),
      }));
    }

    const languagesCol = categoricalColumns.find(c => c.name.toLowerCase().includes("language"));
    if (languagesCol) {
      const langCounts:Record<string,number> = {};
      rows.forEach(r => {
        const val = String(r[languagesCol.name] || "");
        if (val) {
          val.split(",").forEach(lang => {
            const trimmed = lang.trim();
            if (trimmed) langCounts[trimmed] = (langCounts[trimmed] || 0) + 1;
          });
        }
      });
      const sorted = Object.entries(langCounts).sort((a,b)=>b[1] - a[1]);
      const topLang = sorted[0]?.[0] || "N/A";
      const topCount = sorted[0]?.[1] || 0;
      
      kpiList.push(buildKPI({
        title:"Most Popular Language",
        value:topLang,
        status:topCount >= 3 ? "good" : topCount >= 2 ? "warning" : "critical",
        insight:`${topLang} is the most used language with ${topCount} occurrences.`,
        icon:"code",
        sparkline:buildSparkline(sorted.slice(0,5).map(([_,count])=>count)),
      }));
    }

    const educationCol = categoricalColumns.find(c => c.name.toLowerCase().includes("education"));
    if (educationCol && salaryCol) {
      const eduSalaryMap:Record<string,number[]> = {};
      rows.forEach(r => {
        const edu = String(r[educationCol.name] || "Unknown");
        const sal = Number(r[salaryCol.name]);
        if (!isNaN(sal) && sal > 0 && sal < 10000000) {
          if (!eduSalaryMap[edu]) eduSalaryMap[edu] = [];
          eduSalaryMap[edu].push(sal);
        }
      });
      
      const eduAverages = Object.entries(eduSalaryMap).map(([edu, salaries]) => ({
        edu,
        avg: salaries.reduce((a,b)=>a+b,0) / salaries.length,
        count: salaries.length,
      })).sort((a,b)=>b.avg - a.avg);
      
      if (eduAverages.length >= 2) {
        const topEdu = eduAverages[0];
        const bottomEdu = eduAverages[eduAverages.length - 1];
        const diff = roundTo(((topEdu.avg - bottomEdu.avg) / bottomEdu.avg) * 100,1);
        
        kpiList.push(buildKPI({
          title:"Education Impact",
          value:`${diff > 0 ? "+" : ""}${diff}%`,
          status:diff >= 20 ? "good" : diff >= 10 ? "warning" : "critical",
          insight:`${topEdu.edu} earns ${diff > 0 ? "more" : "less"} than ${bottomEdu.edu} (${formatValue(topEdu.avg,"currency")} vs ${formatValue(bottomEdu.avg,"currency")}).`,
          icon:"graduation-cap",
          sparkline:buildSparkline(eduAverages.map(e=>e.avg)),
        }));
      }
    }

    if (primaryDimension && categoricalColumns.length > 0 && !countryCol) {
      const topCategory = categoricalColumns[0];
      if (topCategory) {
        const categoryCounts:Record<string,number> = {};
        rows.forEach(r => {
          const val = String(r[topCategory.name] || "Unknown");
          categoryCounts[val] = (categoryCounts[val] || 0) + 1;
        });
        const sorted = Object.entries(categoryCounts).sort((a,b)=>b[1] - a[1]);
        const topValue = sorted[0]?.[0] || "N/A";
        const topCount = sorted[0]?.[1] || 0;
        const topPercent = roundTo((topCount / totalRows) * 100,1);
        
        kpiList.push(buildKPI({
          title:`Top ${topCategory.name}`,
          value:topValue,
          status:topPercent >= 30 ? "good" : topPercent >= 15 ? "warning" : "critical",
          insight:`${topValue} is the most common ${topCategory.name} with ${topCount.toLocaleString()} records (${topPercent}%).`,
          icon:"pie-chart",
          sparkline:buildSparkline(sorted.slice(0,5).map(([_,count])=>count)),
        }));
      }
    }

    const dateCol = schema.dateColumns[0];
    if (dateCol) {
      const dateValues = rows.map(r => r[dateCol.name]).filter(v => v != null);
      const uniqueDates = new Set(dateValues).size;
      kpiList.push(buildKPI({
        title:`${dateCol.name} Range`,
        value:`${uniqueDates} unique`,
        status:"good",
        insight:`Dataset spans ${uniqueDates} unique ${dateCol.name} values.`,
        icon:"calendar",
        sparkline:buildSparkline([uniqueDates]),
      }));
}

return kpiList;
  },[data,analyticsBundle,schema]);

  return useMemo(()=>({
    kpis,
    analyticsBundle,
  }),[analyticsBundle,kpis]);
};
