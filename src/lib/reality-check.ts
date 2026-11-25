/**
 * REALITY CHECK: blunt, sarcastic career-and-money one-liners meant to shake off procrastination.
 * The humour is aimed at excuses and habits, never at who someone is.
 */

export type RealityCategoryId =
  | "ctc"
  | "jobless"
  | "independence"
  | "parents"
  | "placed"
  | "salary"
  | "luxury"
  | "career"
  | "rejection"
  | "billionaire"
  | "habits";

export type RealityCategory = { id: RealityCategoryId; label: string; emoji: string };

export const REALITY_CATEGORIES: RealityCategory[] = [
  { id: "ctc", label: "CTC Obsession", emoji: "💰" },
  { id: "jobless", label: "Jobless Reality", emoji: "💀" },
  { id: "independence", label: "Financial Independence", emoji: "💸" },
  { id: "parents", label: "Parents' Expectations", emoji: "👨‍👩‍👧" },
  { id: "placed", label: "Friends Getting Placed", emoji: "🏆" },
  { id: "salary", label: "Salary Comparison", emoji: "📊" },
  { id: "luxury", label: "Luxury Lifestyle Dreams", emoji: "🏎️" },
  { id: "career", label: "Career Reality Check", emoji: "🔍" },
  { id: "rejection", label: "Rejection & Competition", emoji: "🥊" },
  { id: "billionaire", label: "Billionaire Mindset", emoji: "🚀" },
  { id: "habits", label: "Habits & Focus", emoji: "📚" },
];

export type RealityQuote = {
  id: string;
  category: RealityCategoryId;
  text: string;
  /** Built from the person's own Settings (target CTC, company, role) rather than the shared list. */
  personal?: boolean;
  /** The book whose central idea the line riffs on. Original wording, not a quotation from the book. */
  source?: string;
};

