# 🐛 InsightFlow - Bug Report Template

Use this template to document software defects, performance regressions, or security issues discovered during testing. Create a copy of this file for each bug.

---

## 📌 Issue Overview

| Attribute | Details |
| :--- | :--- |
| **Bug ID** | `BUG-XXXX` (e.g. BUG-001) |
| **Title** | [Short, descriptive summary of the issue] |
| **Reporter** | [Your Name/Role] |
| **Date Logged** | YYYY-MM-DD |
| **Status** | 🔴 New / 🟡 In Progress / 🟢 Resolved |

---

## 🎛️ Environment Details

* **Environment**: Local / Staging / Production
* **OS / Browser**: [e.g. Windows 11, Chrome v123.0]
* **Platform Component**: 🎨 Frontend UI / 📦 Backend API / 🧠 ML Service / 🛡️ Dashboard Guardian / ⚡ Cache System

---

## 🛑 Bug Details

### 1. Severity & Impact
* **Severity**: 🔴 Critical / 🟠 High / 🟡 Medium / 🔵 Low
* **Impact**: [Does it block user flows? Is there a workaround?]

### 2. Steps to Reproduce
1. Navigate to `[URL or page]` (e.g. `/upload`).
2. Upload the file `[filename]` or perform `[action]`.
3. Enter query or trigger trigger: `[inputs / queries]`.
4. Observe the interface behavior or backend response logs.

### 3. Expected Result
* [Describe what should have happened according to requirements]

### 4. Actual Result
* [Describe the actual buggy behavior, with error messages, console logs, or stack traces if available]

```txt
// Paste any console errors, API error payloads, or logs here
```

---

## 🔍 Technical Analysis

### 1. Root Cause
* [Explain why the bug occurred, referencing specific functions, hooks, or queries if known]

### 2. Affected Files
* [ ] [file_name](file:///path/to/file)
* [ ] [another_file](file:///path/to/another_file)

### 3. Suggested Fix / Workaround
* [Outline the recommended code change or temporary mitigation]

---

## ✅ Resolution & Verification

* **Developer Assigned**: [Name]
* **Pull Request (PR)**: [PR Link or #ID]
* **Regression Test Added**: Yes / No (If yes, link to test file)
* **QA Sign-off**: [QA Engineer / Date]
