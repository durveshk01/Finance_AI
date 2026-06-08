# FinanceIQ Security Policy

FinanceIQ handles sensitive financial documents and should be deployed with strict operational controls.

## Implemented Controls

- No account system or database is required.
- Uploads are validated by extension, MIME type, count, size, and emptiness.
- API routes are rate limited in memory.
- OpenAI calls are made server-side only.
- Statement text is treated as untrusted data in AI prompts.
- Security headers are configured in `next.config.ts`.

## Required Production Controls

- Use HTTPS only.
- Configure `OPENAI_API_KEY` only in the hosting provider environment, never in client code.
- Add persistent distributed rate limiting for multi-instance deployments.
- Add malware scanning for uploaded files before parsing.
- Add error tracking and monitoring.
- Review dependency audit output before every deployment.

## Reporting Issues

If you find a vulnerability, do not publish it publicly. Send a private report to the project owner with:

- Impact
- Steps to reproduce
- Affected endpoint or file
- Suggested remediation
