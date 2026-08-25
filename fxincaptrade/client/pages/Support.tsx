import { apiUrl } from "@/lib/api";
import React, { useCallback, useEffect, useState } from "react";
import Header from "@/components/Header";

type Category = { id: string; name: string };
type Reply = { id: string; authorType: "admin" | "trader"; authorName: string; message: string; createdAt: string };
type Ticket = {
  id: string; ticketNumber: string; subject: string; description: string;
  category: string | null; status: string; createdAt: string; replyCount?: number;
  replies?: Reply[];
};

const STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-500/20 text-amber-300",
  in_progress: "bg-sky-500/20 text-sky-300",
  resolved: "bg-emerald-500/20 text-emerald-300",
  closed: "bg-gray-500/20 text-gray-300",
};
const statusLabel = (s: string) => s.replace("_", " ").replace(/\w/g, (c) => c.toUpperCase());

const authHeaders = () => {
  const token = localStorage.getItem("auth_token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

export default function SupportPage() {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [openTicket, setOpenTicket] = useState<Ticket | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const loadTickets = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/support/my"), { headers: authHeaders() });
      const json = await res.json();
      if (json.success) setTickets(json.data || []);
    } catch { /* list is supplementary */ }
  }, []);

  useEffect(() => {
    fetch(apiUrl("/api/support/categories"), { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => { if (j.success) setCategories(j.data || []); })
      .catch(() => { });
    loadTickets();
  }, [loadTickets]);

  const openThread = async (id: string) => {
    try {
      const res = await fetch(apiUrl(`/api/support/ticket/${id}`), { headers: authHeaders() });
      const json = await res.json();
      if (json.success) { setOpenTicket(json.data); setReplyText(""); }
    } catch { /* ignore */ }
  };

  const sendReply = async () => {
    if (!openTicket || !replyText.trim()) return;
    setReplying(true);
    try {
      const res = await fetch(apiUrl(`/api/support/ticket/${openTicket.id}/reply`), {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ message: replyText }),
      });
      const json = await res.json();
      if (json.success) { setOpenTicket(json.data); setReplyText(""); loadTickets(); }
    } catch { /* ignore */ } finally { setReplying(false); }
  };

  const submitTicket = async () => {
    if (!subject.trim() || !description.trim()) {
      setMessage({ text: "Please fill in both subject and description", ok: false });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    const token = localStorage.getItem("auth_token");
    try {
      const res = await fetch(apiUrl("/api/support"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ subject, description, category }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ text: `Ticket submitted! Your reference: ${data.ticketId}`, ok: true });
        setSubject("");
        setDescription("");
        setCategory("");
        loadTickets();
      } else {
        setMessage({ text: data.error || "Failed to submit ticket", ok: false });
      }
    } catch {
      setMessage({ text: "Network error. Please try again.", ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  const faqs = [
    { q: "How do I deposit funds?", a: "Go to Wallet → Deposit and submit a fund request. Our team will process it within 1–2 business days." },
    { q: "What is the minimum deposit?", a: "The minimum deposit is $100 for a real trading account." },
    { q: "How do I switch between Demo and Real accounts?", a: "Go to Settings and tap the DEMO or REAL button to switch accounts." },
    { q: "How do I verify my identity (KYC)?", a: "Go to Profile and submit your identity documents for verification." },
  ];

  return (
    <>
      <Header />
      <div className="p-4 max-w-lg mx-auto">
        <h1 className="text-xl font-bold text-white mb-4">Support</h1>

        {/* Contact info */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-5 flex gap-4">
          <div className="flex-1 text-center">
            <p className="text-xs text-gray-500 mb-1">Email</p>
            <p className="text-sm text-white">support@ncapfx.com</p>
          </div>
          <div className="w-px bg-white/10" />
          <div className="flex-1 text-center">
            <p className="text-xs text-gray-500 mb-1">Hours</p>
            <p className="text-sm text-white">24/7 Support</p>
          </div>
        </div>

        {/* Ticket form */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Submit a Ticket</h2>

          {message && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${message.ok ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
              }`}>{message.text}</div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500"
              >
                <option value="" className="bg-gray-900">Select a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name} className="bg-gray-900">{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief description of your issue"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please describe your issue in detail"
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 resize-none"
              />
            </div>
            <button
              onClick={submitTicket}
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white font-semibold text-sm transition disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Ticket"}
            </button>
          </div>
        </div>

        {/* My tickets */}
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">My Tickets</h2>
          {tickets.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center text-xs text-gray-500">
              You have not raised any tickets yet.
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openThread(t.id)}
                  className="w-full text-left bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium truncate">{t.subject}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {t.ticketNumber}{t.category ? ` · ${t.category}` : ""} · {new Date(t.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLE[t.status] || STATUS_STYLE.open}`}>
                        {statusLabel(t.status)}
                      </span>
                      {(t.replyCount ?? 0) > 0 && (
                        <span className="text-[10px] text-cyan-400">{t.replyCount} repl{t.replyCount === 1 ? "y" : "ies"}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-sm font-semibold text-gray-200 mb-3">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-sm text-white font-medium mb-2">{faq.q}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {openTicket && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
          onClick={() => setOpenTicket(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#101321]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4 shrink-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{openTicket.subject}</p>
                <p className="text-[11px] text-gray-500">
                  {openTicket.ticketNumber}{openTicket.category ? ` · ${openTicket.category}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLE[openTicket.status] || STATUS_STYLE.open}`}>
                  {statusLabel(openTicket.status)}
                </span>
                <button onClick={() => setOpenTicket(null)} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <div className="rounded-lg bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Your message</p>
                <p className="text-sm text-gray-200 whitespace-pre-wrap">{openTicket.description}</p>
              </div>
              {(openTicket.replies || []).map((r) => (
                <div
                  key={r.id}
                  className={`rounded-lg p-3 ${r.authorType === "admin" ? "bg-cyan-500/10 border border-cyan-500/20" : "bg-white/5"}`}
                >
                  <p className="text-[10px] uppercase tracking-wide mb-1 text-gray-500">
                    {r.authorType === "admin" ? "Support" : "You"} · {new Date(r.createdAt).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap">{r.message}</p>
                </div>
              ))}
            </div>

            {openTicket.status !== "closed" && (
              <div className="border-t border-white/10 p-4 shrink-0">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={2}
                  placeholder="Write a reply..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 resize-none"
                />
                <button
                  onClick={sendReply}
                  disabled={replying || !replyText.trim()}
                  className="mt-2 w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm transition disabled:opacity-40"
                >
                  {replying ? "Sending..." : "Send Reply"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
