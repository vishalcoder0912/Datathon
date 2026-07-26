import {expect, test, type Page} from "@playwright/test";

const evaluator = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: "evaluator@kavach.local",
  displayName: "Synthetic Data Evaluator",
  roleCode: "EVALUATOR",
  clearanceLevel: 1,
};

async function mockKavachApi(page: Page) {
  let loggedIn = false;
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (!path.startsWith("/api/")) return route.continue();
    const json = (data: unknown, status = 200) => route.fulfill({status, contentType: "application/json", body: JSON.stringify({success: status < 400, data})});

    if (path === "/api/auth/refresh") return json({message: "No initial session"}, 401);
    if (path === "/api/auth/login") {
      loggedIn = true;
      return json({accessToken: "e2e-access-token", user: evaluator});
    }
    if (path === "/api/auth/me") return loggedIn ? json(evaluator) : json({message: "No authenticated session"}, 401);
    if (path === "/api/auth/logout") return json({loggedOut: true});

    if (path === "/api/kavach/overview") return json({
      totalIncidents: 42,
      activeInvestigations: 11,
      closedInvestigations: 22,
      highRiskDistricts: 1,
      activeHotspots: 1,
      repeatOffenders: 1,
      currentAlerts: 1,
      mostCommonCategory: "Burglary",
      dataQualityScore: 96,
      monthlyTrend: [{month: "2026-06", incidents: 12}],
      categoryDistribution: [{name: "Burglary", value: 12}],
      districtComparison: [{district: "Bengaluru Urban", incidents: 20}],
      dayOfWeekAnalysis: [{day: "Monday", incidents: 8}],
      severityBreakdown: [{name: "HIGH", value: 7}],
    });
    if (path === "/api/kavach/alerts" && request.method() === "GET") return json([{
      id: "alert-1", type: "CRIME_SPIKE", severity: "HIGH", title: "Spike in Bengaluru Urban",
      description: "Current 7-day count is 9 compared with a 28-day baseline average of 4.", districtId: 1,
      detectedAt: "2026-07-15T08:00:00.000Z", reviewed: false,
      evidence: {currentCount: 9, baselineAverage: 4, zScore: 3.2},
    }]);
    if (path === "/api/kavach/alerts/alert-1/review") return json({id: "alert-1", status: "ACKNOWLEDGED", reviewed: true});
    if (path === "/api/kavach/districts") return json([{district: "Bengaluru Urban", districtId: 1, totalIncidents: 20, riskScore: 74, activeAlerts: 1, hotspots: 1}]);
    if (path.startsWith("/api/kavach/districts/")) return json({district: "Bengaluru Urban", districtId: 1, totalIncidents: 20, riskScore: 74, activeAlerts: 1, hotspots: 1});
    if (path === "/api/kavach/police-stations") return json([{stationId: 101, stationName: "Central Demo Station", districtName: "Bengaluru Urban", totalIncidents: 20, latitude: 12.9716, longitude: 77.5946}]);
    if (path === "/api/kavach/hotspots") return json([{
      hotspotId: "hotspot-1", district: "Bengaluru Urban", incidentCount: 7, dominantCategory: "Burglary", riskScore: 71, confidence: 0.82,
      evidence: ["Seven synthetic incidents were clustered within the configured spatial radius during the selected period."],
    }]);
    if (path === "/api/kavach/network") return json({
      nodes: [
        {id: "person-1", label: "R*** S***", type: "PERSON", isRepeat: true},
        {id: "case-1", label: "104430006202600001", type: "CASE"},
      ],
      edges: [{id: "edge-1", source: "person-1", target: "case-1", relationshipType: "ACCUSED_IN", weight: 2, evidence: [{crimeNo: "104430006202600001", reason: "The masked person is recorded as accused in this synthetic case."}]}],
    });
    if (path === "/api/kavach/offenders") return json([{personId: "person-1", name: "R*** S***", incidentCount: 2, districtCount: 1, stationCount: 1, coAccusedCount: 1, linkComplexityScore: 45, labels: ["MULTIPLE_CASE_LINKS"], lastSeen: "2026-07-14"}]);
    if (path === "/api/kavach/offenders/person-1") return json({
      person: {personId: "person-1", name: "R*** S***"}, incidentCount: 2, districtCount: 1, stationCount: 1, coAccusedCount: 1, linkComplexityScore: 45,
      labels: ["MULTIPLE_CASE_LINKS"], incidents: [{firNumber: "104430006202600001", date: "2026-07-14", crimeType: "Burglary", district: "Bengaluru Urban"}],
      commonModusOperandi: ["Forced rear entry"],
    });
    if (path === "/api/kavach/cases/104430006202600001/similar-mo") return json([{
      crimeNo: "104430006202600019", incidentDate: "2026-07-08", crimeType: "Burglary", district: "Bengaluru Urban", similarityScore: 0.82,
      matchedFeatures: ["entry_method", "time_pattern", "target_type"], evidence: ["Both synthetic incidents used forced rear entry during late-night hours."],
    }]);
    if (path === "/api/kavach/reports" && request.method() === "POST") return json({reportId: "report-1", html: "<!doctype html><html><body><h1>KAVACH Intelligence Report</h1><p>Synthetic data only.</p></body></html>"});

    return json({});
  });
}

test("evaluator investigation story uses scoped, explainable KAVACH intelligence", async ({page}) => {
  await mockKavachApi(page);
  await page.goto("/login?auth=required");

  await expect(page.getByRole("heading", {name: "KAVACH AI"})).toBeVisible();
  await page.getByLabel("Password").fill("synthetic-demo-password");
  await page.getByRole("button", {name: "Sign in"}).click();
  await expect(page.getByRole("heading", {name: "KAVACH AI Workspace"})).toBeVisible();

  await page.getByRole("link", {name: "Alerts"}).click();
  await expect(page.getByText("Spike in Bengaluru Urban")).toBeVisible();
  await page.getByRole("button", {name: /mark reviewed/i}).click();
  await expect(page.getByText("0 Unread")).toBeVisible();

  await page.getByRole("link", {name: "Geo Intelligence"}).click();
  await expect(page.getByText("State-wide Digital Twin")).toBeVisible();
  await page.locator("button").filter({hasText: "Bengaluru Urban"}).last().click();
  await expect(page.getByRole("heading", {name: "Bengaluru Urban"})).toBeVisible();

  await page.getByRole("link", {name: "Person Links"}).click();
  await expect(page.getByText("Person Link Intelligence")).toBeVisible();
  await page.getByText("person-1").click();
  await expect(page.getByText("Historical link indicators")).toBeVisible();
  await page.getByRole("button", {name: "Find similar MO"}).click();
  await expect(page.getByText("104430006202600019")).toBeVisible();
  await expect(page.getByText(/Both synthetic incidents used forced rear entry/i)).toBeVisible();

  await page.getByRole("link", {name: "Network Intelligence"}).click();
  await expect(page.getByLabel("Interactive relationship network graph")).toBeVisible();
  await page.getByRole("button", {name: "Inspect evidence for ACCUSED_IN"}).click();
  await expect(page.getByText("Edge evidence")).toBeVisible();
  await expect(page.getByText("The masked person is recorded as accused in this synthetic case.")).toBeVisible();

  await page.getByRole("link", {name: "Reports"}).click();
  await page.getByRole("button", {name: "Generate Report"}).click();
  await expect(page.getByText("Generated")).toBeVisible();
});
