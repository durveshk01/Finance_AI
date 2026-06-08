# FinanceIQ Privacy Policy

FinanceIQ is designed as a privacy-first bank statement analysis tool.

## Data Processed

The app processes uploaded PDF, CSV, and XLSX bank statements to extract transactions and generate financial insights.

## Storage

The current implementation does not intentionally store uploaded files, parsed transactions, or reports in a database. Data is processed during the request and returned to the browser.

## AI Processing

If `OPENAI_API_KEY` is configured, selected transaction data may be sent to OpenAI to improve categorization and chatbot responses. If no key is configured, FinanceIQ uses local rule-based analysis.

## User Accounts

No login, signup, or subscription is required.

## Production Requirements

Before serving real users, deployers should add:

- Full legal privacy policy reviewed for their jurisdiction
- Terms of service
- Data retention controls
- Incident response process
- Monitoring and audit logs
