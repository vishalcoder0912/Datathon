import AnalyticsEngine from "./analyticsEngine.js";

export class DashboardBuilder {
  constructor() {
    this.analyticsEngine = new AnalyticsEngine();
  }

  async createDashboard(request) {
    console.log("🚀 Initializing Dashboard Generation Pipeline...");

    console.log("📊 Step 1: Analyzing dataset structure...");
    const schema = await this.analyticsEngine.analyzeDatasetStructure(request.dataset);
    console.log("✅ Schema Generated:", schema.dataset_domain);

    console.log("📈 Step 2: Generating KPIs...");
    const kpis = await this.analyticsEngine.generateKPIs(schema, request.dataset);
    console.log(`✅ Generated ${kpis.length} KPIs`);

    console.log("📊 Step 3: Generating visualizations...");
    const visualizations = await this.analyticsEngine.generateVisualizations(
      schema,
      request.dataset
    );
    console.log(`✅ Generated ${visualizations.length} charts`);

    console.log("🎨 Step 4: Building executive dashboard...");
    const dashboard = await this.analyticsEngine.buildExecutiveDashboard(
      schema,
      kpis,
      visualizations
    );
    console.log("✅ Dashboard structure created");

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

  async queryDataset(query, schema, dataset) {
    console.log(`🤖 Processing query: "${query}"`);
    return this.analyticsEngine.respondToAnalyticsQuery(query, schema, dataset);
  }
}

export default DashboardBuilder;
