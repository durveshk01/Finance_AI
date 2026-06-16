"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
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
  Lock,
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
const uploadSteps = ["Uploading file", "Reading transactions", "Categorizing expenses", "Detecting subscriptions", "Generating insights"];
const dashboardTabs = ["Overview", "Spending", "Subscriptions", "Forecast", "Transactions", "Exports"] as const;
const quickPrompts = [
  "Where am I spending most?",
  "Find my subscriptions",
  "How can I save more?",
  "Show unusual transactions",
  "Compare income vs expenses",
  "Create a savings plan",
];
const demoDataNote = "Demo data is synthetic and created only for product testing.";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ExportFormat = "csv" | "xlsx" | "pdf" | "json";
type DashboardTab = (typeof dashboardTabs)[number];
type UploadStatus = "idle" | "dragging" | "analyzing" | "error" | "success";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [report, setReport] = useState<InsightReport | null>(null);
  const [hasRealReport, setHasRealReport] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [progressStep, setProgressStep] = useState(0);
  const [goal, setGoal] = useState("Build a Rs 300,000 emergency fund in 12 months");
  const [simulator, setSimulator] = useState(20);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isChatting, setIsChatting] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("Overview");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Upload a statement or use demo data to start chatting." },
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dashboardRef = useRef<HTMLElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const glowX = useSpring(mouseX, { stiffness: 50, damping: 24 });
  const glowY = useSpring(mouseY, { stiffness: 50, damping: 24 });

  const activeReport = report ?? (isDemoMode ? sampleReport : null);
  const dashboardUnlocked = Boolean(activeReport);

  useEffect(() => {
    const timer = window.setTimeout(() => setChartsReady(true), 0);
    window.dispatchEvent(new CustomEvent("financeiq:page_view", { detail: { page: "home" } }));
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isAnalyzing) return;
    const interval = window.setInterval(() => {
      setProgressStep((current) => Math.min(current + 1, uploadSteps.length - 1));
    }, 650);
    return () => window.clearInterval(interval);
  }, [isAnalyzing]);

  const goalPlan = useMemo(() => {
    const amount = Number(goal.match(/\d[\d,]*/)?.[0]?.replace(/,/g, "") ?? 300000);
    const months = Number(goal.match(/(\d+)\s*month/i)?.[1] ?? 12);
    const monthly = Math.ceil(amount / months);
    const surplus = activeReport?.totals.netSavings ?? 0;
    return { amount, months, monthly, probability: activeReport ? Math.min(96, Math.max(18, Math.round((surplus / monthly) * 72))) : 68 };
  }, [activeReport, goal]);

  const simulatedSavings = useMemo(() => {
    const foodSpend = activeReport?.categories.find((category) => category.name === "Food")?.amount ?? 0;
    return Math.round(foodSpend * (simulator / 100) * 12);
  }, [activeReport, simulator]);

  function scrollToDashboard() {
    window.setTimeout(() => dashboardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  function useSampleCsv() {
    setReport(sampleReport);
    setHasRealReport(false);
    setIsDemoMode(true);
    setUploadStatus("success");
    setError(null);
    setChatOpen(true);
    setActiveTab("Overview");
    setMessages([{ role: "assistant", content: "Demo data loaded. Ask me anything about the sample statement." }]);
    window.dispatchEvent(new CustomEvent("financeiq:demo_loaded", { detail: { source: "sample_csv" } }));
    scrollToDashboard();
  }

  function validateFiles(nextFiles: File[]) {
    if (!nextFiles.length) return "Please upload a PDF, CSV, or XLSX bank statement.";
    const allowedExtensions = new Set(["pdf", "csv", "xlsx"]);
    for (const file of nextFiles) {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (file.size === 0) return "This file appears empty. Please upload a valid bank statement.";
      if (file.size > 10 * 1024 * 1024) return "This file is too large. Please upload a file under 10 MB.";
      if (!allowedExtensions.has(extension)) return "Unsupported file type. Please upload PDF, CSV, or XLSX.";
    }
    return null;
  }

  async function analyze(nextFiles = files) {
    const validationMessage = validateFiles(nextFiles);
    if (validationMessage) {
      setError(validationMessage);
      setUploadStatus("error");
      return;
    }

    setIsAnalyzing(true);
    setProgressStep(0);
    setUploadStatus("analyzing");
    setError(null);
    try {
      const form = new FormData();
      nextFiles.forEach((file) => form.append("files", file));
      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const data = (await response.json()) as { report?: InsightReport; error?: { message: string } };
      if (!response.ok || !data.report) {
        throw new Error(normalizeApiError(data.error?.message));
      }
      setReport(data.report);
      setHasRealReport(true);
      setIsDemoMode(false);
      setUploadStatus("success");
      setChatOpen(true);
      setActiveTab("Overview");
      setMessages([{ role: "assistant", content: `Analysis complete. Your financial health score is ${data.report.health.score}/100. Ask me anything about this statement.` }]);
      window.dispatchEvent(new CustomEvent("financeiq:analysis_complete", { detail: { transactions: data.report.transactions.length } }));
      scrollToDashboard();
    } catch (err) {
      const message = err instanceof Error ? err.message : "We could not detect transactions in this file. Try another bank statement or use CSV format.";
      setError(message);
      setUploadStatus("error");
      setMessages([{ role: "assistant", content: "I could not analyze that statement yet. Check the upload message and try again." }]);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function askCoach(prompt = question) {
    if (!activeReport || !prompt.trim()) return;
    setIsChatting(true);
    setError(null);
    setQuestion("");
    setChatOpen(true);
    setMessages((current) => [...current, { role: "user", content: prompt }, { role: "assistant", content: "Thinking through the statement..." }]);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: prompt, report: activeReport }),
      });
      const data = (await response.json()) as { answer?: string; error?: { message: string } };
      if (!response.ok || !data.answer) throw new Error(data.error?.message ?? "The coach could not answer right now.");
      setMessages((current) => [...current.slice(0, -1), { role: "assistant", content: data.answer ?? "I could not answer that yet." }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "The coach could not answer right now.";
      setMessages((current) => [...current.slice(0, -1), { role: "assistant", content: message }]);
    } finally {
      setIsChatting(false);
    }
  }

  async function exportReport(format: ExportFormat) {
    if (!activeReport) return;
    setExporting(format);
    setError(null);
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: activeReport, format }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: { message: string } };
        throw new Error(data.error?.message ?? "Export failed.");
      }
      const prefix = isDemoMode ? "financeiq-demo" : "financeiq";
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = format === "json" ? `${prefix}-report.json` : format === "pdf" ? `${prefix}-report.pdf` : format === "xlsx" ? `${prefix}-transactions.xlsx` : `${prefix}-transactions.csv`;
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
    const validationMessage = validateFiles(next);
    if (validationMessage) {
      setError(validationMessage);
      setUploadStatus("error");
      return;
    }
    void analyze(next);
  }

  function setDragState(active: boolean) {
    setUploadStatus((current) => {
      if (current === "analyzing") return current;
      if (active) return "dragging";
      return current === "dragging" ? "idle" : current;
    });
  }

  return (
    <main
      className="min-h-screen overflow-hidden bg-black text-white"
      onMouseMove={(event) => {
        mouseX.set(event.clientX - 360);
        mouseY.set(event.clientY - 360);
      }}
    >
      <motion.div className="pointer-events-none fixed z-0 hidden size-[720px] rounded-full bg-[#E50914]/20 blur-[140px] md:block" style={{ x: glowX, y: glowY }} />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,rgba(229,9,20,0.22),transparent_34%),linear-gradient(180deg,rgba(0,0,0,0.04),#000_72%)]" />
      <Particles />

      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-black/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <a className="group flex items-center gap-3 focus-visible-ring" href="#top">
            <span className="grid size-11 place-items-center rounded-xl bg-[#E50914] shadow-[0_0_35px_rgba(229,9,20,.55)] transition group-hover:scale-105">
              <Landmark size={22} aria-hidden />
            </span>
            <span>
              <span className="block text-xl font-black tracking-tight">FinanceIQ</span>
              <span className="hidden text-xs text-[#B3B3B3] sm:block">Financial Intelligence Engine</span>
            </span>
          </a>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-[#C7C7C7] md:flex" aria-label="Primary navigation">
            <a className="transition hover:text-white focus-visible-ring" href="#intelligence">Engine</a>
            <a className="transition hover:text-white focus-visible-ring" href="#dashboard">Dashboard</a>
            <a className="transition hover:text-white focus-visible-ring" href="#security">Security</a>
            <a className="transition hover:text-white focus-visible-ring" href="#faq">FAQ</a>
          </nav>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="premium-button hidden sm:inline-flex" aria-label="Analyze a bank statement">
            Analyze Statement <ArrowRight size={17} aria-hidden />
          </button>
        </div>
      </header>

      <Hero fileInputRef={fileInputRef} activeReport={activeReport ?? sampleReport} useSampleCsv={useSampleCsv} />

      <section className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="upload-heading">
        <UploadConsole fileInputRef={fileInputRef} files={files} error={error} isAnalyzing={isAnalyzing} uploadStatus={uploadStatus} progressStep={progressStep} onFiles={onFiles} onDragState={setDragState} retry={() => void analyze(files)} useSampleCsv={useSampleCsv} />
      </section>

      <section id="dashboard" ref={dashboardRef} className="relative z-10 mx-auto max-w-7xl scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="dashboard-heading">
        <SectionTitle eyebrow="Dashboard" title="Your financial life, rendered like mission control." text="Start with sample data or upload a statement to unlock personal financial intelligence." id="dashboard-heading" />
        <Dashboard report={activeReport} locked={!dashboardUnlocked} hasRealReport={hasRealReport} isDemoMode={isDemoMode} activeTab={activeTab} setActiveTab={setActiveTab} goal={goal} setGoal={setGoal} goalPlan={goalPlan} simulator={simulator} setSimulator={setSimulator} simulatedSavings={simulatedSavings} exportReport={exportReport} chartsReady={chartsReady} exporting={exporting} useSampleCsv={useSampleCsv} openUpload={() => fileInputRef.current?.click()} />
      </section>

      <PremiumSections />
      <FloatingCoach open={chatOpen} setOpen={setChatOpen} reportReady={dashboardUnlocked} isDemoMode={isDemoMode} messages={messages} question={question} setQuestion={setQuestion} askCoach={askCoach} isChatting={isChatting} useSampleCsv={useSampleCsv} />

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/85 p-3 backdrop-blur-xl sm:hidden">
        <button type="button" onClick={() => fileInputRef.current?.click()} className="premium-button min-h-12 w-full" aria-label="Analyze statement">
          Analyze Statement <UploadCloud size={18} aria-hidden />
        </button>
      </div>
    </main>
  );
}

