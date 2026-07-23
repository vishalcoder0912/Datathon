import AnalyticsEngine from "./analyticsEngine.js";

interface Dataset {
  columns: string[];
  data: Record<string, unknown>[];
}

interface DashboardRequest {
  title?: string;
  focus?: string;
  dataset: Dataset;
}

export class DashboardBuilder {
  private analyticsEngine: AnalyticsEngine;

  constructor() {
    this.analyticsEngine = new AnalyticsEngine();
  }

  async createDashboard(request: DashboardRequest) {
    console.log("🚀 Initializing Dashboard Generation Pipeline...");

    // Step 1: Analyze Dataset
    console.log("📊 Step 1: Analyzing dataset structure...");
    const schema = await this.analyticsEngine.analyzeDatasetStructure(request.dataset);
    console.log("✅ Schema Generated:", schema.dataset_domain);

    // Step 2: Generate KPIs
    console.log("📈 Step 2: Generating KPIs...");
    const kpis = await this.analyticsEngine.generateKPIs(schema, request.dataset);
    console.log(`✅ Generated ${kpis.length} KPIs`);

    // Step 3: Generate Visualizations
    console.log("📊 Step 3: Generating visualizations...");
    const visualizations = await this.analyticsEngine.generateVisualizations(
      schema,
      request.dataset
    );
    console.log(`✅ Generated ${visualizations.length} charts`);

    // Step 4: Build Dashboard
    console.log("🎨 Step 4: Building executive dashboard...");
    const dashboard = await this.analyticsEngine.buildExecutiveDashboard(
      schema,
      kpis,
      visualizations
    );
    console.log("✅ Dashboard structure created");

    // Step 5: Generate AI Insights
    console.log("🧠 Step 5: Generating AI insights...");
    const insights = await this.analyticsEngine.generateAIInsights(schema, request.dataset);
    console.log(`✅ Generated ${insights.length} insights`);

    return {
      dashboard,
      schema,
      kpis,
      visualizations,
      insights,
      metadata: {
        created_at: new Date().toISOString(),
        dataset_rows: request.dataset.data.length,
        dataset_columns: request.dataset.columns.length,
      },
    };
  }

  async queryDataset(
    query: string,
    schema: Record<string, unknown>,
    dataset: Dataset
  ) {
    console.log(`🤖 Processing query: "${query}"`);
    return this.analyticsEngine.respondToAnalyticsQuery(
      query,
      schema as unknown as Parameters<typeof this.analyticsEngine.respondToAnalyticsQuery>[1],
      dataset
    );
  }
}

export default DashboardBuilder;
