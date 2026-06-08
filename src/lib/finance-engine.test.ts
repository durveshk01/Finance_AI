import assert from "node:assert/strict";
import { buildReport, parseTransactionsFromText } from "./finance-engine";

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

console.log("finance-engine tests passed");
