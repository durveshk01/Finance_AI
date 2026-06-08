"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Landmark,
  LineChart,
  Lock,
  Moon,
  PiggyBank,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  TrendingDown,
  TrendingUp,
  UploadCloud,
  WalletCards,
  Zap,
} from "lucide-react";
import type { InsightReport } from "@/lib/finance-engine";

const palette = ["#14b8a6", "#2563eb", "#f59e0b", "#ef4444", "#8b5cf6", "#10b981", "#f97316", "#64748b"];

type ChatMessage = { role: "user" | "assistant"; content: string };
type ExportFormat = "csv" | "xlsx" | "pdf" | "json";

export default function Home() {
  const [dark, setDark] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [report, setReport] = useState<InsightReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [goal, setGoal] = useState("Build a Rs 300,000 emergency fund in 12 months");
  const [simulator, setSimulator] = useState(20);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isChatting, setIsChatting] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Upload a statement and I can answer questions from the actual transaction data." },
  ]);
  const [chartsReady, setChartsReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setChartsReady(true), 0);
    window.dispatchEvent(new CustomEvent("financeiq:page_view", { detail: { page: "home" } }));
    return () => window.clearTimeout(timer);
  }, []);

  const goalPlan = useMemo(() => {
    const amount = Number(goal.match(/\d[\d,]*/)?.[0]?.replace(/,/g, "") ?? 300000);
    const months = Number(goal.match(/(\d+)\s*month/i)?.[1] ?? 12);
    const monthly = Math.ceil(amount / months);
    const surplus = report?.totals.netSavings ?? 0;
    return { amount, months, monthly, probability: report ? Math.min(96, Math.max(18, Math.round((surplus / monthly) * 72))) : 68 };
  }, [goal, report]);

  const foodSpend = report?.categories.find((category) => category.name === "Food")?.amount ?? 0;
  const simulatedSavings = Math.round(foodSpend * (simulator / 100) * 12);

  async function analyze(nextFiles = files) {
    setIsAnalyzing(true);
    setError(null);
    try {
      const form = new FormData();
      nextFiles.forEach((file) => form.append("files", file));
      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const data = (await response.json()) as { report?: InsightReport; error?: { message: string } };
      if (!response.ok || !data.report) throw new Error(data.error?.message ?? "Analysis failed. Please try another statement.");
      setReport(data.report);
      setMessages([{ role: "assistant", content: `Analysis complete. Your financial health score is ${data.report.health.score}/100. Ask me anything about this statement.` }]);
      window.dispatchEvent(new CustomEvent("financeiq:analysis_complete", { detail: { transactions: data.report.transactions.length } }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed. Please try again.";
      setError(message);
      setMessages([{ role: "assistant", content: "I could not analyze that statement yet. Check the upload message and try again." }]);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function askCoach(prompt = question) {
    if (!prompt.trim()) return;
    const activeReport = report ?? sampleReport;
    setIsChatting(true);
    setError(null);
    setQuestion("");
    setMessages((current) => [...current, { role: "user", content: prompt }, { role: "assistant", content: "Thinking through the statement..." }]);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: prompt, report: activeReport }),
      });
      const data = (await response.json()) as { answer?: string; error?: { message: string } };
      if (!response.ok || !data.answer) throw new Error(data.error?.message ?? "The coach could not answer right now.");
      const answer = data.answer;
      setMessages((current) => [...current.slice(0, -1), { role: "assistant", content: answer }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "The coach could not answer right now.";
      setMessages((current) => [...current.slice(0, -1), { role: "assistant", content: message }]);
    } finally {
      setIsChatting(false);
    }
  }

  async function exportReport(format: ExportFormat) {
    if (!report) return;
    setExporting(format);
    setError(null);
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report, format }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: { message: string } };
        throw new Error(data.error?.message ?? "Export failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = format === "json" ? "financeiq-report.json" : format === "pdf" ? "financeiq-report.pdf" : format === "xlsx" ? "financeiq-transactions.xlsx" : "financeiq-transactions.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  }

  function onFiles(selected: FileList | null) {
    const next = Array.from(selected ?? []);
    if (!next.length) return;
    setFiles(next);
    void analyze(next);
  }

  return (
    <main className={dark ? "dark" : ""}>
      <div className="mesh min-h-screen text-slate-950 transition-colors dark:text-slate-50">
        <header className="sticky top-0 z-30 border-b border-white/20 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
            <a className="flex items-center gap-3" href="#top">
              <span className="grid size-10 place-items-center rounded-lg bg-slate-950 text-white shadow-lg dark:bg-white dark:text-slate-950">
                <Landmark size={20} />
              </span>
              <span>
                <span className="block text-lg font-bold">FinanceIQ</span>
                <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">Private AI statement intelligence</span>
              </span>
            </a>
            <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300 md:flex">
              <a href="#dashboard">Dashboard</a>
              <a href="#features">Features</a>
              <a href="#privacy">Privacy</a>
              <a href="#faq">FAQ</a>
            </nav>
            <div className="flex items-center gap-2">
              <button
                aria-label="Toggle theme"
                onClick={() => setDark((value) => !value)}
                className="grid size-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-teal-300 dark:border-white/10 dark:bg-white/10 dark:text-slate-100"
              >
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="hidden items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-teal-700 dark:bg-teal-400 dark:text-slate-950 sm:flex"
              >
                Upload <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </header>

        <section id="top" className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:py-14">
          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-white/60 px-3 py-1 text-sm font-medium text-teal-800 shadow-sm backdrop-blur dark:bg-white/10 dark:text-teal-200">
              <Sparkles size={16} /> No login. No signup. No subscription.
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-normal text-slate-950 dark:text-white sm:text-6xl lg:text-7xl">
              FinanceIQ
            </h1>
            <p className="mt-5 max-w-2xl text-xl leading-8 text-slate-650 dark:text-slate-300">
              Upload bank statements and get an AI financial health report, spending forecast, subscription hunter, goal planner, and a financial coach that understands your transaction data.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ["0 accounts", "Start instantly"],
                ["100% private", "Auto-delete after analysis"],
                ["PDF CSV XLSX", "Multi-statement ready"],
              ].map(([metric, label]) => (
                <div key={metric} className="glass rounded-lg p-4">
                  <div className="text-2xl font-bold">{metric}</div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.1 }} className="glass rounded-lg p-4 sm:p-5">
            <div
              onDrop={(event) => {
                event.preventDefault();
                onFiles(event.dataTransfer.files);
              }}
              onDragOver={(event) => event.preventDefault()}
              className="rounded-lg border border-dashed border-teal-400/70 bg-white/70 p-6 text-center transition hover:border-teal-500 hover:bg-white/90 dark:bg-white/10 dark:hover:bg-white/15"
            >
              <input ref={fileInputRef} className="hidden" type="file" multiple accept=".pdf,.csv,.xlsx" onChange={(event) => onFiles(event.target.files)} />
              <div className="mx-auto grid size-16 place-items-center rounded-lg bg-teal-500 text-white shadow-xl shadow-teal-500/25">
                <UploadCloud size={30} />
              </div>
              <h2 className="mt-5 text-2xl font-semibold">Drop statements here</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-300">
                Upload PDF, CSV, XLSX, or plain bank statement files. Multiple statements can be compared in one analysis.
              </p>
              <button onClick={() => fileInputRef.current?.click()} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-teal-700 dark:bg-teal-400 dark:text-slate-950">
                Select files <FileSpreadsheet size={18} />
              </button>
              <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs text-slate-500 dark:text-slate-300">
                {(files.length ? files.map((file) => file.name) : ["HDFC_Jan.pdf", "ICICI_Feb.csv", "SBI_Mar.xlsx"]).map((name) => (
                  <span key={name} className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 dark:border-white/10 dark:bg-white/10">{name}</span>
                ))}
              </div>
              {error ? (
                <div className="mx-auto mt-5 max-w-md rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-left text-sm text-rose-800 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200">
                  <strong className="block">Analysis issue</strong>
                  <span>{error}</span>
                  {files.length ? (
                    <button onClick={() => void analyze(files)} className="mt-3 inline-flex rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white">
                      Retry analysis
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                [Bot, "AI extraction"],
                [ShieldCheck, "Fraud signals"],
                [LineChart, "Forecasting"],
              ].map(([Icon, label]) => (
                <div key={label as string} className="flex items-center gap-2 rounded-lg bg-slate-950/5 px-3 py-3 text-sm font-medium dark:bg-white/10">
                  <Icon size={17} className="text-teal-500" /> {label as string}
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        <AnimatePresence>
          {isAnalyzing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 grid place-items-center bg-slate-950/60 p-4 backdrop-blur">
              <div className="glass max-w-md rounded-lg p-6 text-center text-white">
                <div className="mx-auto mb-5 size-12 animate-spin rounded-full border-4 border-white/20 border-t-teal-300" />
                <h2 className="text-2xl font-semibold">Building your financial intelligence layer</h2>
                <p className="mt-2 text-sm text-slate-200">Extracting transactions, finding subscriptions, scoring risk, and preparing the AI coach.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <section id="dashboard" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <SectionTitle eyebrow="Live Product" title="AI financial command center" text="The dashboard lights up after upload with health scoring, trend prediction, merchant intelligence, budgeting, search, and chat." />
          <Dashboard report={report} goal={goal} setGoal={setGoal} goalPlan={goalPlan} simulator={simulator} setSimulator={setSimulator} simulatedSavings={simulatedSavings} messages={messages} question={question} setQuestion={setQuestion} askCoach={askCoach} exportReport={exportReport} chartsReady={chartsReady} isChatting={isChatting} exporting={exporting} />
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <SectionTitle eyebrow="Premium Features" title="More than spending categories" text="FinanceIQ adds advanced personal finance intelligence normally split across budgeting, forecasting, and wealth apps." />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <motion.div key={feature.title} whileHover={{ y: -4 }} className="glass rounded-lg p-5">
                <feature.icon className="mb-4 text-teal-500" size={24} />
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{feature.text}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section id="privacy" className="border-y border-slate-200/70 bg-white/45 py-16 backdrop-blur dark:border-white/10 dark:bg-slate-950/35">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-600 dark:text-teal-300">Privacy-first</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-normal">Built for sensitive financial data</h2>
              <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-300">No account walls, no permanent storage requirement, and a local-processing option for teams that want statement parsing inside their own environment.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {privacy.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-lg bg-white/70 p-4 shadow-sm dark:bg-white/10">
                  <CheckCircle2 className="text-teal-500" size={20} />
                  <span className="font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <SectionTitle eyebrow="FAQ" title="Straight answers" text="FinanceIQ is designed for instant analysis without turning a private finance task into an onboarding funnel." />
          <div className="space-y-3">
            {faq.map((item) => (
              <details key={item.q} className="glass rounded-lg p-5">
                <summary className="cursor-pointer text-lg font-semibold">{item.q}</summary>
                <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <footer className="border-t border-slate-200/70 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
          FinanceIQ analyzes statements for education and planning. It does not replace a licensed financial advisor.
        </footer>
      </div>
    </main>
  );
}

function Dashboard(props: {
  report: InsightReport | null;
  goal: string;
  setGoal: (goal: string) => void;
  goalPlan: { amount: number; months: number; monthly: number; probability: number };
  simulator: number;
  setSimulator: (value: number) => void;
  simulatedSavings: number;
  messages: ChatMessage[];
  question: string;
  setQuestion: (value: string) => void;
  askCoach: (question?: string) => Promise<void>;
  exportReport: (format: ExportFormat) => Promise<void>;
  chartsReady: boolean;
  isChatting: boolean;
  exporting: ExportFormat | null;
}) {
  const report = props.report ?? sampleReport;
  return (
    <div className="mt-8 grid gap-4 lg:grid-cols-12">
      <Metric title="Income" value={money(report.totals.income)} icon={TrendingUp} tone="text-emerald-500" />
      <Metric title="Expenses" value={money(report.totals.expenses)} icon={TrendingDown} tone="text-rose-500" />
      <Metric title="Net savings" value={money(report.totals.netSavings)} icon={PiggyBank} tone="text-teal-500" />
      <Metric title="Health score" value={`${report.health.score}/100`} icon={Zap} tone="text-amber-500" />

      <Panel className="lg:col-span-4" title="Financial Health Score" action={report.health.label}>
        <div className="flex items-center gap-6">
          <div className="relative grid size-36 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-blue-600 text-4xl font-bold text-white shadow-xl">
            {report.health.score}
            <span className="absolute bottom-8 text-xs font-medium">out of 100</span>
          </div>
          <div className="space-y-3">
            {report.health.breakdown.map((item) => (
              <div key={item.factor} className="flex items-start gap-2 text-sm">
                <span className={`mt-1 size-2 rounded-full ${item.impact === "positive" ? "bg-emerald-500" : item.impact === "negative" ? "bg-rose-500" : "bg-amber-500"}`} />
                <span><strong>{item.factor}:</strong> {item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel className="lg:col-span-4" title="Spending by Category" action="Interactive">
        <div className="h-72">
          {props.chartsReady ? <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={report.categories} dataKey="amount" nameKey="name" innerRadius={58} outerRadius={96} paddingAngle={3}>
                {report.categories.map((_, index) => <Cell key={index} fill={palette[index % palette.length]} />)}
              </Pie>
              <Tooltip formatter={(value) => money(Number(value))} />
            </PieChart>
          </ResponsiveContainer> : <ChartSkeleton />}
        </div>
      </Panel>

      <Panel className="lg:col-span-4" title="AI Coach" action="Statement-aware">
        <div className="scrollbar-thin h-56 overflow-auto space-y-3 pr-1">
          {props.messages.map((message, index) => (
            <div key={index} className={`rounded-lg px-3 py-2 text-sm leading-6 ${message.role === "assistant" ? "bg-teal-500/10 text-slate-700 dark:text-slate-200" : "ml-8 bg-slate-950 text-white dark:bg-white dark:text-slate-950"}`}>
              {message.content}
            </div>
          ))}
        </div>
        <form onSubmit={(event) => { event.preventDefault(); void props.askCoach(); }} className="mt-3 flex gap-2">
          <input value={props.question} onChange={(event) => props.setQuestion(event.target.value)} placeholder="Where am I spending most?" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400 dark:border-white/10 dark:bg-white/10" />
          <button disabled={props.isChatting} className="grid size-10 place-items-center rounded-lg bg-teal-500 text-white disabled:cursor-not-allowed disabled:opacity-60" aria-label="Ask coach"><ChevronRight size={18} /></button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {["Show all food expenses", "What subscriptions should I cancel?", "What unusual transactions do you see?"].map((prompt) => (
            <button key={prompt} onClick={() => void props.askCoach(prompt)} className="rounded-full border border-slate-200 px-3 py-1 text-xs dark:border-white/10">{prompt}</button>
          ))}
        </div>
      </Panel>

      <Panel className="lg:col-span-8" title="Daily Spending Trend" action="30 days">
        <div className="h-72">
          {props.chartsReady ? <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={report.dailyTrend}>
              <defs>
                <linearGradient id="spend" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.22)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => money(Number(value))} />
              <Area dataKey="amount" stroke="#14b8a6" fill="url(#spend)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer> : <ChartSkeleton />}
        </div>
      </Panel>

      <Panel className="lg:col-span-4" title="Lifestyle Analysis" action={report.lifestyle.personality}>
        <p className="text-3xl font-semibold">{report.lifestyle.personality}</p>
        <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">{report.lifestyle.summary}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-white/70 p-3 dark:bg-white/10"><span className="block text-slate-500">Weekend</span>{money(report.weekendVsWeekday.weekend)}</div>
          <div className="rounded-lg bg-white/70 p-3 dark:bg-white/10"><span className="block text-slate-500">Weekday</span>{money(report.weekendVsWeekday.weekday)}</div>
        </div>
      </Panel>

      <Panel className="lg:col-span-4" title="Subscription Hunter" action={`${report.subscriptions.length} found`}>
        <div className="space-y-3">
          {report.subscriptions.slice(0, 4).map((sub) => (
            <div key={sub.merchant} className="flex items-center justify-between rounded-lg bg-white/70 p-3 dark:bg-white/10">
              <div>
                <div className="font-semibold">{sub.merchant}</div>
                <div className="text-xs text-slate-500">Next: {sub.nextPaymentDate}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{money(sub.monthlyCost)}</div>
                <div className="text-xs text-rose-500">{money(sub.annualCost)}/yr</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="lg:col-span-4" title="Goal Planner" action={`${props.goalPlan.probability}% probability`}>
        <input value={props.goal} onChange={(event) => props.setGoal(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400 dark:border-white/10 dark:bg-white/10" />
        <div className="mt-4 rounded-lg bg-teal-500/10 p-4">
          <div className="text-sm text-slate-500 dark:text-slate-300">Recommended monthly savings</div>
          <div className="mt-1 text-3xl font-bold">{money(props.goalPlan.monthly)}</div>
          <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-white/10"><div className="h-2 rounded-full bg-teal-500" style={{ width: `${props.goalPlan.probability}%` }} /></div>
        </div>
      </Panel>

      <Panel className="lg:col-span-4" title="AI Spending Simulator" action={`${props.simulator}% cut`}>
        <label className="text-sm text-slate-500 dark:text-slate-300">Reduce food expenses by</label>
        <input type="range" min="5" max="50" value={props.simulator} onChange={(event) => props.setSimulator(Number(event.target.value))} className="mt-4 w-full accent-teal-500" />
        <div className="mt-5 rounded-lg bg-white/70 p-4 dark:bg-white/10">
          <div className="text-sm text-slate-500">Estimated yearly savings</div>
          <div className="text-3xl font-bold text-teal-600 dark:text-teal-300">{money(props.simulatedSavings)}</div>
        </div>
      </Panel>

      <Panel className="lg:col-span-4" title="Forecasting" action="Next month">
        <div className="space-y-3">
          <Forecast label="Expenses" value={report.forecasting.nextMonthExpenses} />
          <Forecast label="Savings" value={report.forecasting.nextMonthSavings} />
          <Forecast label="90-day balance lift" value={report.forecasting.futureBalance90Days} />
        </div>
      </Panel>

      <Panel className="lg:col-span-4" title="Merchant Intelligence" action="Concentration">
        <div className="h-56">
          {props.chartsReady ? <ResponsiveContainer width="100%" height="100%">
            <BarChart data={report.merchants.slice(0, 6)} layout="vertical">
              <XAxis type="number" hide />
              <YAxis dataKey="merchant" type="category" width={88} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => money(Number(value))} />
              <Bar dataKey="amount" radius={[0, 8, 8, 0]} fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer> : <ChartSkeleton />}
        </div>
      </Panel>

      <Panel className="lg:col-span-8" title="Smart Transaction Search" action="Natural language">
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/10">
          <Search size={18} className="text-slate-400" />
          <span className="text-sm text-slate-500">Example: show all Swiggy transactions or food expenses</span>
        </div>
        <div className="scrollbar-thin max-h-72 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white/90 text-xs uppercase text-slate-500 backdrop-blur dark:bg-slate-900/90">
              <tr><th className="py-2">Date</th><th>Merchant</th><th>Category</th><th className="text-right">Amount</th></tr>
            </thead>
            <tbody>
              {report.transactions.slice(0, 12).map((txn) => (
                <tr key={txn.id} className="border-t border-slate-200/70 dark:border-white/10">
                  <td className="py-3">{txn.date}</td><td>{txn.merchant}</td><td>{txn.category}</td><td className={`text-right font-semibold ${txn.amount > 0 ? "text-emerald-500" : "text-slate-700 dark:text-slate-200"}`}>{money(txn.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="lg:col-span-12" title="One-click Report Export" action="CSV and JSON">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">Export transaction tables for Excel or the complete AI report payload for PDF/report generation workflows.</p>
          <div className="flex gap-2">
            <button disabled={Boolean(props.exporting)} onClick={() => void props.exportReport("csv")} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-950"><Download size={16} /> CSV</button>
            <button disabled={Boolean(props.exporting)} onClick={() => void props.exportReport("xlsx")} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-60 dark:border-white/10"><FileSpreadsheet size={16} /> XLSX</button>
            <button disabled={Boolean(props.exporting)} onClick={() => void props.exportReport("pdf")} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-60 dark:border-white/10"><FileText size={16} /> PDF</button>
            <button disabled={Boolean(props.exporting)} onClick={() => void props.exportReport("json")} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-60 dark:border-white/10"><FileText size={16} /> JSON</button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function Metric({ title, value, icon: Icon, tone }: { title: string; value: string; icon: typeof TrendingUp; tone: string }) {
  return (
    <div className="glass rounded-lg p-5 lg:col-span-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</span>
        <Icon className={tone} size={20} />
      </div>
      <div className="mt-3 text-3xl font-bold">{value}</div>
    </div>
  );
}

function Panel({ title, action, className = "", children }: { title: string; action: string; className?: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} className={`glass rounded-lg p-5 ${className}`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className="rounded-full bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-700 dark:text-teal-200">{action}</span>
      </div>
      {children}
    </motion.div>
  );
}

function Forecast({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/70 p-4 dark:bg-white/10">
      <span className="text-sm text-slate-500 dark:text-slate-300">{label}</span>
      <span className="font-bold">{money(value)}</span>
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-full w-full animate-pulse rounded-lg bg-slate-200/70 dark:bg-white/10" />;
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-600 dark:text-teal-300">{eyebrow}</p>
      <h2 className="mt-3 text-4xl font-semibold tracking-normal sm:text-5xl">{title}</h2>
      <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-300">{text}</p>
    </div>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

const features = [
  { icon: WalletCards, title: "Financial Health Score", text: "AI score out of 100 with savings, debt, subscription, investment, and cash-flow factors explained." },
  { icon: Search, title: "Subscription Hunter", text: "Detects recurring payments, annualizes the cost, predicts renewal dates, and highlights cancellation candidates." },
  { icon: Target, title: "Goal Probability", text: "Turn a goal into a savings roadmap with monthly targets and probability of hitting the deadline." },
  { icon: CalendarDays, title: "Expense Heatmap", text: "Daily and weekly spending visualizations reveal cash-flow rhythm, spikes, and weekend behavior." },
  { icon: ShieldCheck, title: "Risk Detector", text: "Flags high debt pressure, duplicate payments, unusual merchant spikes, and cash-flow compression." },
  { icon: PiggyBank, title: "Savings Engine", text: "Finds specific yearly savings opportunities and category cuts with realistic reduction estimates." },
  { icon: Bot, title: "AI Financial Coach", text: "Chat with the uploaded statement to ask about merchants, categories, subscriptions, and personalized plans." },
  { icon: LineChart, title: "Forecasting", text: "Predicts next-month expenses, future balance lift, and trend direction from current statement behavior." },
  { icon: Lock, title: "Privacy Controls", text: "No accounts, no subscriptions, auto-delete messaging, and local-processing architecture support." },
];

const privacy = ["No login or signup required", "Files are not stored by default", "Local processing option", "Secure upload handling", "OpenAI key is optional", "Export without an account"];

const faq = [
  { q: "Does FinanceIQ require a user account?", a: "No. The app is designed for instant upload and analysis without login, signup, or subscription friction." },
  { q: "Can it read real PDFs and spreadsheets?", a: "Yes. The API route supports PDF text extraction, CSV/plain text parsing, and XLS/XLSX sheet ingestion. Statements with unusual formatting may need OCR or bank-specific parsers." },
  { q: "Does the chatbot use actual transactions?", a: "Yes. The chat route receives the generated report and transaction sample, so answers are grounded in the uploaded statement rather than generic finance tips." },
  { q: "What happens without an OpenAI API key?", a: "FinanceIQ still runs with a deterministic analysis engine, demo fallback, insights, charts, forecasting, exports, and local coach responses. An API key upgrades categorization and narrative answers." },
];

const sampleReport: InsightReport = {
  generatedAt: new Date().toISOString(),
  totals: { income: 248000, expenses: 142860, netSavings: 105140, savingsRate: 42, averageDailySpend: 4762 },
  health: {
    score: 84,
    label: "Excellent",
    breakdown: [
      { factor: "Savings rate", value: "42%", impact: "positive" },
      { factor: "Recurring commitments", value: "4 detected", impact: "neutral" },
      { factor: "Debt pressure", value: "6% of expenses", impact: "positive" },
      { factor: "Investment discipline", value: "SIP found", impact: "positive" },
    ],
  },
  lifestyle: { personality: "Investor", summary: "Your statement shows deliberate wealth-building behavior alongside routine spending." },
  categories: [
    { name: "Investments", amount: 30000, percent: 21 },
    { name: "Food", amount: 24200, percent: 17 },
    { name: "Shopping", amount: 21900, percent: 15 },
    { name: "Groceries", amount: 18600, percent: 13 },
    { name: "Debt", amount: 16800, percent: 12 },
    { name: "Transport", amount: 12200, percent: 9 },
    { name: "Entertainment", amount: 9400, percent: 7 },
    { name: "Utilities", amount: 8760, percent: 6 },
  ],
  dailyTrend: Array.from({ length: 30 }, (_, i) => ({ date: `D${i + 1}`, amount: 1600 + ((i * 431) % 6200) })),
  weeklyTrend: Array.from({ length: 8 }, (_, i) => ({ week: `W${i + 1}`, amount: 18000 + ((i * 3200) % 11000) })),
  merchants: [
    { merchant: "Groww SIP", amount: 30000, transactions: 2 },
    { merchant: "Amazon", amount: 17400, transactions: 6 },
    { merchant: "Swiggy", amount: 15200, transactions: 12 },
    { merchant: "BigBasket", amount: 14200, transactions: 4 },
    { merchant: "Credit Card EMI", amount: 8400, transactions: 1 },
    { merchant: "Uber", amount: 7900, transactions: 10 },
  ],
  subscriptions: [
    { merchant: "Netflix", monthlyCost: 649, annualCost: 7788, confidence: 0.92, nextPaymentDate: "2026-07-04", recommendation: "Keep only if used weekly." },
    { merchant: "Spotify", monthlyCost: 299, annualCost: 3588, confidence: 0.88, nextPaymentDate: "2026-07-10", recommendation: "Consider family plan consolidation." },
    { merchant: "Airtel Broadband", monthlyCost: 1199, annualCost: 14388, confidence: 0.9, nextPaymentDate: "2026-07-02", recommendation: "Review plan speed and usage." },
  ],
  opportunities: [
    { title: "Trim food spend by 12%", detail: "Ordering frequency is the quickest realistic lever.", yearlySavings: 34848 },
    { title: "Subscription cleanup", detail: "Consolidate duplicate entertainment plans.", yearlySavings: 8400 },
  ],
  alerts: [
    { severity: "medium", title: "Weekend spending spike", detail: "Weekend spend is materially higher than weekday average." },
    { severity: "low", title: "Subscription creep", detail: "Recurring services are manageable but worth reviewing." },
  ],
  bills: [
    { merchant: "Airtel Broadband", amount: 1199, predictedDate: "2026-07-02" },
    { merchant: "Netflix", amount: 649, predictedDate: "2026-07-04" },
  ],
  forecasting: { nextMonthExpenses: 148574, nextMonthSavings: 99426, futureBalance90Days: 315420, goalProbability: 88 },
  weekendVsWeekday: { weekend: 52400, weekday: 90260 },
  salary: { detected: true, merchant: "ACME Payroll", amount: 124000, cadence: "Monthly pattern detected", trend: "Stable" },
  coachTips: ["Automate savings on salary day.", "Set a weekly cap for food delivery.", "Review subscriptions before renewal."],
  transactions: [
    { id: "1", date: "2026-05-02", description: "ACME Payroll Salary", merchant: "ACME Payroll", amount: 124000, type: "income", category: "Salary", confidence: 0.94 },
    { id: "2", date: "2026-05-03", description: "Swiggy", merchant: "Swiggy", amount: -1280, type: "expense", category: "Food", confidence: 0.91 },
    { id: "3", date: "2026-05-04", description: "Amazon Marketplace", merchant: "Amazon", amount: -4300, type: "expense", category: "Shopping", confidence: 0.89 },
    { id: "4", date: "2026-05-05", description: "Netflix", merchant: "Netflix", amount: -649, type: "expense", category: "Entertainment", confidence: 0.93 },
    { id: "5", date: "2026-05-06", description: "Groww SIP", merchant: "Groww SIP", amount: -15000, type: "expense", category: "Investments", confidence: 0.88 },
    { id: "6", date: "2026-05-07", description: "BigBasket", merchant: "BigBasket", amount: -3720, type: "expense", category: "Groceries", confidence: 0.87 },
  ],
};
