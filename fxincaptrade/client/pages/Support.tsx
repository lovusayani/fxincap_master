import { apiUrl } from "@/lib/api";
import React, { useState } from "react";
import Header from "@/components/Header";

export default function SupportPage() {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

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
        body: JSON.stringify({ subject, description }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ text: `Ticket submitted! Your reference: ${data.ticketId}`, ok: true });
        setSubject("");
        setDescription("");
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
            <p className="text-sm text-white">support@fxincap.com</p>
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
    </>
  );
}
