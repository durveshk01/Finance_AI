export type Transaction = {
  id: string;
  date: string;
  description: string;
  merchant: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  confidence: number;
};

export type Subscription = {
  merchant: string;
  monthlyCost: number;
  annualCost: number;
  confidence: number;
  nextPaymentDate: string;
  recommendation: string;
};

export type InsightReport = {
  generatedAt: string;
  totals: {
    income: number;
    expenses: number;
    netSavings: number;
    savingsRate: number;
    averageDailySpend: number;
  };
  health: {
    score: number;
    label: string;
    breakdown: { factor: string; value: string; impact: "positive" | "neutral" | "negative" }[];
  };
  lifestyle: {
    personality: "Saver" | "Balanced" | "Impulsive" | "Luxury spender" | "Investor";
    summary: string;
  };
  categories: { name: string; amount: number; percent: number }[];
  dailyTrend: { date: string; amount: number }[];
  weeklyTrend: { week: string; amount: number }[];
  merchants: { merchant: string; amount: number; transactions: number }[];
  subscriptions: Subscription[];
  opportunities: { title: string; detail: string; yearlySavings: number }[];
  alerts: { severity: "low" | "medium" | "high"; title: string; detail: string }[];
  bills: { merchant: string; amount: number; predictedDate: string }[];
  forecasting: {
    nextMonthExpenses: number;
    nextMonthSavings: number;
    futureBalance90Days: number;
    goalProbability: number;
  };
  weekendVsWeekday: { weekend: number; weekday: number };
  salary: { detected: boolean; merchant: string; amount: number; cadence: string; trend: string };
  coachTips: string[];
  transactions: Transaction[];
};

const categoryRules: Record<string, string[]> = {
  Food: ["swiggy", "zomato", "restaurant", "cafe", "starbucks", "mcdonald", "pizza", "food", "dining"],
  Groceries: ["grocery", "dmart", "bigbasket", "supermarket", "mart", "blinkit", "instamart"],
  Transport: ["uber", "ola", "metro", "fuel", "petrol", "shell", "parking", "toll", "rapido"],
  Shopping: ["amazon", "flipkart", "myntra", "store", "retail", "shop", "nykaa"],
  Entertainment: ["netflix", "spotify", "prime", "hotstar", "movie", "bookmyshow", "gaming"],
  Utilities: ["electricity", "water", "gas", "mobile", "airtel", "jio", "wifi", "broadband", "bill"],
  Health: ["pharmacy", "hospital", "clinic", "doctor", "medical", "health"],
  Travel: ["hotel", "flight", "airbnb", "railway", "irctc", "travel"],
  Investments: ["mutual", "sip", "zerodha", "groww", "stocks", "investment"],
  Debt: ["emi", "loan", "credit card", "interest"],
};

export function categorize(description: string, amount: number): string {
  if (amount > 0) return /salary|payroll|income|credit/i.test(description) ? "Salary" : "Income";
  const normalized = description.toLowerCase();
  const match = Object.entries(categoryRules).find(([, tokens]) => tokens.some((token) => normalized.includes(token)));
  return match?.[0] ?? "Other";
}

export function merchantFromDescription(description: string): string {
  return description
    .replace(/upi|pos|neft|imps|txn|payment|debit|credit|ref|[0-9]/gi, "")
    .replace(/[^a-zA-Z ]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(" ") || "Unknown merchant";
}

export function parseTransactionsFromText(text: string): Transaction[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const transactions: Transaction[] = [];

  for (const [index, line] of lines.entries()) {
    const dateMatch = line.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/);
    const amounts = [...line.matchAll(/-?\b\d{2,}(?:,\d{3})*(?:\.\d{1,2})?\b/g)]
      .map((match) => Number(match[0].replace(/,/g, "")))
      .filter((amount) => Number.isFinite(amount));

    if (!dateMatch || amounts.length === 0) continue;

    const debitWords = /debit|withdrawal|paid|spent|dr\b|purchase/i.test(line);
    const creditWords = /credit|deposit|salary|payroll|cr\b|refund/i.test(line);
    const rawAmount = amounts[amounts.length - 1];
    const amount = creditWords && !debitWords ? Math.abs(rawAmount) : -Math.abs(rawAmount);
    const description = line.replace(dateMatch[0], "").replace(String(rawAmount), "").trim() || `Transaction ${index + 1}`;
    const category = categorize(description, amount);

    transactions.push({
      id: `txn_${index}_${Math.abs(amount)}`,
      date: normalizeDate(dateMatch[0]),
      description,
      merchant: merchantFromDescription(description),
      amount,
      type: amount >= 0 ? "income" : "expense",
      category,
      confidence: 0.72,
    });
  }

  return transactions;
}

