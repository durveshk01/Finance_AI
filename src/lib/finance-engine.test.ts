import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildReport, categorize, parseTransactionsFromText } from "./finance-engine";
import { reportToCsv, safeCsvCell } from "./exporters";

const statement = `
01/05/2026 ACME Payroll Salary credit 120000
02/05/2026 Swiggy UPI debit 980
03/05/2026 Netflix Subscription debit 649
04/05/2026 Groww SIP debit 15000
02/06/2026 ACME Payroll Salary credit 125000
04/06/2026 Netflix Subscription debit 649
`;

const transactions = parseTransactionsFromText(statement);
assert.equal(transactions.length, 6);
assert.equal(transactions.filter((txn) => txn.type === "income").length, 2);

const report = buildReport(transactions);
assert.ok(report.health.score > 0);
assert.equal(report.totals.income, 245000);
assert.ok(report.subscriptions.some((subscription) => subscription.merchant.includes("Netflix")));
assert.ok(report.categories.some((category) => category.name === "Investments"));

assert.equal(categorize("BigBasket Grocery debit", -4200), "Groceries");
assert.equal(categorize("Groww SIP Investment debit", -15000), "Investments");
assert.equal(categorize("ACME Payroll Salary credit", 120000), "Salary");
assert.equal(safeCsvCell("=IMPORTXML(\"http://example.com\")"), "\"'=IMPORTXML(\"\"http://example.com\"\")\"");

const sampleStatement = readFileSync("sample-data/financeiq-demo-statement.csv", "utf8");
const sampleTransactions = parseTransactionsFromText(sampleStatement);
assert.ok(sampleTransactions.length >= 100);

const sampleReport = buildReport(sampleTransactions);
assert.ok(sampleReport.totals.income > sampleReport.totals.expenses);
assert.ok(sampleReport.salary.detected);
assert.ok(sampleReport.categories.some((category) => category.name === "Food"));
assert.ok(sampleReport.categories.some((category) => category.name === "Debt"));
assert.ok(sampleReport.subscriptions.some((subscription) => subscription.merchant.includes("Netflix")));
assert.ok(sampleReport.subscriptions.some((subscription) => subscription.merchant.includes("Spotify")));
assert.ok(sampleReport.merchants.length > 3);
assert.ok(sampleReport.forecasting.nextMonthExpenses > 0);
assert.ok(sampleReport.weekendVsWeekday.weekend > 0);
assert.ok(sampleReport.weekendVsWeekday.weekday > 0);
assert.match(reportToCsv(sampleReport), /Date,|\"Date\"/);

console.log("finance-engine tests passed");
