import React, { useState } from "react";
import Header from "@/components/Header";
import { apiUrl } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function WithdrawPage() {
    const navigate = useNavigate();
    const [amount, setAmount] = useState("");
    const [bankName, setBankName] = useState("");
    const [accountHolder, setAccountHolder] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

    const submitWithdraw = async () => {
        const parsedAmount = Number(amount);
        if (!parsedAmount || parsedAmount <= 0) {
            setMessage({ text: "Please enter a valid amount", ok: false });
            return;
        }
        if (!bankName || !accountHolder || !accountNumber) {
            setMessage({ text: "Please complete bank details", ok: false });
            return;
        }

        setSubmitting(true);
        setMessage(null);
        const token = localStorage.getItem("auth_token");

        try {
            const response = await fetch(apiUrl("/api/user/fund-request"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    type: "withdraw",
                    amount: parsedAmount,
                    bankName,
                    accountHolder,
                    accountNumber,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                setMessage({ text: data.message || "Withdrawal request failed", ok: false });
                return;
            }
            setMessage({ text: "Withdrawal request submitted successfully", ok: true });
            setAmount("");
            setBankName("");
            setAccountHolder("");
            setAccountNumber("");
        } catch {
            setMessage({ text: "Network error. Please try again.", ok: false });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <Header />
            <div className="mx-auto max-w-xl p-4 sm:p-6">
                <Card className="rounded-2xl border-white/15 bg-white/5 backdrop-blur-md">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-base text-white">Withdraw Funds</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4 pt-2">
                        {message && (
                            <div
                                className={`rounded-lg border p-3 text-sm ${
                                    message.ok
                                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                                        : "border-red-500/40 bg-red-500/10 text-red-200"
                                }`}
                            >
                                {message.text}
                            </div>
                        )}

                        <div>
                            <label className="mb-1 block text-xs text-gray-400">Amount (USD)</label>
                            <input
                                type="number"
                                min="1"
                                value={amount}
                                onChange={(event) => setAmount(event.target.value)}
                                placeholder="Enter withdraw amount"
                                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-white placeholder-gray-500 focus:border-red-400 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs text-gray-400">Bank Name</label>
                            <input
                                value={bankName}
                                onChange={(event) => setBankName(event.target.value)}
                                placeholder="Bank name"
                                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-white placeholder-gray-500 focus:border-red-400 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs text-gray-400">Account Holder</label>
                            <input
                                value={accountHolder}
                                onChange={(event) => setAccountHolder(event.target.value)}
                                placeholder="Account holder"
                                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-white placeholder-gray-500 focus:border-red-400 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs text-gray-400">Account Number</label>
                            <input
                                value={accountNumber}
                                onChange={(event) => setAccountNumber(event.target.value)}
                                placeholder="Account number"
                                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-white placeholder-gray-500 focus:border-red-400 focus:outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Button
                                type="button"
                                onClick={submitWithdraw}
                                disabled={submitting}
                                className="h-10 rounded-lg bg-red-700 text-white hover:bg-red-600"
                            >
                                {submitting ? "Submitting..." : "Submit Withdrawal Request"}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => navigate("/")}
                                className="h-10 rounded-lg border-white/15 text-gray-200 hover:bg-white/10"
                            >
                                Back To Dashboard
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}