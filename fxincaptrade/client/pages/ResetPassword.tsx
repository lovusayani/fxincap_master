import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import PlatformLogo from "@/components/PlatformLogo";
import { apiUrl } from "@/lib/api";

const upperRegex = /[A-Z]/;
const lowerRegex = /[a-z]/;
const digitRegex = /[0-9]/;
const specialRegex = /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?]/;

function validatePassword(password: string): string {
    if (password.length < 6) return "Password must be at least 6 characters";
    if (!upperRegex.test(password)) return "Password must contain at least one uppercase letter";
    if (!lowerRegex.test(password)) return "Password must contain at least one lowercase letter";
    if (!digitRegex.test(password)) return "Password must contain at least one number";
    if (!specialRegex.test(password)) return "Password must contain at least one special character";
    return "";
}

export default function ResetPasswordPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const prefillEmail = searchParams.get("email");
        const prefillCode = searchParams.get("code");
        if (prefillEmail) setEmail(prefillEmail);
        if (prefillCode) setCode(prefillCode);
    }, [searchParams]);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!email || !code) {
            setError("Email and reset code are required");
            return;
        }
        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            setError(passwordError);
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(apiUrl("/api/auth/reset-password"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code, newPassword }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data?.error || data?.message || "Unable to reset password");
                return;
            }
            setSuccess(true);
            setTimeout(() => {
                navigate("/login", { state: { email, message: "Password reset successfully. Please log in." } });
            }, 1500);
        } catch {
            setError("Unable to reset password right now");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
            <form onSubmit={onSubmit} data-slot="card" className="auth-card w-full max-w-sm rounded-xl border border-white/10 bg-[#101321] p-6 space-y-4">
                <PlatformLogo mode="auth" isDark={true} />
                <h1 className="text-2xl font-bold">Reset Password</h1>

                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white"
                    required
                />
                <input
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit reset code"
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white tracking-widest"
                    required
                />

                <div className="relative">
                    <input
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New Password"
                        className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 pr-10 text-white"
                        required
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-white"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        tabIndex={-1}
                    >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
                <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm New Password"
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white"
                    required
                />
                <p className="text-[11px] text-gray-500">Min 6 chars · 1 uppercase · 1 lowercase · 1 number · 1 special char</p>

                {success ? (
                    <div className="text-sm text-emerald-400">Password reset successfully. Redirecting to login...</div>
                ) : null}
                {error ? <div className="text-sm text-red-400">{error}</div> : null}

                <button type="submit" disabled={loading || success} className="w-full rounded-md bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                    {loading ? "Resetting..." : "Reset Password"}
                </button>

                <div className="flex items-center justify-between text-sm text-gray-400">
                    <Link to="/forgot-password" className="text-cyan-400">Resend code</Link>
                    <Link to="/login" className="text-cyan-400">Back to login</Link>
                </div>
            </form>
        </div>
    );
}
