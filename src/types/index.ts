export type ThemePreference = "light" | "dark" | "system";
export type PreparationLevel = "beginner" | "intermediate" | "advanced";
export type GroupRole = "owner" | "admin" | "member";
export type Priority = "critical" | "high" | "medium" | "low";
export type TopicStatus = "not_started" | "learning" | "practiced" | "revised";
export type Confidence = "weak" | "okay" | "strong";
export type QuestionStatus =
  | "not_started"
  | "in_progress"
  | "revised"
  | "done";
export type QuestionDifficulty = "easy" | "medium" | "hard";
export type ContentScope = "group" | "personal";
export type ContentUnit = "questions" | "videos" | "chapters" | "problems";

export interface User {
  _id: string;
  username?: string;
  name: string;
  email?: string;
  avatar?: string;
  googleId?: string;
  onboardingComplete: boolean;
  preparationLevel: PreparationLevel;
  dailyStudyMinutes: number;
  dailyQuestionGoal: number;
  activeGroupId?: string;
  theme: ThemePreference;
  studyStreak: number;
  lastStudyDate?: string;
  targetCtcLpa?: number;
  targetCompany?: string;
  targetRole?: string;
  isGuest?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  userId: string;
  role: GroupRole;
  joinedAt: string;
}

export interface Group {
  _id: string;
  name: string;
  description?: string;
  joinCode: string;
  joinCodeExpiresAt: string;
  interviewDate?: string;
  /** Questions each member aims to solve per week. */
  weeklyGoalPerMember?: number;
  ownerId: string;
  members: GroupMember[];
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  _id: string;
  groupId?: string;
  userId?: string;
  scope: ContentScope;
  name: string;
  priority: Priority;
  description?: string;
  order: number;
  totalQuestions: number;
  contentUnit?: ContentUnit;
  useForMockInterview?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionsByDate {
  date: string;
  count: number;
}

export interface Topic {
  _id: string;
  subjectId: string;
  groupId: string;
  name: string;
  status: TopicStatus;
  confidence: Confidence;
  priority: Priority;
  studyMinutes: number;
  lastStudied?: string;
  nextRevision?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface TopicProgress {
  _id: string;
  userId: string;
  topicId: string;
  status: TopicStatus;
  confidence: Confidence;
  studyMinutes: number;
  lastStudied?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudySession {
  _id: string;
  userId: string;
  groupId?: string;
  subjectId?: string;
  topicId?: string;
  durationMinutes: number;
  startedAt: string;
  completedAt: string;
  createdAt: string;
}

export interface MockInterviewQuestion {
  subjectId: string;
  subjectName: string;
  topicId?: string;
  questionId?: string;
  question: string;
  source: "practice" | "topic";
}

export interface MockInterviewScore {
  interviewerId?: string;
  interviewerName?: string;
  score: number;
  weaknesses?: string[];
  feedback?: string;
  rubric?: { communication: number; correctness: number; depth: number; confidence: number };
}

export interface MockInterviewSession {
  _id: string;
  groupId: string;
  roundId: string;
  intervieweeId: string;
  questions: MockInterviewQuestion[];
  generatedBy: string;
  scores: MockInterviewScore[];
  expectedScorers: string[];
  currentUserHasScored: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MockInterviewMemberStatus = "not_started" | "in_progress" | "completed";

export interface MockInterviewRoundSummary {
  _id: string;
  roundNumber: number;
  interviewDate: string | null;
  isCurrent: boolean;
  /** All peers have scored, or an admin marked it complete. A completed round lives under Past. */
  isCompleted: boolean;
}

export interface MockInterviewScheduleMember {
  userId: string;
  name: string;
  role: string;
  status: MockInterviewMemberStatus;
  scheduledAt: string | null;
  questionsDone: number;
  questionCount: number;
  scoresSubmitted: number;
  scoresExpected: number;
  averageScore: number | null;
  session: MockInterviewSession | null;
}

export interface MockInterviewSchedule {
  groupId: string;
  currentRoundId: string | null;
  activeRoundId: string;
  isViewingHistory: boolean;
  canGenerate: boolean;
  /** The current round is complete: nothing is upcoming until an admin schedules the next one. */
  currentRoundCompleted: boolean;
  rounds: MockInterviewRoundSummary[];
  members: MockInterviewScheduleMember[];
}

export interface MockInterview {
  _id: string;
  userId: string;
  groupId: string;
  sessionId?: string;
  interviewerId?: string;
  date: string;
  subjectId?: string;
  interviewer?: string;
  score: number;
  questionsAsked: string[];
  strengths: string[];
  weaknesses: string[];
  feedback?: string;
  rubric?: { communication: number; correctness: number; depth: number; confidence: number };
  followUpTopicIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface QuestionProgress {
  _id: string;
  userId: string;
  questionId: string;
  status: QuestionStatus;
  confidence: Confidence;
  lastPracticed?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PracticeQuestion {
  _id: string;
  userId: string;
  groupId: string;
  scope: ContentScope;
  sourceGroupQuestionId?: string;
  subjectId: string;
  topicId?: string;
  practiceDate?: string;
  content: string;
  link?: string;
  difficulty: QuestionDifficulty;
  status: QuestionStatus;
  confidence: Confidence;
  lastPracticed?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanDayItem {
  subjectId: string;
  topicId?: string;
  label: string;
  estimatedMinutes: number;
  completed: boolean;
}

export interface PlanDay {
  dayNumber: number;
  date: string;
  items: PlanDayItem[];
}

// Enriched types for API responses
export interface SubjectWithStats extends Subject {
  topicCount: number;
  completedTopics: number;
  completionPercent: number;
  confidence: Confidence;
  studyMinutes: number;
  lastStudied?: string;
  nextRevision?: string;
  questionCount: number;
  questionsByDate: QuestionsByDate[];
}

export interface TopicWithProgress extends Topic {
  subjectName?: string;
  userStatus?: TopicStatus;
  userConfidence?: Confidence;
  userStudyMinutes?: number;
}

export interface GroupWithStats extends Group {
  memberCount: number;
  memberStats?: MemberStat[];
  weakAreas?: string[];
}

export interface MemberStat {
  userId: string;
  username?: string;
  name: string;
  questionsSolved: number;
  role?: GroupRole;
}

export interface MemberGamificationStat {
  userId: string;
  name: string;
  /** Questions solved (1 point each). */
  totalPoints: number;
  /** Questions not solved yet. */
  pending: number;
  dailyPoints: { date: string; points: number }[];
}

export interface GroupGamification {
  leaderboard: MemberGamificationStat[];
  dailyPoints: { date: string; label: string; points: number }[];
}

export interface UserProfile {
  _id: string;
  username: string;
  name: string;
  preparationLevel: PreparationLevel;
  studyStreak: number;
  dailyStudyMinutes: number;
  sharedGroups: { _id: string; name: string }[];
  weakSubjects: string[];
  strongSubjects: string[];
  joinedAt?: string;
  role?: string;
  isSelf?: boolean;
  stats?: {
    questionsDone: number;
    questionsTotal: number;
    points: number;
    doneLast7Days: number;
    daysSinceActive: number | null;
    studyMinutesWeek: number;
    studyMinutesTotal: number;
    /** Questions completed per day ("YYYY-MM-DD" -> count). */
    heat: Record<string, number>;
  } | null;
  subjects?: { name: string; mastery: number; done: number; total: number }[];
  mock?: {
    count: number;
    avgScore: number | null;
    last: { date: string; score: number }[];
    rubric: Record<string, number | null>;
  } | null;
  interview?: { date: string; daysLeft: number } | null;
  target?: { company?: string; role?: string } | null;
}

export interface TodayQuestion {
  _id: string;
  content: string;
  scope: ContentScope;
  /** Which group a shared question belongs to (shared questions only). */
  groupId?: string;
  groupName?: string;
  subjectName: string;
  trackLabel: string;
  status: QuestionStatus;
  practiceDate?: string;
  /** Set when the question was scheduled before today and is still unsolved. */
  overdueDays?: number;
  link?: string;
}

export interface DashboardData {
  countdown: { days: number; hours: number; totalHours: number; interviewDate: string | null; isPast?: boolean };
  todayQuestions: { group: TodayQuestion[]; personal: TodayQuestion[] };
  studyStreak: number;
  /** Today's progress against the person's own daily goal. */
  daily: { goal: number; solvedToday: number };
  /** Set when the person has been away for a few days: what changed while they were gone. */
  away: { days: number; overdue: number; teamSolved: number } | null;
  /** Questions that were scheduled before today and are not solved yet (oldest first, up to 5). */
  overdue: {
    count: number;
    items: { _id: string; title: string; subjectName: string; practiceDate: string; scope: ContentScope }[];
  };
  /** Every group the person belongs to (the dashboard covers all of them). */
  groups: { _id: string; name: string }[];
  /** The next scheduled mock across all groups, if any. */
  nextMock: { roundNumber: number; date: string; groupId: string; groupName: string } | null;
}

export interface AnalyticsQuestionStatusRow {
  status: string;
  label: string;
  count: number;
}

export interface AnalyticsTrackRow {
  name: string;
  total: number;
  done: number;
  percent: number;
}

export interface AnalyticsActivityDay {
  date: string;
  label: string;
  count: number;
}

export interface AnalyticsData {
  subjectCompletion: { name: string; percent: number }[];
  topicStatusBreakdown: { status: string; count: number }[];
  mockInterviewScores: { date: string; score: number; subject: string }[];
  groupStats?: {
    weakSubjects: string[];
  };
  personal: {
    summary: {
      totalQuestions: number;
      done: number;
      inProgress: number;
      studyMinutesWeek: number;
      studyStreak: number;
    };
    byStatus: AnalyticsQuestionStatusRow[];
    byTrack: AnalyticsTrackRow[];
    activity: AnalyticsActivityDay[];
  };
  group: {
    summary: {
      totalQuestions: number;
      yourDone: number;
      yourPoints: number;
      memberCount: number;
    };
    byStatus: AnalyticsQuestionStatusRow[];
    byTrack: AnalyticsTrackRow[];
    activity: AnalyticsActivityDay[];
    pointsTrend: AnalyticsActivityDay[];
    leaderboard: { userId: string; name: string; points: number }[];
  };
}
