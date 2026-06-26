"use client";

import { ProtectedRoute } from "@/components/shared/protected-route";
import { useAuthStore } from "@/store/auth-store";

function SettingsContent() {
  const user = useAuthStore((s) => s.user);

  return (
    <div>
      <div className="mb-5 pb-4 border-b border-border">
        <h1 className="font-serif text-xl font-semibold text-foreground">Settings</h1>
        <p className="text-xs text-muted mt-0.5">Manage your account</p>
      </div>
      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-medium text-foreground mb-1">Username</h2>
          <p className="text-sm text-muted">{user?.username}</p>
        </div>
        <div>
          <h2 className="text-sm font-medium text-foreground mb-1">Account</h2>
          <p className="text-sm text-muted">Full settings coming in the next milestone.</p>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}
