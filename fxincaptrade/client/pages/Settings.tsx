import React, { useState } from "react";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Palette, ShieldCheck, Bell, Globe, Monitor, Sun, Moon } from "lucide-react";

type UiTheme = "dark" | "light";

/** Same toggle mechanism as the header's own theme switch (shared `ui_theme`
 *  key + `data-theme` attribute), so this stays in sync everywhere. */
function ThemeCard() {
  const [theme, setTheme] = useState<UiTheme>(() => {
    const saved = localStorage.getItem("ui_theme");
    if (saved === "dark" || saved === "light") return saved;
    return "dark";
  });

  const applyTheme = (next: UiTheme) => {
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("ui_theme", next);
    setTheme(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="h-4 w-4 text-cyan-300" />
          Appearance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-gray-400">Choose how the platform looks on this device.</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => applyTheme("dark")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${
              theme === "dark"
                ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
            }`}
          >
            <Moon className="h-4 w-4" />
            Dark
          </button>
          <button
            type="button"
            onClick={() => applyTheme("light")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${
              theme === "light"
                ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
            }`}
          >
            <Sun className="h-4 w-4" />
            Light
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function ToggleRow({ label, description, defaultChecked = false }: { label: string; description: string; defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => setChecked((v) => !v)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-cyan-500" : "bg-white/15"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <>
      <Header />
      <div className="w-full px-4 py-4 sm:px-6 lg:px-8 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-white">Settings</h1>
          <p className="mt-1 text-sm text-gray-400">Manage your account security, preferences, and platform behavior.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4 text-cyan-300" />
                Change Password
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-gray-400">Current Password</label>
                <Input type="password" placeholder="••••••••" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">New Password</label>
                <Input type="password" placeholder="••••••••" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Confirm New Password</label>
                <Input type="password" placeholder="••••••••" />
              </div>
              <Button type="button" className="mt-1 w-full">
                Update Password
              </Button>
            </CardContent>
          </Card>

          <ThemeCard />

          {/* Two-Factor Authentication */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-cyan-300" />
                Two-Factor Authentication
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-white/5">
              <ToggleRow label="Authenticator App" description="Use an app like Google Authenticator for login codes." />
              <ToggleRow label="Email OTP" description="Receive a one-time code by email on every login." />
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4 text-cyan-300" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-white/5">
              <ToggleRow label="Deposit Alerts" description="Email me when a deposit is approved." defaultChecked />
              <ToggleRow label="Withdrawal Alerts" description="Email me when a withdrawal is processed." defaultChecked />
              <ToggleRow label="Trade Alerts" description="Email me when a trade executes." defaultChecked />
              <ToggleRow label="Promotions" description="Receive news about offers and platform updates." />
            </CardContent>
          </Card>

          {/* Language & Region */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-4 w-4 text-cyan-300" />
                Language &amp; Region
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-gray-400">Language</label>
                <select className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20">
                  <option className="bg-gray-900">English</option>
                  <option className="bg-gray-900">Hindi</option>
                  <option className="bg-gray-900">Spanish</option>
                  <option className="bg-gray-900">Arabic</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Time Zone</label>
                <select className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20">
                  <option className="bg-gray-900">UTC</option>
                  <option className="bg-gray-900">GMT+5:30 (India)</option>
                  <option className="bg-gray-900">GMT+0 (London)</option>
                  <option className="bg-gray-900">GMT-5 (New York)</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Active Sessions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Monitor className="h-4 w-4 text-cyan-300" />
                Active Sessions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">This Device</p>
                  <p className="text-xs text-gray-500">Windows · Chrome · Current session</p>
                </div>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                  Active
                </span>
              </div>
              <Button type="button" variant="outline" className="w-full border-white/15 text-gray-200 hover:bg-white/10">
                Sign Out All Other Sessions
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
