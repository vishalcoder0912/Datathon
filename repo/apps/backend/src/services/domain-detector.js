export function detectDomain(columns = [], dictionary = {}) {
  const names = columns.map((c) => String(c.name || c).toLowerCase()).join(" ");
  const dictText = JSON.stringify(dictionary).toLowerCase();

  const text = `${names} ${dictText}`;

  if (/salary|experience|education|framework|language|company_size|job/.test(text)) {
    return {
      domain: "salary_hr_jobs",
      confidence: 0.95,
      label: "Salary / HR / Jobs",
    };
  }

  if (/revenue|sales|order|product|customer|profit|amount/.test(text)) {
    return {
      domain: "sales",
      confidence: 0.9,
      label: "Sales Analytics",
    };
  }

  if (/student|marks|score|attendance|class|course|grade/.test(text)) {
    return {
      domain: "education",
      confidence: 0.88,
      label: "Education Analytics",
    };
  }

  if (/transaction|balance|credit|debit|loan|bank|finance/.test(text)) {
    return {
      domain: "finance",
      confidence: 0.82,
      label: "Finance Analytics",
    };
  }

  return {
    domain: "generic",
    confidence: 0.5,
    label: "Generic Dataset",
  };
}
