import React, { useEffect, useRef, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PlatformLogo from "@/components/PlatformLogo";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const upperRegex = /[A-Z]/;
const lowerRegex = /[a-z]/;
const digitRegex = /[0-9]/;
const specialRegex = /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?]/;
const VERIFICATION_CODE_LENGTH = 6;

function validateFields(firstName: string, lastName: string, email: string, password: string) {
    const errors: Record<string, string> = {};
    if (firstName.length < 4) errors.firstName = "First name must be at least 4 characters";
    if (lastName.length < 4) errors.lastName = "Last name must be at least 4 characters";
    if (!emailRegex.test(email)) errors.email = "Enter a valid email address";
    if (password.length < 6) {
        errors.password = "Password must be at least 6 characters";
    } else if (!upperRegex.test(password)) {
        errors.password = "Password must contain at least one uppercase letter";
    } else if (!lowerRegex.test(password)) {
        errors.password = "Password must contain at least one lowercase letter";
    } else if (!digitRegex.test(password)) {
        errors.password = "Password must contain at least one number";
    } else if (!specialRegex.test(password)) {
        errors.password = "Password must contain at least one special character";
    }
    return errors;
}

export default function RegisterPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const verificationInputRefs = useRef<Array<HTMLInputElement | null>>([]);
    const verificationPollRef = useRef<number | null>(null);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [verificationDigits, setVerificationDigits] = useState<string[]>(() => Array(VERIFICATION_CODE_LENGTH).fill(""));
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [verifyLaterLoading, setVerifyLaterLoading] = useState(false);
    const [verifyLaterChecked, setVerifyLaterChecked] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [verificationStep, setVerificationStep] = useState(false);
    const [verificationInputsLocked, setVerificationInputsLocked] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const verificationCode = verificationDigits.join("");

    useEffect(() => {
        const requestedStep = searchParams.get("step");
        const requestedEmail = searchParams.get("email")?.trim().toLowerCase() || "";
        const requestedCode = searchParams.get("code")?.replace(/\D/g, "").slice(0, VERIFICATION_CODE_LENGTH) || "";
        if (requestedStep === "verify" && requestedEmail) {
            setVerificationStep(true);
            setEmail(requestedEmail);
            setVerifyLaterChecked(false);
            setVerificationInputsLocked(requestedCode.length === VERIFICATION_CODE_LENGTH);
            setVerificationDigits(Array.from({ length: VERIFICATION_CODE_LENGTH }, (_, index) => requestedCode[index] || ""));

            const checkVerificationStatus = async () => {
                try {
                    const res = await fetch("/api/auth/verification-status", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: requestedEmail }),
                    });

                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                        setSuccessMessage("Enter the activation code sent to your email.");
                        return;
                    }

                    if (data?.emailVerified) {
                        navigate("/login", {
                            replace: true,
                            state: {
                                email: requestedEmail,
                                message: "Email already verified. Please log in.",
                            },
                        });
                        return;
                    }

                    setSuccessMessage(
                        requestedCode
                            ? "Your activation code is ready. Review it and click Verify Email."
                            : "Enter the activation code sent to your email."
                    );
                } catch {
                    setSuccessMessage("Enter the activation code sent to your email.");
                }
            };

            void checkVerificationStatus();
        }
    }, [navigate, searchParams]);

    useEffect(() => {
        if (!verificationStep || !email) {
            if (verificationPollRef.current) {
                window.clearInterval(verificationPollRef.current);
                verificationPollRef.current = null;
            }
            return;
        }

        const pollVerificationStatus = async () => {
            try {
                const res = await fetch("/api/auth/verification-status", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                });

                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    return;
                }

                if (data?.emailVerified) {
                    navigate("/login", {
                        replace: true,
                        state: {
                            email,
                            message: "Email verified successfully. You can now log in.",
                        },
                    });
                }
            } catch {
                // Ignore polling errors and keep the current verification screen usable.
            }
        };

        void pollVerificationStatus();
        verificationPollRef.current = window.setInterval(() => {
            void pollVerificationStatus();
        }, 4000);

        return () => {
            if (verificationPollRef.current) {
                window.clearInterval(verificationPollRef.current);
                verificationPollRef.current = null;
            }
        };
    }, [email, navigate, verificationStep]);

    useEffect(() => {
        if (!verificationStep) {
            return;
        }

        const firstEmptyIndex = verificationDigits.findIndex((digit) => !digit);
        const targetIndex = firstEmptyIndex === -1 ? VERIFICATION_CODE_LENGTH - 1 : firstEmptyIndex;
        verificationInputRefs.current[targetIndex]?.focus();
    }, [verificationDigits, verificationStep]);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (verificationStep) {
            await handleVerifyCode();
            return;
        }

        const errors = validateFields(firstName, lastName, email, password);
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }
        setFieldErrors({});
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ firstName, lastName, email, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data?.message || data?.error || "Register failed");
                return;
            }
            setVerificationStep(true);
            setPassword("");
            setVerifyLaterChecked(false);
            setVerificationInputsLocked(false);
            setVerificationDigits(Array(VERIFICATION_CODE_LENGTH).fill(""));
            setSuccessMessage(data?.message || "Registration successful. Enter the activation code sent to your email.");
        } catch {
            setError("Unable to register right now");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        if (verificationCode.trim().length !== VERIFICATION_CODE_LENGTH) {
            setError("Enter the activation code sent to your email");
            return;
        }

        setLoading(true);
        setError("");
        setSuccessMessage("");
        try {
            const res = await fetch("/api/auth/verify-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code: verificationCode.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data?.message || data?.error || "Verification failed");
                return;
            }
            navigate("/login", {
                state: {
                    email,
                    verified: true,
                    message: data?.message || "Email verified successfully. You can now log in.",
                },
            });
        } catch {
            setError("Unable to verify your activation code right now");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyLaterChange = async (checked: boolean) => {
        setVerifyLaterChecked(checked);
        if (!checked || !email || verifyLaterLoading) {
            return;
        }

        setVerifyLaterLoading(true);
        setError("");
        setSuccessMessage("");
        try {
            const res = await fetch("/api/auth/verify-later", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setVerifyLaterChecked(false);
                setError(data?.message || data?.error || "Unable to continue without verification");
                return;
            }

            navigate("/login", {
                state: {
                    email,
                    message: data?.message || "You can verify your email later. Log in to continue.",
                },
            });
        } catch {
            setVerifyLaterChecked(false);
            setError("Unable to continue without verification");
        } finally {
            setVerifyLaterLoading(false);
        }
    };

    const updateVerificationDigit = (index: number, nextValue: string) => {
        if (verificationInputsLocked) {
            return;
        }

        const digit = nextValue.replace(/\D/g, "").slice(-1);
        setVerificationDigits((currentDigits) => {
            const nextDigits = [...currentDigits];
            nextDigits[index] = digit;
            return nextDigits;
        });
        setError("");

        if (digit && index < VERIFICATION_CODE_LENGTH - 1) {
            verificationInputRefs.current[index + 1]?.focus();
        }
    };

    const handleVerificationKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
        if (verificationInputsLocked) {
            return;
        }

        if (event.key === "Backspace" && !verificationDigits[index] && index > 0) {
            verificationInputRefs.current[index - 1]?.focus();
        }

        if (event.key === "ArrowLeft" && index > 0) {
            event.preventDefault();
            verificationInputRefs.current[index - 1]?.focus();
        }

        if (event.key === "ArrowRight" && index < VERIFICATION_CODE_LENGTH - 1) {
            event.preventDefault();
            verificationInputRefs.current[index + 1]?.focus();
        }
    };

    const handleVerificationPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
        if (verificationInputsLocked) {
            event.preventDefault();
            return;
        }

        event.preventDefault();
        const pastedDigits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, VERIFICATION_CODE_LENGTH);
        if (!pastedDigits) {
            return;
        }

        setVerificationDigits(Array.from({ length: VERIFICATION_CODE_LENGTH }, (_, index) => pastedDigits[index] || ""));
        const focusIndex = Math.min(pastedDigits.length, VERIFICATION_CODE_LENGTH - 1);
        verificationInputRefs.current[focusIndex]?.focus();
        setError("");
    };

    const handleResendCode = async () => {
        setResendLoading(true);
        setError("");
        setSuccessMessage("");
        try {
            const res = await fetch("/api/auth/resend-verification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data?.message || data?.error || "Could not resend activation code");
                return;
            }
            setVerificationInputsLocked(false);
            setVerificationDigits(Array(VERIFICATION_CODE_LENGTH).fill(""));
            setSuccessMessage(data?.message || "A new activation code has been sent to your email.");
        } catch {
            setError("Unable to resend the activation code right now");
        } finally {
            setResendLoading(false);
        }
    };

    const inputCls = (field: string) =>
        `w-full rounded-lg border px-3 py-2 bg-black/40 text-white ${fieldErrors[field] ? "border-red-500" : "border-white/15"
        }`;

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
            <form onSubmit={onSubmit} data-slot="card" className="auth-card w-full max-w-sm rounded-xl border border-white/10 bg-[#101321] p-6 space-y-3">
                <PlatformLogo mode="auth" isDark={true} />
                <h1 className="text-2xl font-bold">{verificationStep ? "Verify Email" : "Create Account"}</h1>

                {!verificationStep ? (
                    <>
                        <div>
                            <input
                                value={firstName}
                                onChange={(e) => { setFirstName(e.target.value); setFieldErrors((prev) => ({ ...prev, firstName: "" })); }}
                                placeholder="First name"
                                className={inputCls("firstName")}
                            />
                            {fieldErrors.firstName && <p className="mt-1 text-xs text-red-400">{fieldErrors.firstName}</p>}
                        </div>

                        <div>
                            <input
                                value={lastName}
                                onChange={(e) => { setLastName(e.target.value); setFieldErrors((prev) => ({ ...prev, lastName: "" })); }}
                                placeholder="Last name"
                                className={inputCls("lastName")}
                            />
                            {fieldErrors.lastName && <p className="mt-1 text-xs text-red-400">{fieldErrors.lastName}</p>}
                        </div>

                        <div>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); setFieldErrors((prev) => ({ ...prev, email: "" })); }}
                                placeholder="Email"
                                className={inputCls("email")}
                            />
                            {fieldErrors.email && <p className="mt-1 text-xs text-red-400">{fieldErrors.email}</p>}
                        </div>

                        <div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setFieldErrors((prev) => ({ ...prev, password: "" })); }}
                                placeholder="Password"
                                className={inputCls("password")}
                            />
                            {fieldErrors.password && <p className="mt-1 text-xs text-red-400">{fieldErrors.password}</p>}
                            {!fieldErrors.password && (
                                <p className="mt-1 text-[11px] text-gray-500">Min 6 chars · 1 uppercase · 1 lowercase · 1 number · 1 special char</p>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-100">
                            <p>We sent an activation code to:</p>
                            <p className="mt-1 font-medium text-cyan-300">{email}</p>
                        </div>
                        <div>
                            <div className="flex items-center justify-between gap-2">
                                {verificationDigits.map((digit, index) => (
                                    <input
                                        key={index}
                                        ref={(element) => {
                                            verificationInputRefs.current[index] = element;
                                        }}
                                        value={digit}
                                        onChange={(e) => updateVerificationDigit(index, e.target.value)}
                                        onKeyDown={(e) => handleVerificationKeyDown(index, e)}
                                        onPaste={handleVerificationPaste}
                                        inputMode="numeric"
                                        maxLength={1}
                                        readOnly={verificationInputsLocked}
                                        className={`h-12 w-12 rounded-lg border border-white/15 text-center text-lg font-semibold text-white outline-none transition ${verificationInputsLocked ? "cursor-not-allowed bg-white/10 text-cyan-200" : "bg-black/40 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"}`}
                                        aria-label={`Activation code digit ${index + 1}`}
                                    />
                                ))}
                            </div>
                            <p className="mt-1 text-[11px] text-gray-500">
                                {verificationInputsLocked
                                    ? "This code came from your email link and cannot be edited here."
                                    : "Enter the code from your email, then continue to login."}
                            </p>
                        </div>
                        <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-200">
                            <input
                                type="checkbox"
                                checked={verifyLaterChecked}
                                onChange={(e) => void handleVerifyLaterChange(e.target.checked)}
                                disabled={verifyLaterLoading || loading}
                                className="h-4 w-4 rounded border-white/30 bg-black/40 text-cyan-400 focus:ring-cyan-400"
                            />
                            <span>{verifyLaterLoading ? "Redirecting to login..." : "Verify Later"}</span>
                        </label>
                    </>
                )}

                {successMessage ? <div className="text-sm text-emerald-400">{successMessage}</div> : null}
                {error ? <div className="text-sm text-red-400">{error}</div> : null}

                <Button type="submit" className="w-full" disabled={loading}>
                    {verificationStep ? (loading ? "Verifying..." : "Verify Email") : (loading ? "Creating..." : "Register")}
                </Button>

                {verificationStep ? (
                    <div className="flex items-center justify-between gap-3 text-sm text-gray-400">
                        <button
                            type="button"
                            onClick={handleResendCode}
                            disabled={resendLoading}
                            className="text-cyan-400 disabled:opacity-50"
                        >
                            {resendLoading ? "Sending..." : "Resend Code"}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setVerificationStep(false);
                                setVerificationDigits(Array(VERIFICATION_CODE_LENGTH).fill(""));
                                setVerifyLaterChecked(false);
                                setVerificationInputsLocked(false);
                                setSuccessMessage("");
                                setError("");
                            }}
                            className="text-gray-400 hover:text-white"
                        >
                            Edit details
                        </button>
                    </div>
                ) : (
                    <div className="text-sm text-gray-400">
                        Have an account? <Link to="/login" className="text-cyan-400">Login</Link>
                    </div>
                )}
            </form>
        </div>
    );
}
