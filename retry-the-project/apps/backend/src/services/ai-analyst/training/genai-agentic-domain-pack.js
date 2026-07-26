export const GENAI_AGENTIC_DOMAIN_PACK = [
  {
    domain: "real_estate",
    schemas: [
      ["property_id", "city", "state", "price", "area_sqft", "bedrooms", "bathrooms", "listed_date"],
      ["location", "rent", "property_type", "occupancy_rate", "maintenance_cost", "yield_rate"],
    ],
    kpis: ["Average Property Price", "Price Per Sqft", "Rental Yield", "Occupancy Rate"],
    charts: ["Price by City", "Price Per Sqft Trend", "Property Type Distribution", "Geo Property Map"],
    agentGoal: "Find high-value locations, pricing trends, rental yield, and investment opportunities.",
  },
  {
    domain: "crm_customer_success",
    schemas: [
      ["customer_id", "segment", "signup_date", "plan", "mrr", "churn_status", "support_tickets"],
      ["account_id", "industry", "revenue", "renewal_date", "health_score", "nps"],
    ],
    kpis: ["MRR", "Churn Rate", "Customer Lifetime Value", "NPS", "Account Health Score"],
    charts: ["MRR Trend", "Churn by Segment", "NPS by Plan", "Customer Health Distribution"],
    agentGoal: "Detect churn risk, revenue concentration, customer health, and upsell opportunities.",
  },
  {
    domain: "saas_product_analytics",
    schemas: [
      ["user_id", "event_name", "event_time", "feature", "session_duration", "plan"],
      ["workspace_id", "active_users", "retention_rate", "activation_rate", "feature usage"],
    ],
    kpis: ["DAU", "WAU", "Retention Rate", "Activation Rate", "Feature Adoption"],
    charts: ["Active Users Trend", "Feature Usage Ranking", "Retention Cohort", "Activation Funnel"],
    agentGoal: "Understand product usage, retention, activation, and feature adoption.",
  },
  {
    domain: "website_analytics",
    schemas: [
      ["date", "source", "medium", "sessions", "users", "bounce_rate", "conversion_rate"],
      ["page", "views", "avg_time", "exit_rate", "device", "country"],
    ],
    kpis: ["Total Sessions", "Conversion Rate", "Bounce Rate", "Average Session Duration"],
    charts: ["Traffic Trend", "Source Performance", "Device Breakdown", "Country Traffic Map"],
    agentGoal: "Analyze traffic quality, conversion, acquisition sources, and weak pages.",
  },
  {
    domain: "manufacturing_quality",
    schemas: [
      ["batch_id", "machine_id", "defect_count", "production_date", "units_produced", "downtime"],
      ["plant", "line", "oee", "scrap_rate", "cycle_time", "operator"],
    ],
    kpis: ["Defect Rate", "OEE", "Scrap Rate", "Downtime", "Cycle Time"],
    charts: ["Defect Trend", "OEE by Line", "Downtime by Machine", "Scrap Rate by Plant"],
    agentGoal: "Detect production inefficiency, quality issues, downtime, and defect patterns.",
  },
  {
    domain: "logistics_delivery",
    schemas: [
      ["shipment_id", "origin", "destination", "carrier", "delivery_time", "delay_days", "cost"],
      ["order_id", "route", "vehicle_id", "fuel_cost", "distance_km", "delivery_status"],
    ],
    kpis: ["Average Delivery Time", "Delay Rate", "Shipping Cost", "Cost Per KM"],
    charts: ["Delay by Carrier", "Cost by Route", "Delivery Status Breakdown", "Route Geo Map"],
    agentGoal: "Optimize delivery cost, delay, route performance, and carrier reliability.",
  },
  {
    domain: "insurance_claims",
    schemas: [
      ["claim_id", "policy_id", "claim_amount", "claim_type", "status", "claim_date", "region"],
      ["customer_id", "premium", "risk_score", "fraud_flag", "settlement_days"],
    ],
    kpis: ["Total Claims", "Average Claim Amount", "Fraud Rate", "Settlement Time"],
    charts: ["Claims by Type", "Claim Amount Distribution", "Fraud by Region", "Settlement Trend"],
    agentGoal: "Analyze claim cost, fraud risk, settlement efficiency, and regional exposure.",
  },
  {
    domain: "energy_utilities",
    schemas: [
      ["meter_id", "timestamp", "consumption_kwh", "region", "tariff", "customer_type"],
      ["plant_id", "generation_mwh", "fuel_type", "downtime", "efficiency"],
    ],
    kpis: ["Total Consumption", "Peak Demand", "Average Usage", "Generation Efficiency"],
    charts: ["Consumption Trend", "Usage by Region", "Peak Demand Heatmap", "Fuel Type Mix"],
    agentGoal: "Find usage patterns, demand peaks, efficiency issues, and regional consumption.",
  },
  {
    domain: "telecom",
    schemas: [
      ["customer_id", "plan", "monthly_bill", "data_usage_gb", "call_minutes", "churn"],
      ["tower_id", "region", "signal_strength", "dropped_calls", "network_type"],
    ],
    kpis: ["ARPU", "Churn Rate", "Average Data Usage", "Dropped Call Rate"],
    charts: ["Churn by Plan", "ARPU Trend", "Network Quality by Region", "Usage Distribution"],
    agentGoal: "Analyze churn, ARPU, usage behavior, and network quality.",
  },
  {
    domain: "restaurant_food_delivery",
    schemas: [
      ["order_id", "restaurant", "city", "order_value", "delivery_time", "rating", "cuisine"],
      ["customer_id", "repeat_orders", "discount", "refund_status", "payment_method"],
    ],
    kpis: ["Total Orders", "Average Order Value", "Average Delivery Time", "Rating", "Refund Rate"],
    charts: ["Orders Trend", "Top Restaurants", "Delivery Time by City", "Cuisine Performance"],
    agentGoal: "Improve delivery speed, restaurant performance, customer repeat rate, and rating.",
  },
];
