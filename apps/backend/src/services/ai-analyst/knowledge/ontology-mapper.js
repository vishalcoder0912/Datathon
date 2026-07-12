import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ontologyPath = path.join(__dirname, 'business-ontology.json');
const ontologyRaw = fs.readFileSync(ontologyPath, 'utf8');
const ontology = JSON.parse(ontologyRaw);

/**
 * Maps a given array of raw column names to canonical terms based on the business ontology.
 */
export function mapSchemaToOntology(schemaColumns = []) {
  const mappedTerms = new Set();
  const rawToCanonical = {};

  for (const col of schemaColumns) {
    const rawName = col.toLowerCase().replace(/[^a-z0-9]/g, '');
    let matchedCanonical = null;

    for (const [canonical, synonyms] of Object.entries(ontology)) {
      if (rawName.includes(canonical)) {
        matchedCanonical = canonical;
        break;
      }
      for (const synonym of synonyms) {
        if (rawName.includes(synonym)) {
          matchedCanonical = canonical;
          break;
        }
      }
    }

    if (matchedCanonical) {
      mappedTerms.add(matchedCanonical);
      rawToCanonical[col] = matchedCanonical;
    }
  }

  // Very simple heuristic to guess domain based on canonical overlaps
  const terms = Array.from(mappedTerms);
  let inferredDomain = 'generic';

  if (terms.includes('salary') || (terms.includes('performance') && terms.includes('cost'))) inferredDomain = 'hr_salary';
  if (terms.includes('revenue') && terms.includes('customer')) inferredDomain = 'sales';
  if (terms.includes('order') && terms.includes('product')) inferredDomain = 'ecommerce';
  if (terms.includes('campaign') || terms.includes('conversion')) inferredDomain = 'marketing';
  if (terms.includes('churn') || terms.includes('customer')) inferredDomain = 'crm';
  if (terms.includes('fraud') || terms.includes('risk')) inferredDomain = 'banking_fraud';
  if (terms.includes('claim')) inferredDomain = 'insurance';
  if (terms.includes('delivery') || terms.includes('stock')) inferredDomain = 'logistics_inventory';

  return {
    inferredDomain,
    canonicalTerms: terms,
    mapping: rawToCanonical
  };
}
