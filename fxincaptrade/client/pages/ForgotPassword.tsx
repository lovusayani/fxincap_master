import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import PlatformLogo from "@/components/PlatformLogo";
import { apiUrl } from "@/lib/api";

export default function ForgotPasswordPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [sent, setSent] = useState(false);

    useEffect(() => {
        const prefill = searchParams.get("email");
        if (prefill) setEmail(prefill);
    }, [searchParams]);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const res = await fetch(apiUrl("/api/auth/forgot-password"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data?.error || data?.message || "Unable to send reset code");
                return;
            }
            setSent(true);
        } catch {
            setError("Unable to send reset code right now");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
            <form onSubmit={onSubmit} data-slot="card" className="auth-card w-full max-w-sm rounded-xl border border-white/10 bg-[#101321] p-6 space-y-4">
                <PlatformLogo mode="auth" isDark={true} />
                <h1 className="text-2xl font-bold">Forgot Password</h1>
                <p className="text-sm text-gray-400">
                    Enter your account email and we'll send you a code to reset your password.
                </p>

                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white"
                    required
                    disabled={sent}
                />

                {sent ? (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-300">
                        If an account exists for this email, a reset code has been sent. Check your inbox, then continue below.
                    </div>
                ) : null}
                {error ? <div className="text-sm text-red-400">{error}</div> : null}

                {sent ? (
                    <button
                        type="button"
                        onClick={() => navigate(`/reset-password?email=${encodeURIComponent(email)}`)}
                        className="w-full rounded-md bg-blue-600 py-2 font-medium text-white hover:bg-blue-700"
                    >
                        I have a code — Reset Password
                    </button>
                ) : (
                    <button type="submit" disabled={loading} className="w-full rounded-md bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                        {loading ? "Sending..." : "Send Reset Code"}
                    </button>
                )}

                <div className="text-sm text-gray-400">
                    <Link to="/login" className="text-cyan-400">Back to login</Link>
                </div>
            </form>
        </div>
    );
}
