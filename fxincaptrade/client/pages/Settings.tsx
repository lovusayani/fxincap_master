import React from "react";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Settings is intentionally empty for now.
 *
 * Everything that used to live here — trading accounts, opening a new account,
 * KYC and profile links — moved to the dedicated Accounts page (`/accounts`,
 * "My Accounts" in the nav).
 */
export default function SettingsPage() {
  return (
    <>
      <Header />
      <div className="w-full px-4 py-4 sm:px-6 lg:px-8 space-y-4">
        <h1 className="text-xl font-bold text-white mb-2">Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-400">
              Nothing here yet. Your trading accounts moved to{" "}
              <span className="font-medium text-gray-200">My Accounts</span>.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