const QUOTES: Record<Exclude<RealityCategoryId, "habits">, string[]> = {
  ctc: [
    "Dreaming of a 20 LPA package with a 0 LPA work ethic. Impressive.",
    "CTC dreams: 30 LPA. Current income: ₹0. Confidence: Unlimited.",
    "You've mentally spent your first CTC three times. The offer letter hasn't even been drafted.",
    "Your CTC calculator is getting more screen time than your DSA sheet.",
    "A 40 LPA vision with a 4-hour-a-week preparation plan. The math is not mathing.",
    "You know your in-hand salary breakdown by heart. Pity you don't know a single system design pattern.",
    "Fixed versus variable pay is a great problem to have. Try getting an offer first.",
    "Every minute you spend debating the ideal CTC is a minute a competitor spends earning it.",
    "You're negotiating a salary for a job you haven't applied to.",
    "The package you want has a skill requirement. Check it. It's not 'good vibes'.",
    "Your expected CTC has more zeros than your completed practice questions.",
    "Nobody ever got a raise by calculating it on a spreadsheet at 2 AM.",
    "20 LPA doesn't come with a 'prepare tomorrow' option.",
    "You've researched tax slabs for a salary you don't have. That's ambition wearing a clown nose.",
    "CTC isn't a wish. It's a receipt for the value you can prove.",
    "Your ambition is at senior level. Your output is at 'still reading the syllabus'.",
    "Hot take: a bigger number won't appear because you refreshed the job portal.",
    "You want a premium package. Premium requires effort, which is currently out of stock.",
    "The recruiter won't hire your confidence. They'll hire what you can solve in 45 minutes.",
    "Your salary expectations are increasing faster than your skills.",
  ],
  jobless: [
    "Another month closer to graduation. Still no offer? Interesting.",
    "Your degree is almost ready. Is your job offer?",
    "Unemployment isn't a phase when you schedule it as a lifestyle.",
    "'Preparing' is not a job title. Though you've held it for a remarkably long time.",
    "Your resume has one line under experience: 'Tutorials watched'. Recruiters are not impressed.",
    "You're not between jobs. You're between excuses.",
    "Being JOBLESS is temporary. Getting comfortable with it is the dangerous part.",
    "Day 214 of 'I'll start from Monday.' Monday is filing a complaint.",
    "Your gap year isn't a gap year anymore. It's a gap era.",
    "Graduation day is coming. The job isn't. One of these can be fixed this week.",
    "You say you have time. The job market says you have a deadline.",
    "The interview call won't come to someone who isn't in the market.",
    "Your daily schedule: wake up, panic, open one tab, close it. Productivity, but in reverse.",
    "You've been 'about to apply' for so long it should count as experience.",
    "Employment doesn't start when you feel ready. It starts when you stop waiting to feel ready.",
    "Your GitHub is quieter than a library during exams.",
    "JOBLESS isn't an identity. It's an unfinished to-do list with your name on it.",
    "The 'I'm exploring options' phase has been exploring one option: the bed.",
    "Nobody is coming to rescue your career. Not even the algorithm.",
    "The scariest thing about unemployment is how comfortable it can get.",
  ],
  independence: [
    "Stop calculating your future salary. Start earning the skills that deserve it.",
    "Your dream lifestyle isn't accepting exposure as payment.",
    "Financial freedom won't arrive through motivational reels.",
    "Independence is a skill. You can't download it, but you can practise it daily.",
    "You can't be financially free while your biggest investment is a data pack recharge.",
    "Saving ₹0 and planning to retire at 35 is bold. Mathematically wrong, but bold.",
    "Independence begins the day you earn the first rupee you don't have to explain.",
    "Passive income needs active effort first. That's the part nobody posts about.",
    "A side hustle needs a main hustle to side with.",
    "Your bank balance is the most honest review of your last six months.",
    "Freedom isn't doing nothing. It's not needing anyone to fund the nothing.",
    "You want financial freedom but you still ask for a UPI top-up. Start there.",
    "The goal isn't to get rich quick. It's to stop being broke slowly.",
    "Quit pretending you'll invest 'when you earn more'. Earn first. Then we talk SIPs.",
    "Your first SALARY is just proof you can survive without a bailout.",
    "Money doesn't care about your potential. It only responds to output.",
    "Budgeting is easy when the budget is ₹0. Tragic, but easy.",
    "You can't save your career, or your wallet, from your bed.",
    "Own your income and you own your decisions. Till then, someone else holds the remote.",
    "Imagine telling your future self: 'I started late, but I started today.' Better than another excuse.",
  ],
  parents: [
    "Future millionaire, currently sponsored by Mom and Dad.",
    "Your parents deserve retirement, not another lifetime subscription to your expenses.",
    "You want to spoil your parents someday. First, stop spoiling your productivity.",
    "Your parents said 'take your time.' They didn't say 'take all of it.'",
    "Mom asks 'any update?' You say 'working on it.' The real update is you're mostly working on your sleep.",
    "Dad's retirement plan shouldn't include funding your 'one chai break at a time' startup.",
    "Imagine paying the electricity bill. Somewhere, your father is already imagining it.",
    "Your parents' biggest investment has the performance of a startup in stealth mode. Show returns.",
    "They sacrificed a lot for your education. Don't let the ROI be an unread offer mail.",
    "Relatives asking 'beta, placement?' is not a bug. It's a feature to make you move.",
    "Your parents are proud of your potential. Potential doesn't pay the gas bill.",
    "That 'I'll take care of you someday' speech needs a start date.",
    "Your mother has prayed for your job more consistently than you've studied for it.",
    "Nobody's parents dreamed of 'my child, expert at thinking about doing it tomorrow'.",
    "Your allowance is not a SALARY. Stop negotiating it like one.",
    "The best gift for your parents isn't a promise. It's a first salary slip.",
    "You say family is everything. Then do something for it besides updating your wallpaper.",
    "A parent's patience has a limit. Your procrastination hasn't found its limit yet.",
    "Give your parents a reason to say 'my child works at...' instead of 'my child is preparing for...'",
    "Those sacrifices were meant to buy you a future, not a longer break.",
  ],
  placed: [
    "Your friends are discussing appraisals. You're discussing which series to watch.",
    "Imagine your entire friend circle getting placed while you're still saying 'I'm preparing.'",
    "Your college friends are collecting offer letters. You're collecting excuses.",
    "Your batchmate just posted 'Excited to announce...'. You just posted a motivational quote and did nothing.",
    "The group chat went from memes to onboarding documents. Where are you in this story?",
    "Your friend's bio changed to 'Software Engineer'. Yours says 'Aspiring'. Aspiring to what, exactly?",
    "While you were 'taking a break', your friend cleared their third round.",
    "Everyone from your hostel wing is celebrating offers. You're celebrating reaching page 2 of the syllabus.",
    "Someone you used to tutor just got placed. Let that sink in. Then open your laptop.",
    "Your friend sent a party invite for their first SALARY. Hope you're ready to say 'congrats' and mean it.",
    "Their first pay cheque will buy dinner. Yours would've bought a snack, if you had one.",
    "Your friends are venting about work stress. You're venting about everything but work.",
    "You liked all their placement posts. When do we get a post from you?",
    "Your friends upgraded to 'colleagues'. You're still stuck at 'classmates'.",
    "Everyone has gone quiet in the group because they're busy. Placed people are busy. Think about it.",
    "Your classmate got a pre-placement offer. You got a pre-nap routine.",
    "At the reunion everybody will ask where you work. 'Working on myself' won't impress HR.",
    "The batch topper isn't the only one winning. The one who just kept going wins too.",
    "Your friends aren't ahead because they're geniuses. They're ahead because they started.",
    "The placement cell notice board has more movement than your preparation tracker.",
  ],
  salary: [
    "Someone from your batch just got 18 LPA. And you just completed another Netflix episode.",
    "Your classmates are updating their LinkedIn titles. You're updating your wallpaper.",
    "Your friend's SALARY has a comma. Your pocket money has a limit.",
    "He got 12 LPA with the same syllabus you've 'started' four times.",
    "She asked for a raise. You asked for the wifi password.",
    "Somebody with fewer certificates than you out-earns you. They also shipped more projects. Coincidence?",
    "Your friend's first month's salary equals your annual daydreaming budget.",
    "A 3 LPA offer beats a 30 LPA fantasy. Fantasies don't clear the first round.",
    "Your batchmate's offer letter is on LinkedIn. Yours is still in your imagination.",
    "While you compare packages, the offer-holders compared projects.",
    "They got an offer because they showed up. Showing up is free.",
    "Your classmate cracked a product company. You cracked the 'next episode' button.",
    "The package gap between you and them isn't talent. It's reps.",
    "Everyone is 'lucky' until you count how many rejections they took before the offer.",
    "Don't envy their SALARY. Study their schedule.",
    "'Compare yourself to your past self,' they say. Your past self also did nothing. Progress is optional.",
    "Your peers are comparing ESOPs. You're comparing snack options.",
    "A friend's hike letter is not your problem. Your own hike begins when your skills do.",
    "Salary comparison is free. Salary negotiation requires a job.",
    "Their LPA isn't the competition. Your calendar full of 'later' is.",
  ],
  luxury: [
    "You want a luxury car, but your bank balance is still in tutorial mode.",
    "BMW dreams, ₹47 bank balance. Keep the vision, fix the execution.",
    "You want an iPhone without asking your parents? Start acting like it.",
    "That dream apartment isn't going to pay its own EMI.",
    "Your wishlist is expensive. Your effort is currently on a budget.",
    "One day you want to pay the bills without checking your bank balance. Work for it.",
    "Your Pinterest board has a villa. Your resume has a typo.",
    "A luxury watch tells time. It can't tell you to start.",
    "Window-shopping a Mercedes on a Tier-2 savings plan. The only luxury here is the daydream.",
    "You'll fly business class someday. For now, you're flying between three apps.",
    "Designer sneakers on a 'student discount' mindset.",
    "The lifestyle you want has a prerequisite: employment.",
    "Rich people didn't start with a vision board. They started with a calendar.",
    "You can't manifest the EMI. You can only make it.",
    "Your Goa trip plan is perfect. The funding plan is 'someone else'.",
    "A sports car doesn't care about your vibe. It needs a down payment.",
    "Your dream home needs a salary slip, not a screenshot.",
    "Luxury is waiting for you. You're waiting for motivation. Guess who blinks first?",
    "Imagine buying your own flagship phone with your own money. That's the real flex.",
    "Taste for luxury, discipline for leisure. Reverse that.",
  ],
  career: [
    "LinkedIn is full of promotions. Your profile is full of potential.",
    "Competition isn't sleeping. But apparently, you are.",
    "The placement season doesn't care about your procrastination.",
    "Your career won't build itself. It's not that kind of app.",
    "Interviewers don't ask what you intended to learn. They ask what you can do now.",
    "Your resume says 'quick learner'. Quick, learn something.",
    "Hard work beats talent only when talent is also procrastinating. You're doing both.",
    "Skills pay the bills. Hopes mostly pay in sympathy.",
    "Your learning plan has 14 courses and 0 projects. That's a hobby with a good logo.",
    "Experience doesn't arrive as a free update. Install it manually.",
    "A career isn't a straight line. It also isn't a couch.",
    "Your 'five-year plan' starts with 'tomorrow'. Rename it 'next decade'.",
    "Every skill you postpone is a slot someone else filled.",
    "Your ambition is senior-level. Your commit history is intern-level. Interns at least commit.",
    "Employers want proof of work. 'Worked on my mindset' doesn't come as a PDF.",
    "Your motivation drops after 10 minutes. Careers need 10 months.",
    "Today's task isn't glamorous: solve one problem. Do it, and you're ahead of the 'tomorrow' crowd.",
    "Networking isn't liking posts. It's showing up with something worth sharing.",
    "The industry moves fast. You're still buffering.",
    "No one cares about your potential until you convert it into a deliverable.",
  ],
  rejection: [
    "REJECTION is just feedback with worse formatting. Read it, fix it, resubmit.",
    "You got rejected from one company. Cool. There are thousands you haven't applied to.",
    "Rejection stings. Not applying stings forever.",
    "Imagine fearing REJECTION so much you choose guaranteed silence.",
    "One 'no' isn't a verdict. It's a homework assignment.",
    "The only person who never gets rejected is the one who never tries. They also never get hired.",
    "Your competition gets rejected daily and keeps applying. That's the real edge.",
    "Every rejection mail is a free mock interview report. Study it.",
    "You didn't miss your chance. You missed your chance to prepare for it.",
    "Rejection isn't the end of the road. Quitting is just a very comfy parking lot.",
    "Candidates with ten rejections beat candidates with zero attempts. Do the math.",
    "Your last interview didn't fail. It exposed what to study next. Go study it.",
    "Imagine losing an offer because you skipped the one topic you 'planned to revise'.",
    "Opportunities don't wait for the version of you that feels ready.",
    "The rejection email is polite. The consequences of not improving are not.",
    "Every 'we'll get back to you' is your cue to apply to five more.",
    "Missed an opportunity? Welcome to the club. Members who recover meet at the next round.",
    "Competition is a mirror. If you hate what it shows, move.",
    "Cry for ten minutes about the rejection. Then open the question you got wrong.",
    "You'll never run out of rejections. You'll run out of time to keep avoiding them.",
  ],
  billionaire: [
    "Billionaires aren't reading this quote. They're already working.",
    "You want a billionaire's life with a snooze button's discipline.",
    "Nobody built an empire by planning to start at 9 AM tomorrow.",
    "The rich don't wait for motivation. They schedule discipline.",
    "You can't invest without capital, and you can't build capital without a first job. Start the first job.",
    "Think big, they say. Then do small things daily until big becomes your address.",
    "Your 'billionaire mindset' needs a millionaire habit first. And a thousandaire step. Begin.",
    "The only compound interest you have right now is on your procrastination.",
    "Nobody became a tech titan by being 'chill about it'.",
    "Wealth is boring work repeated for years. Hope you packed snacks.",
    "Your net worth is a lagging indicator of your daily habits. Yesterday's habits are visible in the bank.",
    "Every empire began with one tiny, awkward, unglamorous first step. Take yours before lunch.",
    "Your 'someday I'll be rich' needs a 'today I did something' attached.",
    "Billionaire energy begins with doing the boring task you've postponed twice.",
    "Nobody got wealthy perfecting a morning routine for a job they don't have.",
    "You can't scale something you haven't started.",
    "Your dream of financial freedom is valid. Your plan for it is currently 'vibes'.",
    "The top 1% weren't born at the top of the learning curve. They just got off the bottom.",
    "Ambition without action is just expensive daydreaming.",
    "Stop waiting for the perfect time. The perfect time is a rumour spread by procrastinators.",
  ],
};

