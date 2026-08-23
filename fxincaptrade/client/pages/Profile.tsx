import React, { useEffect, useState } from "react";
import Header from "@/components/Header";
import { apiUrl } from "@/lib/api";

interface UserProfile {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  createdAt: string;
}
interface AccountProfile {
  kycStatus: string;
  accountType: string;
  leverage: number;
}

interface KycDocument {
  id: string;
  type: string;
  status: string;
  documentUrl: string | null;
  documentNumber: string | null;
  uploadedAt: string | null;
}

const KYC_DOCUMENT_TYPES: { type: string; label: string }[] = [
  { type: "aadhaar", label: "Aadhaar Card" },
  { type: "panCard", label: "PAN Card" },
  { type: "passport", label: "Passport" },
  { type: "bankPassbook", label: "Bank Passbook" },
];

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "" });
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const [kycDocs, setKycDocs] = useState<KycDocument[]>([]);
  const [kycMessage, setKycMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [submittingKyc, setSubmittingKyc] = useState(false);

  const fetchProfile = () => {
    const token = localStorage.getItem("auth_token");
    fetch(apiUrl("/api/user/profile"), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          setForm({ firstName: data.user.firstName || "", lastName: data.user.lastName || "", phone: data.user.phone || "" });
        }
        if (data.profile) setProfile(data.profile);
      })
      .catch(() => { });
  };

  const fetchKyc = () => {
    const token = localStorage.getItem("auth_token");
    fetch(apiUrl("/api/user/kyc"), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.kyc?.documents)) {
          setKycDocs(data.kyc.documents);
        }
      })
      .catch(() => { });
  };

  useEffect(() => { fetchProfile(); fetchKyc(); }, []);

  const docFor = (type: string) => kycDocs.find((d) => d.type === type) || null;

  const handleKycFileChange = async (type: string, file: File | null) => {
    if (!file) return;
    setUploadingType(type);
    setKycMessage(null);
    const token = localStorage.getItem("auth_token");
    try {
      const body = new FormData();
      body.append("document", file);
      body.append("documentType", type);
      const res = await fetch(apiUrl("/api/user/kyc/upload"), {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setKycMessage({ text: "Document uploaded", ok: true });
        fetchKyc();
      } else {
        setKycMessage({ text: data.error || "Upload failed", ok: false });
      }
    } catch {
      setKycMessage({ text: "Network error during upload", ok: false });
    } finally {
      setUploadingType(null);
    }
  };

  const submitKyc = async () => {
    setSubmittingKyc(true);
    setKycMessage(null);
    const token = localStorage.getItem("auth_token");
    try {
      const res = await fetch(apiUrl("/api/user/kyc/submit"), {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setKycMessage({ text: "KYC submitted for admin review", ok: true });
        fetchProfile();
      } else {
        setKycMessage({ text: data.error || "Submission failed", ok: false });
      }
    } catch {
      setKycMessage({ text: "Network error", ok: false });
    } finally {
      setSubmittingKyc(false);
    }
  };

  const allKycUploaded = KYC_DOCUMENT_TYPES.every((d) => !!docFor(d.type)?.documentUrl);
  const kycStatusColors: Record<string, string> = {
    approved: "text-green-400 bg-green-500/20",
    pending: "text-yellow-400 bg-yellow-500/20",
    rejected: "text-red-400 bg-red-500/20",
  };

  const saveProfile = async () => {
    setSaving(true);
    setMessage(null);
    const token = localStorage.getItem("auth_token");
    try {
      const res = await fetch(apiUrl("/api/user/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ text: "Profile updated successfully", ok: true });
        setEditMode(false);
        fetchProfile();
      } else {
        setMessage({ text: data.message || "Update failed", ok: false });
      }
    } catch {
      setMessage({ text: "Network error", ok: false });
    } finally {
      setSaving(false);
    }
  };

  const kycColors: Record<string, string> = {
    verified: "text-green-400 bg-green-500/20",
    pending: "text-yellow-400 bg-yellow-500/20",
    pending_review: "text-blue-400 bg-blue-500/20",
    rejected: "text-red-400 bg-red-500/20",
  };

  return (
    <>
      <Header />
      <div className="p-4 max-w-lg mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-red-800 flex items-center justify-center text-2xl font-bold text-white">
            {user?.firstName?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              {user ? `${user.firstName} ${user.lastName}` : "Loading..."}
            </h1>
            <p className="text-sm text-gray-400">{user?.email}</p>
          </div>
        </div>

        {profile && (
          <div className="flex gap-3 mb-5">
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${kycColors[profile.kycStatus] || "text-gray-400 bg-white/10"
              }`}>
              KYC: {profile.kycStatus?.replace("_", " ").toUpperCase()}
            </span>
            <span className="text-xs px-3 py-1 rounded-full bg-white/10 text-gray-300">
              {profile.accountType?.toUpperCase()}
            </span>
            <span className="text-xs px-3 py-1 rounded-full bg-white/10 text-gray-300">
              1:{profile.leverage}
            </span>
          </div>
        )}

        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${message.ok ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
            }`}>{message.text}</div>
        )}

        <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
          {editMode ? (
            <>
              <div>
                <label className="block text-xs text-gray-400 mb-1">First Name</label>
                <input
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Last Name</label>
                <input
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-red-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={() => { setEditMode(false); setMessage(null); }}
                  className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              {[{ label: "Email", value: user?.email }, { label: "Phone", value: user?.phone || "—" }, { label: "Member Since", value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—" }].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className="text-sm text-white">{value}</span>
                </div>
              ))}
              <button
                onClick={() => setEditMode(true)}
                className="w-full py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-sm font-medium transition"
              >
                Edit Profile
              </button>
            </>
          )}
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4 mt-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">KYC Verification</h2>
            {profile && (
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${kycStatusColors[profile.kycStatus] || "text-gray-400 bg-white/10"}`}>
                {profile.kycStatus?.replace("_", " ").toUpperCase()}
              </span>
            )}
          </div>

          {kycMessage && (
            <div className={`p-3 rounded-lg text-sm ${kycMessage.ok ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
              {kycMessage.text}
            </div>
          )}

          <div className="space-y-3">
            {KYC_DOCUMENT_TYPES.map(({ type, label }) => {
              const doc = docFor(type);
              const status = doc?.status;
              return (
                <div key={type} className="flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-lg p-3">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{label}</p>
                    {status ? (
                      <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${kycStatusColors[status] || "text-gray-400 bg-white/10"}`}>
                        {status.toUpperCase()}
                      </span>
                    ) : (
                      <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium text-gray-400 bg-white/10">
                        NOT UPLOADED
                      </span>
                    )}
                  </div>
                  <label className="shrink-0 cursor-pointer px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-medium transition disabled:opacity-50">
                    {uploadingType === type ? "Uploading..." : doc?.documentUrl ? "Re-upload" : "Upload"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      disabled={uploadingType === type || status === "approved"}
                      onChange={(e) => handleKycFileChange(type, e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              );
            })}
          </div>

          <button
            onClick={submitKyc}
            disabled={!allKycUploaded || submittingKyc}
            className="w-full py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submittingKyc ? "Submitting..." : "Submit for Review"}
          </button>
          {!allKycUploaded && (
            <p className="text-xs text-gray-500 text-center">Upload all 4 documents to submit for review.</p>
          )}
        </div>
      </div>
    </>
  );
}
