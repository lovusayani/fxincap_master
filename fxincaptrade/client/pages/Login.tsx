import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PlatformLogo from "@/components/PlatformLogo";
import { apiUrl } from "@/lib/api";

export default function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [infoMessage, setInfoMessage] = useState("");

    useEffect(() => {
        const state = location.state as { email?: string; message?: string } | null;
        if (state?.email) {
            setEmail(state.email);
        }
        if (state?.message) {
            setInfoMessage(state.message);
        }
    }, [location.state]);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setInfoMessage("");
        try {
            const res = await fetch(apiUrl("/api/auth/login"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                if (data?.requiresVerification && email) {
                    setError(data?.message || "Please verify your email before logging in.");
                    return;
                }
                setError(data?.message || data?.error || "Login failed");
                return;
            }
            localStorage.setItem("auth_token", data?.token || data?.accessToken || "demo-token");
            navigate("/");
        } catch {
            setError("Unable to login right now");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
            <form onSubmit={onSubmit} data-slot="card" className="auth-card w-full max-w-sm rounded-xl border border-white/10 bg-[#101321] p-6 space-y-4">
                <PlatformLogo mode="auth" isDark={true} />
                <h1 className="text-2xl font-bold">Sign In</h1>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white"
                    required
                />
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white"
                    required
                />
                {infoMessage ? <div className="text-sm text-emerald-400">{infoMessage}</div> : null}
                {error ? <div className="text-sm text-red-400">{error}</div> : null}
                {error && error.toLowerCase().includes("verify") ? (
                    <button
                        type="button"
                        onClick={() => navigate(`/register?step=verify&email=${encodeURIComponent(email)}`)}
                        className="text-left text-sm text-cyan-400"
                    >
                        Enter activation code
                    </button>
                ) : null}
                <button type="submit" disabled={loading} className="w-full rounded-md bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                    {loading ? "Signing in..." : "Login"}
                </button>
                <div className="text-sm text-gray-400">
                    No account? <a href="/register" className="text-cyan-400">Create one</a>
                </div>
            </form>
        </div>
    );
}
