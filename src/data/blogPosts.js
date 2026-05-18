export const posts = [
  {
    slug: 'restaurant-employee-scheduling',
    title: 'How to Schedule Restaurant Employees Without the Sunday Spreadsheet Nightmare',
    date: 'May 18, 2026',
    category: 'Scheduling Tips',
    readTime: '5 min read',
    excerpt: "If you've ever spent your Sunday rebuilding the same schedule after a flurry of employee texts, you already know the problem. Here's a better way.",
    content: [
      { t: 'p', v: "Every restaurant owner knows the feeling. It's Sunday afternoon. You should be resting, meal prepping, or doing anything else. Instead you're hunched over a spreadsheet, trying to remember who asked for Tuesday off, whether Sarah can actually close on Friday, and whether you have enough coverage for the Saturday rush." },
      { t: 'p', v: 'An hour later you\'ve got a draft. You post it to the group chat. Immediately: "Hey can I swap Thursday?" "Wait I can\'t work Monday." "Who\'s opening Saturday?"' },
      { t: 'p', v: "You spend the next 45 minutes sorting it out. The schedule that took you an hour to build gets rebuilt in real time, one text at a time." },
      { t: 'p', v: "This is how most small restaurants schedule employees. And it's exhausting." },

      { t: 'h2', v: 'Why Spreadsheets Break Down' },
      { t: 'p', v: "Spreadsheets are free, familiar, and flexible — which is exactly why restaurant owners default to them. But they have a few fatal flaws for shift scheduling:" },
      { t: 'ul', v: [
        'No real-time visibility. You post the schedule, but employees have to actively go find it. Most don\'t check the shared Google Sheet until the night before their shift. Then comes the "wait, I work tomorrow?" text.',
        "No notifications. When you change a shift, no one knows unless you tell them individually. This creates a version control nightmare.",
        "No built-in swap workflow. When someone can't make it in, you become the dispatcher — calling, texting, and begging until you find coverage. There's no system for employees to sort it out themselves.",
        "No availability tracking. You're working from memory or a separate notes doc to remember who can work when. One mistake and you schedule someone who told you they can't come in.",
      ]},

      { t: 'h2', v: 'What Good Restaurant Scheduling Actually Looks Like' },
      { t: 'p', v: "The goal isn't a perfect schedule — it's a schedule you can build fast and that doesn't require you to manage it all week." },
      { t: 'p', v: 'Good scheduling has three properties:' },
      { t: 'ol', v: [
        "It gets built once. You set it, publish it, and don't have to re-explain it to 12 people.",
        "Employees can see it instantly. Not after they remember to check the group chat — right away, on their phone.",
        "Swaps happen without you. When someone can't come in, there's a process for finding coverage that doesn't require you as the middleman.",
      ]},

      { t: 'h2', v: 'A Better Process, Step by Step' },

      { t: 'h3', v: 'Step 1: Collect availability before you build' },
      { t: 'p', v: "Before building anything, know who's actually available. Send a quick message on Thursday asking for any availability changes for the following week. Don't build a schedule and then discover conflicts — collect availability first." },

      { t: 'h3', v: 'Step 2: Build around your coverage requirements' },
      { t: 'p', v: "Start with your non-negotiables: how many people do you need per shift, at what times, in what roles. Fill the hardest slots first (Saturday dinner, Friday close). Don't start from \"who wants to work\" — start from \"what do I need covered.\"" },

      { t: 'h3', v: 'Step 3: Publish with one action' },
      { t: 'p', v: "Once the schedule is done, everyone should find out at the same time, automatically — not after you copy-paste it into a group text. ScheduForge sends notifications the moment you hit publish. Every employee gets an alert on their phone." },

      { t: 'h3', v: 'Step 4: Let employees manage their own swaps' },
      { t: 'p', v: "When someone can't make it in, they should request a swap in the app. Other employees who are free can pick it up. You approve or deny with one tap. You never have to be the person tracking down coverage." },

      { t: 'h3', v: 'Step 5: Lock the schedule 48 hours out' },
      { t: 'p', v: "Set a rule: swap requests need to be made at least 48 hours before the shift. This gives you and other employees time to respond. Last-minute scrambles are almost always caused by last-minute requests." },

      { t: 'h2', v: 'The Right Tool for the Job' },
      { t: 'p', v: 'Your options for restaurant scheduling:' },
      { t: 'ul', v: [
        "Spreadsheets (Google Sheets / Excel): Free, but everything above is a manual process. Fine for a team of 3 — breaks down fast as you grow.",
        "Paper schedules: Zero visibility, zero notifications. Still used in a lot of kitchens, but it can't scale.",
        "Legacy scheduling software (When I Work, Homebase, 7shifts): Powerful, but expensive and often more complex than a small restaurant needs.",
        "ScheduForge: Built for exactly this — small restaurant teams who want to replace the spreadsheet without paying enterprise prices or learning a complicated system. $29/month for up to 15 employees, 14-day free trial, no credit card.",
      ]},

      { t: 'h2', v: 'The Bottom Line' },
      { t: 'p', v: "You're going to spend time on scheduling no matter what. The question is how much, and how much of it spills into your week after the schedule is posted." },
      { t: 'p', v: "A good process and a simple tool cuts your scheduling time from 2–3 hours down to 20–30 minutes and eliminates most of the \"hey can I swap\" conversations. That's a few hundred dollars of your time saved every month, for $29." },

      { t: 'cta', label: 'Start your free trial →', href: '/signup', note: '14-day free trial · No credit card required · Set up in under 10 minutes' },
    ],
  },
];
