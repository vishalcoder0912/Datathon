# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: geo-intelligence-flow.spec.ts >> Geo Intelligence Flow displays the geo card with locations for geo datasets and shows fallback text for non-geo datasets
- Location: e2e\geo-intelligence-flow.spec.ts:4:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  getByText('India').first()
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('India').first()
    8 × locator resolved to <option value="India">India</option>
      - unexpected value "hidden"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - region "Notifications (F8)":
      - list
    - region "Notifications alt+T"
    - generic [ref=e3]:
      - complementary [ref=e6]:
        - link "InsightFlow salary-small" [ref=e8] [cursor=pointer]:
          - /url: /dashboard
          - img [ref=e10]
          - generic [ref=e12]:
            - heading "InsightFlow" [level=1] [ref=e13]
            - paragraph [ref=e14]: salary-small
        - paragraph [ref=e16]: Menu
        - navigation [ref=e17]:
          - link "Dashboard" [ref=e18] [cursor=pointer]:
            - /url: /dashboard
            - generic [ref=e19]:
              - img [ref=e21]
              - generic [ref=e26]: Dashboard
          - link "Data Table" [ref=e27] [cursor=pointer]:
            - /url: /data
            - generic [ref=e28]:
              - img [ref=e30]
              - generic [ref=e32]: Data Table
          - link "Upload" [ref=e33] [cursor=pointer]:
            - /url: /upload
            - generic [ref=e34]:
              - img [ref=e36]
              - generic [ref=e39]: Upload
          - link "PDF Intelligence" [ref=e40] [cursor=pointer]:
            - /url: /pdf
            - generic [ref=e41]:
              - img [ref=e43]
              - generic [ref=e46]: PDF Intelligence
          - link "Analytics" [ref=e47] [cursor=pointer]:
            - /url: /analytics
            - generic [ref=e48]:
              - img [ref=e50]
              - generic [ref=e53]: Analytics
          - link "AI Chat" [ref=e54] [cursor=pointer]:
            - /url: /chat
            - generic [ref=e55]:
              - img [ref=e57]
              - generic [ref=e59]: AI Chat
          - link "Agentic AI" [ref=e60] [cursor=pointer]:
            - /url: /agentic
            - generic [ref=e61]:
              - img [ref=e63]
              - generic [ref=e65]: Agentic AI
          - link "Data Science" [ref=e66] [cursor=pointer]:
            - /url: /agentic-data-science
            - generic [ref=e67]:
              - img [ref=e69]
              - generic [ref=e81]: Data Science
        - generic [ref=e83]:
          - generic [ref=e84]:
            - paragraph [ref=e85]: AI Engine Status
            - button "Refresh AI engine status" [ref=e86] [cursor=pointer]:
              - img [ref=e87]
          - generic [ref=e92]:
            - generic [ref=e93]:
              - generic [ref=e94]: Gemini
              - generic [ref=e95]: Offline
            - generic [ref=e97]:
              - generic [ref=e98]: Ollama
              - generic [ref=e99]: Offline
            - generic [ref=e102]:
              - generic [ref=e103]: Mode
              - generic [ref=e104]: Hybrid
            - generic [ref=e105]:
              - generic [ref=e106]: Fallback
              - generic [ref=e107]: Local AI
          - generic [ref=e108]:
            - img [ref=e109]
            - generic [ref=e111]: Gemini API key is missing or invalid.
      - main [ref=e112]:
        - generic [ref=e114]:
          - button "salary-small 3 rows" [ref=e115] [cursor=pointer]:
            - generic [ref=e116]:
              - generic [ref=e117]: salary-small
              - generic [ref=e118]: 3 rows
            - img [ref=e120]
          - generic [ref=e122]:
            - img [ref=e123]
            - textbox "Ask InsightFlow AI anything about your data..." [ref=e125]
            - button "Run AI command" [ref=e126] [cursor=pointer]:
              - img [ref=e127]
          - generic [ref=e129]:
            - button "Refresh" [ref=e130] [cursor=pointer]:
              - img [ref=e131]
              - text: Refresh
            - button "Export" [ref=e136] [cursor=pointer]:
              - img [ref=e137]
              - text: Export
            - button "Share" [ref=e140] [cursor=pointer]:
              - img [ref=e141]
              - text: Share
        - generic [ref=e148]:
          - generic [ref=e149]:
            - generic [ref=e150]:
              - img [ref=e152]
              - generic [ref=e154]:
                - generic [ref=e155]:
                  - heading "InsightFlow Agentic Dashboard" [level=1] [ref=e156]
                  - heading "salary-small" [level=2] [ref=e157]
                - paragraph [ref=e158]: Your AI agent analyzes real uploaded data and controls KPIs, charts, filters, and insights.
            - generic [ref=e159]:
              - generic [ref=e160]: "Last updated: No AI actions yet"
              - button "Run Analysis" [ref=e162] [cursor=pointer]:
                - img [ref=e163]
                - text: Run Analysis
          - generic [ref=e165]:
            - combobox [ref=e166]:
              - option "All Country" [selected]
              - option "India"
              - option "USA"
            - button "Reset" [ref=e167] [cursor=pointer]:
              - img [ref=e168]
              - text: Reset
          - generic [ref=e173]:
            - generic [ref=e174]:
              - generic [ref=e175]:
                - generic [ref=e176]:
                  - paragraph [ref=e177]: Total Records
                  - paragraph [ref=e178]: "3"
                  - paragraph [ref=e180]: COUNT - Row Count
                - img [ref=e182]
              - paragraph [ref=e187]: count(__row_count__)
            - generic [ref=e188]:
              - generic [ref=e189]:
                - generic [ref=e190]:
                  - paragraph [ref=e191]: Average Salary
                  - paragraph [ref=e192]: $68,333.33
                  - generic [ref=e193]:
                    - generic [ref=e194]: +55%
                    - paragraph [ref=e195]: AVG - Salary Usd
                - img [ref=e197]
              - img [ref=e201]
            - generic [ref=e203]:
              - generic [ref=e204]:
                - generic [ref=e205]:
                  - paragraph [ref=e206]: Median Salary
                  - paragraph [ref=e207]: $65,000.00
                  - generic [ref=e208]:
                    - generic [ref=e209]: +55%
                    - paragraph [ref=e210]: MEDIAN - Salary Usd
                - img [ref=e212]
              - img [ref=e215]
            - generic [ref=e217]:
              - generic [ref=e218]:
                - generic [ref=e219]:
                  - paragraph [ref=e220]: Top Location
                  - paragraph [ref=e221]: USA
                  - paragraph [ref=e223]: By Salary Usd
                - img [ref=e225]
              - paragraph [ref=e229]: Calculated from filtered rows
            - generic [ref=e230]:
              - generic [ref=e231]:
                - generic [ref=e232]:
                  - paragraph [ref=e233]: Data Quality Score
                  - paragraph [ref=e234]: 100%
                  - paragraph [ref=e236]: 100% complete
                - img [ref=e238]
              - paragraph [ref=e241]: Calculated from filtered rows
          - generic [ref=e242]:
            - main [ref=e243]:
              - generic [ref=e244]:
                - generic [ref=e246]:
                  - generic [ref=e247]:
                    - generic [ref=e248]:
                      - heading "Average Salary by Country" [level=3] [ref=e249]
                      - paragraph [ref=e250]: AVG - Country vs Salary Usd
                    - generic [ref=e251]:
                      - button "Explain" [ref=e252] [cursor=pointer]:
                        - img [ref=e253]
                        - text: Explain
                      - combobox "Edit chart type" [ref=e255]:
                        - option "bar" [selected]
                        - option "horizontal bar"
                        - option "line"
                        - option "area"
                        - option "pie"
                        - option "donut"
                        - option "histogram"
                        - option "scatter"
                        - option "radar"
                        - option "composed"
                        - option "heatmap"
                      - button [ref=e256] [cursor=pointer]:
                        - img
                  - img [ref=e260]:
                    - generic [ref=e265]:
                      - generic [ref=e267]: USA
                      - generic [ref=e269]: India
                    - generic [ref=e271]:
                      - generic [ref=e273]: "0"
                      - generic [ref=e275]: "25000"
                      - generic [ref=e277]: "50000"
                      - generic [ref=e279]: "75000"
                      - generic [ref=e281]: "100000"
                  - generic [ref=e289]:
                    - generic [ref=e290]: "Metric Used: salary_usd"
                    - generic [ref=e291]: "Calculation Source: AVG(salary_usd) grouped by country"
                - generic [ref=e293]:
                  - generic [ref=e294]:
                    - generic [ref=e295]:
                      - heading "Records by Country" [level=3] [ref=e296]
                      - paragraph [ref=e297]: COUNT - Country vs Count
                    - generic [ref=e298]:
                      - button "Explain" [ref=e299] [cursor=pointer]:
                        - img [ref=e300]
                        - text: Explain
                      - combobox "Edit chart type" [ref=e302]:
                        - option "bar"
                        - option "horizontal bar"
                        - option "line"
                        - option "area"
                        - option "pie"
                        - option "donut" [selected]
                        - option "histogram"
                        - option "scatter"
                        - option "radar"
                        - option "composed"
                        - option "heatmap"
                      - button [ref=e303] [cursor=pointer]:
                        - img
                  - generic [ref=e306]:
                    - img [ref=e307]:
                      - generic [ref=e309]:
                        - img [ref=e311]
                        - img [ref=e313]
                    - list [ref=e315]:
                      - listitem [ref=e316]:
                        - img [ref=e317]
                        - text: India
                      - listitem [ref=e319]:
                        - img [ref=e320]
                        - text: USA
                  - generic [ref=e322]:
                    - generic [ref=e323]: "Metric Used: count"
                    - generic [ref=e324]: "Calculation Source: COUNT(count) grouped by country"
                - generic [ref=e326]:
                  - generic [ref=e327]:
                    - generic [ref=e328]:
                      - heading "Average Salary Usd by Country" [level=3] [ref=e329]
                      - paragraph [ref=e330]: AVG - Country vs Salary Usd
                    - generic [ref=e331]:
                      - button "Explain" [ref=e332] [cursor=pointer]:
                        - img [ref=e333]
                        - text: Explain
                      - combobox "Edit chart type" [ref=e335]:
                        - option "bar" [selected]
                        - option "horizontal bar"
                        - option "line"
                        - option "area"
                        - option "pie"
                        - option "donut"
                        - option "histogram"
                        - option "scatter"
                        - option "radar"
                        - option "composed"
                        - option "heatmap"
                      - button [ref=e336] [cursor=pointer]:
                        - img
                  - img [ref=e340]:
                    - generic [ref=e345]:
                      - generic [ref=e347]: USA
                      - generic [ref=e349]: India
                    - generic [ref=e351]:
                      - generic [ref=e353]: "0"
                      - generic [ref=e355]: "25000"
                      - generic [ref=e357]: "50000"
                      - generic [ref=e359]: "75000"
                      - generic [ref=e361]: "100000"
                  - generic [ref=e369]:
                    - generic [ref=e370]: "Metric Used: salary_usd"
                    - generic [ref=e371]: "Calculation Source: AVG(salary_usd) grouped by country"
                - generic [ref=e373]:
                  - generic [ref=e374]:
                    - generic [ref=e375]:
                      - heading "Salary Usd Distribution" [level=3] [ref=e376]
                      - paragraph [ref=e377]: COUNT - Range vs Count
                    - generic [ref=e378]:
                      - button "Explain" [ref=e379] [cursor=pointer]:
                        - img [ref=e380]
                        - text: Explain
                      - combobox "Edit chart type" [ref=e382]:
                        - option "bar"
                        - option "horizontal bar"
                        - option "line"
                        - option "area"
                        - option "pie"
                        - option "donut"
                        - option "histogram" [selected]
                        - option "scatter"
                        - option "radar"
                        - option "composed"
                        - option "heatmap"
                      - button [ref=e383] [cursor=pointer]:
                        - img
                  - img [ref=e387]:
                    - generic [ref=e392]:
                      - generic [ref=e394]: 50000-55000
                      - generic [ref=e396]: 60000-65000
                      - generic [ref=e398]: 70000-75000
                      - generic [ref=e400]: 85000-90000
                    - generic [ref=e402]:
                      - generic [ref=e404]: "0"
                      - generic [ref=e406]: "0.25"
                      - generic [ref=e408]: "0.5"
                      - generic [ref=e410]: "0.75"
                      - generic [ref=e412]: "1"
                  - generic [ref=e422]:
                    - generic [ref=e423]: "Metric Used: count"
                    - generic [ref=e424]: "Calculation Source: COUNT(count) grouped by range"
                - generic [ref=e426]:
                  - generic [ref=e427]:
                    - generic [ref=e428]:
                      - heading "Top Country by Salary Usd" [level=3] [ref=e429]
                      - paragraph [ref=e430]: MAX - Country vs Salary Usd
                    - generic [ref=e431]:
                      - button "Explain" [ref=e432] [cursor=pointer]:
                        - img [ref=e433]
                        - text: Explain
                      - combobox "Edit chart type" [ref=e435]:
                        - option "bar"
                        - option "horizontal bar" [selected]
                        - option "line"
                        - option "area"
                        - option "pie"
                        - option "donut"
                        - option "histogram"
                        - option "scatter"
                        - option "radar"
                        - option "composed"
                        - option "heatmap"
                      - button [ref=e436] [cursor=pointer]:
                        - img
                  - img [ref=e440]:
                    - generic [ref=e445]:
                      - generic [ref=e447]: "0"
                      - generic [ref=e449]: "25000"
                      - generic [ref=e451]: "50000"
                      - generic [ref=e453]: "75000"
                      - generic [ref=e455]: "100000"
                    - generic [ref=e457]:
                      - generic [ref=e459]: USA
                      - generic [ref=e461]: India
                  - generic [ref=e469]:
                    - generic [ref=e470]: "Metric Used: salary_usd"
                    - generic [ref=e471]: "Calculation Source: MAX(salary_usd) grouped by country"
              - generic [ref=e472]:
                - generic [ref=e474]:
                  - generic [ref=e475]:
                    - img [ref=e477]
                    - generic [ref=e480]:
                      - heading "Geo Intelligence" [level=2] [ref=e481]
                      - paragraph [ref=e482]: 2 locations - Salary Usd
                  - generic [ref=e484]:
                    - img [ref=e485]
                    - generic [ref=e488]: "Field: country"
                - generic [ref=e490]:
                  - generic [ref=e491]:
                    - paragraph [ref=e492]: Field Used
                    - paragraph [ref=e493]: country
                    - paragraph [ref=e494]: Detected geographic column
                  - generic [ref=e495]:
                    - paragraph [ref=e496]: Locations
                    - paragraph [ref=e497]: "2"
                    - paragraph [ref=e498]: Countries/regions with data
                  - generic [ref=e499]:
                    - paragraph [ref=e500]: Top Location
                    - paragraph [ref=e501]: United States
                    - paragraph [ref=e502]: "Avg salary_usd: $90,000"
                  - generic [ref=e503]:
                    - paragraph [ref=e504]: Average
                    - paragraph [ref=e505]: $73,750
                    - paragraph [ref=e506]: Across 2 locations
                  - generic [ref=e507]:
                    - paragraph [ref=e508]: Total Records
                    - paragraph [ref=e509]: "3"
                    - paragraph [ref=e510]: Salary Usd
                - generic [ref=e511]:
                  - generic [ref=e512]:
                    - img [ref=e514]
                    - generic [ref=e696]:
                      - generic [ref=e697]: No data
                      - generic [ref=e699]: Low
                      - generic [ref=e701]: Medium
                      - generic [ref=e703]: High
                  - generic [ref=e705]:
                    - generic [ref=e706]:
                      - heading "Top Locations" [level=3] [ref=e707]
                      - generic [ref=e708]:
                        - 'button "1 United States $90,000 1 records #1" [ref=e709] [cursor=pointer]':
                          - generic [ref=e710]:
                            - generic [ref=e711]:
                              - generic [ref=e712]: "1"
                              - generic [ref=e713]: United States
                            - generic [ref=e714]: $90,000
                          - generic [ref=e717]:
                            - generic [ref=e718]: 1 records
                            - generic [ref=e719]: "#1"
                        - 'button "2 India $57,500 2 records #2" [ref=e720] [cursor=pointer]':
                          - generic [ref=e721]:
                            - generic [ref=e722]:
                              - generic [ref=e723]: "2"
                              - generic [ref=e724]: India
                            - generic [ref=e725]: $57,500
                          - generic [ref=e728]:
                            - generic [ref=e729]: 2 records
                            - generic [ref=e730]: "#2"
                    - generic [ref=e731]:
                      - generic [ref=e732]:
                        - img [ref=e733]
                        - text: AI Geo Insight
                      - paragraph [ref=e735]: Analyzing 2 locations with salary_usd as the primary metric. Top location is United States ($90,000), followed by India.
              - generic [ref=e736]:
                - generic [ref=e737]:
                  - generic [ref=e738]:
                    - heading "Data-Driven Insights" [level=2] [ref=e739]
                    - paragraph [ref=e740]: Generated from the current filtered dataset.
                  - link "Open Copilot" [ref=e741] [cursor=pointer]:
                    - /url: /chat
                - generic [ref=e742]:
                  - generic [ref=e743]:
                    - img [ref=e744]
                    - paragraph [ref=e746]: USA leads
                    - paragraph [ref=e747]: Highest average Salary Usd is 90000.
                  - generic [ref=e748]:
                    - img [ref=e749]
                    - paragraph [ref=e751]: Data quality is strong
                    - paragraph [ref=e752]: 100% completeness and 100% uniqueness across the dataset.
                  - generic [ref=e753]:
                    - img [ref=e754]
                    - paragraph [ref=e756]: Anomaly watch
                    - paragraph [ref=e757]: 0 records in Salary Usd stand far from the average.
              - generic [ref=e758]:
                - generic [ref=e759]:
                  - generic [ref=e760]:
                    - heading "Dataset Preview" [level=2] [ref=e761]
                    - paragraph [ref=e762]: 3 filtered rows x 3 columns
                  - link "View Table" [ref=e763] [cursor=pointer]:
                    - /url: /data
                    - img [ref=e764]
                    - text: View Table
                - table [ref=e767]:
                  - rowgroup [ref=e768]:
                    - row "country salary_usd experience" [ref=e769]:
                      - columnheader "country" [ref=e770]
                      - columnheader "salary_usd" [ref=e771]
                      - columnheader "experience" [ref=e772]
                  - rowgroup [ref=e773]:
                    - row "India 50000 2" [ref=e774]:
                      - cell "India" [ref=e775]
                      - cell "50000" [ref=e776]
                      - cell "2" [ref=e777]
                    - row "USA 90000 5" [ref=e778]:
                      - cell "USA" [ref=e779]
                      - cell "90000" [ref=e780]
                      - cell "5" [ref=e781]
                    - row "India 65000 3" [ref=e782]:
                      - cell "India" [ref=e783]
                      - cell "65000" [ref=e784]
                      - cell "3" [ref=e785]
            - complementary [ref=e786]:
              - generic [ref=e787]:
                - generic [ref=e788]:
                  - generic [ref=e789]:
                    - img [ref=e791]
                    - generic [ref=e793]:
                      - heading "InsightFlow AI" [level=2] [ref=e794]
                      - paragraph [ref=e795]: AI can control dashboard layout and metrics.
                  - generic [ref=e796]: Active
                - generic [ref=e798]:
                  - generic [ref=e799]:
                    - img [ref=e801]
                    - generic [ref=e804]: InsightFlow AI
                    - generic [ref=e805]: 03:43 PM
                  - paragraph [ref=e806]: I can control dashboard layout, metrics, charts, filters, and Geo Intelligence.
                - generic [ref=e808]:
                  - textbox "Ask InsightFlow AI" [ref=e809]:
                    - /placeholder: "Ask: Ask InsightFlow AI..."
                  - button "Send dashboard command" [ref=e810] [cursor=pointer]:
                    - img [ref=e811]
              - generic [ref=e814]:
                - generic [ref=e815]:
                  - heading "Suggested actions" [level=3] [ref=e816]
                  - generic [ref=e817]: View all
                - generic [ref=e818]:
                  - button "Compare Salary Usd by Country" [ref=e819] [cursor=pointer]
                  - button "Show top 5 Country by Salary Usd" [ref=e820] [cursor=pointer]
                  - button "Add a KPI for median Salary Usd" [ref=e821] [cursor=pointer]
                  - button "Run Geo Intelligence" [ref=e822] [cursor=pointer]
                  - button "Explain the trend" [ref=e823] [cursor=pointer]
              - generic [ref=e824]:
                - generic [ref=e825]:
                  - heading "Recent actions" [level=3] [ref=e826]
                  - generic [ref=e827]: View all
                - paragraph [ref=e829]: AI dashboard actions will appear here.
              - generic [ref=e831]:
                - generic [ref=e833]: 100%
                - generic [ref=e834]:
                  - paragraph [ref=e835]: Schema confidence
                  - paragraph [ref=e836]: Based on data quality and field compatibility.
          - generic [ref=e837]:
            - img [ref=e838]
            - text: Schema-safe local calculations
  - generic [ref=e841]: "0.25"
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | import { gotoApp, mockInsightFlowApi } from "./helpers";
  3  | 
  4  | test("Geo Intelligence Flow displays the geo card with locations for geo datasets and shows fallback text for non-geo datasets", async ({ page }) => {
  5  |   // 1. Test WITH geo dimensions (default mock contains 'country')
  6  |   await mockInsightFlowApi(page);
  7  |   await gotoApp(page, "/dashboard");
  8  | 
  9  |   // Verify that Geo Intelligence card renders and displays locations
  10 |   await expect(page.getByText("Geo Intelligence").first()).toBeVisible();
  11 |   await expect(page.getByText("Top Locations").first()).toBeVisible();
> 12 |   await expect(page.getByText("India").first()).toBeVisible();
     |                                                 ^ Error: expect(locator).toBeVisible() failed
  13 | 
  14 |   // 2. Test WITHOUT geo dimensions
  15 |   await page.route("**/api/state", async (route) => {
  16 |     return route.fulfill({
  17 |       json: {
  18 |         success: true,
  19 |         data: {
  20 |           dataset: {
  21 |             id: "e2e-no-geo",
  22 |             name: "sales-no-geo",
  23 |             rowCount: 2,
  24 |             columns: [
  25 |               { name: "order_id", type: "string" },
  26 |               { name: "revenue", type: "number" },
  27 |             ],
  28 |             rows: [
  29 |               { order_id: "1", revenue: 100 },
  30 |               { order_id: "2", revenue: 200 },
  31 |             ],
  32 |           },
  33 |           chatMessages: [],
  34 |           analysis: {
  35 |             dataTypeLabel: "Sales",
  36 |             insights: [],
  37 |             chartRecommendations: [],
  38 |           },
  39 |         },
  40 |       },
  41 |     });
  42 |   });
  43 | 
  44 |   // Reload the page to load the new state
  45 |   await page.reload();
  46 | 
  47 |   // Verify that the Geo Intelligence card displays the fallback text when no geo field is detected
  48 |   await expect(page.getByText("No geographic field detected in this dataset.").first()).toBeVisible();
  49 | });
  50 | 
```