export function demoTransactions(): Transaction[] {
  const merchants = [
    ["ACME Payroll Salary", 124000, "Salary"],
    ["Swiggy", -1280, "Food"],
    ["Amazon Marketplace", -4300, "Shopping"],
    ["Netflix", -649, "Entertainment"],
    ["Uber", -760, "Transport"],
    ["Airtel Broadband", -1199, "Utilities"],
    ["Groww SIP", -15000, "Investments"],
    ["Zomato", -920, "Food"],
    ["BigBasket", -3720, "Groceries"],
    ["Credit Card EMI", -8400, "Debt"],
    ["BookMyShow", -1600, "Entertainment"],
    ["Apollo Pharmacy", -1450, "Health"],
  ] as const;
  const today = new Date();
  const txns: Transaction[] = [];
  for (let i = 0; i < 72; i++) {
    const item = merchants[i % merchants.length];
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const variation = item[1] < 0 ? -(Math.round(Math.abs(item[1]) * (0.75 + ((i % 7) * 0.07)))) : item[1];
    txns.push({
      id: `demo_${i}`,
      date: date.toISOString().slice(0, 10),
      description: item[0],
      merchant: item[0],
      amount: variation,
      type: variation >= 0 ? "income" : "expense",
      category: item[2],
      confidence: 0.86,
    });
  }
  return txns;
}

