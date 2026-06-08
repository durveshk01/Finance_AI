import { z } from "zod";

export const transactionSchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1),
  description: z.string().min(1),
  merchant: z.string().min(1),
  amount: z.number().finite(),
  type: z.enum(["income", "expense"]),
  category: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export const subscriptionSchema = z.object({
  merchant: z.string().min(1),
  monthlyCost: z.number().finite().nonnegative(),
  annualCost: z.number().finite().nonnegative(),
  confidence: z.number().min(0).max(1),
  nextPaymentDate: z.string().min(1),
  recommendation: z.string().min(1),
});

const categorySchema = z.object({
  name: z.string().min(1),
  amount: z.number().finite().nonnegative(),
  percent: z.number().finite(),
});

export const insightReportSchema = z.object({
  generatedAt: z.string().min(1),
  totals: z.object({
    income: z.number().finite(),
    expenses: z.number().finite(),
    netSavings: z.number().finite(),
    savingsRate: z.number().finite(),
    averageDailySpend: z.number().finite(),
  }),
  health: z.object({
    score: z.number().finite().min(0).max(100),
    label: z.string().min(1),
    breakdown: z.array(z.object({
      factor: z.string().min(1),
      value: z.string().min(1),
      impact: z.enum(["positive", "neutral", "negative"]),
    })),
  }),
  lifestyle: z.object({
    personality: z.enum(["Saver", "Balanced", "Impulsive", "Luxury spender", "Investor"]),
    summary: z.string().min(1),
  }),
  categories: z.array(categorySchema),
  dailyTrend: z.array(z.object({ date: z.string().min(1), amount: z.number().finite().nonnegative() })),
  weeklyTrend: z.array(z.object({ week: z.string().min(1), amount: z.number().finite().nonnegative() })),
  merchants: z.array(z.object({
    merchant: z.string().min(1),
    amount: z.number().finite().nonnegative(),
    transactions: z.number().int().nonnegative(),
  })),
  subscriptions: z.array(subscriptionSchema),
  opportunities: z.array(z.object({
    title: z.string().min(1),
    detail: z.string().min(1),
    yearlySavings: z.number().finite().nonnegative(),
  })),
  alerts: z.array(z.object({
    severity: z.enum(["low", "medium", "high"]),
    title: z.string().min(1),
    detail: z.string().min(1),
  })),
  bills: z.array(z.object({
    merchant: z.string().min(1),
    amount: z.number().finite().nonnegative(),
    predictedDate: z.string().min(1),
  })),
  forecasting: z.object({
    nextMonthExpenses: z.number().finite(),
    nextMonthSavings: z.number().finite(),
    futureBalance90Days: z.number().finite(),
    goalProbability: z.number().finite(),
  }),
  weekendVsWeekday: z.object({
    weekend: z.number().finite().nonnegative(),
    weekday: z.number().finite().nonnegative(),
  }),
  salary: z.object({
    detected: z.boolean(),
    merchant: z.string(),
    amount: z.number().finite(),
    cadence: z.string(),
    trend: z.string(),
  }),
  coachTips: z.array(z.string()),
  transactions: z.array(transactionSchema).max(5000),
});

export const chatRequestSchema = z.object({
  question: z.string().trim().min(1).max(600),
  report: insightReportSchema,
});

export const exportRequestSchema = z.object({
  report: insightReportSchema,
  format: z.enum(["csv", "xlsx", "pdf", "json"]),
});
