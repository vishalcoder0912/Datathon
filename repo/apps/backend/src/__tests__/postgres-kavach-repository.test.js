import { describe, expect, it } from 'vitest';
import { PostgresKavachRepository } from '../kavach/repositories/postgres-kavach-repository.js';

describe('PostgresKavachRepository', () => {
  it('uses values for district and geographic scope filters instead of interpolating input', async () => {
    const calls = [];
    const repository = new PostgresKavachRepository({
      queryExecutor: async (text, values) => {
        calls.push({ text, values });
        if (text.includes('to_regclass')) return { rows: [{ incidents_view: 'analytics.v_incidents' }] };
        if (text.includes('COUNT(*)::integer AS total')) return { rows: [{ total: 1 }] };
        return { rows: [{ crimeNo: '104430006202600001', districtId: 77, policeStationId: 9901 }] };
      },
    });

    expect(await repository.initialize()).toBe(true);
    const result = await repository.listCases({ district: "Mysuru' OR 1=1 --", page: 1, pageSize: 25 }, { roleCode: 'DISTRICT_OFFICER', districtId: 77 });

    expect(result.pagination).toMatchObject({ page: 1, pageSize: 25, total: 1 });
    const listCall = calls.at(-1);
    expect(listCall.text).not.toContain("Mysuru' OR 1=1 --");
    expect(listCall.values).toContainEqual(["mysuru' or 1=1 --"]);
    expect(listCall.values).toContain(77);
  });

  it('keeps an offender query syntactically scoped when no optional filters are supplied', async () => {
    const calls = [];
    const repository = new PostgresKavachRepository({
      queryExecutor: async (text, values) => {
        calls.push({ text, values });
        if (text.includes('COUNT(*)::integer AS total')) return { rows: [{ total: 0 }] };
        return { rows: [] };
      },
    });

    expect(await repository.getOffenders({}, { roleCode: 'EVALUATOR' })).toEqual([]);
    expect(calls.some((call) => call.text.includes("WHERE cpr.role_type = 'ACCUSED'"))).toBe(true);
  });
});