export function buildReport(transactions: Transaction[]): InsightReport {
  const expenses = Math.abs(sum(transactions.filter((t) => t.amount < 0).map((t) => t.amount)));
  const income = sum(transactions.filter((t) => t.amount > 0).map((t) => t.amount));
  const netSavings = income - expenses;
  const savingsRate = income ? Math.round((netSavings / income) * 100) : 0;
  const categories = groupAmounts(transactions.filter((t) => t.amount < 0), "category")
    .map((row) => ({ name: row.name, amount: row.amount, percent: expenses ? Math.round((row.amount / expenses) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);
  const merchants = groupAmounts(transactions.filter((t) => t.amount < 0), "merchant")
    .map((row) => ({ merchant: row.name, amount: row.amount, transactions: row.count }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
  const subscriptions = detectSubscriptions(transactions);
  const weekendVsWeekday = transactions.filter((t) => t.amount < 0).reduce(
    (acc, txn) => {
      const day = new Date(txn.date).getDay();
      if (day === 0 || day === 6) acc.weekend += Math.abs(txn.amount);
      else acc.weekday += Math.abs(txn.amount);
      return acc;
    },
    { weekend: 0, weekday: 0 },
  );
  const topCategory = categories[0];
  const debtSpend = categories.find((c) => c.name === "Debt")?.amount ?? 0;
  const investmentSpend = categories.find((c) => c.name === "Investments")?.amount ?? 0;
  const score = clamp(
    50 + Math.min(22, savingsRate / 2) + (investmentSpend > 0 ? 10 : 0) - (debtSpend / Math.max(expenses, 1)) * 22 - (subscriptions.length > 4 ? 8 : 0),
    8,
    96,
  );
  const personality = lifestyleFor(savingsRate, categories, investmentSpend);
  const dailyTrend = trendByDay(transactions);
  const weeklyTrend = trendByWeek(transactions);
  const nextMonthExpenses = Math.round(expenses / Math.max(1, Math.ceil(transactions.length / 30)) * 1.04);

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      income,
      expenses,
      netSavings,
      savingsRate,
      averageDailySpend: Math.round(expenses / Math.max(1, new Set(transactions.map((t) => t.date)).size)),
    },
    health: {
      score: Math.round(score),
      label: score > 78 ? "Excellent" : score > 62 ? "Strong" : score > 45 ? "Needs attention" : "At risk",
      breakdown: [
        { factor: "Savings rate", value: `${savingsRate}%`, impact: savingsRate >= 20 ? "positive" : savingsRate >= 8 ? "neutral" : "negative" },
        { factor: "Recurring commitments", value: `${subscriptions.length} detected`, impact: subscriptions.length > 4 ? "negative" : "neutral" },
        { factor: "Debt pressure", value: `${Math.round((debtSpend / Math.max(expenses, 1)) * 100)}% of expenses`, impact: debtSpend > expenses * 0.18 ? "negative" : "positive" },
        { factor: "Investment discipline", value: investmentSpend ? "SIP or investing found" : "No investing pattern found", impact: investmentSpend ? "positive" : "neutral" },
      ],
    },
    lifestyle: {
      personality,
      summary: personalitySummary(personality),
    },
    categories,
    dailyTrend,
    weeklyTrend,
    merchants,
    subscriptions,
    opportunities: [
      {
        title: `Trim ${topCategory?.name ?? "discretionary"} spend by 12%`,
        detail: "FinanceIQ found a realistic reduction target based on your largest category concentration.",
        yearlySavings: Math.round((topCategory?.amount ?? expenses * 0.2) * 0.12 * 12),
      },
      {
        title: "Subscription cleanup",
        detail: "Cancel or downgrade low-usage recurring services before the next renewal cycle.",
        yearlySavings: Math.round(subscriptions.reduce((acc, sub) => acc + sub.annualCost, 0) * 0.35),
      },
      {
        title: "Rewards card optimization",
        detail: "Food, travel, grocery, and fuel payments appear eligible for category cashback optimization.",
        yearlySavings: Math.round(expenses * 0.018 * 12),
      },
    ],
    alerts: buildAlerts(categories, subscriptions, income, expenses, debtSpend),
    bills: subscriptions.map((sub) => ({ merchant: sub.merchant, amount: sub.monthlyCost, predictedDate: sub.nextPaymentDate })),
    forecasting: {
      nextMonthExpenses,
      nextMonthSavings: Math.round(Math.max(0, income - nextMonthExpenses)),
      futureBalance90Days: Math.round(netSavings * 3),
      goalProbability: clamp(35 + savingsRate + (score / 3), 12, 94),
    },
    weekendVsWeekday,
    salary: detectSalary(transactions),
    coachTips: [
      `Move ${Math.max(5, Math.min(25, savingsRate + 5))}% of income automatically on salary day.`,
      `Set a weekly cap for ${topCategory?.name ?? "top spending"}; it is your fastest savings lever.`,
      "Review recurring bills two days before renewal and mark essential vs optional.",
      "Use a rewards card only for categories you already spend on, then pay it in full.",
    ],
    transactions,
  };
}

function detectSubscriptions(transactions: Transaction[]): Subscription[] {
  const byMerchant = new Map<string, Transaction[]>();
  for (const txn of transactions.filter((t) => t.amount < 0)) {
    byMerchant.set(txn.merchant, [...(byMerchant.get(txn.merchant) ?? []), txn]);
  }
  return [...byMerchant.entries()]
    .filter(([, txns]) => txns.length >= 2)
    .map(([merchant, txns]) => {
      const monthlyCost = Math.round(txns.reduce((acc, txn) => acc + Math.abs(txn.amount), 0) / txns.length);
      const latest = new Date(txns.sort((a, b) => +new Date(b.date) - +new Date(a.date))[0].date);
      latest.setMonth(latest.getMonth() + 1);
      return {
        merchant,
        monthlyCost,
        annualCost: monthlyCost * 12,
        confidence: txns.length > 3 ? 0.9 : 0.72,
        nextPaymentDate: latest.toISOString().slice(0, 10),
        recommendation: monthlyCost > 1000 ? "Review usage and consider downgrade." : "Keep only if used monthly.",
      };
    })
    .sort((a, b) => b.annualCost - a.annualCost)
    .slice(0, 6);
}

function detectSalary(transactions: Transaction[]) {
  const salaries = transactions.filter((t) => t.amount > 0 && /salary|payroll|income/i.test(`${t.description} ${t.category}`));
  const highestIncome = transactions.filter((t) => t.amount > 0).sort((a, b) => b.amount - a.amount)[0];
  const salary = salaries[0] ?? highestIncome;
  return {
    detected: Boolean(salary),
    merchant: salary?.merchant ?? "Not detected",
    amount: salary?.amount ?? 0,
    cadence: salaries.length > 1 ? "Monthly pattern detected" : "Single deposit detected",
    trend: salaries.length > 1 ? "Stable" : "Needs more statements for growth trend",
  };
}

function buildAlerts(
  categories: { name: string; amount: number; percent: number }[],
  subscriptions: Subscription[],
  income: number,
  expenses: number,
  debtSpend: number,
): InsightReport["alerts"] {
  const alerts: InsightReport["alerts"] = [];
  if (expenses > income * 0.85) alerts.push({ severity: "high", title: "Cash flow compression", detail: "Expenses are consuming more than 85% of detected income." });
  if (debtSpend > expenses * 0.18) alerts.push({ severity: "high", title: "Debt pressure signal", detail: "Debt or EMI payments are taking a large share of monthly outflow." });
  if (subscriptions.length > 3) alerts.push({ severity: "medium", title: "Subscription creep", detail: `${subscriptions.length} recurring payments may be quietly lifting fixed costs.` });
  const top = categories[0];
  if (top?.percent > 32) alerts.push({ severity: "medium", title: "Category concentration", detail: `${top.name} accounts for ${top.percent}% of total spending.` });
  return alerts.length ? alerts : [{ severity: "low", title: "No major risk spikes", detail: "FinanceIQ did not find severe anomalies in this statement." }];
}

function groupAmounts(transactions: Transaction[], field: "category" | "merchant") {
  const grouped = new Map<string, { amount: number; count: number }>();
  for (const txn of transactions) {
    const key = txn[field];
    const current = grouped.get(key) ?? { amount: 0, count: 0 };
    grouped.set(key, { amount: current.amount + Math.abs(txn.amount), count: current.count + 1 });
  }
  return [...grouped.entries()].map(([name, value]) => ({ name, ...value }));
}

function trendByDay(transactions: Transaction[]) {
  return groupByDate(transactions, (txn) => txn.date).slice(-30);
}

function trendByWeek(transactions: Transaction[]) {
  return groupByDate(transactions, (txn) => {
    const date = new Date(txn.date);
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    return start.toISOString().slice(0, 10);
  }).map((row) => ({ week: row.date, amount: row.amount }));
}

function groupByDate(transactions: Transaction[], keyFn: (txn: Transaction) => string) {
  const grouped = new Map<string, number>();
  for (const txn of transactions.filter((t) => t.amount < 0)) {
    const key = keyFn(txn);
    grouped.set(key, (grouped.get(key) ?? 0) + Math.abs(txn.amount));
  }
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount: Math.round(amount) }));
}