/**
 * Lines built on the central ideas of well-known habit and productivity books, in the same blunt voice as the rest.
 * They are written fresh for this app (the ideas are the books', the wording is not), so none is a quotation.
 */
const BOOK_LINES: { source: string; lines: string[] }[] = [
  {
    source: "Atomic Habits",
    lines: [
      "Atomic Habits says you don't rise to your goals, you fall to your systems. Your system is 'tomorrow'.",
      "Get 1% better every day, the book promises. You've been getting 0% better every day with impressive consistency.",
      "Habits are votes for the person you want to become. Lately you've been voting for 'person who watches one more episode'.",
      "The two-minute rule: make it so small you can't say no. You still said no to opening the laptop.",
      "Environment beats willpower. Your phone is on the desk and your DSA sheet is in a folder you've forgotten.",
      "Habit stacking: after chai, solve one problem. Your current stack: after chai, more chai.",
      "Goals set direction, systems make progress. Your goal is a 20 LPA offer. Your system is hope.",
      "Never miss twice. You've now missed twice, thrice, and started calling it a lifestyle.",
    ],
  },
  {
    source: "The Power of Habit",
    lines: [
      "Every habit is a loop: cue, routine, reward. Yours is: open phone, scroll for an hour, feel nothing.",
      "Keystone habits ripple through everything. Your keystone habit appears to be pressing snooze.",
      "You can't delete a bad habit, only replace the routine. Swap 'scrolling' for 'one solved question' and try again.",
      "Cravings drive habits. You crave the job offer, but the only craving you act on is biryani.",
      "Small wins build momentum. You haven't had a win lately because you haven't started a small one.",
      "Willpower works like a muscle. Yours has been on a long holiday.",
      "Find your cue: the exact moment you reach for a distraction. That moment is where your career gets decided.",
      "Habits stick better with a community. Your accountability group is right there in this app. Use it.",
    ],
  },
  {
    source: "Tiny Habits",
    lines: [
      "Tiny Habits says start so small it's silly. 'Solve one question' isn't silly. Doing zero is.",
      "Behaviour needs motivation, ability and a prompt. You have the first two. Set the prompt like it's a job.",
      "Anchor the new habit to something you already do: after brushing, open one question. Don't negotiate with it.",
      "Celebrate right after you do it. You can't celebrate something you haven't done.",
      "Make the behaviour tiny enough that motivation stops being a requirement. It's tiny. You still skipped it.",
      "Feeling good wires the habit in. Solve one problem, feel proud, repeat. It's cheaper than regret.",
      "Stop being consistent with a giant plan you never start. Be consistent with a small one.",
      "Two push-ups become a workout. One question becomes a career. Open the question.",
    ],
  },
  {
    source: "Deep Work",
    lines: [
      "Deep Work says hours of undistracted focus are a career superpower. You have 14 tabs open and 3 notifications.",
      "Attention residue: every notification check leaves part of your brain behind. Yours was left behind in 2023.",
      "Shallow work keeps you busy. Deep work gets you hired. Your calendar says you're very, very busy.",
      "Four hours of real focus beats ten hours of hovering. Close the tabs, then close the gap.",
      "Schedule your deep work blocks, or your inbox will schedule your life for you.",
      "You say you can't focus. You can binge a series for five hours. Focus isn't missing, it's misallocated.",
      "Boredom is training for your attention. Stop curing it with your phone every 90 seconds.",
      "Learning hard things fast is the skill behind the CTC. Practise it: 90 minutes, phone in another room.",
    ],
  },
  {
    source: "Getting Things Done",
    lines: [
      "GTD says your mind is for having ideas, not holding them. Yours is holding 47 unfinished tasks and a grudge.",
      "Capture everything in a trusted system. Your trusted system is currently 'I'll remember'. You won't.",
      "Decide the next physical action. 'Prepare for interviews' isn't one. 'Solve array question #1' is.",
      "If it takes under two minutes, do it now. Replying to the recruiter takes under two minutes.",
      "Review weekly or the system rots. Your last review was a feeling.",
      "A project without a next action is a wish with a deadline.",
      "A clear head isn't a gift. It comes from writing things down and picking what's next.",
      "'Someday/maybe' is a fine list. It's a terrible place to keep your job search.",
    ],
  },
  {
    source: "Eat That Frog!",
    lines: [
      "Eat That Frog says do the hardest task first. Your frog is a system design question and you've been feeding it snacks.",
      "If you must eat two frogs, eat the ugliest first. Yours is the one you've avoided for three weeks.",
      "Plan tomorrow tonight. Tomorrow's you won't make better choices, only shinier excuses.",
      "The 80/20 rule: a few tasks create most of your results. Find your top three and do them first.",
      "Clarity is everything: a written goal, a deadline, a list. Yours is 'be successful'. That's not a list.",
      "Practise a routine until it's automatic. That's how people with less talent beat people with more.",
      "Stop doing easy small tasks to feel productive. Reorganising your bookmarks is not progress.",
      "Your frog isn't getting any smaller. It's just getting louder.",
    ],
  },
  {
    source: "Procrastinate on Purpose",
    lines: [
      "Procrastinate on Purpose says choose what to postpone deliberately. You're postponing everything accidentally.",
      "Eliminate, automate, delegate, procrastinate, concentrate. You skipped to 'procrastinate' and called it strategy.",
      "Some things deserve to be put off. Preparing for the interview isn't one of them.",
      "Multiply your time by working on things that make everything else easier. Building skills is exactly that.",
      "Not everything on your list matters. The item called 'get a job' does.",
      "The best use of your time today is whatever makes tomorrow lighter. That is not a nap.",
      "Procrastination is a choice about what to do instead. You've been choosing badly.",
      "Do the important thing now, delegate or drop the rest. Your 'rest' is mostly noise.",
    ],
  },
];

