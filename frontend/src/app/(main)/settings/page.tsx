"use client";

import { useState } from "react";
import { ProtectedRoute } from "@/components/shared/protected-route";
import { useAuthStore } from "@/store/auth-store";
import { useUpdateProfile, useUpdateEmail } from "@/hooks/use-user";
import { useMasterKey } from "@/hooks/use-master-key";
import { Avatar } from "@/components/shared/avatar";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useRouter } from "next/navigation";

function SettingsContent() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const router = useRouter();

  const updateProfile = useUpdateProfile();
  const updateEmail = useUpdateEmail();
  const { reEncryptMasterKey, isAvailable: hasMasterKey } = useMasterKey();

  const [about, setAbout] = useState(user?.about ?? "");
  const [quote, setQuote] = useState(user?.favorite_quote ?? "");
  const [feeling, setFeeling] = useState(user?.currently_feeling ?? "");
  const [theme, setTheme] = useState(user?.preferences?.theme ?? "system");
  const [emailInput, setEmailInput] = useState("");
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const hasProfileChanges =
    about !== (user?.about ?? "") ||
    quote !== (user?.favorite_quote ?? "") ||
    feeling !== (user?.currently_feeling ?? "");

  const handleSaveProfile = async () => {
    try {
      const updated = await updateProfile.mutateAsync({
        about: about || null,
        favorite_quote: quote || null,
        currently_feeling: feeling || null,
      });
      if (user) {
        setUser({ ...user, ...updated } as typeof user);
      }
    } catch {
      // error handled by mutation
    }
  };

  const handleSavePreferences = async () => {
    try {
      const updated = await updateProfile.mutateAsync({
        preferences: {
          ...user?.preferences,
          theme,
        },
      });
      if (user) {
        setUser({ ...user, ...updated } as typeof user);
      }
    } catch {
      // error handled by mutation
    }
    router.refresh();
  };

  const handleAddEmail = async () => {
    setEmailError(null);
    setEmailMessage(null);
    if (!emailInput.trim()) {
      setEmailError("Email is required");
      return;
    }
    try {
      const result = await updateEmail.mutateAsync(emailInput.trim());
      setEmailMessage(result.message);
      setEmailInput("");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update email";
      setEmailError(message);
    }
  };

  const handleRemoveEmail = async () => {
    setEmailError(null);
    setEmailMessage(null);
    try {
      const result = await updateEmail.mutateAsync(null);
      setEmailMessage(result.message);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to remove email";
      setEmailError(message);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordMessage(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordError("Password must contain at least one letter and one digit");
      return;
    }

    try {
      const { apiClient } = await import("@/lib/api/client");
      const payload: Record<string, string> = {
        current_password: currentPassword,
        new_password: newPassword,
      };

      if (hasMasterKey && currentPassword) {
        const reEncrypted = await reEncryptMasterKey(currentPassword, newPassword);
        if (reEncrypted) {
          payload.new_encrypted_master_key = reEncrypted.newEncryptedMasterKey;
          payload.new_master_key_salt = reEncrypted.newMasterKeySalt;
        }
      }

      await apiClient.put("/auth/change-password", payload);
      setPasswordMessage("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      setPasswordError(
        error?.response?.data?.error?.message ?? "Failed to change password",
      );
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8 pb-4 border-b border-border">
        <h1 className="font-serif text-xl font-semibold text-foreground">
          Settings
        </h1>
        <p className="text-xs text-muted mt-0.5">Manage your account</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="w-full justify-start mb-6">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div className="flex items-center gap-4">
                <Avatar
                  src={user.avatar_path}
                  alt={user.username}
                  size="lg"
                />
                <div>
                  <p className="text-sm text-muted">
                    Avatar upload will be available in a future update.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  About
                </label>
                <textarea
                  className="w-full min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                  maxLength={500}
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder="Tell us about yourself..."
                />
                <p className="text-xs text-muted mt-1">{about.length}/500</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Favorite Quote
                </label>
                <Input
                  maxLength={300}
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  placeholder="A quote that inspires you..."
                />
                <p className="text-xs text-muted mt-1">{quote.length}/300</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Currently Feeling
                </label>
                <Input
                  maxLength={50}
                  value={feeling}
                  onChange={(e) => setFeeling(e.target.value)}
                  placeholder="e.g. hopeful, reflective, grateful..."
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                {updateProfile.isError && (
                  <p className="text-xs text-destructive">
                    Failed to save profile changes.
                  </p>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveProfile}
                  disabled={!hasProfileChanges || updateProfile.isPending}
                >
                  {updateProfile.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account">
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Username
                </label>
                <p className="text-sm text-muted">{user.username}</p>
                <p className="text-xs text-muted mt-0.5">
                  Username cannot be changed.
                </p>
              </div>

              <div className="pt-2 border-t border-border">
                <label className="block text-sm font-medium text-foreground mb-1">
                  Email
                </label>
                <p className="text-sm text-muted mb-2">
                  {user.has_email
                    ? user.email_verified
                      ? "Email is set and verified."
                      : "Email is set but not verified."
                    : "No email set. Adding an email enables password recovery."}
                </p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="you@example.com"
                    className="flex-1"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleAddEmail}
                    disabled={updateEmail.isPending}
                  >
                    {updateEmail.isPending ? "..." : "Set"}
                  </Button>
                  {user.has_email && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleRemoveEmail}
                      disabled={updateEmail.isPending}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                {emailMessage && (
                  <p className="text-xs text-success mt-1">{emailMessage}</p>
                )}
                {emailError && (
                  <p className="text-xs text-destructive mt-1">{emailError}</p>
                )}
              </div>

              <div className="pt-2 border-t border-border">
                <label className="block text-sm font-medium text-foreground mb-1">
                  Change Password
                </label>
                <div className="space-y-3">
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                  />
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (8+ chars, letters + digits)"
                  />
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleChangePassword}
                    disabled={
                      !currentPassword || !newPassword || !confirmPassword
                    }
                  >
                    Change Password
                  </Button>
                  {passwordMessage && (
                    <p className="text-xs text-success">{passwordMessage}</p>
                  )}
                  {passwordError && (
                    <p className="text-xs text-destructive">
                      {passwordError}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <h3 className="text-sm font-medium text-destructive mb-1">
                  Danger Zone
                </h3>
                <p className="text-xs text-muted mb-2">
                  Account deletion will be available in a future milestone.
                  Once available, this action will permanently delete your
                  diaries, comments, and all associated data.
                </p>
                {!showDeleteDialog ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled
                    title="Account deletion coming in a future milestone"
                  >
                    Delete Account
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-destructive font-medium">
                      Type your username to confirm:
                    </p>
                    <Input
                      value={deleteConfirm}
                      onChange={(e) => setDeleteConfirm(e.target.value)}
                      placeholder={user.username}
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleteConfirm !== user.username}
                    >
                      Permanently Delete
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Theme
                </label>
                <div className="flex gap-2">
                  {["system", "light", "dark"].map((t) => (
                    <Button
                      key={t}
                      variant={theme === t ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => setTheme(t)}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <h3 className="text-sm font-medium text-foreground mb-2">
                  Notifications
                </h3>
                <p className="text-xs text-muted mb-3">
                  Notification preferences will be fully customizable in a
                  future milestone.
                </p>
                <div className="space-y-2">
                  {[
                    { key: "notify_on_like", label: "Likes" },
                    { key: "notify_on_comment", label: "Comments" },
                    { key: "notify_on_follow", label: "New followers" },
                    { key: "notify_on_bookmark", label: "Bookmarks" },
                  ].map(({ key, label }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-sm text-foreground">{label}</span>
                      <span className="text-xs text-muted">Coming soon</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-border">
                <Button variant="primary" size="sm" onClick={handleSavePreferences}>
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
