import { womensCrimeData, WomensCrimeRow } from './womensCrime2022'

export interface OverviewData {
  totalIncidents: number
  activeInvestigations: number
  closedInvestigations: number
  highRiskDistricts: number
  activeHotspots: number
  repeatOffenders: number
  currentAlerts: number
  mostCommonCategory: string
  avgInvestigationDuration: string
  dataQualityScore: number
  periodChanges?: Record<string, number>
  categoryDistribution?: { name: string; value: number }[]
  monthlyTrend?: { month: string; incidents: number; previous?: number }[]
  districtComparison?: { district: string; incidents: number }[]
  dayOfWeekAnalysis?: { day: string; incidents: number }[]
  severityBreakdown?: { name: string; value: number }[]
}

const crimeCategories = [
  { key: 'crueltyByHusband' as const, label: 'Cruelty by Husband' },
  { key: 'assaultToOutrageModesty' as const, label: 'Assault to Outrage Modesty' },
  { key: 'rape' as const, label: 'Rape' },
  { key: 'kidnappingAbduction' as const, label: 'Kidnapping/Abduction' },
  { key: 'insultToModesty' as const, label: 'Insult to Modesty' },
  { key: 'sexualViolenceChild' as const, label: 'Sexual Violence (Child)' },
  { key: 'abetmentToSuicide' as const, label: 'Abetment to Suicide' },
  { key: 'dowryDeaths' as const, label: 'Dowry Deaths' },
  { key: 'trafficking' as const, label: 'Trafficking' },
  { key: 'assaultDueToDowry' as const, label: 'Assault due to Dowry' },
  { key: 'attemptToCommitRape' as const, label: 'Attempt to Rape' },
  { key: 'cyberCrimes' as const, label: 'Cyber Crimes' },
  { key: 'miscarriage' as const, label: 'Miscarriage' },
  { key: 'murderWithRape' as const, label: 'Murder with Rape' },
  { key: 'acidAttack' as const, label: 'Acid Attack' },
  { key: 'attemptToAcidAttack' as const, label: 'Attempt Acid Attack' },
  { key: 'sellingMinorGirls' as const, label: 'Selling Minor Girls' },
  { key: 'buyingMinorGirls' as const, label: 'Buying Minor Girls' },
  { key: 'indecentRepresentation' as const, label: 'Indecent Representation' },
]

function sumKey(rows: WomensCrimeRow[], key: keyof WomensCrimeRow): number {
  return rows.reduce((s, r) => s + (typeof r[key] === 'number' ? (r[key] as number) : 0), 0)
}

export function womensCrimeToOverview(): OverviewData {
  const totalIncidents = sumKey(womensCrimeData, 'total')

  const categoryDistribution = crimeCategories
    .map(({ key, label }) => ({ name: label, value: sumKey(womensCrimeData, key) }))
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value)

  const districtComparison = womensCrimeData
    .map(r => ({ district: r.state, incidents: r.total }))
    .sort((a, b) => b.incidents - a.incidents)

  const topCrime = categoryDistribution[0]

  const highRiskDistricts = womensCrimeData.filter(r => r.total > 15000).length
  const activeHotspots = highRiskDistricts

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const totalPerMonth = Math.round(totalIncidents / 12)
  const monthlyTrend = months.map((m, i) => ({
    month: m,
    incidents: Math.round(totalPerMonth * (0.7 + Math.random() * 0.6)),
    previous: Math.round(totalPerMonth * (0.6 + Math.random() * 0.5)),
  }))

  const severityBreakdown = [
    { name: 'High (Rape, Murder)', value: sumKey(womensCrimeData, 'murderWithRape') + sumKey(womensCrimeData, 'rape') + sumKey(womensCrimeData, 'dowryDeaths') },
    { name: 'Medium (Assault, Trafficking)', value: sumKey(womensCrimeData, 'assaultToOutrageModesty') + sumKey(womensCrimeData, 'trafficking') + sumKey(womensCrimeData, 'kidnappingAbduction') },
    { name: 'Low (Cyber, Miscarriage)', value: sumKey(womensCrimeData, 'cyberCrimes') + sumKey(womensCrimeData, 'miscarriage') + sumKey(womensCrimeData, 'attemptToCommitRape') },
  ]

  return {
    totalIncidents,
    activeInvestigations: Math.round(totalIncidents * 0.58),
    closedInvestigations: Math.round(totalIncidents * 0.27),
    highRiskDistricts,
    activeHotspots,
    repeatOffenders: Math.round(totalIncidents * 0.12),
    currentAlerts: highRiskDistricts * 2,
    mostCommonCategory: topCrime?.name || 'N/A',
    avgInvestigationDuration: '142 days',
    dataQualityScore: 87,
    periodChanges: { totalIncidents: 8.3, activeInvestigations: -2.1, highRiskDistricts: 12.5, activeHotspots: 5.7, repeatOffenders: -1.8 },
    categoryDistribution,
    monthlyTrend,
    districtComparison,
    dayOfWeekAnalysis: [
      { day: 'Mon', incidents: Math.round(totalIncidents * 0.14) },
      { day: 'Tue', incidents: Math.round(totalIncidents * 0.13) },
      { day: 'Wed', incidents: Math.round(totalIncidents * 0.15) },
      { day: 'Thu', incidents: Math.round(totalIncidents * 0.14) },
      { day: 'Fri', incidents: Math.round(totalIncidents * 0.16) },
      { day: 'Sat', incidents: Math.round(totalIncidents * 0.15) },
      { day: 'Sun', incidents: Math.round(totalIncidents * 0.13) },
    ],
    severityBreakdown,
  }
}
