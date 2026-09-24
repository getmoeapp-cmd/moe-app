// Quiz estimates use one monthly basis.
// Each weekly input is converted with 52/12, the monthly lines are summed,
// and the year figure is that monthly total times 12.
const WEEKS_PER_YEAR = 52;
const MONTHS_PER_YEAR = 12;
export const QUIZ_PLAN_PRICE = 399;

const SPEND = {
  "$1,000-$3,000": 2000,
  "$3,000-$5,000": 4000,
  "$5,000-$10,000": 7500,
  "$10,000+": 12000,
};
const OVER_ORDER = { Rarely: 0.03, Sometimes: 0.06, Often: 0.10, "All the time": 0.15 };
const EMERGENCY_WEEKLY = { Never: 0, "1-2x/month": 75, Weekly: 150, "Multiple/week": 300 };
const TEAM_HOURS = { "Just me": 3, "2-5": 4, "6-10": 5, "10+": 7 };

export function weeklyToMonthly(weekly) {
  return Math.round((Number(weekly) || 0) * WEEKS_PER_YEAR / MONTHS_PER_YEAR);
}

export function calcQuizSavings(answers = {}) {
  const spend = SPEND[answers.weeklySpend] || 3000;
  const overOrderPct = OVER_ORDER[answers.overOrder] ?? 0.06;
  const emergencyWeekly = EMERGENCY_WEEKLY[answers.emergencyRuns] ?? 75;
  const teamHours = TEAM_HOURS[answers.teamSize] || 4;
  const wastePct = answers.trackWaste === "No" ? 0.05 : 0.02;

  const overOrdering = weeklyToMonthly(Math.round(spend * overOrderPct));
  const emergency = weeklyToMonthly(emergencyWeekly);
  const labor = weeklyToMonthly(Math.round(teamHours * 28));
  const waste = weeklyToMonthly(Math.round(spend * wastePct));
  const monthly = overOrdering + emergency + labor + waste;

  return {
    overOrdering,
    emergency,
    labor,
    waste,
    monthly,
    annual: monthly * MONTHS_PER_YEAR,
  };
}

export function quizPaybackDays(monthly) {
  const loss = Number(monthly) || 0;
  if (loss <= 0) return null;
  return Math.max(1, Math.ceil((QUIZ_PLAN_PRICE / loss) * 30));
}

export function quizRoiMultiple(monthly) {
  const loss = Number(monthly) || 0;
  if (loss <= 0) return 0;
  return Math.round((loss / QUIZ_PLAN_PRICE) * 10) / 10;
}
