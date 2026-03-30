import React, { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTradingStore } from "@/state/trading-store";

type DepositOffer = {
    id: string;
    title: string;
    description: string;
    badge?: string | null;
};

type ChainConfig = {
    code: string;
    label: string;
    walletAddress: string;
};

type PromoPreview = {
    code: string;
    discountPercent: number;
    discountAmount: number;
    payableAmount: number;
};

type DepositRow = {
    id: string;
    reference: string;
    amount: number;
    status: string;
    paymentMethod?: string | null;
    method?: string | null;
    paymentChain?: string | null;
    promoCode?: string | null;
    createdAt: string;
};

const formatMoney = (amount: number, currency = "USD") =>
    new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(amount || 0));

const statusTone = (status: string) => {
    const value = String(status || "").toLowerCase();
    if (value === "completed") return "bg-emerald-500/20 text-emerald-300";
    if (value === "rejected" || value === "failed") return "bg-red-500/20 text-red-300";
    if (value === "processing") return "bg-blue-500/20 text-blue-300";
    return "bg-amber-500/20 text-amber-300";
};

export default function DepositPage() {
    const navigate = useNavigate();
    const { account, loadAccount } = useTradingStore();

    const [showModal, setShowModal] = useState(false);
    const [amount, setAmount] = useState("");
    const [promoCode, setPromoCode] = useState("");
    const [promoPreview, setPromoPreview] = useState<PromoPreview | null>(null);
    const [promoError, setPromoError] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("USDT");
    const [paymentChain, setPaymentChain] = useState("ERC20");
    const [remarks, setRemarks] = useState("");
    const [screenshot, setScreenshot] = useState<File | null>(null);
    const [screenshotError, setScreenshotError] = useState("");

    const [chains, setChains] = useState<ChainConfig[]>([]);
    const [offers, setOffers] = useState<DepositOffer[]>([]);
    const [offerIndex, setOfferIndex] = useState(0);
    const [depositRows, setDepositRows] = useState<DepositRow[]>([]);

    const [loadingRows, setLoadingRows] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

    const token = localStorage.getItem("auth_token");
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

    const selectedChain = useMemo(
        () => chains.find((item) => item.code === paymentChain) || null,
        [chains, paymentChain]
    );

    const qrCodeUrl = useMemo(() => {
        if (!selectedChain?.walletAddress) return "";
        return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(selectedChain.walletAddress)}`;
    }, [selectedChain?.walletAddress]);

    const payableAmount = useMemo(() => {
        const numericAmount = Number(amount || 0);
        if (!numericAmount || numericAmount <= 0) return 0;
        if (!promoPreview) return numericAmount;
        return promoPreview.payableAmount;
    }, [amount, promoPreview]);

    const loadPaymentConfig = async () => {
        try {
            const response = await fetch("/api/user/deposit-payment-config", { headers: authHeaders });
            if (!response.ok) return;
            const json = await response.json();
            const nextChains = json?.data?.chains || [];
            if (Array.isArray(nextChains) && nextChains.length > 0) {
                setChains(nextChains);
                setPaymentChain(nextChains[0].code);
            }
        } catch {
            setChains([]);
        }
    };

    const loadOffers = async () => {
        try {
            const response = await fetch("/api/user/deposit-offers", { headers: authHeaders });
            if (!response.ok) return;
            const json = await response.json();
            setOffers(Array.isArray(json?.data) ? json.data : []);
        } catch {
            setOffers([]);
        }
    };

    const loadDepositRows = async () => {
        setLoadingRows(true);
        try {
            const response = await fetch("/api/user/fund-requests", { headers: authHeaders });
            if (!response.ok) return;
            const json = await response.json();
            const rows = Array.isArray(json?.requests) ? json.requests : [];
            setDepositRows(rows.filter((item: any) => String(item?.type || "").toLowerCase() === "deposit"));
        } catch {
            setDepositRows([]);
        } finally {
            setLoadingRows(false);
        }
    };

    useEffect(() => {
        void loadAccount();
        void loadPaymentConfig();
        void loadOffers();
        void loadDepositRows();
    }, []);

    useEffect(() => {
        if (offers.length <= 1) return;
        const interval = setInterval(() => {
            setOfferIndex((prev) => (prev + 1) % offers.length);
        }, 3500);
        return () => clearInterval(interval);
    }, [offers.length]);

    const applyPromoCode = async () => {
        setPromoError("");
        setPromoPreview(null);
        const parsedAmount = Number(amount);
        const trimmedPromo = promoCode.trim();

        if (!trimmedPromo) {
            setPromoError("Enter promo code first");
            return;
        }
        if (!parsedAmount || parsedAmount <= 0) {
            setPromoError("Enter valid amount before applying promo code");
            return;
        }

        try {
            const response = await fetch("/api/user/deposit/validate-promo", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...authHeaders,
                },
                body: JSON.stringify({ amount: parsedAmount, promoCode: trimmedPromo }),
            });
            const data = await response.json();
            if (!response.ok || !data?.success) {
                setPromoError(data?.error || "Invalid promo code");
                return;
            }
            setPromoPreview(data.data);
        } catch {
            setPromoError("Could not validate promo code");
        }
    };

    const submitDeposit = async () => {
        const parsedAmount = Number(amount);
        if (!parsedAmount || parsedAmount <= 0) {
            setMessage({ text: "Please enter a valid amount", ok: false });
            return;
        }

        if (paymentMethod !== "USDT") {
            setMessage({ text: "Only USDT payment method is active currently", ok: false });
            return;
        }

        if (!paymentChain) {
            setMessage({ text: "Please select USDT chain", ok: false });
            return;
        }

        if (!screenshot) {
            setScreenshotError("Screenshot is required");
            setMessage({ text: "Screenshot is required", ok: false });
            return;
        }

        setScreenshotError("");

        setSubmitting(true);
        setMessage(null);

        try {
            const formData = new FormData();
            formData.append("type", "deposit");
            formData.append("amount", String(parsedAmount));
            formData.append("method", "crypto");
            formData.append("paymentMethod", paymentMethod);
            formData.append("paymentChain", paymentChain);
            formData.append("chain", paymentChain);
            formData.append("cryptoSymbol", "USDT");
            formData.append("walletAddress", selectedChain?.walletAddress || "");
            formData.append("remarks", remarks);
            if (promoCode.trim()) {
                formData.append("promoCode", promoCode.trim());
            }
            formData.append("screenshot", screenshot);

            const response = await fetch("/api/user/fund-request", {
                method: "POST",
                headers: {
                    ...authHeaders,
                },
                body: formData,
            });
            const data = await response.json();
            if (!response.ok) {
                setMessage({ text: data.error || data.message || "Deposit request failed", ok: false });
                return;
            }

            const successText = data?.promoCode
                ? `Deposit request submitted (Promo ${data.promoCode} applied). Status: Pending verification.`
                : "Deposit request submitted successfully. Status: Pending verification.";

            setMessage({ text: successText, ok: true });
            setAmount("");
            setPromoCode("");
            setPromoPreview(null);
            setPromoError("");
            setRemarks("");
            setScreenshot(null);
            setScreenshotError("");
            setShowModal(false);
            await loadDepositRows();
        } catch {
            setMessage({ text: "Network error. Please try again.", ok: false });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <Header />
            <div className="w-full px-4 py-4 sm:px-6 lg:px-8 space-y-4">
                <h1 className="text-xl font-bold text-white mb-2">Deposit</h1>

                {!showModal && message && (
                    <div className={`p-3 rounded-lg text-sm ${message.ok ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                        {message.text}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                    <Card>
                        <CardHeader>
                            <CardTitle>Current Balance</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-xs text-gray-400">Active trading wallet balance</p>
                            <p className="text-2xl font-semibold text-white">
                                {formatMoney(account?.balance || 0, account?.currency || "USD")}
                            </p>
                            <Button type="button" onClick={() => setShowModal(true)} className="h-10 rounded-lg w-full">
                                Add Balance
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Deposit Tips</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm text-gray-300">
                            <p>1. Use only the wallet address shown for selected chain.</p>
                            <p>2. Upload a clear screenshot of successful transfer.</p>
                            <p>3. Pending deposits move to completed after admin verification.</p>
                            <p>4. Add remarks if transaction needs extra context.</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Deposit Offers</CardTitle>
                            {offers.length > 1 && (
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setOfferIndex((prev) => (prev - 1 + offers.length) % offers.length)}
                                        className="rounded-md border border-white/20 px-2 py-1 text-xs text-gray-200 hover:bg-white/10"
                                    >
                                        Prev
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setOfferIndex((prev) => (prev + 1) % offers.length)}
                                        className="rounded-md border border-white/20 px-2 py-1 text-xs text-gray-200 hover:bg-white/10"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent>
                            {offers.length === 0 ? (
                                <p className="text-sm text-gray-400">No active offers right now.</p>
                            ) : (
                                <div className="space-y-2">
                                    {offers[offerIndex]?.badge && (
                                        <span className="inline-block rounded-full bg-blue-500/20 px-2 py-1 text-xs text-blue-300">
                                            {offers[offerIndex].badge}
                                        </span>
                                    )}
                                    <p className="text-base font-semibold text-white">{offers[offerIndex]?.title}</p>
                                    <p className="text-sm text-gray-300">{offers[offerIndex]?.description}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between gap-3">
                            <CardTitle>Deposit Report</CardTitle>
                            <Button type="button" variant="outline" className="h-9 rounded-lg border-white/15 text-gray-200 hover:bg-white/10" onClick={loadDepositRows}>
                                Refresh
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4 overflow-x-auto">
                        {loadingRows ? (
                            <p className="text-sm text-gray-400">Loading deposit reports...</p>
                        ) : depositRows.length === 0 ? (
                            <p className="text-sm text-gray-400">No deposit requests found yet.</p>
                        ) : (
                            <table className="min-w-full border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-white/10 text-left text-gray-400">
                                        <th className="px-3 py-2 font-medium">Reference</th>
                                        <th className="px-3 py-2 font-medium">Amount</th>
                                        <th className="px-3 py-2 font-medium">Method</th>
                                        <th className="px-3 py-2 font-medium">Chain</th>
                                        <th className="px-3 py-2 font-medium">Promo</th>
                                        <th className="px-3 py-2 font-medium">Status</th>
                                        <th className="px-3 py-2 font-medium">Submitted At</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {depositRows.map((row) => (
                                        <tr key={row.id} className="border-b border-white/5">
                                            <td className="px-3 py-2 text-gray-200">{row.reference || row.id}</td>
                                            <td className="px-3 py-2 text-white">{formatMoney(Number(row.amount || 0))}</td>
                                            <td className="px-3 py-2 text-gray-300">{row.paymentMethod || row.method || "-"}</td>
                                            <td className="px-3 py-2 text-gray-300">{row.paymentChain || "-"}</td>
                                            <td className="px-3 py-2 text-gray-300">{row.promoCode || "-"}</td>
                                            <td className="px-3 py-2">
                                                <span className={`rounded-full px-2 py-1 text-xs uppercase ${statusTone(row.status)}`}>
                                                    {row.status || "pending"}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-gray-400">{row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </CardContent>
                </Card>

                <div>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate("/")}
                        className="h-10 rounded-lg border-white/15 text-gray-200 hover:bg-white/10"
                    >
                        Back To Dashboard
                    </Button>
                </div>

                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                        <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-[#0d1117] p-4 shadow-2xl">
                            <div className="mb-3 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-white">Add Balance</h2>
                                <button
                                    type="button"
                                    onClick={() => !submitting && setShowModal(false)}
                                    className="rounded-md border border-white/20 px-2 py-1 text-xs text-gray-200 hover:bg-white/10"
                                >
                                    Close
                                </button>
                            </div>

                            {showModal && message && (
                                <div className={`mb-3 rounded-lg p-3 text-sm ${message.ok ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                                    {message.text}
                                </div>
                            )}

                            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-xs text-gray-400">Amount</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={amount}
                                            onChange={(event) => {
                                                setAmount(event.target.value);
                                                setPromoPreview(null);
                                                setPromoError("");
                                            }}
                                            placeholder="Enter amount"
                                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-white placeholder-gray-500 focus:border-blue-400 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-xs text-gray-400">Promo Code (Optional)</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={promoCode}
                                                onChange={(event) => {
                                                    setPromoCode(event.target.value);
                                                    setPromoPreview(null);
                                                    setPromoError("");
                                                }}
                                                placeholder="Enter promo code"
                                                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-white placeholder-gray-500 focus:border-blue-400 focus:outline-none"
                                            />
                                            <Button type="button" onClick={applyPromoCode} className="h-10 rounded-lg">
                                                Apply
                                            </Button>
                                        </div>
                                        {promoError && <p className="mt-1 text-xs text-red-300">{promoError}</p>}
                                        {promoPreview && (
                                            <p className="mt-1 text-xs text-emerald-300">
                                                Promo applied: {promoPreview.discountPercent}% OFF, payable {formatMoney(promoPreview.payableAmount)}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-xs text-gray-400">Payment Method</label>
                                        <select
                                            value={paymentMethod}
                                            onChange={(event) => setPaymentMethod(event.target.value)}
                                            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-foreground focus:border-ring focus:outline-none"
                                            style={{ color: "var(--foreground)", backgroundColor: "var(--background)" }}
                                        >
                                            <option style={{ color: "#0f172a", backgroundColor: "#ffffff" }} value="USDT">USDT (Active)</option>
                                            <option style={{ color: "#0f172a", backgroundColor: "#ffffff" }} value="BTC" disabled>BTC (Inactive)</option>
                                            <option style={{ color: "#0f172a", backgroundColor: "#ffffff" }} value="USD" disabled>USD (Inactive)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-xs text-gray-400">USDT Chain</label>
                                        <select
                                            value={paymentChain}
                                            onChange={(event) => setPaymentChain(event.target.value)}
                                            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-foreground focus:border-ring focus:outline-none"
                                            style={{ color: "var(--foreground)", backgroundColor: "var(--background)" }}
                                        >
                                            {chains.map((item) => (
                                                <option style={{ color: "#0f172a", backgroundColor: "#ffffff" }} key={item.code} value={item.code}>
                                                    {item.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                                    <p className="text-sm font-medium text-white">Payment Details</p>
                                    <p className="mt-2 text-xs text-gray-400">Wallet Address</p>
                                    <p className="break-all rounded-md bg-black/30 p-2 text-xs text-gray-200">
                                        {selectedChain?.walletAddress || "No wallet configured"}
                                    </p>
                                    {qrCodeUrl && (
                                        <div className="mt-3">
                                            <p className="text-xs text-gray-400 mb-2">QR Code</p>
                                            <img src={qrCodeUrl} alt="Wallet QR" className="h-36 w-36 rounded-md border border-white/10 bg-white p-1" />
                                        </div>
                                    )}
                                    <p className="mt-2 text-xs text-blue-300">
                                        Amount to pay: {formatMoney(payableAmount)}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-xs text-gray-400">Upload Screenshot (Required)</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(event) => {
                                                setScreenshot(event.target.files?.[0] || null);
                                                setScreenshotError("");
                                            }}
                                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-1 file:text-xs file:text-white"
                                        />
                                        {screenshotError && <p className="mt-1 text-xs text-red-300">{screenshotError}</p>}
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs text-gray-400">Remarks (Optional)</label>
                                        <textarea
                                            rows={3}
                                            value={remarks}
                                            onChange={(event) => setRemarks(event.target.value)}
                                            placeholder="Add note for admin verification"
                                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-400 focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2 justify-end">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setShowModal(false)}
                                        className="h-10 rounded-lg border-white/15 text-gray-200 hover:bg-white/10"
                                        disabled={submitting}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="button" onClick={submitDeposit} disabled={submitting} className="h-10 rounded-lg">
                                        {submitting ? "Submitting..." : "Submit Deposit"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}