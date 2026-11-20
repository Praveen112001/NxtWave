"use client";

import React, { useState } from "react";
import { Sparkles, ShieldCheck, Calculator, Send, CheckCircle2, MessageSquare, Share2, Database } from "lucide-react";

export default function NiatGrowthSystem() {
  const [leadProfile, setLeadProfile] = useState({
    studentName: "Aarav Reddy",
    parentContact: "+91 98765 43210",
    examName: "JEE Main",
    percentile: 86,
    preferredState: "Telangana",
    budgetLakhs: 12,
    language: "Telugu"
  });

  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);
  const [toolTrace, setToolTrace] = useState<any[]>([]);
  const [webhookStatus, setWebhookStatus] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerateBrief = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setBrief(null);
    setChatMessages([]);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "generate_brief", leadProfile })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setBrief(data.reply);
      setToolTrace(data.toolTrace || []);
      setWebhookStatus(data.webhookStatus || "");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !brief) return;

    const updatedHistory = [...chatMessages, { role: "user" as const, content: chatInput }];
    setChatMessages(updatedHistory);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "chat",
          leadProfile,
          messages: [
            { role: "assistant", content: brief },
            ...updatedHistory
          ]
        })
      });
      const data = await res.json();
      setChatMessages([...updatedHistory, { role: "assistant", content: data.reply }]);
    } catch {
      setChatMessages([...updatedHistory, { role: "assistant", content: "Connection error. Please retry." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const copyWhatsAppShare = () => {
    if (!brief) return;
    navigator.clipboard.writeText(`*NIAT Personalized Parent Decision Brief for ${leadProfile.studentName}*\n\n${brief}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">NIAT Rank-to-ROI & Parent Clarity Concierge</h1>
              <p className="text-xs text-slate-400">AI-Native Funnel Engine • Grounded Campus DB + Tool-Calling Agent + CRM Webhook</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 px-3 py-1.5 rounded-full">
            <ShieldCheck className="w-4 h-4" />
            <span>UGC Degree + NxtWave Industry Overlay Verified</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: ToF Lead Diagnostic Form */}
        <section className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 h-fit shadow-xl">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Calculator className="w-4 h-4" />
            <span>Step 1: Top-of-Funnel Diagnostic</span>
          </div>
          <h2 className="text-xl font-bold mb-1">Check Rank Reality & 4-Year ROI</h2>
          <p className="text-sm text-slate-400 mb-6">
            Compare traditional cutoff options vs. exact NIAT partner campus fees & NAT scholarships in your parent&apos;s language.
          </p>

          <form onSubmit={handleGenerateBrief} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Student Name</label>
              <input
                type="text"
                required
                value={leadProfile.studentName}
                onChange={(e) => setLeadProfile({ ...leadProfile, studentName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Parent WhatsApp / Email (For Brief Delivery)</label>
              <input
                type="text"
                required
                value={leadProfile.parentContact}
                onChange={(e) => setLeadProfile({ ...leadProfile, parentContact: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Entrance Exam</label>
                <select
                  value={leadProfile.examName}
                  onChange={(e) => setLeadProfile({ ...leadProfile, examName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none"
                >
                  <option>JEE Main</option>
                  <option>TG / AP EAPCET</option>
                  <option>MHT-CET</option>
                  <option>KCET</option>
                  <option>Class 12 Boards</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Percentile / Score (%)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={leadProfile.percentile}
                  onChange={(e) => setLeadProfile({ ...leadProfile, percentile: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Preferred State</label>
                <select
                  value={leadProfile.preferredState}
                  onChange={(e) => setLeadProfile({ ...leadProfile, preferredState: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none"
                >
                  <option>Telangana</option>
                  <option>Maharashtra</option>
                  <option>Tamil Nadu</option>
                  <option>Karnataka</option>
                  <option>Uttar Pradesh</option>
                  <option>Any</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">4-Yr Tuition Budget (₹ Lakhs)</label>
                <input
                  type="number"
                  min={6}
                  max={25}
                  required
                  value={leadProfile.budgetLakhs}
                  onChange={(e) => setLeadProfile({ ...leadProfile, budgetLakhs: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Parent&apos;s Preferred Language</label>
              <select
                value={leadProfile.language}
                onChange={(e) => setLeadProfile({ ...leadProfile, language: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none"
              >
                <option>Telugu</option>
                <option>Tamil</option>
                <option>Hindi</option>
                <option>English</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? "Running AI Campus & ROI Agent..." : "Generate Parent Clarity Brief"}
            </button>
          </form>
        </section>

        {/* Right Column: BoF Vernacular Brief + Tool Telemetry + Parent Q&A */}
        <section className="lg:col-span-7 space-y-6">
          {!brief && !loading && (
