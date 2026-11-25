"use client";

import { useDocumentTitle } from "@/lib/use-document-title";
import { useState, useEffect, useMemo } from "react";
import Slider from "@/components/ui/Slider";
import { Input } from "@/components/ui/Input";
import {
  Check,
  Copy,
  KeyRound,
  LogOut,
  Trash2,
  UserRound,
  Monitor,
  Moon,
  Sun,
  Target,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useUser } from "@/components/providers/UserProvider";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import AccentPicker from "@/components/ui/AccentPicker";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Select from "@/components/ui/Select";
import Label from "@/components/ui/Label";
import Modal from "@/components/ui/Modal";
import ModalFooter from "@/components/ui/ModalFooter";
import PageHeader from "@/components/ui/PageHeader";
import { SettingsPageSkeleton } from "@/components/ui/StateViews";
import { ApiError, apiPost, getErrorMessage, resetLocalData } from "@/lib/api";
import { clearOfflineCaches } from "@/lib/offline-cache";
import { normalizeUser } from "@/lib/user";
import toast from "react-hot-toast";
import { pickCtcMotivation } from "@/lib/inspiration";
import type { PreparationLevel, ThemePreference } from "@/types";

const LEVEL_OPTIONS: { value: PreparationLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

type ProfileField = "name" | "email" | "preparationLevel" | "targetCompany" | "targetRole" | "dailyQuestionGoal";

/** The API returns one message; attribute it to the field it is about so it can show under that field. */
function fieldForError(message: string): ProfileField | null {
  const m = message.toLowerCase();
  if (m.includes("email")) return "email";
  if (m.includes("question goal")) return "dailyQuestionGoal";
  if (m.includes("preparation level")) return "preparationLevel";
  if (m.includes("company")) return "targetCompany";
  if (m.includes("role")) return "targetRole";
  if (m.includes("name")) return "name";
  return null;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-xs text-[var(--danger)]">
      {message}
    </p>
  );
}

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function SettingsGroup({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Icon className="h-4 w-4" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
            {description && (
              <p className="mt-0.5 text-xs text-[var(--muted)]">{description}</p>
            )}
          </div>
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </Card>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold capitalize text-[var(--foreground)]">{value}</p>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading, updateUser, logout, setUser } = useUser();
  useDocumentTitle("Settings");
  const confirm = useConfirm();
  const { theme, setTheme } = useTheme();
  const profile = user ? normalizeUser(user) : null;
  const [dailyMinutes, setDailyMinutes] = useState(profile?.dailyStudyMinutes ?? 120);
  const [targetCtc, setTargetCtc] = useState(profile?.targetCtcLpa ?? 0);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Profile form (saved on its own, separate from the sticky "Save" bar below).
  const [pName, setPName] = useState(profile?.name ?? "");
  const [pEmail, setPEmail] = useState(profile?.email ?? "");
  const [pLevel, setPLevel] = useState<PreparationLevel>(profile?.preparationLevel ?? "intermediate");
  const [pCompany, setPCompany] = useState(profile?.targetCompany ?? "");
  const [pRole, setPRole] = useState(profile?.targetRole ?? "");
  const [pGoal, setPGoal] = useState(profile?.dailyQuestionGoal ?? 3);
  const [profileErrors, setProfileErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [profileSaving, setProfileSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const p = normalizeUser(user);
    setDailyMinutes(p.dailyStudyMinutes);
    setTargetCtc(p.targetCtcLpa ?? 0);
    setPName(p.name);
    setPEmail(p.email ?? "");
    setPLevel(p.preparationLevel);
    setPCompany(p.targetCompany ?? "");
    setPRole(p.targetRole ?? "");
    setPGoal(p.dailyQuestionGoal);
  }, [user]);

  const isGuest = Boolean(user?.isGuest);
  const profileDirty =
    !!profile &&
    (pName.trim() !== profile.name ||
      pEmail.trim() !== (profile.email ?? "") ||
      pLevel !== profile.preparationLevel ||
      pCompany.trim() !== (profile.targetCompany ?? "") ||
      pRole.trim() !== (profile.targetRole ?? "") ||
      pGoal !== profile.dailyQuestionGoal);
  const deleteExpected = user?.username ?? "DELETE";
  const deleteMatches = deleteInput.trim() === deleteExpected;

  const ctcPreview = useMemo(
    () => (targetCtc > 0 ? pickCtcMotivation(targetCtc) : null),
    [targetCtc]
  );

  const savedCtc = profile?.targetCtcLpa ?? 0;
  const currentCtc = targetCtc > 0 ? targetCtc : 0;

  const isDirty = useMemo(() => {
    if (!profile) return false;
    return (
      dailyMinutes !== profile.dailyStudyMinutes ||
      theme !== profile.theme ||
      currentCtc !== savedCtc
    );
  }, [profile, dailyMinutes, theme, currentCtc, savedCtc]);

  const displayCode = newCode ?? null;
  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const saveSettings = async () => {
    setSaving(true);
    try {
      await updateUser({
        dailyStudyMinutes: dailyMinutes,
        theme,
        targetCtcLpa: targetCtc > 0 ? targetCtc : undefined,
      });
      setTheme(theme);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  };

  const regenerateCode = async () => {
    setRegenerating(true);
    try {
      const result = await apiPost<{ authCode: string }>("/api/auth/regenerate-code");
      setNewCode(result.authCode);
      toast.success("New login code generated");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to regenerate code"));
    } finally {
      setRegenerating(false);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest || !profile) return;
    const errors: Partial<Record<ProfileField, string>> = {};
    if (!pName.trim()) errors.name = "Name is required";
    else if (pName.trim().length > 60) errors.name = "Name must be 60 characters or fewer";
    const goal = Math.round(Number(pGoal));
    if (!Number.isFinite(goal) || goal < 1 || goal > 50) errors.dailyQuestionGoal = "Enter a number from 1 to 50";
    if (Object.keys(errors).length) {
      setProfileErrors(errors);
      toast.error("Please fix the highlighted fields");
      return;
    }
    setProfileErrors({});
    setProfileSaving(true);
    try {
      await updateUser({
        name: pName.trim(),
        email: pEmail.trim(),
        preparationLevel: pLevel,
        targetCompany: pCompany.trim(),
        targetRole: pRole.trim(),
        dailyQuestionGoal: goal,
      });
      toast.success("Profile saved");
    } catch (err) {
      const message = getErrorMessage(err, "Failed to save profile");
      const field = err instanceof ApiError ? fieldForError(message) : null;
      if (field) setProfileErrors({ [field]: message });
      toast.error(message);
    } finally {
      setProfileSaving(false);
    }
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeleteOpen(false);
    setDeleteInput("");
  };

  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest || !user || !deleteMatches || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${user._id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user.username ? { username: deleteInput.trim() } : { confirm: "DELETE" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.success === false) {
        throw new Error(body.error || `Deleting failed with status ${res.status}`);
      }
      await clearOfflineCaches();
      await resetLocalData();
      try {
        localStorage.removeItem("growthhub-user");
      } catch {
        /* storage unavailable */
      }
      toast.success("Your account was deleted");
      setUser(null);
      router.push("/login");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete account"));
      setDeleting(false);
    }
  };

  const copyCode = () => {
    if (!displayCode) return;
    navigator.clipboard.writeText(displayCode);
    toast.success("Code copied");
  };

  const revertSettings = () => {
    if (!profile) return;
    setDailyMinutes(profile.dailyStudyMinutes);
    setTargetCtc(profile.targetCtcLpa ?? 0);
    setTheme(profile.theme);
  };

  const handleLogout = async () => {
    if (isDirty) {
      const ok = await confirm({
        title: "Unsaved changes",
        message: "You have unsaved changes. Sign out without saving?",
        confirmLabel: "Sign out",
        variant: "default",
      });
      if (!ok) return;
    }
    if (!(await logout())) return;
    router.push("/login");
  };

  if (loading || !user || !profile) {
    return <SettingsPageSkeleton />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-8">
      <PageHeader
        title="Settings"
        description="Manage your account, goals, and how the app looks."
      />

      <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/8 via-transparent to-transparent"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand text-lg font-bold text-white">
              {initials || "?"}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold text-[var(--foreground)]">{user.name}</p>
              <p className="text-sm text-[var(--muted)]">@{user.username}</p>
              {user.isGuest && (
                <Chip variant="warning" className="mt-2 !px-2 !py-0.5 !text-xs">
                  Demo account
                </Chip>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button href={`/users/${user._id}`} variant="outline" size="sm">View profile</Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-[var(--muted)] hover:text-[var(--danger)]"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Sign out
            </Button>
          </div>
        </div>

        <div className="relative mt-4 grid grid-cols-3 gap-2">
          <StatPill label="Level" value={profile.preparationLevel} />
          <StatPill label="Streak" value={`${profile.studyStreak} days`} />
          <StatPill
            label="Daily goal"
            value={`${Math.floor(dailyMinutes / 60)}h ${dailyMinutes % 60}m`}
          />
        </div>
      </div>

      <SettingsGroup
        icon={UserRound}
        title="Profile"
        description="Your name and what you are preparing for."
      >
        {isGuest && (
          <p className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--muted)]">
            This is the shared demo account — create your own account to edit your profile.
          </p>
        )}
        <form onSubmit={saveProfile} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={pName}
              onChange={(e) => setPName(e.target.value)}
              disabled={isGuest}
              maxLength={60}
              autoComplete="name"
              aria-invalid={Boolean(profileErrors.name)}
              aria-describedby={profileErrors.name ? "profile-name-error" : undefined}
            />
            <FieldError id="profile-name-error" message={profileErrors.name} />
          </div>
          <div>
            <Label htmlFor="profile-email">Email (optional)</Label>
            <Input
              id="profile-email"
              type="email"
              value={pEmail}
              onChange={(e) => setPEmail(e.target.value)}
              disabled={isGuest}
              maxLength={120}
              autoComplete="email"
              aria-invalid={Boolean(profileErrors.email)}
              aria-describedby={profileErrors.email ? "profile-email-error" : undefined}
            />
            <FieldError id="profile-email-error" message={profileErrors.email} />
          </div>
          <div>
            <Label htmlFor="profile-level">Preparation level</Label>
            <Select
              id="profile-level"
              value={pLevel}
              onChange={(v) => setPLevel(v as PreparationLevel)}
              options={LEVEL_OPTIONS}
              disabled={isGuest}
              aria-label="Preparation level"
            />
            <FieldError id="profile-level-error" message={profileErrors.preparationLevel} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="profile-company">Target company</Label>
              <Input
                id="profile-company"
                value={pCompany}
                onChange={(e) => setPCompany(e.target.value)}
                disabled={isGuest}
                maxLength={120}
                placeholder="e.g. Acme Corp"
                aria-invalid={Boolean(profileErrors.targetCompany)}
                aria-describedby={profileErrors.targetCompany ? "profile-company-error" : undefined}
              />
              <FieldError id="profile-company-error" message={profileErrors.targetCompany} />
            </div>
            <div>
              <Label htmlFor="profile-role">Target role</Label>
              <Input
                id="profile-role"
                value={pRole}
                onChange={(e) => setPRole(e.target.value)}
                disabled={isGuest}
                maxLength={120}
                placeholder="e.g. Backend Engineer"
                aria-invalid={Boolean(profileErrors.targetRole)}
                aria-describedby={profileErrors.targetRole ? "profile-role-error" : undefined}
              />
              <FieldError id="profile-role-error" message={profileErrors.targetRole} />
            </div>
          </div>
          <div>
            <Label htmlFor="profile-goal">Daily question goal (1-50)</Label>
            <Input
              id="profile-goal"
              type="number"
              min={1}
              max={50}
              step={1}
              value={Number.isFinite(pGoal) ? pGoal : ""}
              onChange={(e) => setPGoal(e.target.value === "" ? NaN : Number(e.target.value))}
              disabled={isGuest}
              className="sm:!w-32"
              aria-invalid={Boolean(profileErrors.dailyQuestionGoal)}
              aria-describedby={profileErrors.dailyQuestionGoal ? "profile-goal-error" : undefined}
            />
            <FieldError id="profile-goal-error" message={profileErrors.dailyQuestionGoal} />
          </div>
          {!isGuest && (
            <div className="flex justify-end">
              <Button type="submit" size="sm" loading={profileSaving} disabled={!profileDirty}>
                {profileSaving ? "Saving…" : "Save profile"}
              </Button>
            </div>
          )}
        </form>
      </SettingsGroup>

      <SettingsGroup
        icon={KeyRound}
        title="Sign in"
        description="Your 6-digit code for passwordless login on other devices."
      >
        {displayCode ? (
          <div className="rounded-xl border border-brand/30 bg-brand/5 p-4">
            <p className="text-center font-mono text-2xl font-bold tracking-[0.25em] text-brand">
              {displayCode}
            </p>
            <p className="mt-2 text-center text-xs text-[var(--muted)]">
              Save this somewhere safe — your previous code no longer works.
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={copyCode}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy
              </Button>
              <Button variant="ghost" size="sm" onClick={regenerateCode} loading={regenerating}>
                {regenerating ? "Generating…" : "New code"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted)]">
              Generate a fresh code if you need to sign in elsewhere or lost yours.
            </p>
            <Button variant="outline" size="sm" onClick={regenerateCode} loading={regenerating}>
              {regenerating ? "Generating…" : "Generate login code"}
            </Button>
          </div>
        )}
      </SettingsGroup>

      <SettingsGroup
        icon={Monitor}
        title="Appearance"
        description="Choose how the interface looks on this device."
      >
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((t) => {
            const Icon = t.icon;
            const active = theme === t.value;
            return (
              <button
                key={t.value}
                type="button"
                aria-pressed={active}
                onClick={() => setTheme(t.value)}
                className={clsx(
                  "flex flex-col items-center gap-2 rounded-xl border px-3 py-3 text-xs font-medium transition-colors",
                  active
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--input-border)] hover:text-[var(--foreground)]"
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
                {t.label}
              </button>
            );
          })}
        </div>
        <AccentPicker />
      </SettingsGroup>

      <SettingsGroup
        icon={Timer}
        title="Study goal"
        description="How much time you aim to put in each day."
      >
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-3xl font-bold tabular-nums text-brand">
              {Math.floor(dailyMinutes / 60)}
              <span className="text-lg font-semibold">h</span>
              {" "}
              {dailyMinutes % 60}
              <span className="text-lg font-semibold">m</span>
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">per day</p>
          </div>
          <div className="flex gap-1.5">
            {[60, 120, 180, 240].map((m) => (
              <Chip
                key={m}
                variant="brand"
                active={dailyMinutes === m}
                onClick={() => setDailyMinutes(m)}
                className="!rounded-lg font-medium"
              >
                {m / 60}h
              </Chip>
            ))}
          </div>
        </div>
        <Slider
          min={30}
          max={480}
          step={15}
          value={dailyMinutes}
          onChange={setDailyMinutes}
          aria-label="Daily study minutes"
          className="mt-4"
        />
        <div className="mt-1 flex justify-between text-xs text-[var(--muted)]">
          <span>30m</span>
          <span>8h</span>
        </div>
      </SettingsGroup>

      <SettingsGroup
        icon={Target}
        title="Salary target"
        description="Optional — powers CTC-themed motivation on your dashboard."
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2">
            <Input
              type="number"
              min={0}
              max={200}
              step={0.5}
              value={targetCtc || ""}
              onChange={(e) => setTargetCtc(Number(e.target.value))}
              placeholder="25"
              aria-label="Target CTC in LPA"
              className="!w-16 !border-0 !bg-transparent !p-0 text-lg font-semibold !shadow-none"
            />
            <span className="text-sm font-medium text-[var(--muted)]">LPA</span>
          </div>
          {targetCtc > 0 && (
            <p className="text-sm text-[var(--muted)]">
              ≈ ₹{Math.round((targetCtc * 100000) / 12 / 1000)}K/mo
            </p>
          )}
        </div>
        {ctcPreview && (
          <blockquote className="mt-4 rounded-xl border-l-4 border-brand bg-[var(--surface-muted)] px-4 py-3 text-sm italic leading-relaxed text-[var(--foreground)]">
            {ctcPreview.text}
          </blockquote>
        )}
      </SettingsGroup>

      {!isGuest && (
        <>
          <section
            aria-labelledby="danger-zone-title"
            className="rounded-xl border border-danger/40 bg-danger/5 p-5"
          >
            <h2 id="danger-zone-title" className="text-sm font-semibold text-[var(--danger)]">
              Danger zone
            </h2>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[var(--muted)]">
                Permanently delete your account and personal data. If you own a group with other members,
                transfer ownership first. This cannot be undone.
              </p>
              <Button type="button" variant="dangerOutline" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Delete account
              </Button>
            </div>
          </section>

          <Modal open={deleteOpen} onClose={closeDelete} title="Delete account" size="sm">
            <form onSubmit={deleteAccount} className="space-y-4">
              <p className="text-sm text-[var(--muted)]">
                This permanently deletes your profile, progress, personal tracks and questions, mock interview
                results and notes. Groups you are the only member of are deleted too.
              </p>
              <div>
                <Label htmlFor="delete-confirm">
                  {user.username ? `Type your username (${user.username}) to confirm` : "Type DELETE to confirm"}
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={deleting}
                  autoFocus
                />
              </div>
              <ModalFooter className="!mt-4" onCancel={closeDelete} cancelDisabled={deleting}>
                <Button type="submit" variant="danger" disabled={!deleteMatches} loading={deleting}>
                  {deleting ? "Deleting…" : "Delete my account"}
                </Button>
              </ModalFooter>
            </form>
          </Modal>
        </>
      )}

      {!isDirty ? (
        <p className="flex items-center justify-center gap-1.5 text-xs text-[var(--muted)] sm:justify-start">
          <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
          Settings synced with your account
        </p>
      ) : (
        <div
          className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-xl border border-brand/25 bg-[var(--card)]/95 p-3 shadow-panel backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between"
          role="status"
          aria-live="polite"
        >
          <div className="min-w-0 text-sm">
            <p className="font-medium text-[var(--foreground)]">Unsaved changes</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Theme previews instantly — save to keep goals and appearance on your account.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" size="sm" onClick={revertSettings} disabled={saving}>
              Revert
            </Button>
            <Button size="sm" onClick={saveSettings} loading={saving} className="min-w-[6.5rem]">
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