function lifestyleFor(savingsRate: number, categories: { name: string; amount: number; percent: number }[], investmentSpend: number): InsightReport["lifestyle"]["personality"] {
  const luxury = categories.find((c) => ["Shopping", "Travel", "Entertainment"].includes(c.name))?.percent ?? 0;
  if (investmentSpend > 0 && savingsRate > 15) return "Investor";
  if (savingsRate > 28) return "Saver";
  if (luxury > 38) return "Luxury spender";
  if (savingsRate < 5) return "Impulsive";
  return "Balanced";
}

function personalitySummary(personality: InsightReport["lifestyle"]["personality"]) {
  const summaries = {
    Saver: "You preserve cash well and can likely accelerate goal-based investing.",
    Balanced: "Your spending mix is healthy, with a few categories worth tightening.",
    Impulsive: "Frequent discretionary spending is reducing your monthly flexibility.",
    "Luxury spender": "Premium lifestyle categories are absorbing a large share of cash flow.",
    Investor: "Your statement shows deliberate wealth-building behavior alongside routine spending.",
  };
  return summaries[personality];
}

function normalizeDate(value: string) {
  const parts = value.split(/[/-]/).map(Number);
  if (parts[0] > 1900) return new Date(parts[0], parts[1] - 1, parts[2]).toISOString().slice(0, 10);
  const year = parts[2] < 100 ? 2000 + parts[2] : parts[2];
  return new Date(year, parts[1] - 1, parts[0]).toISOString().slice(0, 10);
}

function sum(values: number[]) {
  return Math.round(values.reduce((acc, value) => acc + value, 0));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
