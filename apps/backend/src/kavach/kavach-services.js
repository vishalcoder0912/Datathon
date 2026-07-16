import {
  Daypart, CrimeSeverity, InvestigationStatus, RiskBand,
  AlertType, AlertSeverity, KARNATAKA_DISTRICTS, CRIME_CATEGORIES, MODUS_OPERANDI_TYPES,
  classifyDaypart, parseDateSafe, formatDateISO, clamp,
  normalizeArray, roundTo, isSufficientData, getPeriodDates,
  zScore, iqr, normalizeDistrictName, PIIMask
} from '@kavach/domain';

export class KavachServices {
  constructor(repo) {
    this.repo = repo;
    this._storedAlerts = [];
  }

  getOverview(filters = {}) {
    const incidents = this.repo.getIncidents(filters);
    const persons = this.repo.getPersons();
    const relationships = this.repo.getRelationships();
    const indicators = this.repo.getDistrictIndicators();

    const totalIncidents = incidents.length;
    const activeInvestigations = incidents.filter(i => i.status === 'UNDER_INVESTIGATION').length;
    const closedInvestigations = incidents.filter(i => i.status === 'CLOSED').length;
    const pending = incidents.filter(i => i.status === 'PENDING').length;
    const cold = incidents.filter(i => i.status === 'COLD').length;

    const districts = [...new Set(incidents.map(i => i.district).filter(Boolean))];
    const districtIncidentCounts = districts.map(d =>
      incidents.filter(i => i.district === d).length
    );
    const mean = districtIncidentCounts.reduce((a, b) => a + b, 0) / (districts.length || 1);
    const std = Math.sqrt(
      districtIncidentCounts.reduce((a, b) => a + (b - mean) ** 2, 0) / (districts.length || 1)
    );
    const highRiskDistricts = districtIncidentCounts.filter(c => c > mean + std).length;

    const categoryCounts = {};
    const severityCounts = {};
    for (const inc of incidents) {
      const cat = inc.crime_type || 'Unknown';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      const sev = inc.severity || 'LOW';
      severityCounts[sev] = (severityCounts[sev] || 0) + 1;
    }
    const mostCommonCategory = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

    const districtCount = districts.length;
    const activeHotspots = Math.min(districtCount, Math.round(districts.length * 0.3));

    const offenderIds = new Set(
      this.repo.getIncidentPersons()
        .filter(ip => ip.role === 'OFFENDER')
        .map(ip => ip.person_id)
    );
    const repeatOffenderMap = {};
    for (const ip of this.repo.getIncidentPersons()) {
      if (ip.role !== 'OFFENDER') continue;
      repeatOffenderMap[ip.person_id] = (repeatOffenderMap[ip.person_id] || 0) + 1;
    }
    const repeatOffenders = Object.values(repeatOffenderMap).filter(c => c >= 2).length;

    const currentAlerts = Math.round(totalIncidents * 0.05);

    const allDates = incidents
      .map(i => i.incident_date)
      .filter(Boolean)
      .sort();
    let periodChange = 0;
    if (allDates.length >= 2) {
      const mid = Math.floor(allDates.length / 2);
      const firstHalf = allDates.slice(0, mid).length;
      const secondHalf = allDates.slice(mid).length;
      periodChange = secondHalf > 0
        ? roundTo(((secondHalf - firstHalf) / firstHalf) * 100)
        : 0;
    }

    const durationDays = incidents
      .filter(i => i.incident_date && i.status === 'CLOSED')
      .map(i => {
        const d = parseDateSafe(i.incident_date);
        return d ? (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24) : 0;
      });
    const avgInvestigationDuration = durationDays.length > 0
      ? roundTo(durationDays.reduce((a, b) => a + b, 0) / durationDays.length)
      : 0;

    const withLocation = incidents.filter(i => i.latitude && i.longitude).length;
    const dataQualityScore = totalIncidents > 0
      ? roundTo((withLocation / totalIncidents) * 100)
      : 0;

    const monthlyTrend = this.getMonthlyTrends(filters).map(t => ({ month: t.month, incidents: t.total })).slice(-12);
    const categoryDistribution = Object.entries(categoryCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
    const dayOfWeekAnalysis = this.getDayOfWeekAnalysis(filters).map(d => ({ day: d.day, incidents: d.total }));
    const severityBreakdown = Object.entries(severityCounts).map(([name, value]) => ({ name, value }));

    return {
      totalIncidents,
      activeInvestigations,
      closedInvestigations,
      pending,
      cold,
      highRiskDistricts,
      activeHotspots,
      repeatOffenders,
      currentAlerts,
      periodChange,
      mostCommonCategory,
      avgInvestigationDuration,
      dataQualityScore,
      dataPeriod: this._getDataPeriod(incidents),
      recordCount: totalIncidents,
      monthlyTrend,
      categoryDistribution,
      dayOfWeekAnalysis,
      severityBreakdown,
    };
  }

  getDistrictAnalysis(district, filters = {}) {
    const districtFilters = { ...filters, district };
    const incidents = this.repo.getIncidents(districtFilters);
    if (incidents.length === 0) return null;

    const categoryCounts = {};
    const statusCounts = {};
    const severityCounts = {};
    const stationCounts = {};
    let totalSeverity = 0;

    for (const inc of incidents) {
      const cat = inc.crime_type || 'Unknown';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      const st = inc.status || 'Unknown';
      statusCounts[st] = (statusCounts[st] || 0) + 1;
      const sev = inc.severity || 'LOW';
      severityCounts[sev] = (severityCounts[sev] || 0) + 1;
      const ps = inc.police_station || 'Unknown';
      stationCounts[ps] = (stationCounts[ps] || 0) + 1;
      if (sev === 'CRITICAL') totalSeverity += 4;
      else if (sev === 'HIGH') totalSeverity += 3;
      else if (sev === 'MEDIUM') totalSeverity += 2;
      else totalSeverity += 1;
    }

    const topCategory = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

    const indicator = this.repo.getDistrictIndicators().find(
      ind => normalizeDistrictName(ind.district) === normalizeDistrictName(district)
    );

    return {
      district,
      totalIncidents: incidents.length,
      categoryCounts,
      statusCounts,
      severityCounts,
      stationCounts,
      topCategory,
      avgSeverity: roundTo(totalSeverity / incidents.length),
      activeCases: (statusCounts['UNDER_INVESTIGATION'] || 0) + (statusCounts['PENDING'] || 0),
      closedCases: statusCounts['CLOSED'] || 0,
      indicators: indicator || null,
      dataPeriod: this._getDataPeriod(incidents),
      recordCount: incidents.length,
    };
  }

  getAllDistrictSummaries(filters = {}) {
    const districts = [...new Set(this.repo.getIncidents(filters).map(i => i.district).filter(Boolean))];
    const summaries = districts.map(d => {
      const analysis = this.getDistrictAnalysis(d, filters);
      return analysis ? {
        district: analysis.district,
        totalIncidents: analysis.totalIncidents,
        topCategory: analysis.topCategory,
        avgSeverity: analysis.avgSeverity,
        activeCases: analysis.activeCases,
        closedCases: analysis.closedCases,
        indicators: analysis.indicators,
      } : null;
    }).filter(Boolean);
    return summaries;
  }

  getMonthlyTrends(filters = {}) {
    const incidents = this.repo.getIncidents(filters);
    const monthMap = {};
    for (const inc of incidents) {
      if (!inc.incident_date) continue;
      const month = inc.incident_date.substring(0, 7);
      if (!monthMap[month]) monthMap[month] = { month, total: 0, categories: {} };
      monthMap[month].total++;
      const cat = inc.crime_type || 'Unknown';
      monthMap[month].categories[cat] = (monthMap[month].categories[cat] || 0) + 1;
    }
    return Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));
  }

  getWeeklyTrends(filters = {}) {
    const incidents = this.repo.getIncidents(filters);
    const weekMap = {};
    for (const inc of incidents) {
      if (!inc.incident_date) continue;
      const d = parseDateSafe(inc.incident_date);
      if (!d) continue;
      const yearStart = new Date(d.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((d - yearStart) / 86400000 + yearStart.getDay() + 1) / 7);
      const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      if (!weekMap[key]) weekMap[key] = { week: key, total: 0, categories: {} };
      weekMap[key].total++;
      const cat = inc.crime_type || 'Unknown';
      weekMap[key].categories[cat] = (weekMap[key].categories[cat] || 0) + 1;
    }
    return Object.values(weekMap).sort((a, b) => a.week.localeCompare(b.week));
  }

  getDayOfWeekAnalysis(filters = {}) {
    const incidents = this.repo.getIncidents(filters);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayMap = {};
    for (const inc of incidents) {
      if (!inc.incident_date) continue;
      const d = parseDateSafe(inc.incident_date);
      if (!d) continue;
      const dayName = days[d.getDay()];
      if (!dayMap[dayName]) dayMap[dayName] = { day: dayName, total: 0, categories: {} };
      dayMap[dayName].total++;
      const cat = inc.crime_type || 'Unknown';
      dayMap[dayName].categories[cat] = (dayMap[dayName].categories[cat] || 0) + 1;
    }
    return days.map(d => dayMap[d] || { day: d, total: 0, categories: {} });
  }

  getHourOfDayAnalysis(filters = {}) {
    const incidents = this.repo.getIncidents(filters);
    const hourMap = {};
    for (let h = 0; h < 24; h++) {
      hourMap[h] = { hour: h, total: 0, categories: {} };
    }
    for (const inc of incidents) {
      if (!inc.incident_time) continue;
      const parts = inc.incident_time.split(':');
      const hour = parseInt(parts[0], 10);
      if (isNaN(hour) || hour < 0 || hour > 23) continue;
      hourMap[hour].total++;
      const cat = inc.crime_type || 'Unknown';
      hourMap[hour].categories[cat] = (hourMap[hour].categories[cat] || 0) + 1;
    }
    return Object.values(hourMap);
  }

  getDaypartAnalysis(filters = {}) {
    const incidents = this.repo.getIncidents(filters);
    const parts = ['DAWN', 'MORNING', 'AFTERNOON', 'EVENING', 'NIGHT', 'LATE_NIGHT'];
    const dpMap = {};
    for (const p of parts) dpMap[p] = { daypart: p, total: 0, categories: {} };
    for (const inc of incidents) {
      if (!inc.incident_time) continue;
      const parts2 = inc.incident_time.split(':');
      const hour = parseInt(parts2[0], 10);
      if (isNaN(hour)) continue;
      const dp = classifyDaypart(hour);
      if (!dp || !dpMap[dp]) continue;
      dpMap[dp].total++;
      const cat = inc.crime_type || 'Unknown';
      dpMap[dp].categories[cat] = (dpMap[dp].categories[cat] || 0) + 1;
    }
    return parts.map(p => dpMap[p]);
  }

  getCategoryGrowth(filters = {}) {
    const incidents = this.repo.getIncidents(filters);
    const allDates = incidents.map(i => i.incident_date).filter(Boolean).sort();
    if (allDates.length < 2) return [];
    const mid = Math.floor(allDates.length / 2);
    const midDate = allDates[mid];
    const firstHalf = incidents.filter(i => i.incident_date && i.incident_date <= midDate);
    const secondHalf = incidents.filter(i => i.incident_date && i.incident_date > midDate);

    const countByCategory = (list) => {
      const map = {};
      for (const inc of list) {
        const cat = inc.crime_type || 'Unknown';
        map[cat] = (map[cat] || 0) + 1;
      }
      return map;
    };

    const firstCounts = countByCategory(firstHalf);
    const secondCounts = countByCategory(secondHalf);
    const allCategories = [...new Set([...Object.keys(firstCounts), ...Object.keys(secondCounts)])];

    return allCategories.map(cat => {
      const first = firstCounts[cat] || 0;
      const second = secondCounts[cat] || 0;
      const change = first > 0 ? roundTo(((second - first) / first) * 100) : (second > 0 ? 100 : 0);
      return { category: cat, firstPeriod: first, secondPeriod: second, change, direction: change >= 0 ? 'increase' : 'decrease' };
    }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }

  getDistrictComparison(filters = {}) {
    const summaries = this.getAllDistrictSummaries(filters);
    const incidents = this.repo.getIncidents(filters);
    return summaries.map(s => ({
      ...s,
      percentage: incidents.length > 0 ? roundTo((s.totalIncidents / incidents.length) * 100) : 0,
    }));
  }

  getModusOperandiTrends(filters = {}) {
    const incidents = this.repo.getIncidents(filters);
    const moMap = {};
    const moByMonth = {};
    for (const inc of incidents) {
      const mo = inc.modus_operandi || 'Unknown';
      if (!moMap[mo]) moMap[mo] = 0;
      moMap[mo]++;
      if (inc.incident_date) {
        const month = inc.incident_date.substring(0, 7);
        if (!moByMonth[month]) moByMonth[month] = {};
        moByMonth[month][mo] = (moByMonth[month][mo] || 0) + 1;
      }
    }
    const total = incidents.length;
    return {
      totalMOs: Object.keys(moMap).length,
      moDistribution: Object.entries(moMap).map(([mo, count]) => ({
        modusOperandi: mo,
        count,
        percentage: roundTo((count / total) * 100),
      })).sort((a, b) => b.count - a.count),
      monthlyTrend: Object.entries(moByMonth).sort((a, b) => a[0].localeCompare(b[0])).map(([month, mos]) => ({
        month,
        mos,
      })),
    };
  }

  getCurrentVsPrevious(filters = {}) {
    const incidents = this.repo.getIncidents(filters);
    const allDates = incidents.map(i => i.incident_date).filter(Boolean).sort();
    if (allDates.length < 2) return { current: 0, previous: 0, change: 0 };

    const mid = Math.floor(allDates.length / 2);
    const midDate = allDates[mid];
    const current = incidents.filter(i => i.incident_date && i.incident_date > midDate);
    const previous = incidents.filter(i => i.incident_date && i.incident_date <= midDate);

    const aggregate = (list) => ({
      total: list.length,
      byCategory: list.reduce((acc, i) => {
        const cat = i.crime_type || 'Unknown';
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      }, {}),
      byDistrict: list.reduce((acc, i) => {
        const d = i.district || 'Unknown';
        acc[d] = (acc[d] || 0) + 1;
        return acc;
      }, {}),
    });

    const currentAgg = aggregate(current);
    const previousAgg = aggregate(previous);
    const change = previousAgg.total > 0
      ? roundTo(((currentAgg.total - previousAgg.total) / previousAgg.total) * 100)
      : 0;

    return {
      current: currentAgg,
      previous: previousAgg,
      change,
      direction: change >= 0 ? 'increase' : 'decrease',
    };
  }

  getHotspots(filters = {}) {
    const incidents = this.repo.getIncidents(filters);
    const persons = this.repo.getPersons();
    const incidentPersons = this.repo.getIncidentPersons();
    const districts = [...new Set(incidents.map(i => i.district).filter(Boolean))];

    const offenderCounts = {};
    for (const ip of incidentPersons) {
      if (ip.role === 'OFFENDER') {
        offenderCounts[ip.person_id] = (offenderCounts[ip.person_id] || 0) + 1;
      }
    }
    const repeatOffendersByPerson = Object.entries(offenderCounts)
      .filter(([_, c]) => c >= 2)
      .map(([id]) => id);

    const allDates = incidents.map(i => i.incident_date).filter(Boolean).sort();

    const hotspots = districts.map(district => {
      const districtIncidents = incidents.filter(i => i.district === district);
      const count = districtIncidents.length;
      if (count === 0) return null;

      const mid = Math.floor(allDates.length / 2);
      const midDate = allDates.length > 0 ? allDates[Math.min(mid, allDates.length - 1)] : null;
      const recent = midDate
        ? districtIncidents.filter(i => i.incident_date && i.incident_date > midDate).length
        : count;
      const earlier = midDate
        ? districtIncidents.filter(i => i.incident_date && i.incident_date <= midDate).length
        : 0;
      const growthRate = earlier > 0 ? (recent - earlier) / earlier : 0;

      let severitySum = 0;
      for (const inc of districtIncidents) {
        if (inc.severity === 'CRITICAL') severitySum += 4;
        else if (inc.severity === 'HIGH') severitySum += 3;
        else if (inc.severity === 'MEDIUM') severitySum += 2;
        else severitySum += 1;
      }
      const avgSeverity = severitySum / count;

      const districtPersonIds = [
        ...new Set(
          incidentPersons
            .filter(ip => districtIncidents.some(di => di.fir_number === ip.incident_id))
            .map(ip => ip.person_id)
        )
      ];
      const repeatOffenderCount = districtPersonIds.filter(id => repeatOffendersByPerson.includes(id)).length;

      const allCounts = districts.map(d =>
        incidents.filter(i => i.district === d).length
      );
      const normIncidentCount = count / (Math.max(...allCounts) || 1);
      const normGrowth = Math.min(1, Math.max(-1, growthRate));
      const normSeverity = avgSeverity / 4;
      const normRepeat = repeatOffenderCount / (count || 1);
      const anomalyScore = this._calculateAnomalyScoreForDistrict(districtIncidents);

      const score = clamp(
        normIncidentCount * 35
        + ((normGrowth + 1) / 2) * 20
        + normSeverity * 20
        + Math.min(1, normRepeat) * 15
        + anomalyScore * 10
      );

      return {
        id: district.toLowerCase().replace(/\s+/g, '-'),
        district,
        score: roundTo(score),
        incidentCount: count,
        growthRate: roundTo(growthRate),
        avgSeverity: roundTo(avgSeverity),
        repeatOffenderCount,
        anomalyScore: roundTo(anomalyScore),
        factors: [
          { name: 'incidentVolume', value: roundTo(normIncidentCount * 100), weight: 0.35 },
          { name: 'recentGrowth', value: roundTo(((normGrowth + 1) / 2) * 100), weight: 0.20 },
          { name: 'severityLevel', value: roundTo(normSeverity * 100), weight: 0.20 },
          { name: 'repeatOffenderActivity', value: roundTo(Math.min(1, normRepeat) * 100), weight: 0.15 },
          { name: 'anomalyScore', value: roundTo(anomalyScore * 100), weight: 0.10 },
        ],
        confidence: roundTo(Math.min(1, count / 50)),
        dataPeriod: this._getDataPeriod(districtIncidents),
        recordCount: count,
        calculatedAt: new Date().toISOString(),
      };
    }).filter(Boolean);

    hotspots.sort((a, b) => b.score - a.score);
    return hotspots;
  }

  getHotspotById(id) {
    const hotspots = this.getHotspots();
    return hotspots.find(h => h.id === id) || null;
  }

  getDistrictHotspots(district, filters = {}) {
    const hotspots = this.getHotspots({ ...filters, district });
    return hotspots.filter(h => h.district === district || normalizeDistrictName(h.district) === normalizeDistrictName(district));
  }

  _calculateAnomalyScoreForDistrict(incidents) {
    if (incidents.length < 3) return 0;
    const allDates = this.repo.getIncidents().map(i => i.incident_date).filter(Boolean).sort();
    const districtDates = incidents.map(i => i.incident_date).filter(Boolean).sort();
    const expectedPerDay = allDates.length / Math.max(1, new Set(allDates).size);
    const actualPerDay = districtDates.length / Math.max(1, new Set(districtDates).size);
    if (expectedPerDay === 0) return 0;
    return Math.min(1, (actualPerDay - expectedPerDay) / expectedPerDay);
  }

  detectAnomalies(filters = {}) {
    const incidents = this.repo.getIncidents(filters);
    const results = [];

    const districtCounts = {};
    for (const inc of incidents) {
      const d = inc.district || 'Unknown';
      districtCounts[d] = (districtCounts[d] || 0) + 1;
    }
    const counts = Object.values(districtCounts);
    if (counts.length >= 3) {
      const { q1, q3, iqr: iqrVal } = iqr(counts);
      const upper = q3 + 1.5 * iqrVal;
      for (const [district, count] of Object.entries(districtCounts)) {
        if (count > upper) {
          const zs = zScore(counts, count);
          results.push({
            type: 'DISTRICT_ANOMALY',
            district,
            value: count,
            threshold: upper,
            zScore: roundTo(zs),
            severity: Math.abs(zs) > 3 ? 'CRITICAL' : Math.abs(zs) > 2 ? 'HIGH' : 'MEDIUM',
          });
        }
      }
    }

    const stationCounts = {};
    for (const inc of incidents) {
      const ps = inc.police_station || 'Unknown';
      stationCounts[ps] = (stationCounts[ps] || 0) + 1;
    }
    const stationValues = Object.values(stationCounts);
    if (stationValues.length >= 3) {
      const { q1, q3, iqr: iqrVal } = iqr(stationValues);
      const upper = q3 + 1.5 * iqrVal;
      for (const [station, count] of Object.entries(stationCounts)) {
        if (count > upper) {
          results.push({
            type: 'STATION_ANOMALY',
            policeStation: station,
            value: count,
            threshold: upper,
            zScore: roundTo(zScore(stationValues, count)),
            severity: 'MEDIUM',
          });
        }
      }
    }

    const categoryCounts = {};
    for (const inc of incidents) {
      const cat = inc.crime_type || 'Unknown';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
    const catValues = Object.values(categoryCounts);
    if (catValues.length >= 3) {
      const { q1, q3, iqr: iqrVal } = iqr(catValues);
      const upper = q3 + 1.5 * iqrVal;
      for (const [cat, count] of Object.entries(categoryCounts)) {
        if (count > upper) {
          results.push({
            type: 'CATEGORY_ANOMALY',
            category: cat,
            value: count,
            threshold: upper,
            zScore: roundTo(zScore(catValues, count)),
            severity: 'MEDIUM',
          });
        }
      }
    }

    return results;
  }

  checkIncidentSpike(district, period = 'month') {
    const allIncidents = this.repo.getIncidents();
    const districtIncidents = allIncidents.filter(i => i.district === district);
    if (districtIncidents.length < 3) return { spike: false, message: 'Insufficient data' };

    const periodMap = {};
    for (const inc of districtIncidents) {
      if (!inc.incident_date) continue;
      const key = inc.incident_date.substring(0, 7);
      periodMap[key] = (periodMap[key] || 0) + 1;
    }
    const counts = Object.values(periodMap);
    const recentPeriods = Object.entries(periodMap).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 3);
    const recentValues = recentPeriods.map(([_, c]) => c);
    const historicalValues = counts.slice(0, -3);

    if (historicalValues.length < 2) return { spike: false, message: 'Insufficient historical data' };
    const mean = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
    const variance = historicalValues.reduce((a, b) => a + (b - mean) ** 2, 0) / (historicalValues.length - 1);
    const std = Math.sqrt(variance);
    if (std === 0) return { spike: false, message: 'No variance in data' };

    const spikes = recentValues.map(v => ({
      period: recentPeriods[recentValues.indexOf(v)][0],
      value: v,
      zScore: roundTo((v - mean) / std),
      isSpike: (v - mean) / std > 2,
    }));

    return {
      district,
      period,
      mean: roundTo(mean),
      std: roundTo(std),
      spikes,
      hasSpike: spikes.some(s => s.isSpike),
    };
  }

  checkStationSpike(station, period = 'month') {
    const allIncidents = this.repo.getIncidents();
    const stationIncidents = allIncidents.filter(i => i.police_station === station);
    if (stationIncidents.length < 3) return { spike: false, message: 'Insufficient data' };

    const periodMap = {};
    for (const inc of stationIncidents) {
      if (!inc.incident_date) continue;
      const key = inc.incident_date.substring(0, 7);
      periodMap[key] = (periodMap[key] || 0) + 1;
    }
    const counts = Object.values(periodMap);
    const recentPeriods = Object.entries(periodMap).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 3);
    const recentValues = recentPeriods.map(([_, c]) => c);
    const historicalValues = counts.slice(0, -3);

    if (historicalValues.length < 2) return { spike: false, message: 'Insufficient historical data' };
    const mean = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
    const variance = historicalValues.reduce((a, b) => a + (b - mean) ** 2, 0) / (historicalValues.length - 1);
    const std = Math.sqrt(variance);
    if (std === 0) return { spike: false, message: 'No variance' };

    const spikes = recentValues.map(v => ({
      period: recentPeriods[recentValues.indexOf(v)][0],
      value: v,
      zScore: roundTo((v - mean) / std),
      isSpike: (v - mean) / std > 2,
    }));

    return {
      station,
      period,
      mean: roundTo(mean),
      std: roundTo(std),
      spikes,
      hasSpike: spikes.some(s => s.isSpike),
    };
  }

  checkCategorySpike(category, period = 'month') {
    const allIncidents = this.repo.getIncidents();
    const catIncidents = allIncidents.filter(i => i.crime_type === category);
    if (catIncidents.length < 3) return { spike: false, message: 'Insufficient data' };

    const periodMap = {};
    for (const inc of catIncidents) {
      if (!inc.incident_date) continue;
      const key = inc.incident_date.substring(0, 7);
      periodMap[key] = (periodMap[key] || 0) + 1;
    }
    const counts = Object.values(periodMap);
    const recentPeriods = Object.entries(periodMap).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 3);
    const recentValues = recentPeriods.map(([_, c]) => c);
    const historicalValues = counts.slice(0, -3);

    if (historicalValues.length < 2) return { spike: false, message: 'Insufficient historical data' };
    const mean = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
    const variance = historicalValues.reduce((a, b) => a + (b - mean) ** 2, 0) / (historicalValues.length - 1);
    const std = Math.sqrt(variance);
    if (std === 0) return { spike: false, message: 'No variance' };

    const spikes = recentValues.map(v => ({
      period: recentPeriods[recentValues.indexOf(v)][0],
      value: v,
      zScore: roundTo((v - mean) / std),
      isSpike: (v - mean) / std > 2,
    }));

    return { category, period, mean: roundTo(mean), std: roundTo(std), spikes, hasSpike: spikes.some(s => s.isSpike) };
  }

  checkTimeOfDayAnomaly() {
    const incidents = this.repo.getIncidents();
    const hourCounts = {};
    for (let h = 0; h < 24; h++) hourCounts[h] = 0;
    for (const inc of incidents) {
      if (!inc.incident_time) continue;
      const parts = inc.incident_time.split(':');
      const hour = parseInt(parts[0], 10);
      if (!isNaN(hour) && hour >= 0 && hour < 24) hourCounts[hour]++;
    }
    const values = Object.values(hourCounts);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance) || 1;

    const anomalies = [];
    for (const [hour, count] of Object.entries(hourCounts)) {
      const zs = (count - mean) / std;
      if (Math.abs(zs) > 1.5) {
        anomalies.push({ hour: Number(hour), count, expected: roundTo(mean), zScore: roundTo(zs), severity: Math.abs(zs) > 2.5 ? 'HIGH' : 'MEDIUM' });
      }
    }
    return anomalies;
  }

  checkModusOperandiAnomaly() {
    const incidents = this.repo.getIncidents();
    const moCounts = {};
    for (const inc of incidents) {
      const mo = inc.modus_operandi || 'Unknown';
      moCounts[mo] = (moCounts[mo] || 0) + 1;
    }
    const values = Object.values(moCounts);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance) || 1;

    const anomalies = [];
    for (const [mo, count] of Object.entries(moCounts)) {
      const zs = (count - mean) / std;
      if (Math.abs(zs) > 1.5) {
        anomalies.push({ modusOperandi: mo, count, expected: roundTo(mean), zScore: roundTo(zs), severity: Math.abs(zs) > 2.5 ? 'HIGH' : 'MEDIUM' });
      }
    }
    return anomalies;
  }

  checkInvestigationDelay() {
    const incidents = this.repo.getIncidents();
    const delayed = incidents.filter(i => i.status === 'PENDING' || i.status === 'UNDER_INVESTIGATION')
      .filter(i => i.incident_date)
      .map(i => {
        const d = parseDateSafe(i.incident_date);
        const daysSince = d ? Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)) : 0;
        return { ...i, daysSince };
      })
      .filter(i => i.daysSince > 30);

    return delayed.map(i => ({
      firNumber: i.fir_number,
      district: i.district,
      policeStation: i.police_station,
      crimeType: i.crime_type,
      daysSince: i.daysSince,
      status: i.status,
    })).sort((a, b) => b.daysSince - a.daysSince);
  }

  getNetworkGraph(filters = {}) {
    const incidents = this.repo.getIncidents(filters);
    const incidentIds = new Set(incidents.map(i => i.fir_number));
    const filteredLinks = this.repo.getIncidentPersons().filter(ip => incidentIds.has(ip.incident_id));
    const personIds = [...new Set(filteredLinks.map(ip => ip.person_id))];
    const persons = personIds.map(id => this.repo.getPersonById(id)).filter(Boolean);

    const relationships = this.repo.getRelationships().filter(r =>
      incidentIds.has(r.target_id) || personIds.includes(r.source_id)
    );

    const nodes = [
      ...incidents.map(i => ({ id: i.fir_number, type: 'incident', label: i.fir_number, crimeType: i.crime_type, district: i.district, severity: i.severity })),
      ...persons.map(p => ({ id: p.person_id, type: 'person', label: p.name, age: p.age, gender: p.gender })),
    ];

    const edges = [
      ...relationships.map(r => ({ source: r.source_id, target: r.target_id, type: r.relationship_type, evidence: r.evidence })),
      ...filteredLinks.map(ip => ({ source: ip.person_id, target: ip.incident_id, type: ip.role === 'OFFENDER' ? 'ACCUSED_IN' : ip.role === 'VICTIM' ? 'VICTIM_IN' : 'WITNESS_IN' })),
    ];

    return { nodes, edges };
  }

  getNetworkForPerson(personId) {
    const person = this.repo.getPersonById(personId);
    if (!person) return null;
    const incidents = this.repo.getIncidentsForPerson(personId);
    const associates = this.repo.getAssociates(personId);

    const nodes = [
      { id: person.person_id, type: 'person', label: person.name, age: person.age, gender: person.gender, ego: true },
      ...incidents.map(i => ({ id: i.fir_number, type: 'incident', label: i.fir_number, crimeType: i.crime_type })),
      ...associates.map(a => ({ id: a.person_id, type: 'person', label: a.name, age: a.age, gender: a.gender, ego: false })),
    ];

    const edges = [
      ...incidents.map(i => ({ source: personId, target: i.fir_number, type: 'ASSOCIATED_WITH' })),
      ...associates.map(a => ({ source: personId, target: a.person_id, type: 'ASSOCIATED_WITH' })),
    ];

    return { person, incidents, associates, graph: { nodes, edges } };
  }

  getNetworkForIncident(firNumber) {
    const incident = this.repo.getIncidentById(firNumber);
    if (!incident) return null;
    const links = this.repo.getIncidentPersons().filter(ip => ip.incident_id === firNumber);
    const persons = links.map(ip => this.repo.getPersonById(ip.person_id)).filter(Boolean);
    const personIds = links.map(ip => ip.person_id);

    const otherIncidents = this.repo.getIncidentPersons()
      .filter(ip => personIds.includes(ip.person_id) && ip.incident_id !== firNumber)
      .map(ip => this.repo.getIncidentById(ip.incident_id))
      .filter(Boolean);

    const nodes = [
      { id: incident.fir_number, type: 'incident', label: incident.fir_number, crimeType: incident.crime_type, ego: true },
      ...persons.map(p => ({ id: p.person_id, type: 'person', label: p.name, role: links.find(l => l.person_id === p.person_id)?.role })),
      ...otherIncidents.map(i => ({ id: i.fir_number, type: 'incident', label: i.fir_number, crimeType: i.crime_type, ego: false })),
    ];

    const edges = [
      ...links.map(ip => ({ source: ip.person_id, target: ip.incident_id, type: ip.role === 'OFFENDER' ? 'ACCUSED_IN' : ip.role === 'VICTIM' ? 'VICTIM_IN' : 'WITNESS_IN' })),
      ...otherIncidents.map(i => ({ source: firNumber, target: i.fir_number, type: 'RELATED_VIA_PERSON' })),
    ];

    return { incident, persons, relatedIncidents: otherIncidents, graph: { nodes, edges } };
  }

  findConnectedComponents() {
    const allLinks = this.repo.getIncidentPersons();
    const adj = {};
    for (const link of allLinks) {
      if (!adj[link.person_id]) adj[link.person_id] = new Set();
      if (!adj[link.incident_id]) adj[link.incident_id] = new Set();
      adj[link.person_id].add(link.incident_id);
      adj[link.incident_id].add(link.person_id);
    }

    const visited = new Set();
    const components = [];

    for (const node of Object.keys(adj)) {
      if (visited.has(node)) continue;
      const queue = [node];
      const component = new Set();
      while (queue.length > 0) {
        const current = queue.shift();
        if (visited.has(current)) continue;
        visited.add(current);
        component.add(current);
        for (const neighbor of (adj[current] || [])) {
          if (!visited.has(neighbor)) queue.push(neighbor);
        }
      }
      if (component.size >= 2) {
        const personIds = [...component].filter(id => id.startsWith('P'));
        const incidentIds = [...component].filter(id => id.startsWith('FIR'));
        components.push({
          size: component.size,
          personCount: personIds.length,
          incidentCount: incidentIds.length,
          personIds,
          incidentIds,
        });
      }
    }

    return components.sort((a, b) => b.size - a.size);
  }

  findCrossDistrictNetworks() {
    const components = this.findConnectedComponents();
    const crossDistrict = [];

    for (const comp of components) {
      const districts = new Set();
      for (const firId of comp.incidentIds) {
        const inc = this.repo.getIncidentById(firId);
        if (inc && inc.district) districts.add(inc.district);
      }
      if (districts.size >= 2) {
        crossDistrict.push({
          ...comp,
          districts: [...districts],
          districtCount: districts.size,
        });
      }
    }

    return crossDistrict.sort((a, b) => b.districtCount - a.districtCount || b.size - a.size);
  }

  getOffenders(filters = {}) {
    const incidents = this.repo.getIncidents(filters);
    const incidentIds = new Set(incidents.map(i => i.fir_number));
    const offenderLinks = this.repo.getIncidentPersons()
      .filter(ip => ip.role === 'OFFENDER' && incidentIds.has(ip.incident_id));

    const offenderMap = {};
    for (const link of offenderLinks) {
      if (!offenderMap[link.person_id]) {
        const person = this.repo.getPersonById(link.person_id);
        offenderMap[link.person_id] = {
          personId: link.person_id,
          name: person?.name || 'Unknown',
          age: person?.age || null,
          gender: person?.gender || null,
          incidentCount: 0,
          incidents: [],
          firstSeen: null,
          lastSeen: null,
        };
      }
      const record = offenderMap[link.person_id];
      record.incidentCount++;
      const inc = this.repo.getIncidentById(link.incident_id);
      if (inc) {
        record.incidents.push(inc.fir_number);
        if (!record.firstSeen || inc.incident_date < record.firstSeen) record.firstSeen = inc.incident_date;
        if (!record.lastSeen || inc.incident_date > record.lastSeen) record.lastSeen = inc.incident_date;
      }
    }

    return Object.values(offenderMap)
      .map(o => ({
        ...o,
        classification: o.incidentCount >= 3 ? 'Repeat Offender' : o.incidentCount >= 2 ? 'Frequent Offender' : 'First-time Offender',
        riskScore: this._calculateRiskScoreForOffender(o),
      }))
      .sort((a, b) => b.incidentCount - a.incidentCount);
  }

  _calculateRiskScoreForOffender(offender) {
    const base = Math.min(offender.incidentCount * 15, 60);
    const recency = offender.lastSeen ? Math.max(0, 30 - Math.floor((Date.now() - new Date(offender.lastSeen).getTime()) / (1000 * 60 * 60 * 24 * 30))) : 0;
    const recencyScore = Math.min(recency, 20);
    const ageScore = offender.age && offender.age < 30 ? 10 : offender.age && offender.age < 45 ? 5 : 0;
    return clamp(base + recencyScore + ageScore);
  }

  getOffenderDetail(personId) {
    const person = this.repo.getPersonById(personId);
    if (!person) return null;
    const incidents = this.repo.getIncidentsForPerson(personId);
    const associates = this.repo.getAssociates(personId);
    const offenderLinks = this.repo.getIncidentPersons()
      .filter(ip => ip.person_id === personId && ip.role === 'OFFENDER');

    const incidentCount = offenderLinks.length;
    const classification = incidentCount >= 3 ? 'Repeat Offender' : incidentCount >= 2 ? 'Frequent Offender' : 'First-time Offender';
    const riskScore = this._calculateRiskScoreForOffender({ incidentCount, lastSeen: incidents[incidents.length - 1]?.incident_date, age: person.age });

    const categoryCounts = {};
    for (const inc of incidents) {
      const cat = inc.crime_type || 'Unknown';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }

    const timeline = incidents
      .filter(i => i.incident_date)
      .map(i => ({ date: i.incident_date, firNumber: i.fir_number, crimeType: i.crime_type, severity: i.severity, status: i.status }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      person,
      incidentCount,
      classification,
      riskScore,
      categoryCounts,
      timeline,
      associates,
      incidents: incidents.map(i => ({
        firNumber: i.fir_number,
        crimeType: i.crime_type,
        date: i.incident_date,
        severity: i.severity,
        status: i.status,
      })),
    };
  }

  classifyRepeatOffender(personId) {
    const person = this.repo.getPersonById(personId);
    if (!person) return null;
    const incidents = this.repo.getIncidentsForPerson(personId);
    const offenderLinks = this.repo.getIncidentPersons()
      .filter(ip => ip.person_id === personId && ip.role === 'OFFENDER');
    const totalOffences = offenderLinks.length;

    const categoryCounts = {};
    const districtCounts = {};
    let violentOffences = 0;
    let sameCategoryRepeats = 0;

    for (const link of offenderLinks) {
      const inc = this.repo.getIncidentById(link.incident_id);
      if (!inc) continue;
      const cat = inc.crime_type || 'Unknown';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      districtCounts[inc.district] = (districtCounts[inc.district] || 0) + 1;

      const violent = ['Murder', 'Assault', 'Robbery', 'Kidnapping', 'Sexual Offence', 'Arson'];
      if (violent.includes(cat)) violentOffences++;

      if (categoryCounts[cat] >= 2) sameCategoryRepeats++;
    }

    const recidivismScore = totalOffences >= 3 ? 3 : totalOffences >= 2 ? 2 : 1;
    const violentScore = violentOffences >= 2 ? 3 : violentOffences >= 1 ? 2 : 1;
    const versatilityScore = Object.keys(categoryCounts).length >= 3 ? 3 : Object.keys(categoryCounts).length >= 2 ? 2 : 1;
    const totalScore = recidivismScore + violentScore + versatilityScore;

    let classification;
    if (totalScore >= 8) classification = 'HIGH_RISK_REPEAT';
    else if (totalScore >= 6) classification = 'MODERATE_RISK_REPEAT';
    else if (totalScore >= 4) classification = 'LOW_RISK_REPEAT';
    else classification = 'FIRST_TIME';

    return {
      personId,
      totalOffences,
      classification,
      score: totalScore,
      factors: {
        recidivismScore,
        violentScore,
        versatilityScore,
      },
      categoryCounts,
      districtCounts,
      violentOffenceCount: violentOffences,
    };
  }

  calculateOffenderRiskScore(personId) {
    const classification = this.classifyRepeatOffender(personId);
    if (!classification) return null;

    const riskScoreMap = { 'HIGH_RISK_REPEAT': 85, 'MODERATE_RISK_REPEAT': 65, 'LOW_RISK_REPEAT': 40, 'FIRST_TIME': 15 };
    const baseScore = riskScoreMap[classification.classification] || 15;
    const score = clamp(baseScore + classification.totalOffences * 2);

    return {
      score,
      band: this._getRiskBand(score),
      factors: classification.factors,
      classification: classification.classification,
      totalOffences: classification.totalOffences,
    };
  }

  calculateDistrictRiskScore(district, filters = {}) {
    const analysis = this.getDistrictAnalysis(district, filters);
    if (!analysis) return null;

    const { totalIncidents, avgSeverity } = analysis;
    const incidents = this.repo.getIncidents({ ...filters, district });
    const allIncidents = this.repo.getIncidents(filters);
    const totalAll = allIncidents.length || 1;

    const volumeScore = (totalIncidents / totalAll) * 100;
    const severityScore = (avgSeverity / 4) * 100;

    const openCases = analysis.activeCases || 0;
    const openRatio = totalIncidents > 0 ? openCases / totalIncidents : 0;
    const openScore = openRatio * 100;

    const allDistricts = [...new Set(allIncidents.map(i => i.district).filter(Boolean))];
    const districtCounts = allDistricts.map(d =>
      allIncidents.filter(i => i.district === d).length
    );
    const normVolume = districtCounts.length > 0
      ? totalIncidents / (Math.max(...districtCounts) || 1)
      : 0;

    const anomalyScore = this._calculateAnomalyScoreForDistrict(incidents) * 100;

    const score = clamp(
      normVolume * 35
      + severityScore * 25
      + openScore * 20
      + anomalyScore * 20
    );

    const factors = [
      { name: 'incidentVolume', value: roundTo(normVolume), weight: 0.35, contribution: roundTo(normVolume * 0.35) },
      { name: 'severityLevel', value: roundTo(severityScore), weight: 0.25, contribution: roundTo(severityScore * 0.25) },
      { name: 'openCases', value: roundTo(openScore), weight: 0.20, contribution: roundTo(openScore * 0.20) },
      { name: 'anomalyScore', value: roundTo(anomalyScore), weight: 0.20, contribution: roundTo(anomalyScore * 0.20) },
    ];

    return {
      district,
      score: roundTo(score),
      band: this._getRiskBand(score),
      confidence: roundTo(Math.min(1, totalIncidents / 100)),
      formulaVersion: '1.0.0',
      dataPeriod: this._getDataPeriod(incidents),
      factors,
      limitations: ['Model uses historical data only', 'Does not account for socioeconomic factors', 'Temporal weights may vary seasonally'],
      recordCount: totalIncidents,
      calculatedAt: new Date().toISOString(),
    };
  }

  calculateAllDistrictRisks(filters = {}) {
    const districts = [...new Set(this.repo.getIncidents(filters).map(i => i.district).filter(Boolean))];
    return districts.map(d => this.calculateDistrictRiskScore(d, filters)).filter(Boolean)
      .sort((a, b) => b.score - a.score);
  }

  getRiskDistribution() {
    const risks = this.calculateAllDistrictRisks();
    const distribution = { VERY_LOW: 0, LOW: 0, MODERATE: 0, HIGH: 0, VERY_HIGH: 0, CRITICAL: 0 };
    for (const r of risks) {
      if (distribution[r.band] !== undefined) distribution[r.band]++;
    }
    return { distribution, total: risks.length };
  }

  _getRiskBand(score) {
    if (score >= 90) return RiskBand.CRITICAL;
    if (score >= 75) return RiskBand.VERY_HIGH;
    if (score >= 55) return RiskBand.HIGH;
    if (score >= 35) return RiskBand.MODERATE;
    if (score >= 15) return RiskBand.LOW;
    return RiskBand.VERY_LOW;
  }

  calculateCorrelations() {
    const indicators = this.repo.getDistrictIndicators();
    if (indicators.length < 2) return {};
    const incidentsByDistrict = this.repo.getIncidentsByDistrict();

    const districtCrimeRates = indicators.map(ind => {
      const incs = incidentsByDistrict[ind.district] || [];
      const rate = (ind.population && ind.population > 0) ? (incs.length / ind.population) * 100000 : 0;
      return { district: ind.district, crimeRate: rate };
    });

    const metrics = ['literacyRate', 'unemploymentRate', 'policePresence', 'povertyRate', 'urbanizationRate'];
    const correlations = {};

    for (const metric of metrics) {
      const valid = indicators
        .map((ind, i) => ({
          x: ind[metric] != null ? Number(ind[metric]) : null,
          y: districtCrimeRates.find(dcr => dcr.district === ind.district)?.crimeRate || 0,
        }))
        .filter(p => p.x !== null && !isNaN(p.x) && !isNaN(p.y));

      if (valid.length < 2) { correlations[metric] = null; continue; }

      const n = valid.length;
      const sumX = valid.reduce((a, b) => a + b.x, 0);
      const sumY = valid.reduce((a, b) => a + b.y, 0);
      const sumXY = valid.reduce((a, b) => a + b.x * b.y, 0);
      const sumX2 = valid.reduce((a, b) => a + b.x * b.x, 0);
      const sumY2 = valid.reduce((a, b) => a + b.y * b.y, 0);

      const num = n * sumXY - sumX * sumY;
      const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
      correlations[metric] = den !== 0 ? roundTo(num / den) : 0;
    }

    return correlations;
  }

  getCorrelationMatrix() {
    const correlations = this.calculateCorrelations();
    const metrics = Object.keys(correlations);
    const matrix = {};
    for (const m1 of metrics) {
      matrix[m1] = {};
      for (const m2 of metrics) {
        if (m1 === m2) {
          matrix[m1][m2] = 1;
        } else {
          matrix[m1][m2] = correlations[m1] != null ? roundTo(correlations[m1] * 0.5 + correlations[m2] * 0.5) : null;
        }
      }
    }
    return { metrics, matrix, correlations };
  }

  getRankedCorrelations() {
    const correlations = this.calculateCorrelations();
    return Object.entries(correlations)
      .filter(([_, v]) => v !== null)
      .map(([metric, value]) => ({ metric, value, strength: Math.abs(value) > 0.7 ? 'strong' : Math.abs(value) > 0.4 ? 'moderate' : 'weak', direction: value >= 0 ? 'positive' : 'negative' }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  }

  getDistrictScatter(district, xMetric, yMetric) {
    const indicators = this.repo.getDistrictIndicators();
    const incidentsByDistrict = this.repo.getIncidentsByDistrict();

    const allPoints = indicators.map(ind => {
      const incs = incidentsByDistrict[ind.district] || [];
      const crimeRate = (ind.population && ind.population > 0) ? (incs.length / ind.population) * 100000 : 0;
      return {
        district: ind.district,
        x: ind[xMetric] != null ? Number(ind[xMetric]) : null,
        y: ind[yMetric] != null ? Number(ind[yMetric]) : null,
        crimeRate: roundTo(crimeRate),
      };
    }).filter(p => p.x !== null && p.y !== null);

    const target = allPoints.find(p => p.district === district || normalizeDistrictName(p.district) === normalizeDistrictName(district));

    return {
      xMetric,
      yMetric,
      targetDistrict: target || null,
      allPoints,
      totalPoints: allPoints.length,
    };
  }

  generateAlerts() {
    const alerts = [];
    const anomalies = this.detectAnomalies();
    const allIncidents = this.repo.getIncidents();

    for (const anomaly of anomalies) {
      if (anomaly.type === 'DISTRICT_ANOMALY') {
        alerts.push({
          id: `alert-${Date.now()}-${alerts.length}`,
          type: AlertType.DISTRICT_INCIDENT_SPIKE,
          title: `Incident spike detected in ${anomaly.district}`,
          message: `${anomaly.district} reported ${anomaly.value} incidents (threshold: ${anomaly.threshold}). Z-score: ${anomaly.zScore}`,
          severity: anomaly.severity === 'CRITICAL' ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
          district: anomaly.district,
          metrics: { count: anomaly.value, threshold: anomaly.threshold, zScore: anomaly.zScore },
          detectedAt: new Date().toISOString(),
          reviewed: false,
        });
      } else if (anomaly.type === 'STATION_ANOMALY') {
        alerts.push({
          id: `alert-${Date.now()}-${alerts.length}`,
          type: AlertType.POLICE_STATION_SPIKE,
          title: `Spike at ${anomaly.policeStation}`,
          message: `${anomaly.policeStation} reported ${anomaly.value} incidents (threshold: ${anomaly.threshold}).`,
          severity: AlertSeverity.WARNING,
          policeStation: anomaly.policeStation,
          metrics: { count: anomaly.value, threshold: anomaly.threshold },
          detectedAt: new Date().toISOString(),
          reviewed: false,
        });
      } else if (anomaly.type === 'CATEGORY_ANOMALY') {
        alerts.push({
          id: `alert-${Date.now()}-${alerts.length}`,
          type: AlertType.CRIME_CATEGORY_SPIKE,
          title: `Rise in ${anomaly.category}`,
          message: `${anomaly.category} incidents at ${anomaly.value} (threshold: ${anomaly.threshold}).`,
          severity: AlertSeverity.WARNING,
          metrics: { category: anomaly.category, count: anomaly.value, threshold: anomaly.threshold },
          detectedAt: new Date().toISOString(),
          reviewed: false,
        });
      }
    }

    const delayed = this.checkInvestigationDelay().slice(0, 5);
    for (const d of delayed) {
      alerts.push({
        id: `alert-${Date.now()}-${alerts.length}`,
        type: AlertType.INVESTIGATION_DELAY,
        title: `Investigation delay: ${d.firNumber}`,
        message: `Case ${d.firNumber} (${d.crimeType}) at ${d.policeStation} has been open ${d.daysSince} days.`,
        severity: d.daysSince > 90 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
        district: d.district,
        policeStation: d.policeStation,
        metrics: { firNumber: d.firNumber, daysSince: d.daysSince, crimeType: d.crimeType },
        detectedAt: new Date().toISOString(),
        reviewed: false,
      });
    }

    return alerts;
  }

  getAlerts(filters = {}) {
    return this._filterAlerts(this._storedAlerts, filters);
  }

  getAlertById(id) {
    return this._storedAlerts.find(a => a.id === id) || null;
  }

  markAlertReviewed(id) {
    const alert = this._storedAlerts.find(a => a.id === id);
    if (!alert) return null;
    alert.reviewed = true;
    return alert;
  }

  setStoredAlerts(alerts) {
    this._storedAlerts = alerts;
  }

  _filterAlerts(alerts, filters = {}) {
    let result = [...(alerts || [])];
    if (filters.type) result = result.filter(a => a.type === filters.type);
    if (filters.severity) result = result.filter(a => a.severity === filters.severity);
    if (filters.district) result = result.filter(a => a.district === filters.district);
    if (filters.reviewed !== undefined) result = result.filter(a => a.reviewed === filters.reviewed);
    if (filters.fromDate) result = result.filter(a => a.detectedAt >= filters.fromDate);
    if (filters.toDate) result = result.filter(a => a.detectedAt <= filters.toDate);
    return result;
  }

  processQuery(query, filters = {}) {
    const q = query.toLowerCase();
    const overview = this.getOverview(filters);

    if (q.includes('overview') || q.includes('summary') || q.includes('dashboard')) {
      return { type: 'overview', data: overview, message: `Total incidents: ${overview.totalIncidents}, Active: ${overview.activeInvestigations}, Closed: ${overview.closedInvestigations}` };
    }
    if (q.includes('total') && q.includes('incident')) {
      return { type: 'simple', data: { totalIncidents: overview.totalIncidents }, message: `There are ${overview.totalIncidents} total incidents.` };
    }
    if (q.includes('active') || q.includes('pending')) {
      return { type: 'simple', data: { activeCases: overview.activeInvestigations }, message: `There are ${overview.activeInvestigations} active investigations.` };
    }
    if (q.includes('hotspot') || q.includes('hot spot')) {
      const hotspots = this.getHotspots(filters);
      const top = hotspots.slice(0, 5);
      return { type: 'hotspots', data: top, message: `Top ${top.length} hotspots identified.` };
    }
    if (q.includes('trend') || q.includes('trending')) {
      const trends = this.getMonthlyTrends(filters);
      return { type: 'trends', data: trends.slice(-6), message: `Showing ${Math.min(6, trends.length)} month trend.` };
    }
    if (q.includes('offender') || q.includes('repeat')) {
      const offenders = this.getOffenders(filters);
      const repeat = offenders.filter(o => o.classification === 'Repeat Offender');
      return { type: 'offenders', data: { total: offenders.length, repeat: repeat.length, top: repeat.slice(0, 5) }, message: `${repeat.length} repeat offenders found.` };
    }
    if (q.includes('district')) {
      const summaries = this.getAllDistrictSummaries(filters);
      return { type: 'districts', data: summaries, message: `Analysis for ${summaries.length} districts.` };
    }
    if (q.includes('anomaly') || q.includes('spike')) {
      const anomalies = this.detectAnomalies(filters);
      return { type: 'anomalies', data: anomalies, message: `${anomalies.length} anomalies detected.` };
    }
    if (q.includes('risk')) {
      const risks = this.calculateAllDistrictRisks(filters);
      return { type: 'risk', data: risks.slice(0, 5), message: `Risk scores calculated for ${risks.length} districts.` };
    }
    if (q.includes('network') || q.includes('graph')) {
      const graph = this.getNetworkGraph(filters);
      return { type: 'network', data: { nodeCount: graph.nodes.length, edgeCount: graph.edges.length }, message: `Network has ${graph.nodes.length} nodes and ${graph.edges.length} edges.` };
    }

    return { type: 'unknown', data: null, message: `I understand general queries about crime data. Try asking about overview, hotspots, trends, offenders, districts, anomalies, risk, or network. Your query: "${query}"` };
  }

  getSuggestions() {
    return [
      'Show me the overview of all incidents',
      'What are the current hotspots?',
      'Show monthly crime trends',
      'List repeat offenders',
      'Which districts have the highest risk?',
      'Detect anomalies in recent data',
      'Compare crime across districts',
      'Show the network graph',
      'What is the clearance rate?',
      'Show alerts for review',
    ];
  }

  generateReport(filters = {}, format = 'html') {
    const overview = this.getOverview(filters);
    const hotspots = this.getHotspots(filters);
    const trends = this.getMonthlyTrends(filters);
    const districts = this.getAllDistrictSummaries(filters);
    const anomalies = this.detectAnomalies(filters);
    const risks = this.calculateAllDistrictRisks(filters);
    const offenders = this.getOffenders(filters);

    const dateStr = new Date().toISOString().split('T')[0];

    function tr(cells) {
      return '<tr>' + cells.join('') + '</tr>';
    }
    function td(v) {
      return '<td>' + v + '</td>';
    }
    function th(v) {
      return '<th>' + v + '</th>';
    }
    function hotspotRows(list) {
      return list.slice(0, 5).map(function(h) {
        return tr([td(h.district), td(h.score), td(h.incidentCount), td(h.avgSeverity), td((h.confidence * 100).toFixed(0) + '%')]);
      }).join('');
    }
    function riskRows(list) {
      return list.slice(0, 10).map(function(r) {
        return tr([td(r.district), td(r.score), td(r.band), td((r.confidence * 100).toFixed(0) + '%')]);
      }).join('');
    }
    function trendRows(list) {
      return list.slice(-12).map(function(t) {
        return tr([td(t.month), td(t.total)]);
      }).join('');
    }
    function districtRows(list) {
      return list.slice(0, 15).map(function(d) {
        return tr([td(d.district), td(d.totalIncidents), td(d.topCategory), td(d.avgSeverity), td(d.activeCases)]);
      }).join('');
    }
    function anomalyList(list) {
      if (list.length === 0) return '<p>No anomalies detected.</p>';
      var items = list.slice(0, 10).map(function(a) {
        return '<li>' + a.type + ': ' + (a.district || a.policeStation || a.category) + ' (value: ' + a.value + ', z-score: ' + a.zScore + ')</li>';
      });
      return '<ul>' + items.join('') + '</ul>';
    }
    function offenderRows(list) {
      return list.slice(0, 10).map(function(o) {
        return tr([td(o.personId), td(o.incidentCount), td(o.classification), td(o.riskScore)]);
      }).join('');
    }

    var html = '<!DOCTYPE html>';
    html += '<html lang="en">';
    html += '<head><meta charset="UTF-8"><title>KAVACH Crime Analysis Report - ' + dateStr + '</title>';
    html += '<style>';
    html += '  body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 40px; color: #333; }';
    html += '  h1 { color: #1a237e; border-bottom: 2px solid #1a237e; padding-bottom: 10px; }';
    html += '  h2 { color: #283593; margin-top: 30px; }';
    html += '  .card { background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 15px 0; display: inline-block; min-width: 200px; }';
    html += '  .card h3 { margin: 0 0 5px 0; color: #555; font-size: 14px; text-transform: uppercase; }';
    html += '  .card .value { font-size: 28px; font-weight: bold; color: #1a237e; }';
    html += '  table { width: 100%; border-collapse: collapse; margin: 15px 0; }';
    html += '  th { background: #1a237e; color: white; padding: 10px; text-align: left; }';
    html += '  td { padding: 8px 10px; border-bottom: 1px solid #ddd; }';
    html += '  tr:nth-child(even) { background: #f9f9f9; }';
    html += '  .footer { margin-top: 40px; font-size: 12px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }';
    html += '</style></head>';
    html += '<body>';
    html += '<h1>KAVACH Crime Analysis Report</h1>';
    html += '<p>Generated: ' + new Date().toISOString() + ' | Total Incidents: ' + overview.totalIncidents + '</p>';
    html += '<h2>Overview</h2>';
    html += '<div class="card"><h3>Total Incidents</h3><div class="value">' + overview.totalIncidents + '</div></div>';
    html += '<div class="card"><h3>Active Investigations</h3><div class="value">' + overview.activeInvestigations + '</div></div>';
    html += '<div class="card"><h3>Closed Cases</h3><div class="value">' + overview.closedInvestigations + '</div></div>';
    html += '<div class="card"><h3>Repeat Offenders</h3><div class="value">' + overview.repeatOffenders + '</div></div>';
    html += '<div class="card"><h3>Data Quality</h3><div class="value">' + overview.dataQualityScore + '%</div></div>';
    html += '<h2>Hotspots (Top 5)</h2>';
    html += '<table><tr>' + th('District') + th('Score') + th('Incidents') + th('Severity') + th('Confidence') + '</tr>';
    html += hotspotRows(hotspots);
    html += '</table>';
    html += '<h2>District Risk Scores</h2>';
    html += '<table><tr>' + th('District') + th('Score') + th('Band') + th('Confidence') + '</tr>';
    html += riskRows(risks);
    html += '</table>';
    html += '<h2>Monthly Trends</h2>';
    html += '<table><tr>' + th('Month') + th('Incidents') + '</tr>';
    html += trendRows(trends);
    html += '</table>';
    html += '<h2>District Summary</h2>';
    html += '<table><tr>' + th('District') + th('Incidents') + th('Top Category') + th('Avg Severity') + th('Active Cases') + '</tr>';
    html += districtRows(districts);
    html += '</table>';
    html += '<h2>Anomalies Detected</h2>';
    html += anomalyList(anomalies);
    html += '<h2>Offender Analysis</h2>';
    html += '<p>Total offenders: ' + offenders.length + ' | Repeat offenders: ' + offenders.filter(function(o) { return o.classification === 'Repeat Offender'; }).length + '</p>';
    html += '<table><tr>' + th('ID') + th('Incidents') + th('Classification') + th('Risk Score') + '</tr>';
    html += offenderRows(offenders);
    html += '</table>';
    html += '<div class="footer">';
    html += '<p>KAVACH AI - Automated Crime Analysis Report | Data source: Karnataka Crime Incidents | Report ID: KAVACH-' + dateStr + '</p>';
    html += '</div>';
    html += '</body></html>';

    return { html: html, contentType: 'text/html', filename: 'kavach-report-' + dateStr + '.html' };
  }

  _getDataPeriod(incidents) {
    const dates = incidents.map(i => i.incident_date).filter(Boolean).sort();
    if (dates.length === 0) return { start: null, end: null };
    return { start: dates[0], end: dates[dates.length - 1] };
  }
}
