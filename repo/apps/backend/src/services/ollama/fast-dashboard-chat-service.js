import { retrieveLearningMemory } from "../ai-analyst/self-learning-memory.js";

const cache = new Map();

function cacheKey({ message, schemaProfile }) {
  const cols = getColumns(schemaProfile)
    .map((column) => column.name || column.normalizedName)
    .filter(Boolean)
    .join("|");
  const summarySignature = JSON.stringify(schemaProfile?.localAnalytics || {});
  return `${String(message || "").toLowerCase().trim()}::${schemaProfile?.rowCount || ""}::${cols}::${summarySignature}`;
}

function getColumns(schemaProfile) {
  if (Array.isArray(schemaProfile?.columns)) return schemaProfile.columns;
  if (Array.isArray(schemaProfile?.schema?.columns)) return schemaProfile.schema.columns;
  return [];
}

function findColumn(columns, keywords) {
  return columns.find((column) => {
    const name = String(column.name || column.normalizedName || "").toLowerCase();
    return keywords.some((keyword) => name.includes(keyword));
  });
}

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(number);
}

function getEducationSalaryRanking(schemaProfile) {
  const ranking = schemaProfile?.localAnalytics?.educationSalaryRanking;
  return Array.isArray(ranking) ? ranking : [];
}

function localAnswer(message, schemaProfile, currentDashboard) {
  const q = String(message || "").toLowerCase();
  const columns = getColumns(schemaProfile);

  const primaryMetricCol = findColumn(columns, ["amount", "sales", "revenue", "salary", "income", "price", "total", "profit", "value"]);
  const secondaryMetricCol = findColumn(columns.filter((column) => column !== primaryMetricCol), ["value", "score", "quantity", "count", "amount"]);
  const salaryCol = findColumn(columns, ["salary", "revenue", "sales", "income"]);
  const countryCol = findColumn(columns, ["country", "region", "state", "city", "location", "territory", "geo"]);
  const categoryCol = findColumn(columns, ["category", "type", "segment", "product", "department"]);
  const dateCol = findColumn(columns, ["date", "month", "year", "time"]);
  const expCol = findColumn(columns, ["experience", "years"]);
  const skillCol = findColumn(columns, ["language", "skill", "framework"]);
  const educationCol = findColumn(columns, ["education", "degree", "qualification"]);

  if (
    educationCol &&
    salaryCol &&
    q.includes("education") &&
    (q.includes("salary") || q.includes("highest") || q.includes("correlat"))
  ) {
    const ranking = getEducationSalaryRanking(schemaProfile);

    if (ranking.length) {
      const [top, second] = ranking;
      const secondSentence = second
        ? ` ${second.label} is second, around ${formatMoney(second.average)}.`
        : "";

      return {
        intent: "answer",
        answer: `${top.label} has the highest average ${salaryCol.name}, around ${formatMoney(top.average)}.${secondSentence}`,
        action: {
          chart: {
            title: `Average ${salaryCol.name} by ${educationCol.name}`,
            type: "bar",
            xKey: educationCol.name,
            yKey: salaryCol.name,
            aggregation: "avg",
            limit: 10,
          },
        },
        reason: `Computed average ${salaryCol.name} grouped by ${educationCol.name} locally from dataset rows.`,
        source: "local",
      };
    }

    return {
      intent: "add_chart",
      answer: `I can compare average ${salaryCol.name} by ${educationCol.name}.`,
      action: {
        chart: {
          title: `Average ${salaryCol.name} by ${educationCol.name}`,
          type: "bar",
          xKey: educationCol.name,
          yKey: salaryCol.name,
          aggregation: "avg",
          limit: 10,
        },
      },
      reason: `${educationCol.name} is a category and ${salaryCol.name} is a numeric metric.`,
      source: "local",
    };
  }

  if (q.includes("what") && q.includes("dataset")) {
    return {
      intent: "answer",
      answer: `This dataset has ${schemaProfile?.rowCount || schemaProfile?.rows || "many"} records and ${schemaProfile?.columnCount || columns.length} columns. It appears to be a generic analytics dataset. The main metric is ${primaryMetricCol?.name || "a numeric field"}, the secondary numeric field is ${secondaryMetricCol?.name || "not detected"}, the main segment is ${categoryCol?.name || countryCol?.name || "a category column"}, and ${dateCol?.name || "a date column"} can be used for trend analysis when present.`,
      action: {},
      reason: "Answered from schema summary without LLM.",
      source: "local",
    };
  }

  if ((q.includes("geo") || q.includes("map") || q.includes("location")) && primaryMetricCol) {
    if (!countryCol) {
      return {
        intent: "answer",
        answer: "Geo analysis is not available for this dataset because I cannot find a country, region, state, city, location, territory, or geo column.",
        action: {},
        reason: "No geo/location column exists in schema.",
        source: "local",
      };
    }

    return {
      intent: "add_chart",
      answer: `Created geo analysis for ${primaryMetricCol.name} by ${countryCol.name}.`,
      action: {
        chart: {
          title: `Geo Analysis by ${countryCol.name}`,
          type: "map",
          xKey: countryCol.name,
          yKey: primaryMetricCol.name,
          aggregation: "avg",
          limit: 12,
        },
      },
      reason: `${countryCol.name} is a location field and ${primaryMetricCol.name} is the main metric.`,
      source: "local",
    };
  }

  if (primaryMetricCol && categoryCol && (q.includes("category") || q.includes("segment") || q.includes(" by "))) {
    return {
      intent: "add_chart",
      answer: `Created average ${primaryMetricCol.name} by ${categoryCol.name}.`,
      action: {
        chart: {
          title: `Average ${primaryMetricCol.name} by ${categoryCol.name}`,
          type: "bar",
          xKey: categoryCol.name,
          yKey: primaryMetricCol.name,
          aggregation: "avg",
          limit: 10,
        },
      },
      reason: `${categoryCol.name} is a segment and ${primaryMetricCol.name} is the main metric.`,
      source: "local",
    };
  }

  if (primaryMetricCol && dateCol && (q.includes("trend") || q.includes("time") || q.includes("date"))) {
    return {
      intent: "add_chart",
      answer: `Created ${primaryMetricCol.name} trend by ${dateCol.name}.`,
      action: {
        chart: {
          title: `${primaryMetricCol.name} Trend by ${dateCol.name}`,
          type: "line",
          xKey: dateCol.name,
          yKey: primaryMetricCol.name,
          aggregation: "avg",
          limit: 30,
        },
      },
      reason: `${dateCol.name} is a date field, so trend analysis is valid.`,
      source: "local",
    };
  }

  if (primaryMetricCol && (q.includes("outlier") || q.includes("top record") || q.includes("highest"))) {
    return {
      intent: "add_chart",
      answer: `Created top ${primaryMetricCol.name} records and outliers.`,
      action: {
        chart: {
          title: `Top ${primaryMetricCol.name} Outliers`,
          type: "table",
          xKey: "name",
          yKey: primaryMetricCol.name,
          aggregation: "max",
          limit: 10,
        },
      },
      reason: `Highest ${primaryMetricCol.name} rows are useful for outlier review.`,
      source: "local",
    };
  }

  if (q.includes("skill") || q.includes("language") || q.includes("framework")) {
    if (!skillCol) {
      return {
        intent: "answer",
        answer: "I cannot find a skill, language, or framework column in this schema.",
        action: {},
        reason: "No skill-related column exists in schema.",
        source: "local",
      };
    }

    return {
      intent: "add_chart",
      answer: `I can show the most common values from ${skillCol.name}.`,
      action: {
        chart: {
          title: `Top ${skillCol.name}`,
          type: "bar",
          xKey: skillCol.name,
          yKey: "count",
          aggregation: "count",
          limit: 10,
        },
      },
      reason: `${skillCol.name} is a categorical/multi-value column suitable for ranking.`,
      source: "local",
    };
  }

  if (q.includes("salary") && q.includes("country")) {
    if (!salaryCol || !countryCol) {
      return {
        intent: "answer",
        answer: "I cannot create this chart because salary/country columns are missing.",
        action: {},
        reason: "Required columns not found in schema.",
        source: "local",
      };
    }

    return {
      intent: "add_chart",
      answer: `Created average ${salaryCol.name} by ${countryCol.name}.`,
      action: {
        chart: {
          title: `Average ${salaryCol.name} by ${countryCol.name}`,
          type: "bar",
          xKey: countryCol.name,
          yKey: salaryCol.name,
          aggregation: "avg",
          limit: 10,
        },
      },
      reason: `${countryCol.name} is a segment and ${salaryCol.name} is a numeric metric.`,
      source: "local",
    };
  }

  if (q.includes("experience") && q.includes("salary")) {
    if (!salaryCol || !expCol) {
      return {
        intent: "answer",
        answer: "I cannot compare experience and salary because one of those columns is missing.",
        action: {},
        reason: "Required columns not found.",
        source: "local",
      };
    }

    return {
      intent: "add_chart",
      answer: `Created ${salaryCol.name} vs ${expCol.name} chart.`,
      action: {
        chart: {
          title: `${salaryCol.name} vs ${expCol.name}`,
          type: "scatter",
          xKey: expCol.name,
          yKey: salaryCol.name,
          aggregation: "avg",
          limit: 500,
        },
      },
      reason: "Scatter chart is best for comparing two numeric variables.",
      source: "local",
    };
  }

  if (q.includes("remove") || q.includes("delete")) {
    return {
      intent: "remove_chart",
      answer: "I removed the matching chart if it exists.",
      action: {
        targetTitle: String(message || "").replace(/remove|delete|chart/gi, "").trim(),
      },
      reason: "User requested chart removal.",
      source: "local",
    };
  }

  if (/chart|graph|show|create|add/.test(q) && salaryCol && countryCol) {
    return {
      intent: "add_chart",
      answer: `Created ${salaryCol.name} by ${countryCol.name}.`,
      action: {
        chart: {
          title: `${salaryCol.name} by ${countryCol.name}`,
          type: "bar",
          xKey: countryCol.name,
          yKey: salaryCol.name,
          aggregation: q.includes("average") || q.includes("avg") ? "avg" : "sum",
          limit: 10,
        },
      },
      reason: `${countryCol.name} is a category and ${salaryCol.name} is a numeric metric.`,
      source: "local",
    };
  }

  return null;
}

