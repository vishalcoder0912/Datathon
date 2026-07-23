import { describe,expect,it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Dataset } from "@/features/data/model/dataStore";
import {
  aggregateAverageByDimension,
  aggregateEducationDistribution,
  aggregateMultivalueFrequency,
  buildAnalyticsDashboard,
  cleanDatasetForAnalytics,
} from "@/features/data/model/analyticsEngine";
import { useKPIEngine } from "@/features/dashboard/hooks/useKPIEngine";

const analyticsDataset:Dataset = {
  id:"salary-analytics-1",
  name:"Global Developer Compensation",
  uploadedAt:new Date("2026-04-22T00:00:00.000Z"),
  rowCount:11,
  columns:[
    { name:"country",type:"string",sample:["USA","India","Germany"] },
    { name:"salary_usd",type:"number",sample:["120000","40000","90000"] },
    { name:"experience",type:"number",sample:["3","8","6"] },
    { name:"education",type:"string",sample:["Bachelor","Master","PhD"] },
    { name:"languages",type:"string",sample:["Python, SQL","Python, R"] },
  ],
  rows:[
    { country:"USA",salary_usd:"120000",experience:"3",education:"Bachelor",languages:"Python, SQL" },
    { country:"USA",salary_usd:"150000",experience:"7",education:"Master",languages:"Python, SQL, JavaScript" },
    { country:"India",salary_usd:"40000",experience:"2",education:"Bachelor",languages:"Python, SQL" },
    { country:"India",salary_usd:"60000",experience:"5",education:"Master",languages:"Python, R" },
    { country:"Germany",salary_usd:"90000",experience:"6",education:"PhD",languages:"Python, SQL, Scala" },
    { country:"Germany",salary_usd:"95000",experience:"8",education:"Master",languages:"SQL, Scala" },
    { country:"Canada",salary_usd:"110000",experience:"9",education:"PhD",languages:"Python, SQL" },
    { country:"Canada",salary_usd:"115000",experience:"11",education:"Master",languages:"Python, Go" },
    { country:"USA",salary_usd:"150000",experience:"7",education:"Master",languages:"Python, SQL, JavaScript" },
    { country:"Brazil",salary_usd:null,experience:"4",education:"Bachelor",languages:null },
    { country:"USA",salary_usd:"9999999",experience:"65",education:"PhD",languages:"Cobol" },
  ],
};

describe("analytics engine",()=>{
  it("cleans datasets and reports missing values, duplicates, and outliers",()=>{
    const result = cleanDatasetForAnalytics(analyticsDataset);

    expect(result.validationSummary).toEqual({
      totalRows:11,
      validRows:8,
      missingPercentage:3.64,
      duplicateCount:1,
      outlierCount:2,
    });
    expect(result.missingByColumn.salary_usd).toBe(1);
    expect(result.missingByColumn.languages).toBe(1);
    expect(result.cleanedDataset.rows).toHaveLength(8);
  });

  it("aggregates salary by country using averages rather than totals",()=>{
    const { cleanedDataset } = cleanDatasetForAnalytics(analyticsDataset);
    const countryColumn = cleanedDataset.columns.find((column)=>column.name === "country");
    const salaryColumn = cleanedDataset.columns.find((column)=>column.name === "salary_usd");

    expect(countryColumn).toBeDefined();
    expect(salaryColumn).toBeDefined();

    const salaryByCountry = aggregateAverageByDimension(cleanedDataset.rows,countryColumn!,salaryColumn!,{ normalizeByTotalEntries:true });

    expect(salaryByCountry).toEqual([
      { country:"USA",salary_usd:135000,sampleSize:2,normalizedValue:16875 },
      { country:"Canada",salary_usd:112500,sampleSize:2,normalizedValue:14062.5 },
      { country:"Germany",salary_usd:92500,sampleSize:2,normalizedValue:11562.5 },
      { country:"India",salary_usd:60000,sampleSize:1,normalizedValue:7500 },
    ]);
  });

  it("parses multivalue language fields and sorts frequencies descending",()=>{
    const { cleanedDataset } = cleanDatasetForAnalytics(analyticsDataset);
    const languageColumn = cleanedDataset.columns.find((column)=>column.name === "languages");

    expect(languageColumn).toBeDefined();

    const languageFrequency = aggregateMultivalueFrequency(cleanedDataset.rows,languageColumn!);

    expect(languageFrequency.slice(0,5)).toEqual([
      { languages:"Python",count:6,percentage:37.5 },
      { languages:"SQL",count:5,percentage:31.25 },
      { languages:"Scala",count:2,percentage:12.5 },
      { languages:"JavaScript",count:1,percentage:6.25 },
      { languages:"R",count:1,percentage:6.25 },
    ]);
  });

  it("counts real education distribution and keeps logical education order",()=>{
    const { cleanedDataset } = cleanDatasetForAnalytics(analyticsDataset);
    const educationColumn = cleanedDataset.columns.find((column)=>column.name === "education");

    expect(educationColumn).toBeDefined();

    const educationDistribution = aggregateEducationDistribution(cleanedDataset.rows,educationColumn!);

    expect(educationDistribution).toEqual([
      { education:"Bachelor",count:2,percentage:25 },
      { education:"Master",count:4,percentage:50 },
      { education:"PhD",count:2,percentage:25 },
    ]);
  });

  it("builds a memoizable dashboard bundle with statistically correct chart semantics",()=>{
    const bundle = buildAnalyticsDashboard(analyticsDataset);

    expect(bundle.structuredData.salaryByCountry[0]).toMatchObject({ country:"USA",salary_usd:135000 });
    expect(bundle.structuredData.experienceByCountry[0]).toMatchObject({ country:"Canada",experience:10 });
    expect(bundle.charts.map((chart)=>chart.title)).toEqual([
      "Average Salary Usd by Country",
      "Average Experience by Country",
      "Language Frequency",
      "Education Distribution",
      "Average Salary Usd by Education",
      "Salary Usd vs Experience",
    ]);
    expect(bundle.charts[5]).toMatchObject({
      type:"scatter",
      xKey:"experience",
      yKey:"salary_usd",
    });
    expect(bundle.insights.length).toBeGreaterThan(0);
  });

  it("returns dynamic, insight-driven KPIs from the KPI engine hook",()=>{
    const { result } = renderHook(()=>useKPIEngine(analyticsDataset));

    expect(result.current.kpis.map((kpi)=>kpi.title)).toEqual([
      "Data Quality",
      "Avg Salary",
      "Experience-Salary Correlation",
      "Top Country",
      "Most Popular Language",
      "Education Impact",
    ]);
    expect(result.current.kpis[0]).toMatchObject({
      title:"Data Quality",
      value:"72.73%",
      trend:"stable",
      status:"critical",
    });
    expect(result.current.kpis[1]).toMatchObject({
      title:"Avg Salary",
      status:"good",
    });
    expect(result.current.kpis[2].insight).toContain("correlation");
    expect(result.current.kpis[3]).toMatchObject({
      title:"Top Country",
      value:"USA",
      status:"good",
    });
    expect(result.current.kpis[4]).toMatchObject({
      title:"Most Popular Language",
      value:"Python",
    });
    expect(result.current.kpis[5].value).toMatch(/%|N\/A/);
  });
});