const BOOK_QUOTES: RealityQuote[] = BOOK_LINES.flatMap(({ source, lines }) =>
  lines.map((text, i) => ({
    id: `habits-${source.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "")}-${i + 1}`,
    category: "habits" as const,
    text,
    source,
  }))
);

export const REALITY_QUOTES: RealityQuote[] = [
  ...(Object.keys(QUOTES) as (keyof typeof QUOTES)[]).flatMap((category) =>
    QUOTES[category].map((text, i) => ({ id: `${category}-${i + 1}`, category, text }))
  ),
  ...BOOK_QUOTES,
];

/**
 * Lines written around the person's own target from Settings: their CTC in LPA, and optionally the company
 * and role they are aiming at. Returns nothing when no target is set. Amounts are gross and approximate.
 */
export function personalQuotes(targetLpa?: number | null, company?: string | null, role?: string | null): RealityQuote[] {
  if (!targetLpa || !(targetLpa > 0)) return [];
  const lpa = Number.isInteger(targetLpa) ? String(targetLpa) : targetLpa.toFixed(1);
  const annual = targetLpa * 100000;
  const monthlyLakh = (annual / 12 / 100000).toFixed(2);
  const daily = Math.round(annual / 365).toLocaleString("en-IN");
  const weekly = Math.round(annual / 52).toLocaleString("en-IN");

  const lines = [
    `You want ${lpa} LPA. That's about ₹${monthlyLakh}L a month. Your current monthly contribution to that goal: a plan.`,
    `${lpa} LPA isn't a wish. It's a skills checklist you haven't started ticking.`,
    `Target: ${lpa} LPA. Current plan: scrolling. These two have never met.`,
    `Every day you delay costs roughly ₹${daily} of the CTC you keep promising yourself. Enjoy the discount on effort.`,
    `A missed week is about ₹${weekly} of future earnings. Hope the break was worth it.`,
    `${lpa} LPA, and the most advanced thing you've shipped is a to-do list.`,
    `Your ${lpa} LPA dream has a deadline. It's called 'everyone else applied first'.`,
    `₹${monthlyLakh}L a month is the goal. Today you've earned ₹0. Let's at least change what you did about it.`,
  ];
  if (company?.trim()) {
    lines.push(
      `${company.trim()} won't hire your daydream. Solve one question and make them reconsider.`,
      `You want ${company.trim()} and ${lpa} LPA. They want proof. Proof comes in solved problems, not saved posts.`
    );
  }
  if (role?.trim()) {
    lines.push(`Aspiring ${role.trim()}. Emphasis on 'aspiring'. Fix the word, not the title.`);
  }
  return lines.map((text, i) => ({ id: `mine-${i + 1}`, category: "ctc" as const, text, personal: true }));
}

