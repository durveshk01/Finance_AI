"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";
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
  AlertTriangle,
  ArrowRight,
  Bot,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Fingerprint,
  Landmark,
  LineChart,
  MessageCircle,
  PiggyBank,
  Play,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UploadCloud,
  WalletCards,
  X,
} from "lucide-react";
import type { InsightReport } from "@/lib/finance-engine";

const palette = ["#E50914", "#FF3B3B", "#F97316", "#A855F7", "#22C55E", "#38BDF8", "#FACC15", "#B3B3B3"];

type ChatMessage = { role: "user" | "assistant"; content: string };
type ExportFormat = "csv" | "xlsx" | "pdf" | "json";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [report, setReport] = useState<InsightReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [goal, setGoal] = useState("Build a Rs 300,000 emergency fund in 12 months");
  const [simulator, setSimulator] = useState(20);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isChatting, setIsChatting] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Upload a statement and I will turn it into financial intelligence." },
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const glowX = useSpring(mouseX, { stiffness: 55, damping: 22 });
  const glowY = useSpring(mouseY, { stiffness: 55, damping: 22 });

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

  const activeReport = report ?? sampleReport;
  const foodSpend = activeReport.categories.find((category) => category.name === "Food")?.amount ?? 0;
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
      setChatOpen(true);
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
    const sourceReport = report ?? sampleReport;
    setIsChatting(true);
    setError(null);
    setQuestion("");
    setChatOpen(true);
    setMessages((current) => [...current, { role: "user", content: prompt }, { role: "assistant", content: "Thinking through the statement..." }]);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: prompt, report: sourceReport }),
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
    <main
      className="min-h-screen overflow-hidden bg-black text-white"
      onMouseMove={(event) => {
        mouseX.set(event.clientX - 360);
        mouseY.set(event.clientY - 360);
      }}
    >
      <motion.div className="pointer-events-none fixed z-0 size-[720px] rounded-full bg-[#E50914]/20 blur-[140px]" style={{ x: glowX, y: glowY }} />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,rgba(229,9,20,0.24),transparent_34%),linear-gradient(180deg,rgba(0,0,0,0.08),#000_72%)]" />
      <Particles />

      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-black/55 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <a className="group flex items-center gap-3" href="#top">
            <span className="grid size-11 place-items-center rounded-xl bg-[#E50914] shadow-[0_0_35px_rgba(229,9,20,.55)] transition group-hover:scale-105">
              <Landmark size={22} />
            </span>
            <span>
              <span className="block text-xl font-black tracking-tight">FinanceIQ</span>
              <span className="hidden text-xs text-[#B3B3B3] sm:block">Financial Intelligence Engine</span>
            </span>
          </a>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-[#B3B3B3] md:flex">
            <a className="transition hover:text-white" href="#intelligence">Engine</a>
            <a className="transition hover:text-white" href="#dashboard">Dashboard</a>
            <a className="transition hover:text-white" href="#security">Security</a>
            <a className="transition hover:text-white" href="#faq">FAQ</a>
          </nav>
          <button onClick={() => fileInputRef.current?.click()} className="premium-button hidden sm:inline-flex">
            Analyze Statement <ArrowRight size={17} />
          </button>
        </div>
      </header>

      <section id="top" className="relative z-10 min-h-screen overflow-hidden px-4 pt-28 sm:px-6">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#000_0%,rgba(0,0,0,.76)_42%,rgba(0,0,0,.2)_100%)]" />
        <div className="absolute right-[-12%] top-24 hidden h-[72vh] w-[62vw] rounded-full bg-[radial-gradient(circle,rgba(229,9,20,.38),rgba(255,59,59,.1)_32%,transparent_68%)] blur-2xl lg:block" />
        <motion.div className="absolute bottom-20 right-10 hidden w-[520px] rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-[#E50914]/20 backdrop-blur-2xl xl:block" initial={{ opacity: 0, x: 80, rotate: 2 }} animate={{ opacity: 1, x: 0, rotate: 0 }} transition={{ duration: 1 }}>
          <HeroPreview report={activeReport} />
        </motion.div>
        <div className="relative mx-auto flex min-h-[calc(100vh-7rem)] max-w-7xl items-center">
          <motion.div className="max-w-4xl pb-12" initial={{ opacity: 0, y: 34 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }}>
            <motion.div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#E50914]/40 bg-[#E50914]/10 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_30px_rgba(229,9,20,.18)]" whileHover={{ scale: 1.03 }}>
              <Sparkles size={16} className="text-[#FF3B3B]" /> Private AI analysis. No login required.
            </motion.div>
            <h1 className="max-w-5xl text-5xl font-black leading-[0.95] tracking-tight text-white sm:text-7xl lg:text-8xl">
              Turn Bank Statements Into Financial Intelligence
            </h1>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-[#B3B3B3] sm:text-2xl sm:leading-10">
              Upload any bank statement and instantly uncover spending patterns, subscriptions, savings opportunities, fraud risks, and AI-powered financial insights.
            </p>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <motion.button whileHover={{ scale: 1.045 }} whileTap={{ scale: 0.98 }} onClick={() => fileInputRef.current?.click()} className="premium-button px-7 py-4 text-base">
                Analyze Statement <UploadCloud size={20} />
              </motion.button>
              <motion.a whileHover={{ scale: 1.045 }} whileTap={{ scale: 0.98 }} href="#dashboard" className="inline-flex items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/10 px-7 py-4 font-bold text-white backdrop-blur transition hover:border-[#FF3B3B]/50 hover:bg-white/15 hover:shadow-[0_0_40px_rgba(229,9,20,.25)]">
                <Play size={18} /> View Demo
              </motion.a>
            </div>
            <div className="mt-10 grid max-w-3xl gap-3 sm:grid-cols-3">
              {heroStats.map((stat, index) => (
                <motion.div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + index * 0.08 }}>
                  <div className="text-3xl font-black">{stat.value}</div>
                  <div className="mt-1 text-sm text-[#B3B3B3]">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <UploadConsole fileInputRef={fileInputRef} files={files} error={error} isAnalyzing={isAnalyzing} onFiles={onFiles} retry={() => void analyze(files)} />
      </section>

      <section id="dashboard" className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionTitle eyebrow="Cinematic Dashboard" title="Your financial life, rendered like mission control." text="Large KPIs, intelligent alerts, immersive charts, AI coaching, forecasting, subscriptions, goals, and export tools in one premium command center." />
        <Dashboard report={activeReport} hasRealReport={Boolean(report)} goal={goal} setGoal={setGoal} goalPlan={goalPlan} simulator={simulator} setSimulator={setSimulator} simulatedSavings={simulatedSavings} messages={messages} question={question} setQuestion={setQuestion} askCoach={askCoach} exportReport={exportReport} chartsReady={chartsReady} isChatting={isChatting} exporting={exporting} />
      </section>

      <PremiumSections />
      <FloatingCoach open={chatOpen} setOpen={setChatOpen} messages={messages} question={question} setQuestion={setQuestion} askCoach={askCoach} isChatting={isChatting} />
    </main>
  );
}

function UploadConsole({ fileInputRef, files, error, isAnalyzing, onFiles, retry }: { fileInputRef: React.RefObject<HTMLInputElement | null>; files: File[]; error: string | null; isAnalyzing: boolean; onFiles: (files: FileList | null) => void; retry: () => void }) {
  return (
    <motion.div className="relative overflow-hidden rounded-[32px] border border-[#E50914]/35 bg-white/[0.05] p-5 shadow-[0_0_80px_rgba(229,9,20,.18)] backdrop-blur-2xl sm:p-8" initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
      <div className="absolute -right-20 -top-20 size-72 rounded-full bg-[#E50914]/25 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-px w-1/2 bg-gradient-to-r from-transparent via-[#FF3B3B] to-transparent" />
      <div className="relative grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#FF3B3B]">Secure Upload Console</p>
          <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Feed the intelligence engine.</h2>
          <p className="mt-4 text-lg leading-8 text-[#B3B3B3]">Drag in a PDF, CSV, or XLSX statement under 10 MB. FinanceIQ validates the file, extracts transactions, runs OCR when needed, and turns raw records into financial intelligence.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {["10 MB secure limit", "PDF, CSV, XLSX only", "OCR fallback", "No fake fallback data"].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 p-3 text-sm font-semibold text-white">
                <CheckCircle2 size={18} className="text-[#FF3B3B]" /> {item}
              </div>
            ))}
          </div>
        </div>
        <div
          onDrop={(event) => {
            event.preventDefault();
            onFiles(event.dataTransfer.files);
          }}
          onDragOver={(event) => event.preventDefault()}
          className="group relative min-h-[360px] overflow-hidden rounded-[28px] border border-dashed border-[#E50914]/70 bg-black/55 p-6 text-center shadow-[inset_0_0_55px_rgba(229,9,20,.12)] transition hover:border-[#FF3B3B] hover:shadow-[0_0_70px_rgba(229,9,20,.35),inset_0_0_65px_rgba(229,9,20,.18)]"
        >
          <input ref={fileInputRef} className="hidden" type="file" multiple accept=".pdf,.csv,.xlsx" onChange={(event) => onFiles(event.target.files)} />
          <FloatingFileIcons />
          <div className="relative z-10 flex min-h-[310px] flex-col items-center justify-center">
            <motion.div className="grid size-24 place-items-center rounded-3xl bg-[#E50914] shadow-[0_0_55px_rgba(229,9,20,.65)]" animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }}>
              {isAnalyzing ? <div className="size-9 animate-spin rounded-full border-4 border-white/25 border-t-white" /> : <UploadCloud size={42} />}
            </motion.div>
            <h3 className="mt-6 text-2xl font-black">{isAnalyzing ? "Analyzing statement..." : "Drop statement here"}</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#B3B3B3]">Encrypted-feeling, validation-first upload flow for financial documents.</p>
            <button onClick={() => fileInputRef.current?.click()} className="premium-button mt-6">
              Select Statement <FileSpreadsheet size={18} />
            </button>
            <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs text-[#B3B3B3]">
              {(files.length ? files.map((file) => file.name) : ["statement.pdf", "transactions.csv", "bank-data.xlsx"]).map((name) => (
                <span key={name} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1">{name}</span>
              ))}
            </div>
            {error ? (
              <div className="mt-5 max-w-lg rounded-2xl border border-[#FF3B3B]/50 bg-[#E50914]/10 px-4 py-3 text-left text-sm text-white">
                <strong className="flex items-center gap-2"><AlertTriangle size={16} /> Upload issue</strong>
                <p className="mt-1 text-[#ffd0d0]">{error}</p>
                {files.length ? <button onClick={retry} className="mt-3 rounded-xl bg-[#E50914] px-4 py-2 text-xs font-bold text-white">Retry analysis</button> : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Dashboard(props: {
  report: InsightReport;
  hasRealReport: boolean;
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
  const report = props.report;
  return (
    <div className="mt-10 grid gap-5 lg:grid-cols-12">
      <HealthScoreCard report={report} />
      <Metric title="Income" value={money(report.totals.income)} icon={TrendingUp} tone="from-emerald-500 to-teal-400" />
      <Metric title="Expenses" value={money(report.totals.expenses)} icon={TrendingDown} tone="from-[#E50914] to-[#FF3B3B]" />
      <Metric title="Net savings" value={money(report.totals.netSavings)} icon={PiggyBank} tone="from-blue-500 to-cyan-300" />

      <Panel className="lg:col-span-4" title="Spending Constellation" action="Interactive">
        <div className="h-80">
          {props.chartsReady ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={report.categories} dataKey="amount" nameKey="name" innerRadius={70} outerRadius={118} paddingAngle={4}>
                  {report.categories.map((_, index) => <Cell key={index} fill={palette[index % palette.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => money(Number(value))} contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : <ChartSkeleton />}
        </div>
        <Legend items={report.categories.slice(0, 5).map((category, index) => ({ label: category.name, color: palette[index % palette.length], value: `${category.percent}%` }))} />
      </Panel>

      <Panel className="lg:col-span-8" title="Cash Flow Cinema" action="30-day trend">
        <div className="h-80">
          {props.chartsReady ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={report.dailyTrend}>
                <defs>
                  <linearGradient id="redSpend" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#E50914" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#E50914" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
                <XAxis dataKey="date" tick={{ fill: "#B3B3B3", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#B3B3B3", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => money(Number(value))} contentStyle={tooltipStyle} />
                <Area dataKey="amount" stroke="#FF3B3B" fill="url(#redSpend)" strokeWidth={4} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <ChartSkeleton />}
        </div>
      </Panel>

      <Panel className="lg:col-span-4" title="Lifestyle Signal" action={report.lifestyle.personality}>
        <p className="text-4xl font-black">{report.lifestyle.personality}</p>
        <p className="mt-4 leading-7 text-[#B3B3B3]">{report.lifestyle.summary}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <MiniStat label="Weekend" value={money(report.weekendVsWeekday.weekend)} />
          <MiniStat label="Weekday" value={money(report.weekendVsWeekday.weekday)} />
        </div>
      </Panel>

      <Panel className="lg:col-span-4" title="Subscription Hunter" action={`${report.subscriptions.length} found`}>
        <div className="space-y-3">
          {report.subscriptions.slice(0, 4).map((sub) => (
            <motion.div key={sub.merchant} whileHover={{ x: 4 }} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.05] p-4">
              <div>
                <div className="font-bold">{sub.merchant}</div>
                <div className="text-xs text-[#B3B3B3]">Next renewal: {sub.nextPaymentDate}</div>
              </div>
              <div className="text-right">
                <div className="font-black">{money(sub.monthlyCost)}</div>
                <div className="text-xs text-[#FF3B3B]">{money(sub.annualCost)}/yr</div>
              </div>
            </motion.div>
          ))}
        </div>
      </Panel>

      <Panel className="lg:col-span-4" title="Forecasting" action="Next month">
        <div className="space-y-3">
          <Forecast label="Expenses" value={report.forecasting.nextMonthExpenses} />
          <Forecast label="Savings" value={report.forecasting.nextMonthSavings} />
          <Forecast label="90-day balance lift" value={report.forecasting.futureBalance90Days} />
        </div>
      </Panel>

      <Panel className="lg:col-span-4" title="Goal Probability" action={`${props.goalPlan.probability}%`}>
        <input value={props.goal} onChange={(event) => props.setGoal(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none transition focus:border-[#FF3B3B]" />
        <div className="mt-5 rounded-3xl bg-[#E50914]/10 p-5">
          <div className="text-sm text-[#B3B3B3]">Monthly roadmap</div>
          <div className="mt-2 text-4xl font-black">{money(props.goalPlan.monthly)}</div>
          <div className="mt-4 h-2 rounded-full bg-white/10"><motion.div className="h-2 rounded-full bg-gradient-to-r from-[#E50914] to-[#FF3B3B]" initial={{ width: 0 }} whileInView={{ width: `${props.goalPlan.probability}%` }} /></div>
        </div>
      </Panel>

      <Panel className="lg:col-span-4" title="Spending Simulator" action={`${props.simulator}% cut`}>
        <label className="text-sm text-[#B3B3B3]">Reduce food expenses by</label>
        <input type="range" min="5" max="50" value={props.simulator} onChange={(event) => props.setSimulator(Number(event.target.value))} className="mt-5 w-full accent-[#E50914]" />
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-[#B3B3B3]">Projected yearly savings</div>
          <div className="mt-2 text-4xl font-black text-[#FF3B3B]">{money(props.simulatedSavings)}</div>
        </div>
      </Panel>

      <Panel className="lg:col-span-4" title="Merchant Gravity" action="Top merchants">
        <div className="h-64">
          {props.chartsReady ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.merchants.slice(0, 6)} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="merchant" type="category" width={92} tick={{ fill: "#B3B3B3", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => money(Number(value))} contentStyle={tooltipStyle} />
                <Bar dataKey="amount" radius={[0, 10, 10, 0]} fill="#E50914" />
              </BarChart>
            </ResponsiveContainer>
          ) : <ChartSkeleton />}
        </div>
      </Panel>

      <Panel className="lg:col-span-8" title="Transaction Intelligence" action="Natural language ready">
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
          <Search size={18} className="text-[#FF3B3B]" />
          <span className="text-sm text-[#B3B3B3]">Ask the floating assistant: “Show all Swiggy transactions”</span>
        </div>
        <div className="scrollbar-thin max-h-72 overflow-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="sticky top-0 bg-[#0F0F0F]/95 text-xs uppercase tracking-wider text-[#B3B3B3] backdrop-blur">
              <tr><th className="py-3">Date</th><th>Merchant</th><th>Category</th><th className="text-right">Amount</th></tr>
            </thead>
            <tbody>
              {report.transactions.slice(0, 12).map((txn) => (
                <tr key={txn.id} className="border-t border-white/10 transition hover:bg-white/[0.04]">
                  <td className="py-4">{txn.date}</td><td>{txn.merchant}</td><td>{txn.category}</td><td className={`text-right font-black ${txn.amount > 0 ? "text-emerald-400" : "text-white"}`}>{money(txn.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="lg:col-span-12" title="One-click Intelligence Exports" action={props.hasRealReport ? "Ready" : "Upload first"}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-3xl text-sm leading-6 text-[#B3B3B3]">Export your analyzed statement as CSV, XLSX, PDF, or full JSON report. Exports unlock after real upload analysis.</p>
          <div className="flex flex-wrap gap-2">
            {(["csv", "xlsx", "pdf", "json"] as ExportFormat[]).map((format) => (
              <button key={format} disabled={!props.hasRealReport || Boolean(props.exporting)} onClick={() => void props.exportReport(format)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-bold uppercase text-white transition hover:border-[#FF3B3B]/60 hover:bg-[#E50914]/20 disabled:cursor-not-allowed disabled:opacity-40">
                {format === "xlsx" ? <FileSpreadsheet size={16} /> : format === "csv" ? <Download size={16} /> : <FileText size={16} />} {props.exporting === format ? "Exporting" : format}
              </button>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function HealthScoreCard({ report }: { report: InsightReport }) {
  const score = report.health.score;
  const circumference = 2 * Math.PI * 82;
  const offset = circumference - (score / 100) * circumference;
  return (
    <motion.div className="premium-card relative overflow-hidden p-6 lg:col-span-6 xl:col-span-5" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
      <div className="absolute -right-24 -top-24 size-72 rounded-full bg-[#E50914]/30 blur-3xl" />
      <div className="relative grid gap-8 md:grid-cols-[220px_1fr] md:items-center">
        <div className="relative mx-auto size-56">
          <svg className="size-56 -rotate-90" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="82" stroke="rgba(255,255,255,.08)" strokeWidth="18" fill="none" />
            <motion.circle cx="100" cy="100" r="82" stroke="url(#scoreGradient)" strokeWidth="18" fill="none" strokeLinecap="round" strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} whileInView={{ strokeDashoffset: offset }} transition={{ duration: 1.4, ease: "easeOut" }} />
            <defs>
              <linearGradient id="scoreGradient" x1="0" x2="1">
                <stop stopColor="#E50914" />
                <stop offset="1" stopColor="#FF3B3B" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-6xl font-black">{score}</div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#B3B3B3]">Health Score</div>
            </div>
          </div>
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#FF3B3B]">Hero Signal</p>
          <h3 className="mt-3 text-4xl font-black">{report.health.label}</h3>
          <div className="mt-5 space-y-3">
            {report.health.breakdown.map((item) => (
              <div key={item.factor} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
                <span className={`mt-1 size-2.5 rounded-full ${item.impact === "positive" ? "bg-emerald-400" : item.impact === "negative" ? "bg-[#E50914]" : "bg-amber-400"}`} />
                <span><strong>{item.factor}:</strong> <span className="text-[#B3B3B3]">{item.value}</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Metric({ title, value, icon: Icon, tone }: { title: string; value: string; icon: typeof TrendingUp; tone: string }) {
  return (
    <motion.div whileHover={{ y: -6, scale: 1.015 }} className="premium-card p-5 lg:col-span-4 xl:col-span-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[#B3B3B3]">{title}</span>
        <span className={`grid size-12 place-items-center rounded-2xl bg-gradient-to-br ${tone} shadow-lg`}><Icon size={21} /></span>
      </div>
      <div className="mt-5 text-4xl font-black tracking-tight">{value}</div>
    </motion.div>
  );
}

function Panel({ title, action, className = "", children }: { title: string; action: string; className?: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} whileHover={{ y: -5 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.55 }} className={`premium-card p-5 ${className}`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="text-xl font-black tracking-tight">{title}</h3>
        <span className="rounded-full border border-[#E50914]/35 bg-[#E50914]/10 px-3 py-1 text-xs font-black text-[#FF3B3B]">{action}</span>
      </div>
      {children}
    </motion.div>
  );
}

function FloatingCoach(props: { open: boolean; setOpen: (open: boolean) => void; messages: ChatMessage[]; question: string; setQuestion: (value: string) => void; askCoach: (question?: string) => Promise<void>; isChatting: boolean }) {
  return (
    <div className="fixed bottom-5 right-5 z-50">
      <AnimatePresence>
        {props.open && (
          <motion.div initial={{ opacity: 0, y: 24, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.95 }} className="mb-4 w-[calc(100vw-2.5rem)] max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#0F0F0F]/95 shadow-[0_0_80px_rgba(229,9,20,.28)] backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-[#E50914] shadow-[0_0_35px_rgba(229,9,20,.55)]"><Bot size={21} /></span>
                <div>
                  <div className="font-black">FinanceIQ Coach</div>
                  <div className="text-xs text-[#B3B3B3]">{props.isChatting ? "Streaming intelligence..." : "Statement-aware assistant"}</div>
                </div>
              </div>
              <button onClick={() => props.setOpen(false)} className="grid size-9 place-items-center rounded-xl bg-white/10 transition hover:bg-white/15" aria-label="Close assistant"><X size={18} /></button>
            </div>
            <div className="scrollbar-thin h-80 space-y-3 overflow-auto p-4">
              {props.messages.map((message, index) => (
                <div key={index} className={`rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "assistant" ? "mr-8 bg-white/[0.06] text-white" : "ml-8 bg-[#E50914] text-white"}`}>
                  {message.content}
                </div>
              ))}
              {props.isChatting ? <TypingIndicator /> : null}
            </div>
            <div className="border-t border-white/10 p-4">
              <form onSubmit={(event) => { event.preventDefault(); void props.askCoach(); }} className="flex gap-2">
                <input value={props.question} onChange={(event) => props.setQuestion(event.target.value)} placeholder="Ask about your money..." className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none transition focus:border-[#FF3B3B]" />
                <button disabled={props.isChatting} className="grid size-12 place-items-center rounded-2xl bg-[#E50914] transition hover:scale-105 disabled:opacity-60" aria-label="Ask coach"><ChevronRight size={19} /></button>
              </form>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Where am I spending most?", "Subscriptions to cancel?", "Find unusual transactions"].map((prompt) => (
                  <button key={prompt} onClick={() => void props.askCoach(prompt)} className="rounded-full border border-white/10 px-3 py-1 text-xs text-[#B3B3B3] transition hover:border-[#FF3B3B]/60 hover:text-white">{prompt}</button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.96 }} onClick={() => props.setOpen(!props.open)} className="grid size-16 place-items-center rounded-full bg-[#E50914] shadow-[0_0_55px_rgba(229,9,20,.65)]" aria-label="Open AI assistant">
        <MessageCircle size={28} />
      </motion.button>
    </div>
  );
}

function PremiumSections() {
  return (
    <>
      <section id="intelligence" className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionTitle eyebrow="Why FinanceIQ" title="Built for people who want clarity, not spreadsheets." text="FinanceIQ combines extraction, categorization, anomaly detection, coaching, and forecasting into a single cinematic financial intelligence experience." />
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {whyCards.map((card) => (
            <motion.div key={card.title} whileHover={{ y: -8, scale: 1.015 }} className="premium-card p-6">
              <card.icon className="text-[#FF3B3B]" size={28} />
              <h3 className="mt-5 text-xl font-black">{card.title}</h3>
              <p className="mt-3 leading-7 text-[#B3B3B3]">{card.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="relative z-10 border-y border-white/10 bg-[#0F0F0F]/65 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <SectionTitle eyebrow="AI Features" title="Financial intelligence that feels instant." text="A premium suite of analysis tools built around the statement you upload." />
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <motion.div key={feature.title} whileHover={{ y: -6 }} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-[#E50914]/50 hover:shadow-[0_0_45px_rgba(229,9,20,.2)]">
                <feature.icon className="text-[#FF3B3B]" size={25} />
                <h3 className="mt-4 text-lg font-black">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#B3B3B3]">{feature.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid gap-5 lg:grid-cols-3">
          {stats.map((stat) => (
            <motion.div key={stat.label} whileHover={{ scale: 1.02 }} className="premium-card p-8 text-center">
              <div className="text-5xl font-black text-[#FF3B3B]">{stat.value}</div>
              <div className="mt-3 text-sm uppercase tracking-[0.2em] text-[#B3B3B3]">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="security" className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="premium-card grid gap-8 p-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[#FF3B3B]">Security & Privacy</p>
            <h2 className="mt-4 text-4xl font-black sm:text-6xl">Sensitive data deserves a serious interface.</h2>
            <p className="mt-5 text-lg leading-8 text-[#B3B3B3]">No accounts. Strict upload validation. Rate-limited APIs. Security headers. Server-side AI calls. Statement text treated as untrusted data.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {privacy.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/35 p-4 font-bold">
                <ShieldCheck className="text-[#FF3B3B]" size={20} /> {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionTitle eyebrow="Testimonials" title="The kind of insight people remember." text="Animated social proof for the moments FinanceIQ uncovers hidden money leaks." />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {testimonials.map((item) => (
            <motion.div key={item.quote} whileHover={{ y: -8, rotate: item.rotate }} className="premium-card p-6">
              <div className="text-5xl text-[#E50914]">“</div>
              <p className="text-xl font-bold leading-8">{item.quote}</p>
              <div className="mt-6 text-sm text-[#B3B3B3]">{item.name}</div>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="faq" className="relative z-10 mx-auto max-w-4xl px-4 py-20 sm:px-6">
        <SectionTitle eyebrow="FAQ" title="Clear answers before you upload." text="FinanceIQ keeps the experience instant, private, and transparent." />
        <div className="mt-10 space-y-4">
          {faq.map((item) => (
            <details key={item.q} className="premium-card p-5">
              <summary className="cursor-pointer text-lg font-black">{item.q}</summary>
              <p className="mt-4 leading-7 text-[#B3B3B3]">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}

function HeroPreview({ report }: { report: InsightReport }) {
  return (
    <div className="rounded-[24px] bg-black/60 p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-[#B3B3B3]">Financial Health</div>
          <div className="text-5xl font-black">{report.health.score}</div>
        </div>
        <div className="rounded-full bg-[#E50914]/15 px-3 py-1 text-xs font-black text-[#FF3B3B]">{report.health.label}</div>
      </div>
      <div className="mt-5 h-32">
        <div className="flex h-full items-end gap-1">
          {report.dailyTrend.slice(-18).map((point, index, rows) => {
            const max = Math.max(...rows.map((row) => row.amount), 1);
            return <span key={`${point.date}-${index}`} className="flex-1 rounded-t bg-gradient-to-t from-[#E50914] to-[#FF3B3B]" style={{ height: `${28 + (point.amount / max) * 72}%`, opacity: 0.42 + index / 34 }} />;
          })}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniStat label="Income" value={money(report.totals.income)} />
        <MiniStat label="Spend" value={money(report.totals.expenses)} />
        <MiniStat label="Saved" value={money(report.totals.netSavings)} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
      <div className="text-xs text-[#B3B3B3]">{label}</div>
      <div className="mt-1 text-sm font-black">{value}</div>
    </div>
  );
}

function Forecast({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <span className="text-sm text-[#B3B3B3]">{label}</span>
      <span className="font-black">{money(value)}</span>
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string; value: string }[] }) {
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-[#B3B3B3]"><span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} /> {item.label}</span>
          <span className="font-bold">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-full w-full animate-pulse rounded-3xl bg-white/[0.06]" />;
}

function TypingIndicator() {
  return (
    <div className="mr-8 flex w-fit gap-1 rounded-2xl bg-white/[0.06] px-4 py-3">
      {[0, 1, 2].map((dot) => (
        <motion.span key={dot} className="size-2 rounded-full bg-[#FF3B3B]" animate={{ y: [0, -5, 0], opacity: [0.45, 1, 0.45] }} transition={{ duration: 0.8, repeat: Infinity, delay: dot * 0.12 }} />
      ))}
    </div>
  );
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <motion.div className="max-w-4xl" initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
      <p className="text-sm font-black uppercase tracking-[0.22em] text-[#FF3B3B]">{eyebrow}</p>
      <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">{title}</h2>
      <p className="mt-5 text-lg leading-8 text-[#B3B3B3]">{text}</p>
    </motion.div>
  );
}

function Particles() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {Array.from({ length: 26 }, (_, index) => (
        <motion.span
          key={index}
          className="absolute size-1 rounded-full bg-[#FF3B3B]/45"
          style={{ left: `${(index * 37) % 100}%`, top: `${(index * 19) % 100}%` }}
          animate={{ y: [0, -24, 0], opacity: [0.15, 0.7, 0.15], scale: [0.7, 1.2, 0.7] }}
          transition={{ duration: 4 + (index % 5), repeat: Infinity, delay: index * 0.15 }}
        />
      ))}
    </div>
  );
}

function FloatingFileIcons() {
  const icons = [FileText, FileSpreadsheet, FileText];
  return (
    <>
      {icons.map((Icon, index) => (
        <motion.div key={index} className="absolute rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-[#FF3B3B]" style={{ left: `${18 + index * 28}%`, top: `${20 + (index % 2) * 55}%` }} animate={{ y: [0, -14, 0], rotate: [0, index === 1 ? 7 : -7, 0] }} transition={{ duration: 4 + index, repeat: Infinity }}>
          <Icon size={24} />
        </motion.div>
      ))}
    </>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

const tooltipStyle = {
  background: "rgba(15,15,15,.96)",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: "16px",
  color: "#fff",
};

const heroStats = [
  { value: "10 MB", label: "secure upload limit" },
  { value: "AI", label: "coach after analysis" },
  { value: "0", label: "accounts required" },
];

const whyCards = [
  { icon: Brain, title: "AI-first analysis", text: "Statement data becomes scored insights, not a static table." },
  { icon: Radar, title: "Risk detection", text: "Flags cash-flow pressure, duplicate patterns, subscriptions, and anomalies." },
  { icon: Target, title: "Goal planning", text: "Transforms savings goals into monthly roadmaps and probability signals." },
  { icon: Fingerprint, title: "Private by default", text: "No login wall, no fake fallback data, and strict upload validation." },
];

const features = [
  { icon: WalletCards, title: "Financial Health Score", text: "Animated score out of 100 with breakdowns for savings, risk, debt, and investing behavior." },
  { icon: Search, title: "Subscription Hunter", text: "Detects recurring merchants, annualizes costs, and predicts next payments." },
  { icon: CalendarDays, title: "Expense Heatmap", text: "Daily and weekly signals reveal spending rhythm and behavior shifts." },
  { icon: ShieldCheck, title: "Fraud Signals", text: "Highlights unusual patterns and risk markers for closer review." },
  { icon: PiggyBank, title: "Savings Engine", text: "Finds category cuts, rewards opportunities, and yearly savings estimates." },
  { icon: LineChart, title: "Forecasting", text: "Projects expenses, savings, and balance movement from transaction history." },
];

const stats = [
  { value: "18+", label: "financial signals" },
  { value: "4", label: "export formats" },
  { value: "100%", label: "no-login flow" },
];

const privacy = ["Validated uploads", "Rate-limited APIs", "Security headers", "Server-side AI", "OCR fallback", "No accounts"];

const testimonials = [
  { quote: "FinanceIQ found subscriptions I forgot I was paying for.", name: "Product designer, Bengaluru", rotate: -1 },
  { quote: "Saved me ₹12,000 annually in the first analysis.", name: "Founder, Mumbai", rotate: 1 },
  { quote: "It made my spending pattern obvious in five minutes.", name: "Consultant, Delhi", rotate: -1 },
];

const faq = [
  { q: "Does FinanceIQ require a user account?", a: "No. Upload analysis works without login, signup, or subscription." },
  { q: "Can it read scanned PDFs?", a: "Yes, FinanceIQ attempts OCR when a PDF has little extractable text. Complex scans may still need clearer source files." },
  { q: "Does the AI follow instructions inside statements?", a: "No. Uploaded statement text is treated as untrusted data and prompt hardening tells the AI never to execute instructions found in transaction text." },
  { q: "Can I export my report?", a: "Yes. After real analysis, export CSV, XLSX, PDF, or JSON." },
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