function Hero({ fileInputRef, activeReport, useSampleCsv }: { fileInputRef: RefObject<HTMLInputElement | null>; activeReport: InsightReport; useSampleCsv: () => void }) {
  return (
    <section id="top" className="relative z-10 min-h-screen overflow-hidden px-4 pt-28 sm:px-6" aria-labelledby="hero-heading">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#000_0%,rgba(0,0,0,.82)_46%,rgba(0,0,0,.28)_100%)]" />
      <div className="absolute right-[-12%] top-24 hidden h-[72vh] w-[62vw] rounded-full bg-[radial-gradient(circle,rgba(229,9,20,.34),rgba(255,59,59,.1)_32%,transparent_68%)] blur-2xl lg:block" />
      <div className="relative mx-auto grid min-h-[calc(100vh-7rem)] max-w-7xl items-center gap-10 lg:grid-cols-[1.02fr_0.98fr]">
        <motion.div className="pb-8" initial={{ opacity: 0, y: 34 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <motion.div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#E50914]/40 bg-[#E50914]/10 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_30px_rgba(229,9,20,.18)]" whileHover={{ scale: 1.03 }}>
            <Sparkles size={16} className="text-[#FF3B3B]" aria-hidden /> Private AI analysis. No login required.
          </motion.div>
          <h1 id="hero-heading" className="max-w-5xl text-4xl font-black leading-[0.98] tracking-tight text-white sm:text-6xl lg:text-7xl xl:text-8xl">
            Turn Bank Statements Into Financial Intelligence
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#C7C7C7] sm:text-2xl sm:leading-10">
            Upload any bank statement and instantly uncover spending patterns, subscriptions, savings opportunities, fraud risks, and AI-powered financial insights.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <motion.button type="button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }} onClick={() => fileInputRef.current?.click()} className="premium-button min-h-12 px-7 py-4 text-base" aria-label="Analyze statement">
              Analyze Statement <UploadCloud size={20} aria-hidden />
            </motion.button>
            <motion.button type="button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }} onClick={useSampleCsv} className="secondary-button min-h-12 px-7 py-4 text-base" aria-label="Use sample CSV demo data">
              Use Sample CSV <FileSpreadsheet size={19} aria-hidden />
            </motion.button>
            <motion.a whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }} href="#dashboard" className="secondary-button min-h-12 px-7 py-4 text-base">
              <Play size={18} aria-hidden /> View Demo
            </motion.a>
          </div>
          <p className="mt-5 text-sm font-medium text-[#D0D0D0]">No login required - PDF/CSV/XLSX - Privacy-first analysis</p>
          <p className="mt-2 max-w-2xl text-sm text-[#C7C7C7]">{demoDataNote}</p>
          <MiniFlow />
        </motion.div>

        <motion.div className="pb-12 lg:pb-0" initial={{ opacity: 0, x: 60, rotate: 1 }} animate={{ opacity: 1, x: 0, rotate: 0 }} transition={{ duration: 0.9, delay: 0.1 }}>
          <HeroPreview report={activeReport} />
        </motion.div>
      </div>
    </section>
  );
}