export const categoryOf = (id: RealityCategoryId): RealityCategory =>
  REALITY_CATEGORIES.find((c) => c.id === id) ?? REALITY_CATEGORIES[0];

/* ------------------------------------------------------------------ */
/* Picking: a shuffled deck, so quotes don't repeat until all were seen */
/* ------------------------------------------------------------------ */

/** Fisher-Yates shuffle (returns a new array). */
function shuffle<T>(items: T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Hands out every quote in the pool once in random order, then reshuffles. The first quote of a new
 * round is never the one just shown, so the same quote can't appear twice in a row.
 */
export function createQuoteDeck(pool: RealityQuote[], random: () => number = Math.random, lastId?: string) {
  let deck: RealityQuote[] = [];
  let last = lastId;

  const refill = () => {
    deck = shuffle(pool, random);
    if (pool.length > 1 && deck[0]?.id === last) {
      const swap = 1 + Math.floor(random() * (deck.length - 1));
      [deck[0], deck[swap]] = [deck[swap], deck[0]];
    }
  };

  return {
    next(): RealityQuote {
      if (pool.length === 0) throw new Error("Quote pool is empty");
      if (deck.length === 0) refill();
      let q = deck.shift()!;
      // can only happen right after a reshuffle that placed the last quote first; the refill guards it,
      // this covers a pool that changed mid-round
      if (pool.length > 1 && q.id === last) q = deck.shift() ?? q;
      last = q.id;
      return q;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Highlighting                                                          */
/* ------------------------------------------------------------------ */

// One capturing group only, so String.split puts the matches at the odd positions.
const HOT_WORDS =
  /(\bCTC\b|\bLPA\b|₹\s?\d[\d,]*|₹|\bJOBLESS\b|\bunemployment\b|\bSALARY\b|\bREJECTION\b|\boffers?\b|\bplaced\b|\bplacement\b|\bEMI\b|\bBMW\b)/gi;

export type QuoteSegment = { text: string; hot: boolean };

/** Splits a quote so words like CTC, JOBLESS, SALARY, ₹ amounts and REJECTION can be emphasised. */
export function highlightSegments(text: string): QuoteSegment[] {
  return text
    .split(HOT_WORDS)
    .map((part, i) => ({ text: part, hot: i % 2 === 1 }))
    .filter((s) => s.text.length > 0);
}

/* ------------------------------------------------------------------ */
/* Rotation                                                              */
/* ------------------------------------------------------------------ */

/** How long each quote stays before the next one appears. */
export const ROTATE_EVERY_MS = 60_000;
