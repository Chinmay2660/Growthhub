"use client";

import { useState } from "react";
import Slider from "@/components/ui/Slider";
import DatePicker from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/Input";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import AppLogo from "@/components/ui/AppLogo";
import { apiPost, getErrorMessage } from "@/lib/api";
import { useUser } from "@/components/providers/UserProvider";
import toast from "react-hot-toast";
import type { User, Group } from "@/types";

const STEPS = ["Welcome", "Target", "Tracks", "Study Time", "Group"];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, setUser } = useUser();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState("");
  const [preparationLevel, setPreparationLevel] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [targetCompany, setTargetCompany] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [interviewDate, setInterviewDate] = useState("");
  const [dailyStudyMinutes, setDailyStudyMinutes] = useState(120);
  const [groupAction, setGroupAction] = useState<"create" | "join">("create");
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const addSubject = () => {
    const trimmed = newSubject.trim();
    if (!trimmed) return;
    if (subjects.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Track already added");
      return;
    }
    setSubjects((prev) => [...prev, trimmed]);
    setNewSubject("");
  };

  const removeSubject = (subject: string) => {
    setSubjects((prev) => prev.filter((s) => s !== subject));
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      const result = await apiPost<{ user: User; group: Group }>("/api/onboarding", {
        name: name || user?.name,
        subjects,
        preparationLevel,
        dailyStudyMinutes,
        targetCompany: targetCompany.trim() || undefined,
        targetRole: targetRole.trim() || undefined,
        interviewDate: groupAction === "create" && interviewDate ? interviewDate : undefined,
        groupAction,
        groupName: groupAction === "create" ? groupName || `${name || user?.name}'s Prep Group` : undefined,
        joinCode: groupAction === "join" ? joinCode : undefined,
      });
      setUser(result.user);
      toast.success("Welcome to GrowthHub!");
      router.push("/dashboard");
    } catch (err) {
      toast.error(getErrorMessage(err, "Setup failed"));
    } finally {
      setLoading(false);
    }
  };

  const canNext = () => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return true;
    if (step === 2) return true;
    if (step === 3) return dailyStudyMinutes > 0;
    if (step === 4) return groupAction === "create" || joinCode.length === 6;
    return false;
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 w-fit">
            <AppLogo />
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">GrowthHub</h1>
        </div>

        <div className="mb-6 flex justify-center gap-1">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 w-10 rounded-full transition-colors ${
                i <= step ? "bg-brand" : "bg-stone-200 dark:bg-stone-700"
              }`}
            />
          ))}
        </div>

        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!canNext() || loading) return;
              if (step < STEPS.length - 1) setStep((s) => s + 1);
              else void handleFinish();
            }}
          >
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">What&apos;s your name?</h2>
              <label htmlFor="ob-name" className="sr-only">Your name</label>
              <Input
                id="ob-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoFocus
              />
              <div>
                <span id="ob-level-label" className="text-sm font-medium text-[var(--foreground)]">Preparation level</span>
                <div className="mt-2 flex gap-2" role="group" aria-labelledby="ob-level-label">
                  {(["beginner", "intermediate", "advanced"] as const).map((level) => (
                    <Chip
                      key={level}
                      variant="brand"
                      active={preparationLevel === level}
                      onClick={() => setPreparationLevel(level)}
                      className="flex-1 justify-center !rounded-lg !px-3 !py-2 capitalize"
                    >
                      {level}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">What are you preparing for?</h2>
              <p className="text-sm text-[var(--muted)]">
                Your interview date drives the daily plan. All optional, and you can change it later.
              </p>
              <label htmlFor="ob-company" className="sr-only">Target company</label>
              <Input
                id="ob-company"
                type="text"
                value={targetCompany}
                onChange={(e) => setTargetCompany(e.target.value)}
                placeholder="Target company (e.g. Acme Corp)"
              />
              <label htmlFor="ob-role" className="sr-only">Target role</label>
              <Input
                id="ob-role"
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="Target role (e.g. Backend Engineer)"
              />
              <div>
                <label className="text-sm font-medium" htmlFor="interview-date">
                  Interview date
                </label>
                <DatePicker
                  id="interview-date"
                  value={interviewDate}
                  onChange={setInterviewDate}
                  clearable
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-[var(--muted)]">Applies when you create a group. Joining uses the group&apos;s date.</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Which tracks are you preparing?</h2>
              <p className="text-sm text-[var(--muted)]">Add your own tracks. You can add more later from the Tracks page.</p>
              <div className="flex gap-2">
                <label htmlFor="ob-subject" className="sr-only">Track name</label>
                <Input
                  id="ob-subject"
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSubject())}
                  placeholder="e.g. System Design"
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={addSubject} disabled={!newSubject.trim()}>
                  Add
                </Button>
              </div>
              {subjects.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {subjects.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 rounded-lg border border-brand/30 bg-brand/10 px-3 py-1.5 text-sm font-medium text-brand"
                    >
                      {s}
                      <button
                        type="button"
                        onClick={() => removeSubject(s)}
                        className="text-brand/70 hover:text-brand"
                        aria-label={`Remove ${s}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)]">No tracks yet — skip for now or add at least one.</p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Daily study time available?</h2>
              <Slider
                min={30}
                max={480}
                step={15}
                value={dailyStudyMinutes}
                onChange={setDailyStudyMinutes}
                aria-label="Daily study minutes"
                aria-valuetext={`${Math.floor(dailyStudyMinutes / 60)} hours ${dailyStudyMinutes % 60} minutes`}
              />
              <p className="text-center text-2xl font-bold text-brand">
                {Math.floor(dailyStudyMinutes / 60)}h {dailyStudyMinutes % 60}m
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Create or join a group</h2>
              <div className="flex gap-2">
                <Chip
                  variant="brand"
                  active={groupAction === "create"}
                  onClick={() => setGroupAction("create")}
                  className="flex-1 justify-center !rounded-lg !px-3 !py-2 !text-sm"
                >
                  Create group
                </Chip>
                <Chip
                  variant="brand"
                  active={groupAction === "join"}
                  onClick={() => setGroupAction("join")}
                  className="flex-1 justify-center !rounded-lg !px-3 !py-2 !text-sm"
                >
                  Join group
                </Chip>
              </div>
              {groupAction === "create" ? (
                <>
                <label htmlFor="ob-group-name" className="sr-only">Group name</label>
                <Input
                  id="ob-group-name"
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder={`${name}'s Prep Group (optional)`}
                />
                </>
              ) : (
                <>
                <label htmlFor="ob-join-code" className="sr-only">Group join code (6 digits)</label>
                <Input
                  id="ob-join-code"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="font-mono tracking-widest"
                />
                {subjects.length > 0 && (
                  <p className="text-xs text-[var(--muted)]">
                    Tracks you added will be kept for your personal tracks.
                  </p>
                )}
                </>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
            >
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="submit" disabled={!canNext()}>
                Continue
              </Button>
            ) : (
              <Button type="submit" loading={loading}
                disabled={!canNext()}>
                {loading ? "Setting up..." : "Launch Dashboard"}
              </Button>
            )}
          </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
