"use client";

import { useDocumentTitle } from "@/lib/use-document-title";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Check, Copy, KeyRound, Shield, Sparkles, Zap } from "lucide-react";
import Checkbox from "@/components/ui/Checkbox";
import Label from "@/components/ui/Label";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormField from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import AppLogo from "@/components/ui/AppLogo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { apiPost, getErrorMessage } from "@/lib/api";
import { getCareerFlowAppUrl, googleLoginUrl } from "@/lib/apps-client";
import { useUser } from "@/components/providers/UserProvider";
import toast from "react-hot-toast";
import { getHomePath } from "@/lib/home";
import type { User } from "@/types";

type AuthTab = "signin" | "signup";

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AuthTabs({
  tab,
  onChange,
}: {
  tab: AuthTab;
  onChange: (tab: AuthTab) => void;
}) {
  const tabs: { id: AuthTab; label: string }[] = [
    { id: "signin", label: "Sign in" },
    { id: "signup", label: "Sign up" },
  ];

  return (
    <div className="mb-3 flex rounded-lg bg-[var(--surface-muted)] p-1">
      {tabs.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={tab === item.id}
          onClick={() => onChange(item.id)}
          className={clsx(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
            tab === item.id
              ? "bg-[var(--card)] text-[var(--foreground)] shadow-soft"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function AuthDivider({ label }: { label: string }) {
  return (
    <div className="relative my-3">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-[var(--border)]" />
      </div>
      <div className="relative flex justify-center text-[10px] uppercase tracking-wide">
        <span className="bg-[var(--card)] px-2 text-[var(--muted)]">{label}</span>
      </div>
    </div>
  );
}

function LabeledField({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

/** Shown once after sign-up or a recovery: the plaintext recovery key, which is never shown again. */
function RecoveryKeyStep({
  recoveryKey,
  title,
  onDone,
}: {
  recoveryKey: string;
  title: string;
  onDone: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
      toast.success("Recovery key copied");
    } catch {
      toast.error("Could not copy. Select the key and copy it manually.");
    }
  };

  return (
    <Card padded={false} className="animate-scale-in p-4 sm:p-5">
      <div className="mb-3 text-center">
        <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <KeyRound className="h-4 w-4" aria-hidden />
        </div>
        <h2 className="text-lg font-bold text-[var(--foreground)]">{title}</h2>
        <p className="mt-1 text-xs text-[var(--muted)] sm:text-sm">
          If you ever forget your 6-digit code, this key is the only way back into your account. It can
          not be shown again, so keep it somewhere safe, such as a password manager.
        </p>
      </div>
      <div className="rounded-xl border border-brand/30 bg-brand/5 p-4 text-center">
        <p className="select-all break-all font-mono text-xl font-bold tracking-[0.15em] text-brand">
          {recoveryKey}
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={copy}>
          {copied ? <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden /> : <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
          {copied ? "Copied" : "Copy key"}
        </Button>
      </div>
      <div className="mt-4 flex items-start gap-2.5">
        <Checkbox
          checked={saved}
          onChange={() => setSaved((v) => !v)}
          aria-label="I have saved my recovery key"
          className="mt-0.5"
        />
        <span className="cursor-pointer text-sm text-[var(--foreground)]" onClick={() => setSaved((v) => !v)}>
          I&apos;ve saved my recovery key
        </span>
      </div>
      <Button type="button" className="mt-4 w-full" disabled={!saved} onClick={onDone}>
        Continue
      </Button>
    </Card>
  );
}

function LoginPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useUser();
  const [tab, setTab] = useState<AuthTab>(() =>
    searchParams.get("tab") === "signup" ? "signup" : "signin"
  );
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [recoveryKeyInput, setRecoveryKeyInput] = useState("");
  const [newCode, setNewCode] = useState("");
  const [recoverLoading, setRecoverLoading] = useState(false);
  const [pendingKey, setPendingKey] = useState<{ key: string; user: User; title: string } | null>(null);

  const authError = searchParams.get("error");

  const handleGoogleLogin = () => {
    setGoogleLoading(true);
    window.location.href = googleLoginUrl();
  };

  const handleGuestLogin = async () => {
    setGuestLoading(true);
    try {
      const result = await apiPost<{ user: User }>("/api/auth/guest", {});
      setUser(result.user);
      toast.success("Welcome to the demo!");
      router.push(getHomePath(result.user));
    } catch (err) {
      toast.error(getErrorMessage(err, "Demo login failed"));
    } finally {
      setGuestLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await apiPost<{ user: User }>("/api/auth/login", {
        username,
        code,
      });
      setUser(result.user);
      toast.success(`Welcome back, ${result.user.name}!`);
      router.push(getHomePath(result.user));
    } catch (err) {
      toast.error(getErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterLoading(true);
    try {
      const result = await apiPost<{ user: User; recoveryKey: string }>("/api/auth/register", {
        username,
        name,
        code,
      });
      toast.success("Account created! Now save your recovery key.");
      // The user is only put in app state after the key step, so the app does not navigate away early.
      setPendingKey({ key: result.recoveryKey, user: result.user, title: "Save your recovery key" });
    } catch (err) {
      toast.error(getErrorMessage(err, "Registration failed"));
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoverLoading(true);
    try {
      const result = await apiPost<{ user: User; recoveryKey: string }>("/api/auth/recover", {
        username,
        recoveryKey: recoveryKeyInput,
        newCode,
      });
      toast.success("Your code was reset. Save your new recovery key.");
      setPendingKey({ key: result.recoveryKey, user: result.user, title: "Save your new recovery key" });
    } catch (err) {
      toast.error(getErrorMessage(err, "Recovery failed"));
    } finally {
      setRecoverLoading(false);
    }
  };

  if (pendingKey) {
    return (
      <RecoveryKeyStep
        recoveryKey={pendingKey.key}
        title={pendingKey.title}
        onDone={() => {
          setUser(pendingKey.user);
          router.push(getHomePath(pendingKey.user));
        }}
      />
    );
  }

  if (forgot) {
    return (
      <Card padded={false} className="animate-scale-in p-4 sm:p-5">
        <div className="mb-3 text-center">
          <h2 className="text-lg font-bold text-[var(--foreground)]">Forgot your code?</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)] sm:text-sm">
            Enter your username and the recovery key you saved, then choose a new 6-digit code.
          </p>
        </div>
        <form onSubmit={handleRecover} className="space-y-3">
          <LabeledField id="rc-username" label="Username">
            <Input
              id="rc-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="your_username"
              autoComplete="username"
              required
            />
          </LabeledField>
          <LabeledField id="rc-key" label="Recovery key" hint="Looks like ABCD-EFGH-JKMN-PQRS">
            <Input
              id="rc-key"
              type="text"
              value={recoveryKeyInput}
              onChange={(e) => setRecoveryKeyInput(e.target.value.toUpperCase())}
              placeholder="ABCD-EFGH-JKMN-PQRS"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="font-mono tracking-wider"
              required
            />
          </LabeledField>
          <LabeledField id="rc-code" label="New 6-digit code">
            <Input
              id="rc-code"
              type="password"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••••"
              autoComplete="new-password"
              className="tracking-widest"
              required
            />
          </LabeledField>
          <Button
            type="submit"
            className="w-full"
            loading={recoverLoading}
            disabled={newCode.length !== 6 || !username || !recoveryKeyInput.trim()}
          >
            {recoverLoading ? "Resetting..." : "Reset code"}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setForgot(false)}>
            Back to sign in
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card padded={false} className="animate-scale-in p-4 sm:p-5">
      <div className="mb-3 text-center">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-2.5 py-0.5 text-[11px] font-medium text-brand">
          <Sparkles className="h-3 w-3" aria-hidden />
          Shared platform login
        </div>
        <h2 className="text-lg font-bold text-[var(--foreground)]">
          {tab === "signin" ? "Welcome back" : "Create account"}
        </h2>
        <p className="mt-0.5 text-xs text-[var(--muted)] sm:text-sm">
          {tab === "signin"
            ? "Google or username + 6-digit code"
            : "Works in GrowthHub and CareerFlow"}
        </p>
      </div>

      <AuthTabs tab={tab} onChange={setTab} />

      {authError && tab === "signin" && (
        <div className="mb-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          Sign-in failed. Please try again.
        </div>
      )}

      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={handleGoogleLogin}
        disabled={googleLoading}
      >
        {googleLoading ? (
          "Connecting..."
        ) : (
          <>
            <GoogleIcon />
            Continue with Google
          </>
        )}
      </Button>

      <AuthDivider label={tab === "signin" ? "or use code" : "or create with code"} />

      {tab === "signin" ? (
        <>
          <form onSubmit={handleLogin} className="space-y-3">
            <FormField label="Username">
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="your_username"
                autoComplete="username"
                required
              />
            </FormField>
            <FormField label="6-digit code" hint="The code you chose at registration">
              <Input
                type="password"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                autoComplete="current-password"
                className="tracking-widest"
                required
              />
            </FormField>
            <Button type="submit" className="w-full" loading={loading}
              disabled={code.length !== 6}>
              {loading ? "Signing in..." : "Sign in with code"}
            </Button>
            <button
              type="button"
              onClick={() => setForgot(true)}
              className="w-full text-center text-xs font-medium text-[var(--muted)] hover:text-brand"
            >
              Forgot your code?
            </button>
          </form>

          <Button
            type="button"
            variant="outline"
            className="mt-3 w-full"
            onClick={handleGuestLogin}
            disabled={guestLoading}
          >
            {guestLoading ? "Loading demo..." : "Try demo — no account needed"}
          </Button>
        </>
      ) : (
        <form onSubmit={handleRegister} className="space-y-3">
          <FormField label="Username" hint="3-20 chars, letters, numbers, underscore">
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              placeholder="alex_prep"
              autoComplete="username"
              minLength={3}
              maxLength={20}
              required
            />
          </FormField>
          <FormField label="Display name">
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex"
              autoComplete="name"
              required
            />
          </FormField>
          <FormField label="Login code" hint="6 digits — this is your password">
            <Input
              type="password"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              autoComplete="new-password"
              className="tracking-widest"
              required
            />
          </FormField>
          <Button type="submit" className="w-full" loading={registerLoading}
            disabled={code.length !== 6}>
            {registerLoading ? "Creating..." : "Create account"}
          </Button>
        </form>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-2">
          <Zap className="h-3 w-3 shrink-0 text-brand" aria-hidden />
          <span className="text-[11px] font-medium text-[var(--foreground)]">One login</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-2">
          <Shield className="h-3 w-3 shrink-0 text-success" aria-hidden />
          <span className="text-[11px] font-medium text-[var(--foreground)]">Two apps</span>
        </div>
      </div>
    </Card>
  );
}

export default function LoginPage() {
  useDocumentTitle("Sign in");
  return (
    <div className="login-shell flex flex-col">
      <header className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <AppLogo size="sm" />
          <span className="text-sm font-bold text-[var(--foreground)]">GrowthHub</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={getCareerFlowAppUrl()}
            className="hidden text-xs font-medium text-[var(--muted)] hover:text-brand sm:inline"
          >
            CareerFlow
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col justify-center px-4 pb-4 sm:px-6">
        <Suspense
          fallback={
            <Card padded={false} className="p-5">
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
              </div>
            </Card>
          }
        >
          <LoginPanel />
        </Suspense>
      </main>
    </div>
  );
}