async function ollamaFallback(message, schemaProfile) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number(process.env.DASHBOARD_AI_TIMEOUT_MS || 3000),
  );

  const cols = getColumns(schemaProfile);
  const memories = retrieveLearningMemory({
    userQuestion: message,
    schemaColumns: cols.map((c) => c.name || c.normalizedName).filter(Boolean),
    domain: schemaProfile?.domain || schemaProfile?.schema?.domain || "generic",
  });

  try {
    const res = await fetch(`${process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL || "http://localhost:11434"}/api/chat`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_CHAT_MODEL || "llama3.2:3b",
        stream: false,
        messages: [
          {
            role: "system",
            content: `Answer briefly for a data dashboard assistant. Use schema only. Do not invent columns. Keep under 80 words.

Use these learned corrections before answering:
${JSON.stringify(memories, null, 2)}

If a correction rule matches the user question, follow it.
Do not repeat previous mistakes.`,
          },
          {
            role: "user",
            content: JSON.stringify({
              question: message,
              schema: {
                domain: schemaProfile?.domain,
                rowCount: schemaProfile?.rowCount,
                columns: getColumns(schemaProfile).map((column) => ({
                  name: column.name,
                  type: column.type,
                  role: column.role,
                })),
              },
            }),
          },
        ],
        options: {
          temperature: 0.1,
          num_predict: 120,
          num_ctx: 2048,
        },
        keep_alive: process.env.OLLAMA_KEEP_ALIVE || "24h",
      }),
    });

    const data = await res.json();

    return {
      intent: "answer",
      answer: data?.message?.content || "I could not generate a response.",
      action: {},
      reason: "Answered using fast Ollama fallback.",
      source: "ollama",
    };
  } catch {
    return {
      intent: "answer",
      answer: "I can answer schema, KPI, chart, salary, country, skill, and dashboard questions. Try asking: 'show salary by country'.",
      action: {},
      reason: "LLM timeout fallback.",
      source: "fallback",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fastDashboardChat({ message, schemaProfile, currentDashboard }) {
  const key = cacheKey({ message, schemaProfile });

  if (cache.has(key)) {
    return {
      ...cache.get(key),
      cached: true,
    };
  }

  let result = localAnswer(message, schemaProfile, currentDashboard);

  if (!result) {
    result = await ollamaFallback(message, schemaProfile);
  }

  cache.set(key, result);

  return {
    ...result,
    cached: false,
  };
}