function MiniFlow() {
  const flow = ["Upload", "Extract", "Categorize", "Insights", "Chat"];
  return (
    <div className="mt-8 flex max-w-3xl flex-wrap gap-2" aria-label="FinanceIQ analysis flow">
      {flow.map((step, index) => (
        <div key={step} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-bold text-white">
          <span className="grid size-6 place-items-center rounded-full bg-[#E50914] text-xs">{index + 1}</span>
          {step}
        </div>
      ))}
    </div>
  );
}

function UploadConsole({
  fileInputRef,
  files,
  error,
  isAnalyzing,
  uploadStatus,
  progressStep,
  onFiles,
  onDragState,
  retry,
  useSampleCsv,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  files: File[];
  error: string | null;
  isAnalyzing: boolean;
  uploadStatus: UploadStatus;
  progressStep: number;
  onFiles: (files: FileList | null) => void;
  onDragState: (active: boolean) => void;
  retry: () => void;
  useSampleCsv: () => void;
}) {
  const statusCopy = {
    idle: "Ready for secure upload",
    dragging: "Drop to start analysis",
    analyzing: "Analyzing statement",
    error: "Action needed",
    success: "Statement ready",
  } satisfies Record<UploadStatus, string>;

  return (
    <motion.div className="relative overflow-hidden rounded-[32px] border border-[#E50914]/35 bg-white/[0.05] p-5 shadow-[0_0_80px_rgba(229,9,20,.18)] backdrop-blur-2xl sm:p-8" initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
      <div className="absolute -right-20 -top-20 hidden size-72 rounded-full bg-[#E50914]/25 blur-3xl md:block" />
      <div className="relative grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#FF3B3B]">Secure Upload Console</p>
          <h2 id="upload-heading" className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">Feed the intelligence engine.</h2>
          <p className="mt-4 text-lg leading-8 text-[#C7C7C7]">Supported: PDF, CSV, XLSX - Max size: 10 MB</p>
          <p className="mt-2 text-sm text-[#C7C7C7]">{demoDataNote}</p>
          <TrustBadges />
          {isAnalyzing ? <ProgressTimeline activeStep={progressStep} /> : null}
        </div>
        <div
          onDrop={(event) => {
            event.preventDefault();
            onDragState(false);
            onFiles(event.dataTransfer.files);
          }}
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDragEnter={() => onDragState(true)}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            onDragState(false);
          }}
          aria-busy={isAnalyzing}
          className={`group relative min-h-[380px] overflow-hidden rounded-[28px] border border-dashed p-6 text-center transition ${uploadShellClass(uploadStatus)}`}
        >
          <input ref={fileInputRef} className="sr-only" type="file" multiple accept=".pdf,.csv,.xlsx" onChange={(event) => onFiles(event.target.files)} aria-label="Upload PDF, CSV, or XLSX bank statement" />
          <FloatingFileIcons />
          <div className="relative z-10 flex min-h-[330px] flex-col items-center justify-center">
            <motion.div className="grid size-24 place-items-center rounded-3xl bg-[#E50914] shadow-[0_0_55px_rgba(229,9,20,.65)]" animate={isAnalyzing ? { scale: [1, 1.06, 1] } : { y: [0, -8, 0] }} transition={{ duration: 2.8, repeat: Infinity }}>
              {isAnalyzing ? <div className="size-9 animate-spin rounded-full border-4 border-white/25 border-t-white" /> : <UploadCloud size={42} aria-hidden />}
            </motion.div>
            <h3 className="mt-6 text-2xl font-black">{statusCopy[uploadStatus]}</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#C7C7C7]">Large drag-and-drop zone with validation before any statement reaches analysis.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="premium-button min-h-12" aria-label="Select statement file">
                Select Statement <FileSpreadsheet size={18} aria-hidden />
              </button>
              <button type="button" onClick={useSampleCsv} className="secondary-button min-h-12" aria-label="Use sample CSV">
                Use Sample CSV
              </button>
            </div>
            <SelectedFiles files={files} uploadStatus={uploadStatus} />
            {error ? (
              <div className="mt-5 max-w-lg rounded-2xl border border-[#FF3B3B]/50 bg-[#E50914]/10 px-4 py-3 text-left text-sm text-white" role="alert">
                <strong className="flex items-center gap-2"><AlertTriangle size={16} aria-hidden /> Upload issue</strong>
                <p className="mt-1 text-[#FFD6D6]">{error}</p>
                {files.length ? <button type="button" onClick={retry} className="focus-visible-ring mt-3 rounded-xl bg-[#E50914] px-4 py-2 text-xs font-bold text-white">Retry analysis</button> : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SelectedFiles({ files, uploadStatus }: { files: File[]; uploadStatus: UploadStatus }) {
  const rows = files.length ? files : [];
  return (
    <div className="mt-5 w-full max-w-xl space-y-2 text-left">
      {rows.length ? rows.map((file) => (
        <div key={`${file.name}-${file.size}`} className="rounded-2xl border border-white/10 bg-black/45 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{file.name}</p>
              <p className="text-xs text-[#C7C7C7]">{formatBytes(file.size)} - {file.name.split(".").pop()?.toUpperCase() || "FILE"} - {file.type || "Unknown MIME"}</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-bold text-white">
              {uploadStatus === "success" ? "Ready" : uploadStatus === "error" ? "Review" : uploadStatus === "analyzing" ? "Analyzing" : "Ready"}
            </span>
          </div>
        </div>
      )) : (
        <div className="flex flex-wrap justify-center gap-2 text-xs text-[#C7C7C7]">
          {["statement.pdf", "transactions.csv", "bank-data.xlsx"].map((name) => (
            <span key={name} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1">{name}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressTimeline({ activeStep }: { activeStep: number }) {
  return (
    <div className="mt-7 rounded-3xl border border-white/10 bg-black/35 p-4" aria-label="Analysis progress" aria-live="polite">
      <div className="space-y-3">
        {uploadSteps.map((step, index) => {
          const complete = index < activeStep;
          const active = index === activeStep;
          return (
            <motion.div key={step} className="flex items-center gap-3" animate={{ opacity: complete || active ? 1 : 0.55 }}>
              <span className={`grid size-8 place-items-center rounded-full border ${complete ? "border-emerald-400 bg-emerald-400 text-black" : active ? "border-[#FF3B3B] bg-[#E50914] text-white shadow-[0_0_24px_rgba(229,9,20,.5)]" : "border-white/15 bg-white/[0.04] text-[#C7C7C7]"}`}>
                {complete ? <CheckCircle2 size={16} aria-hidden /> : index + 1}
              </span>
              <span className="text-sm font-bold text-white">{step}</span>
              {active ? <motion.span className="ml-auto h-1.5 w-16 rounded-full bg-[#E50914]" animate={{ opacity: [0.35, 1, 0.35] }} transition={{ duration: 1.1, repeat: Infinity }} /> : null}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Dashboard(props: {
  report: InsightReport | null;
  locked: boolean;
  hasRealReport: boolean;
  isDemoMode: boolean;
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  goal: string;
  setGoal: (goal: string) => void;
  goalPlan: { amount: number; months: number; monthly: number; probability: number };
  simulator: number;
  setSimulator: (value: number) => void;
  simulatedSavings: number;
  exportReport: (format: ExportFormat) => Promise<void>;
  chartsReady: boolean;
  exporting: ExportFormat | null;
  useSampleCsv: () => void;
  openUpload: () => void;
}) {
  if (props.locked || !props.report) {
    return <LockedDashboard useSampleCsv={props.useSampleCsv} openUpload={props.openUpload} />;
  }

  return (
    <div className="mt-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {props.isDemoMode ? <ModeBadge label="Demo Data" /> : null}
          {props.hasRealReport ? <ModeBadge label="Personal Report" tone="success" /> : null}
        </div>
        <p className="text-sm text-[#C7C7C7]">{props.isDemoMode ? "Sample CSV loaded for exploration." : "Your uploaded statement is active."}</p>
      </div>
      <div className="scrollbar-horizontal mb-6 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Dashboard sections">
        {dashboardTabs.map((tab) => (
          <button key={tab} type="button" role="tab" aria-selected={props.activeTab === tab} onClick={() => props.setActiveTab(tab)} className={`focus-visible-ring min-h-11 shrink-0 rounded-full border px-5 text-sm font-black transition ${props.activeTab === tab ? "border-[#FF3B3B] bg-[#E50914] text-white shadow-[0_0_28px_rgba(229,9,20,.35)]" : "border-white/10 bg-white/[0.04] text-[#C7C7C7] hover:text-white"}`}>
            {tab}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={props.activeTab} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
          {props.activeTab === "Overview" ? <OverviewTab report={props.report} chartsReady={props.chartsReady} isDemoMode={props.isDemoMode} /> : null}
          {props.activeTab === "Spending" ? <SpendingTab report={props.report} chartsReady={props.chartsReady} /> : null}
          {props.activeTab === "Subscriptions" ? <SubscriptionsTab report={props.report} /> : null}
          {props.activeTab === "Forecast" ? <ForecastTab report={props.report} goal={props.goal} setGoal={props.setGoal} goalPlan={props.goalPlan} simulator={props.simulator} setSimulator={props.setSimulator} simulatedSavings={props.simulatedSavings} /> : null}
          {props.activeTab === "Transactions" ? <TransactionsTab report={props.report} /> : null}
          {props.activeTab === "Exports" ? <ExportsTab isDemoMode={props.isDemoMode} exporting={props.exporting} exportReport={props.exportReport} /> : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function LockedDashboard({ useSampleCsv, openUpload }: { useSampleCsv: () => void; openUpload: () => void }) {
  return (
    <div className="relative mt-10 overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] p-6 sm:p-10">
      <div className="absolute inset-0 opacity-30 blur-sm">
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="premium-card h-64 lg:col-span-6" />
          <div className="premium-card h-64 lg:col-span-3" />
          <div className="premium-card h-64 lg:col-span-3" />
        </div>
      </div>
      <div className="relative z-10 mx-auto max-w-2xl py-16 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#E50914] shadow-[0_0_42px_rgba(229,9,20,.5)]"><Lock size={28} aria-hidden /></div>
        <h3 className="mt-6 text-3xl font-black">Upload a statement or use sample data to unlock the dashboard.</h3>
        <p className="mt-3 text-[#C7C7C7]">Before analysis, FinanceIQ keeps personal insights locked so demo data is never confused with your real finances.</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={openUpload} className="premium-button min-h-12">Upload statement</button>
          <button type="button" onClick={useSampleCsv} className="secondary-button min-h-12">Use Sample CSV</button>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ report, chartsReady, isDemoMode }: { report: InsightReport; chartsReady: boolean; isDemoMode: boolean }) {
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <HealthScoreCard report={report} isDemoMode={isDemoMode} />
      <Metric title="Income" value={money(report.totals.income)} icon={TrendingUp} tone="from-emerald-500 to-teal-400" />
      <Metric title="Expenses" value={money(report.totals.expenses)} icon={TrendingDown} tone="from-[#E50914] to-[#FF3B3B]" />
      <Metric title="Net savings" value={money(report.totals.netSavings)} icon={PiggyBank} tone="from-blue-500 to-cyan-300" />
      <Panel className="lg:col-span-8" title="Cash Flow Cinema" action="30-day trend">
        <CashFlowChart report={report} chartsReady={chartsReady} />
      </Panel>
      <Panel className="lg:col-span-4" title="Top Insights" action="AI summary">
        <div className="space-y-3">
          {report.alerts.slice(0, 3).map((alert) => (
            <div key={alert.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-2 text-sm font-black text-white"><AlertTriangle size={16} className="text-[#FF3B3B]" aria-hidden /> {alert.title}</div>
              <p className="mt-2 text-sm leading-6 text-[#C7C7C7]">{alert.detail}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function SpendingTab({ report, chartsReady }: { report: InsightReport; chartsReady: boolean }) {
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <Panel className="lg:col-span-4" title="Spending by Category" action="Interactive">
        <CategoryChart report={report} chartsReady={chartsReady} />
      </Panel>
      <Panel className="lg:col-span-8" title="Daily Trend" action="30 days">
        <CashFlowChart report={report} chartsReady={chartsReady} />
      </Panel>
      <Panel className="lg:col-span-4" title="Merchant Gravity" action="Top merchants">
        <MerchantChart report={report} chartsReady={chartsReady} />
      </Panel>
      <Panel className="lg:col-span-4" title="Weekend vs Weekday" action="Behavior">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <MiniStat label="Weekend spend" value={money(report.weekendVsWeekday.weekend)} />
          <MiniStat label="Weekday spend" value={money(report.weekendVsWeekday.weekday)} />
        </div>
      </Panel>
      <Panel className="lg:col-span-4" title="Lifestyle Signal" action={report.lifestyle.personality}>
        <p className="text-4xl font-black">{report.lifestyle.personality}</p>
        <p className="mt-4 leading-7 text-[#C7C7C7]">{report.lifestyle.summary}</p>
      </Panel>
    </div>
  );
}

function SubscriptionsTab({ report }: { report: InsightReport }) {
  const annualTotal = report.subscriptions.reduce((sum, subscription) => sum + subscription.annualCost, 0);
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <Panel className="lg:col-span-4" title="Annual Subscription Cost" action={money(annualTotal)}>
        <p className="text-5xl font-black text-[#FF3B3B]">{money(annualTotal)}</p>
        <p className="mt-3 leading-7 text-[#C7C7C7]">Recurring payments detected from repeated merchant patterns.</p>
      </Panel>
      <Panel className="lg:col-span-8" title="Subscription Hunter" action={`${report.subscriptions.length} found`}>
        <div className="grid gap-3 md:grid-cols-2">
          {report.subscriptions.map((sub) => (
            <motion.div key={sub.merchant} whileHover={{ x: 4 }} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-black">{sub.merchant}</div>
                  <div className="text-xs text-[#C7C7C7]">Next payment: {sub.nextPaymentDate}</div>
                </div>
                <div className="text-right">
                  <div className="font-black">{money(sub.monthlyCost)}</div>
                  <div className="text-xs text-[#FF3B3B]">{money(sub.annualCost)}/yr</div>
                </div>
              </div>
              <p className="mt-3 text-sm text-[#C7C7C7]">{sub.recommendation}</p>
            </motion.div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function ForecastTab(props: {
  report: InsightReport;
  goal: string;
  setGoal: (goal: string) => void;
  goalPlan: { amount: number; months: number; monthly: number; probability: number };
  simulator: number;
  setSimulator: (value: number) => void;
  simulatedSavings: number;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <Panel className="lg:col-span-4" title="Forecasting" action="Next month">
        <div className="space-y-3">
          <Forecast label="Expenses" value={props.report.forecasting.nextMonthExpenses} />
          <Forecast label="Savings" value={props.report.forecasting.nextMonthSavings} />
          <Forecast label="90-day balance lift" value={props.report.forecasting.futureBalance90Days} />
        </div>
      </Panel>
      <Panel className="lg:col-span-4" title="Goal Probability" action={`${props.goalPlan.probability}%`}>
        <label className="text-sm font-bold text-[#C7C7C7]" htmlFor="goal-input">Savings goal</label>
        <input id="goal-input" value={props.goal} onChange={(event) => props.setGoal(event.target.value)} className="focus-visible-ring mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none transition focus:border-[#FF3B3B]" />
        <div className="mt-5 rounded-3xl bg-[#E50914]/10 p-5">
          <div className="text-sm text-[#C7C7C7]">Recommended monthly savings</div>
          <div className="mt-2 text-4xl font-black">{money(props.goalPlan.monthly)}</div>
          <div className="mt-4 h-2 rounded-full bg-white/10"><motion.div className="h-2 rounded-full bg-gradient-to-r from-[#E50914] to-[#FF3B3B]" initial={{ width: 0 }} whileInView={{ width: `${props.goalPlan.probability}%` }} /></div>
        </div>
      </Panel>
      <Panel className="lg:col-span-4" title="Spending Simulator" action={`${props.simulator}% cut`}>
        <label className="text-sm font-bold text-[#C7C7C7]" htmlFor="simulator-input">Reduce food expenses by</label>
        <input id="simulator-input" type="range" min="5" max="50" value={props.simulator} onChange={(event) => props.setSimulator(Number(event.target.value))} className="mt-5 w-full accent-[#E50914]" />
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-[#C7C7C7]">Projected yearly savings</div>
          <div className="mt-2 text-4xl font-black text-[#FF3B3B]">{money(props.simulatedSavings)}</div>
        </div>
      </Panel>
    </div>
  );
}

function TransactionsTab({ report }: { report: InsightReport }) {
  return (
    <Panel title="Transaction Intelligence" action="Natural language ready">
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
        <Search size={18} className="text-[#FF3B3B]" aria-hidden />
          <span className="text-sm text-[#C7C7C7]">Ask the assistant: &quot;Show all Swiggy transactions&quot;</span>
      </div>
      <div className="scrollbar-thin max-h-96 overflow-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="sticky top-0 bg-[#0F0F0F]/95 text-xs uppercase tracking-wider text-[#C7C7C7] backdrop-blur">
            <tr><th className="py-3">Date</th><th>Merchant</th><th>Category</th><th className="text-right">Amount</th></tr>
          </thead>
          <tbody>
            {report.transactions.slice(0, 30).map((txn) => (
              <tr key={txn.id} className="border-t border-white/10 transition hover:bg-white/[0.04]">
                <td className="py-4">{txn.date}</td><td>{txn.merchant}</td><td>{txn.category}</td><td className={`text-right font-black ${txn.amount > 0 ? "text-emerald-400" : "text-white"}`}>{money(txn.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ExportsTab({ isDemoMode, exporting, exportReport }: { isDemoMode: boolean; exporting: ExportFormat | null; exportReport: (format: ExportFormat) => Promise<void> }) {
  return (
    <Panel title="One-click Intelligence Exports" action={isDemoMode ? "Demo exports" : "Ready"}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          {isDemoMode ? <ModeBadge label="Demo Data" /> : null}
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#C7C7C7]">Export CSV, XLSX, PDF, or JSON. Demo mode downloads use a financeiq-demo filename so they are never confused with real reports.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["csv", "xlsx", "pdf", "json"] as ExportFormat[]).map((format) => (
            <button key={format} type="button" disabled={Boolean(exporting)} onClick={() => void exportReport(format)} className="focus-visible-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-bold uppercase text-white transition hover:border-[#FF3B3B]/60 hover:bg-[#E50914]/20 disabled:cursor-not-allowed disabled:opacity-50">
              {format === "xlsx" ? <FileSpreadsheet size={16} aria-hidden /> : format === "csv" ? <Download size={16} aria-hidden /> : <FileText size={16} aria-hidden />} {exporting === format ? "Exporting" : format}
            </button>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function HealthScoreCard({ report, isDemoMode }: { report: InsightReport; isDemoMode: boolean }) {
  const score = report.health.score;
  const circumference = 2 * Math.PI * 82;
  const offset = circumference - (score / 100) * circumference;
  return (
    <motion.div className="premium-card relative overflow-hidden p-6 lg:col-span-6 xl:col-span-5" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
      <div className="absolute -right-24 -top-24 hidden size-72 rounded-full bg-[#E50914]/30 blur-3xl md:block" />
      <div className="relative grid gap-8 md:grid-cols-[220px_1fr] md:items-center">
        <div className="relative mx-auto size-56">
          <svg className="size-56 -rotate-90" viewBox="0 0 200 200" aria-hidden>
            <circle cx="100" cy="100" r="82" stroke="rgba(255,255,255,.08)" strokeWidth="18" fill="none" />
            <motion.circle cx="100" cy="100" r="82" stroke="url(#scoreGradient)" strokeWidth="18" fill="none" strokeLinecap="round" strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} whileInView={{ strokeDashoffset: offset }} transition={{ duration: 1.2, ease: "easeOut" }} />
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
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#C7C7C7]">Health Score</div>
            </div>
          </div>
        </div>
        <div>
          <div className="flex flex-wrap gap-2">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#FF3B3B]">Hero Signal</p>
            {isDemoMode ? <ModeBadge label="Demo Data" /> : null}
          </div>
          <h3 className="mt-3 text-4xl font-black">{report.health.label}</h3>
          <div className="mt-5 space-y-3">
            {report.health.breakdown.map((item) => (
              <div key={item.factor} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
                <span className={`mt-1 size-2.5 rounded-full ${item.impact === "positive" ? "bg-emerald-400" : item.impact === "negative" ? "bg-[#E50914]" : "bg-amber-400"}`} />
                <span><strong>{item.factor}:</strong> <span className="text-[#C7C7C7]">{item.value}</span></span>
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
        <span className="text-sm font-semibold text-[#C7C7C7]">{title}</span>
        <span className={`grid size-12 place-items-center rounded-2xl bg-gradient-to-br ${tone} shadow-lg`}><Icon size={21} aria-hidden /></span>
      </div>
      <div className="mt-5 text-4xl font-black tracking-tight">{value}</div>
    </motion.div>
  );
}

function Panel({ title, action, className = "", children }: { title: string; action: string; className?: string; children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} whileHover={{ y: -4 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.45 }} className={`premium-card p-5 ${className}`}>
      <div className="relative z-10 mb-5 flex items-center justify-between gap-3">
        <h3 className="text-xl font-black tracking-tight">{title}</h3>
        <span className="rounded-full border border-[#E50914]/35 bg-[#E50914]/10 px-3 py-1 text-xs font-black text-[#FF3B3B]">{action}</span>
      </div>
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

function CategoryChart({ report, chartsReady }: { report: InsightReport; chartsReady: boolean }) {
  return (
    <>
      <div className="h-80">
        {chartsReady ? (
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
    </>
  );
}

function CashFlowChart({ report, chartsReady }: { report: InsightReport; chartsReady: boolean }) {
  return (
    <div className="h-80">
      {chartsReady ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={report.dailyTrend}>
            <defs>
              <linearGradient id="redSpend" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#E50914" stopOpacity={0.55} />
                <stop offset="95%" stopColor="#E50914" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
            <XAxis dataKey="date" tick={{ fill: "#C7C7C7", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#C7C7C7", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value) => money(Number(value))} contentStyle={tooltipStyle} />
            <Area dataKey="amount" stroke="#FF3B3B" fill="url(#redSpend)" strokeWidth={4} />
          </AreaChart>
        </ResponsiveContainer>
      ) : <ChartSkeleton />}
    </div>
  );
}

function MerchantChart({ report, chartsReady }: { report: InsightReport; chartsReady: boolean }) {
  return (
    <div className="h-64">
      {chartsReady ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={report.merchants.slice(0, 6)} layout="vertical">
            <XAxis type="number" hide />
            <YAxis dataKey="merchant" type="category" width={92} tick={{ fill: "#C7C7C7", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value) => money(Number(value))} contentStyle={tooltipStyle} />
            <Bar dataKey="amount" radius={[0, 10, 10, 0]} fill="#E50914" />
          </BarChart>
        </ResponsiveContainer>
      ) : <ChartSkeleton />}
    </div>
  );
}

function FloatingCoach(props: {
  open: boolean;
  setOpen: (open: boolean) => void;
  reportReady: boolean;
  isDemoMode: boolean;
  messages: ChatMessage[];
  question: string;
  setQuestion: (value: string) => void;
  askCoach: (question?: string) => Promise<void>;
  isChatting: boolean;
  useSampleCsv: () => void;
}) {
  const disabled = !props.reportReady;
  return (
    <div className="fixed bottom-20 right-4 z-50 sm:bottom-5 sm:right-5">
      <AnimatePresence>
        {props.open && (
          <motion.div initial={{ opacity: 0, y: 24, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.95 }} className="mb-4 max-h-[calc(100vh-8rem)] w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#0F0F0F]/95 shadow-[0_0_80px_rgba(229,9,20,.28)] backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-[#E50914] shadow-[0_0_35px_rgba(229,9,20,.55)]"><Bot size={21} aria-hidden /></span>
                <div>
                  <div className="flex items-center gap-2 font-black">FinanceIQ Coach {props.isDemoMode ? <ModeBadge label="Demo Data" /> : null}</div>
                  <div className="text-xs text-[#C7C7C7]">{disabled ? "Upload or demo required" : props.isChatting ? "Streaming intelligence..." : "Statement-aware assistant"}</div>
                </div>
              </div>
              <button type="button" onClick={() => props.setOpen(false)} className="focus-visible-ring grid size-9 place-items-center rounded-xl bg-white/10 transition hover:bg-white/15" aria-label="Close assistant"><X size={18} aria-hidden /></button>
            </div>
            <div className="scrollbar-thin h-72 space-y-3 overflow-auto p-4 sm:h-80">
              {disabled ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-sm leading-6 text-white">
                  Upload a statement or use demo data to start chatting.
                  <button type="button" onClick={props.useSampleCsv} className="secondary-button mt-3 min-h-10 w-full">Use Sample CSV</button>
                </div>
              ) : props.messages.map((message, index) => (
                <div key={index} className={`rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "assistant" ? "mr-8 bg-white/[0.06] text-white" : "ml-8 bg-[#E50914] text-white"}`}>
                  {message.content}
                </div>
              ))}
              {props.isChatting ? <TypingIndicator /> : null}
            </div>
            <div className="border-t border-white/10 p-4">
              <form onSubmit={(event) => { event.preventDefault(); void props.askCoach(); }} className="flex gap-2">
                <input disabled={disabled} value={props.question} onChange={(event) => props.setQuestion(event.target.value)} placeholder={disabled ? "Upload or use demo data first" : "Ask about your money..."} className="focus-visible-ring min-w-0 flex-1 rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm outline-none transition focus:border-[#FF3B3B] disabled:cursor-not-allowed disabled:opacity-60" />
                <button type="submit" disabled={disabled || props.isChatting} className="focus-visible-ring grid size-12 place-items-center rounded-2xl bg-[#E50914] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60" aria-label="Ask coach"><ChevronRight size={19} aria-hidden /></button>
              </form>
              <div className="mt-3 flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button key={prompt} type="button" disabled={disabled} onClick={() => void props.askCoach(prompt)} className="focus-visible-ring rounded-full border border-white/10 px-3 py-1 text-xs text-[#C7C7C7] transition hover:border-[#FF3B3B]/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">{prompt}</button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button type="button" whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.96 }} onClick={() => props.setOpen(!props.open)} className="focus-visible-ring grid size-16 place-items-center rounded-full bg-[#E50914] shadow-[0_0_55px_rgba(229,9,20,.65)]" aria-label="Open AI assistant">
        <MessageCircle size={28} aria-hidden />
      </motion.button>
    </div>
  );
}

function PremiumSections() {
  return (
    <>
      <section id="intelligence" className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="why-heading">
        <SectionTitle eyebrow="Why FinanceIQ" title="Built for people who want clarity, not spreadsheets." text="FinanceIQ combines extraction, categorization, anomaly detection, coaching, and forecasting into a single financial intelligence experience." id="why-heading" />
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {whyCards.map((card) => (
            <motion.div key={card.title} whileHover={{ y: -8, scale: 1.015 }} className="premium-card p-6">
              <card.icon className="text-[#FF3B3B]" size={28} aria-hidden />
              <h3 className="mt-5 text-xl font-black">{card.title}</h3>
              <p className="mt-3 leading-7 text-[#C7C7C7]">{card.text}</p>
            </motion.div>
          ))}
        </div>
      </section>
      <section className="relative z-10 border-y border-white/10 bg-[#0F0F0F]/65 px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="features-heading">
        <div className="mx-auto max-w-7xl">
          <SectionTitle eyebrow="AI Features" title="Financial intelligence that feels instant." text="A premium suite of analysis tools built around the statement you upload." id="features-heading" />
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <motion.div key={feature.title} whileHover={{ y: -6 }} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-[#E50914]/50 hover:shadow-[0_0_45px_rgba(229,9,20,.2)]">
                <feature.icon className="text-[#FF3B3B]" size={25} aria-hidden />
                <h3 className="mt-4 text-lg font-black">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#C7C7C7]">{feature.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20" aria-label="FinanceIQ stats">
        <div className="grid gap-5 lg:grid-cols-3">
          {stats.map((stat) => (
            <motion.div key={stat.label} whileHover={{ scale: 1.02 }} className="premium-card p-8 text-center">
              <div className="text-5xl font-black text-[#FF3B3B]">{stat.value}</div>
              <div className="mt-3 text-sm uppercase tracking-[0.2em] text-[#C7C7C7]">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>
      <ProductMetricsSection />
      <ArchitectureSection />
      <CaseStudySection />
      <EngineeringHighlightsSection />
      <section id="security" className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="security-heading">
        <div className="premium-card grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[#FF3B3B]">Security & Privacy</p>
            <h2 id="security-heading" className="mt-4 text-4xl font-black sm:text-6xl">Sensitive data deserves a serious interface.</h2>
            <p className="mt-5 text-lg leading-8 text-[#C7C7C7]">No accounts. Strict upload validation. Rate-limited APIs. Security headers. Server-side AI calls. Statement text treated as untrusted data.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {privacy.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/35 p-4 font-bold">
                <ShieldCheck className="text-[#FF3B3B]" size={20} aria-hidden /> {item}
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="testimonials-heading">
        <SectionTitle eyebrow="Testimonials" title="The kind of insight people remember." text="Social proof for the moments FinanceIQ uncovers hidden money leaks." id="testimonials-heading" />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {testimonials.map((item) => (
            <motion.div key={item.quote} whileHover={{ y: -8, rotate: item.rotate }} className="premium-card p-6">
              <div className="text-5xl text-[#E50914]" aria-hidden>&quot;</div>
              <p className="text-xl font-bold leading-8">{item.quote}</p>
              <div className="mt-6 text-sm text-[#C7C7C7]">{item.name}</div>
            </motion.div>
          ))}
        </div>
      </section>
      <section id="faq" className="relative z-10 mx-auto max-w-4xl px-4 py-14 pb-28 sm:px-6 sm:py-20" aria-labelledby="faq-heading">
        <SectionTitle eyebrow="FAQ" title="Clear answers before you upload." text="FinanceIQ keeps the experience instant, private, and transparent." id="faq-heading" />
        <div className="mt-10 space-y-4">
          {faq.map((item) => (
            <details key={item.q} className="premium-card p-5">
              <summary className="cursor-pointer text-lg font-black">{item.q}</summary>
              <p className="mt-4 leading-7 text-[#C7C7C7]">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}

function ProductMetricsSection() {
  return (
    <section className="relative z-10 border-y border-white/10 bg-black/60 px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="metrics-heading">
      <div className="mx-auto max-w-7xl">
        <SectionTitle eyebrow="Product Metrics" title="A public demo built for fast evaluation." text="FinanceIQ is easy to test without an account and transparent about demo data versus uploaded statement data." id="metrics-heading" />
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {productMetrics.map((item) => (
            <motion.div key={item} whileHover={{ y: -5 }} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <CheckCircle2 className="text-[#FF3B3B]" size={22} aria-hidden />
              <p className="mt-4 font-black">{item}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArchitectureSection() {
  return (
    <section className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="architecture-heading">
      <SectionTitle eyebrow="Architecture" title="From raw statement to explainable financial intelligence." text="The product flow is designed to make uploaded data traceable, validated, analyzed, and exportable without requiring user accounts." id="architecture-heading" />
      <div className="scrollbar-horizontal mt-10 flex gap-3 overflow-x-auto pb-3">
        {architectureFlow.map((step, index) => (
          <div key={step} className="min-w-[190px] rounded-3xl border border-white/10 bg-white/[0.05] p-5">
            <span className="grid size-9 place-items-center rounded-full bg-[#E50914] text-sm font-black">{index + 1}</span>
            <p className="mt-5 font-black">{step}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CaseStudySection() {
  return (
    <section className="relative z-10 border-y border-white/10 bg-[#0F0F0F]/65 px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="case-study-heading">
      <div className="mx-auto max-w-7xl">
        <SectionTitle eyebrow="Case Study" title="Problem - Solution - Impact" text="A concise product story for evaluators who want to understand the engineering and user value quickly." id="case-study-heading" />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {caseStudy.map((item) => (
            <motion.div key={item.title} whileHover={{ y: -6 }} className="premium-card p-6">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#FF3B3B]">{item.title}</p>
              <p className="mt-5 text-lg leading-8 text-white">{item.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EngineeringHighlightsSection() {
  return (
    <section className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="engineering-heading">
      <SectionTitle eyebrow="Built with production-grade engineering" title="Full-stack signals that matter in reviews." text="The project pairs a polished client experience with server-side analysis, validation, exports, and AI-ready API routes." id="engineering-heading" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {engineeringHighlights.map((item) => (
          <div key={item} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <Sparkles className="text-[#FF3B3B]" size={20} aria-hidden />
            <p className="mt-4 font-black">{item}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {techCredibility.map((item) => (
          <div key={item} className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-[#D8D8D8]">{item}</div>
        ))}
      </div>
    </section>
  );
}

function HeroPreview({ report }: { report: InsightReport }) {
  return (
    <div className="premium-card p-5">
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-[#C7C7C7]">Live demo preview</div>
            <div className="mt-1 text-5xl font-black">{report.health.score}</div>
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
    </div>
  );
}

function TrustBadges() {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      {["No login required", "Secure file validation", "Server-side AI", "Privacy-first analysis", "No fake financial data"].map((item) => (
        <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 p-3 text-sm font-semibold text-white">
          <CheckCircle2 size={18} className="text-[#FF3B3B]" aria-hidden /> {item}
        </div>
      ))}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
      <div className="text-xs text-[#C7C7C7]">{label}</div>
      <div className="mt-1 text-sm font-black">{value}</div>
    </div>
  );
}

function Forecast({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <span className="text-sm text-[#C7C7C7]">{label}</span>
      <span className="font-black">{money(value)}</span>
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string; value: string }[] }) {
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-[#C7C7C7]"><span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} /> {item.label}</span>
          <span className="font-bold">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function ModeBadge({ label, tone = "demo" }: { label: string; tone?: "demo" | "success" }) {
  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${tone === "success" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-[#FF3B3B]/50 bg-[#E50914]/15 text-[#FFD0D0]"}`}>{label}</span>;
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

function SectionTitle({ eyebrow, title, text, id }: { eyebrow: string; title: string; text: string; id?: string }) {
  return (
    <motion.div className="max-w-4xl" initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
      <p className="text-sm font-black uppercase tracking-[0.22em] text-[#FF3B3B]">{eyebrow}</p>
      <h2 id={id} className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">{title}</h2>
      <p className="mt-5 text-lg leading-8 text-[#C7C7C7]">{text}</p>
    </motion.div>
  );
}

function Particles() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 hidden overflow-hidden md:block">
      {Array.from({ length: 18 }, (_, index) => (
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
        <motion.div key={index} className="absolute hidden rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-[#FF3B3B] sm:block" style={{ left: `${18 + index * 28}%`, top: `${20 + (index % 2) * 55}%` }} animate={{ y: [0, -14, 0], rotate: [0, index === 1 ? 7 : -7, 0] }} transition={{ duration: 4 + index, repeat: Infinity }}>
          <Icon size={24} aria-hidden />
        </motion.div>
      ))}
    </>
  );
}

function uploadShellClass(status: UploadStatus) {
  if (status === "dragging") return "border-[#FF3B3B] bg-[#E50914]/10 shadow-[0_0_70px_rgba(229,9,20,.38),inset_0_0_65px_rgba(229,9,20,.18)]";
  if (status === "analyzing") return "border-[#FF3B3B] bg-black/65 shadow-[0_0_70px_rgba(229,9,20,.35),inset_0_0_65px_rgba(229,9,20,.18)]";
  if (status === "error") return "border-[#FF3B3B] bg-[#E50914]/10 shadow-[0_0_55px_rgba(229,9,20,.28)]";
  if (status === "success") return "border-emerald-400/70 bg-emerald-400/5 shadow-[0_0_55px_rgba(16,185,129,.16)]";
  return "border-[#E50914]/70 bg-black/55 shadow-[inset_0_0_55px_rgba(229,9,20,.12)] hover:border-[#FF3B3B] hover:shadow-[0_0_70px_rgba(229,9,20,.35),inset_0_0_65px_rgba(229,9,20,.18)]";
}

function normalizeApiError(message?: string) {
  if (!message) return "We could not detect transactions in this file. Try another bank statement or use CSV format.";
  if (message.includes("larger than 10 MB")) return "This file is too large. Please upload a file under 10 MB.";
  if (message.includes("not supported") || message.includes("invalid file type")) return "Unsupported file type. Please upload PDF, CSV, or XLSX.";
  if (message.includes("empty")) return "This file appears empty. Please upload a valid bank statement.";
  if (message.includes("could not find transactions")) return "We could not detect transactions in this file. Try another bank statement or use CSV format.";
  return message;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

const productMetrics = [
  "No login required",
  "Supports PDF, CSV, XLSX",
  "OCR fallback for scanned PDFs",
  "AI financial coach",
  "PDF/XLSX/CSV/JSON export",
  "Privacy-first upload validation",
];

const architectureFlow = ["Upload", "Validation", "Parsing/OCR", "Categorization", "Insights Engine", "Dashboard", "AI Coach", "Export"];

const caseStudy = [
  { title: "Problem", text: "Bank statements are hard to understand manually, especially when subscriptions, recurring bills, and category trends are buried in raw rows." },
  { title: "Solution", text: "FinanceIQ converts raw statements into financial health scores, spending categories, subscriptions, risk alerts, forecasts, and statement-aware AI answers." },
  { title: "Impact", text: "Users can understand spending, detect recurring costs, discover savings opportunities, compare behavior, and export reports for follow-up analysis." },
];

const engineeringHighlights = [
  "Client-side premium UX",
  "Server-side statement analysis",
  "Schema validation",
  "File validation",
  "Error handling",
  "Responsive dashboard",
  "AI-assisted insights",
  "Multi-format export",
];

const techCredibility = [
  "Next.js App Router",
  "TypeScript",
  "Tailwind CSS",
  "Framer Motion",
  "Recharts",
  "Zod validation",
  "Rate-limited APIs",
  "Security headers",
  "OpenAI-ready architecture",
  "Export engine",
];

const privacy = ["Validated uploads", "Rate-limited APIs", "Security headers", "Server-side AI", "OCR fallback", "No accounts"];

const testimonials = [
  { quote: "FinanceIQ found subscriptions I forgot I was paying for.", name: "Product designer, Bengaluru", rotate: -1 },
  { quote: "Saved me Rs 12,000 annually in the first analysis.", name: "Founder, Mumbai", rotate: 1 },
  { quote: "It made my spending pattern obvious in five minutes.", name: "Consultant, Delhi", rotate: -1 },
];

const faq = [
  { q: "Does FinanceIQ require a user account?", a: "No. Upload analysis works without login, signup, or subscription." },
  { q: "Can it read scanned PDFs?", a: "Yes, FinanceIQ attempts OCR when a PDF has little extractable text. Complex scans may still need clearer source files." },
  { q: "Does the AI follow instructions inside statements?", a: "No. Uploaded statement text is treated as untrusted data and prompt hardening tells the AI never to execute instructions found in transaction text." },
  { q: "Can I export my report?", a: "Yes. After real analysis or demo mode, export CSV, XLSX, PDF, or JSON." },
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
