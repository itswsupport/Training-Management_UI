/**
 * The ETMS user manual, as data.
 *
 * One source, two renderings: `/user-guide` draws it as the app's own cards,
 * and `scripts/build-user-manual.mjs` draws the same chapters into
 * `public/ETMS-User-Manual.pdf`. Keeping the words here is what stops the
 * printed manual and the on-screen one drifting apart.
 *
 * `.mjs` rather than `.js` on purpose: the PDF is built by a plain `node`
 * script, and this package has no `"type": "module"`, so a `.js` file here
 * would be parsed as CommonJS and the script could not import it.
 *
 * Block shapes a renderer must handle:
 *   { type: "para",    text }
 *   { type: "heading", text }
 *   { type: "steps",   items: [{ title?, text }] }
 *   { type: "bullets", items: [text] }
 *   { type: "terms",   items: [{ term, color?, text }] }
 *   { type: "notice",  tone: "info"|"warn"|"success"|"danger", text }
 *   { type: "cards",   items: [{ label, color, icon? }] }
 *   { type: "form",    title, fields: [{ label, placeholder?, options?,
 *                        wide?, lines? }], actions?: [{ label, tone? }] }
 *   { type: "screen",  caption?, chrome?, tiles?, panel?, kind? }
 *
 * A `screen` block draws a grid by default. `kind` swaps that for a sheet the
 * grid shapes cannot describe:
 *   kind: "certificate" — the certificate page's printed sheet
 *   kind: "player"      — the course page's video preview card, with
 *                         { badge?, lecture?, note?, progress?, rows? } where
 *                         each row is { name, state: "done"|"playing"|"todo",
 *                         action? }
 *
 * Each chapter carries an `audience`: "user", "officer" or "both". The manual's
 * toggle reads it, so a reader can look at the other role's chapters without
 * having that role.
 */

/**
 * Mirrors `src/lib/palette.js`. Repeated as literals rather than imported
 * because that file is CommonJS to `node` and this one has to stay importable
 * by the build script with no bundler in front of it.
 */
export const C = {
  brand: "#3482AE",
  brandDark: "#2a6a8f",
  pending: "#ffc107",
  approved: "#20c997",
  rejected: "#dc3545",
  muted: "#adb5bd",
};

export const MANUAL_TITLE = "REPL ETMS";
export const MANUAL_SUBTITLE = "Employee Training Management System";
export const MANUAL_NAME = "User Manual";

export const CHAPTERS = [
  /* ---------------------------------------------------------------- */
  {
    id: "start",
    audience: "both",
    label: "GETTING STARTED",
    icon: "Compass",
    color: C.brand,
    tile: "bg-[#3482AE] hover:bg-[#2a6a8f]",
    cards: [
      {
        title: "What ETMS is",
        icon: "GraduationCap",
        color: C.brand,
        subtitle:
          "ETMS is the Employee Training Management System — the place where the training assigned to you is listed, watched, tested and certified.",
        blocks: [
          {
            type: "bullets",
            items: [
              "Every course assigned to you appears on your USER dashboard, sorted into four states so you can see at a glance what still needs doing.",
              "A course is made of sections. Each section holds lectures, each lecture holds its material — a video, a document, or both — and an assignment.",
              "You work through the material, complete the assignment, then submit the feedback form. Only then is the course marked completed and the certificate issued.",
              "Courses are assigned to you by the training officer. You do not enrol yourself.",
            ],
          },
        ],
      },
      {
        title: "Signing in",
        icon: "LogIn",
        color: C.pending,
        blocks: [
          {
            type: "steps",
            items: [
              {
                title: "Open ETMS",
                text: "reach it from the REPL group portal HOME link, or go to the ETMS address directly.",
              },
              {
                title: "Enter your employee code and password",
                text: "these are your usual REPL portal credentials. ETMS does not keep a separate password, so there is nothing extra to remember or reset here.",
              },
              {
                title: "You land on your dashboard",
                text: "a training officer opens on the Training Officer Dashboard; everyone else opens on the User Dashboard.",
              },
            ],
          },
          {
            type: "notice",
            tone: "warn",
            text: "If sign-in is refused with a role error, your account has not been given a training role yet. Contact the training officer — a password reset will not fix this.",
          },
        ],
      },
      {
        title: "Finding your way around",
        icon: "Compass",
        color: C.approved,
        blocks: [
          { type: "heading", text: "The sidebar" },
          {
            type: "terms",
            items: [
              {
                term: "Home",
                color: C.brand,
                text: "leaves ETMS and returns you to the REPL group portal dashboard.",
              },
              {
                term: "User",
                color: C.brand,
                text: "your own learning — the four course tiles and the lists under them.",
              },
              {
                term: "Training Officer",
                color: C.rejected,
                text: "the administration screens. This entry only appears for a training officer.",
              },
              {
                term: "Logout",
                color: C.muted,
                text: "ends the session. Use it on any shared machine.",
              },
            ],
          },
          { type: "heading", text: "The top bar" },
          {
            type: "bullets",
            items: [
              "The ☰ button collapses and expands the sidebar — useful on a narrow screen, or when a course table is wide.",
              "HELP opens this manual in a new tab, from anywhere in the application.",
              "LOGOUT signs you out immediately.",
              "Every screen carries a BACK button at the top right that returns you to where you came from.",
            ],
          },
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    id: "courses",
    audience: "user",
    label: "COURSES & LECTURES",
    icon: "BookOpen",
    color: C.pending,
    tile: "bg-[#ffc107] hover:bg-[#e0a800]",
    cards: [
      {
        title: "The four course tiles",
        icon: "ListChecks",
        color: C.pending,
        subtitle:
          "The tiles across the top of the User Dashboard are navigation, not counters. Pick one and the list below it changes.",
        blocks: [
          {
            type: "cards",
            items: [
              { label: "PENDING", color: C.pending, icon: "Hourglass" },
              { label: "IN PROCESS", color: C.brand, icon: "BookOpen" },
              { label: "COMPLETED", color: C.approved, icon: "CheckCircle2" },
              { label: "OVERDUE", color: C.rejected, icon: "AlertTriangle" },
            ],
          },
          {
            type: "terms",
            items: [
              {
                term: "Pending",
                color: C.pending,
                text: "assigned to you but not started. Open one to begin.",
              },
              {
                term: "In Process",
                color: C.brand,
                text: "started but not finished — material still to watch, an assignment still to submit, or the feedback form still to fill in.",
              },
              {
                term: "Completed",
                color: C.approved,
                text: "finished, with the certificate available to view and download. The list also shows your grade and registration date.",
              },
              {
                term: "Overdue",
                color: C.rejected,
                text: "the quarter lapsed before the course was finished. These are view-only: you can see the course but cannot open, start or act on it.",
              },
            ],
          },
          {
            type: "screen",
            chrome: true,
            caption:
              "PENDING — courses assigned to you that you have not opened yet.",
            tiles: [
              { label: "PENDING", color: C.pending, active: true },
              { label: "IN PROCESS", color: C.brand },
              { label: "COMPLETED", color: C.approved },
              { label: "OVERDUE", color: C.rejected },
            ],
            panel: {
              title: "PENDING COURSES",
              color: C.pending,
              columns: ["COURSE NO", "COURSE NAME", "COURSE CATEGORY", "COURSE INSTRUCTOR"],
              rows: [
                ["TM-001", "Introduction to Workplace Safety", "Safety", "R. Deshmukh"],
                ["TM-004", "Fire Drill & Evacuation", "Safety", "S. Kulkarni"],
              ],
            },
          },
          {
            type: "screen",
            caption:
              "IN PROCESS — opened, but material, an assignment or the feedback form is still outstanding.",
            panel: {
              title: "IN-PROCESS COURSES",
              color: C.brand,
              columns: ["COURSE NO", "COURSE NAME", "COURSE CATEGORY", "COURSE INSTRUCTOR"],
              rows: [
                ["TM-002", "Time & Stress Management", "Behavioural", "A. Joshi"],
              ],
            },
          },
          {
            type: "screen",
            caption:
              "COMPLETED — with your grade, and the certificate column for viewing or downloading it.",
            panel: {
              title: "COMPLETED COURSES",
              color: C.approved,
              columns: ["COURSE NO", "COURSE NAME", "GRADE", "CERTIFICATE"],
              rows: [
                ["TM-003", "Quality Basics", "A", "@certificate"],
                ["TM-005", "5S at the Workplace", "B", "@certificate"],
              ],
            },
          },
          {
            type: "screen",
            caption:
              "OVERDUE — view-only. The course number is greyed out because the row cannot be opened.",
            panel: {
              title: "OVERDUE COURSES",
              color: C.rejected,
              columns: ["COURSE NO", "COURSE NAME", "COURSE CATEGORY", "COURSE INSTRUCTOR"],
              rows: [
                [
                  { text: "TM-006", pill: C.muted },
                  "Machine Guarding",
                  "Safety",
                  "R. Deshmukh",
                ],
              ],
            },
          },
          {
            type: "notice",
            tone: "danger",
            text: "An overdue course cannot be reopened from here. If you still need to complete it, ask the training officer to reassign it.",
          },
        ],
      },
      {
        title: "Opening a course",
        icon: "FileText",
        color: C.brand,
        subtitle:
          "Click any course in a list to open it. The course page is the same for every course, so it is worth knowing its parts.",
        blocks: [
          {
            type: "steps",
            items: [
              {
                title: "The header banner",
                text: "carries the course code, its name, and pills for the category, the instructor and the date it is valid until.",
              },
              {
                title: "The player card, on the right",
                text: "starts empty and plays whichever lecture video you pick from COURSE CONTENT. Nothing plays until you choose one, and only what plays here is counted.",
              },
              {
                title: "Course description and what you will learn",
                text: "what the course covers and what you are expected to take away from it.",
              },
              {
                title: "Topics covered and this course includes",
                text: "the section list, and a count of the sections and lectures in front of you.",
              },
              {
                title: "COURSE CONTENT",
                text: "the blue bar lower down the page. This is the part you actually work through — sections that expand to show their lectures.",
              },
            ],
          },
        ],
      },
      {
        title: "Watching a lecture video",
        icon: "MonitorPlay",
        color: C.brand,
        subtitle:
          "Opening a video is not the same as watching it. ETMS measures how much of a lecture has actually gone by before it counts.",
        blocks: [
          {
            type: "steps",
            items: [
              {
                title: "Expand a section",
                text: "under COURSE CONTENT. The first section is already open; click any other to expand it.",
              },
              {
                title: "Click the lecture's video",
                text: "an uploaded video, or a YouTube lecture, plays in the preview card at the top right of the page — the page does not navigate away.",
              },
              {
                title: "Watch it through",
                text: "the video counts as watched once about 90% of it has actually been played. Skipping to the end does not fill the bar; only time you have really covered counts.",
              },
              {
                title: "Keep the speed sensible",
                text: "playback above 1.25× earns no credit. Faster than that is not watching, so the counter stops.",
              },
              {
                title: "Look for the green tick",
                text: 'the words "opened" appear in green beside the material once it is done, and the section header shows how many of its lectures are finished.',
              },
            ],
          },
          {
            type: "screen",
            kind: "player",
            chrome: true,
            badge: "62% watched · 90% needed",
            lecture: "1.2 Personal Protective Equipment",
            progress: "1/3 done",
            rows: [
              { name: "1.1 Why safety matters", state: "done" },
              {
                name: "1.2 Personal Protective Equipment",
                state: "playing",
                action: "Watch video",
              },
              {
                name: "1.3 Safety data sheets (PDF)",
                state: "todo",
                action: "Open file",
              },
            ],
            caption:
              "The preview card plays the lecture you click, and the badge over it counts what has actually been watched. Below, under COURSE CONTENT, a finished lecture turns green and reads COMPLETED; the one in front of you offers WATCH VIDEO.",
          },
          {
            type: "notice",
            tone: "info",
            text: "Time is only counted while the video is genuinely playing. Pressing play and walking away earns nothing — a paused player counts for nothing either.",
          },
          {
            type: "notice",
            tone: "warn",
            text: "Some links — a Google Drive or Vimeo page, for example — cannot be played inside ETMS. Those open in a new browser tab and are ticked as soon as you open them, because nothing on the other side can report back.",
          },
        ],
      },
      {
        title: "Reading a document",
        icon: "FileText",
        color: C.approved,
        subtitle:
          "PDFs, spreadsheets and images open in a reader over the page, with a progress bar that fills as you read.",
        blocks: [
          {
            type: "terms",
            items: [
              {
                term: "PDF",
                color: C.brand,
                text: "every page has to have been on screen, at least half visible, for about five seconds. Scroll through the whole document — jumping to the last page does not finish it.",
              },
              {
                term: "Spreadsheet",
                color: C.approved,
                text: "counts once it has been open in front of you for about fifteen seconds.",
              },
              {
                term: "Image",
                color: C.pending,
                text: "counts after about five seconds on screen.",
              },
            ],
          },
          {
            type: "notice",
            tone: "info",
            text: "A lecture with both a video and a document needs both. Opening the PDF does not mark the video watched, and playing the video does not mark the PDF read.",
          },
        ],
      },
      {
        title: "Assignments",
        icon: "Lock",
        color: C.rejected,
        subtitle:
          "Each lecture has its own assignment, and the section has one covering all of it. Both are gated on the material.",
        blocks: [
          {
            type: "steps",
            items: [
              {
                title: "Finish the lecture's material",
                text: "a lecture's assignment unlocks once every piece of material in that lecture is done — not just the first one.",
              },
              {
                title: "Finish every lecture in the section",
                text: "the section's own assignment stays locked until all of its lectures are done, so you cannot skip ahead to the paper.",
              },
              {
                title: "Open the assignment",
                text: "use the Start assignment link under the lecture, or the section-wide link at the foot of the section.",
              },
              {
                title: "Answer and submit",
                text: "once submitted, the section shows a SUBMITTED badge and you cannot take that paper again.",
              },
            ],
          },
          {
            type: "form",
            title: "Assignment Paper",
            fields: [
              {
                label: "1) Which of these must be worn in the shop floor area?",
                options: [
                  "Safety helmet",
                  "Safety shoes",
                  "Both of the above",
                  "Neither",
                ],
              },
            ],
            actions: [{ label: "Submit" }, { label: "Cancel", tone: "danger" }],
          },
          {
            type: "notice",
            tone: "warn",
            text: 'Why is my assignment locked? Because its material has not been marked done. Go back to COURSE CONTENT and check each item under the lecture for the green "opened" tick.',
          },
          {
            type: "notice",
            tone: "info",
            text: "The ticks are remembered per browser. Sitting a lecture on a different machine, or clearing your browser data, can reset them — but a submitted assignment is kept on the server and settles that section either way.",
          },
        ],
      },
      {
        title: "The feedback form",
        icon: "MessageSquareText",
        color: C.rejected,
        blocks: [
          {
            type: "bullets",
            items: [
              "Once every assignment in the course is submitted, a red FEEDBACK FORM button appears in the course header.",
              "The form is mandatory. Until it is submitted the course stays IN PROCESS and no certificate is issued, however many assignments you have completed.",
              "The course page shows a red banner reminding you of this while the form is outstanding.",
            ],
          },
          {
            type: "form",
            title: "Course Feedback Form",
            fields: [
              {
                label: "1) How useful was this course to your day-to-day work?",
                options: [
                  "Very useful",
                  "Useful",
                  "Somewhat useful",
                  "Not useful",
                ],
              },
              {
                label: "2) What would you change about this course?",
                placeholder: "Type your answer…",
                wide: true,
                lines: 3,
              },
            ],
            actions: [{ label: "Submit" }, { label: "Cancel", tone: "danger" }],
          },
        ],
      },
      {
        title: "When a course changes",
        icon: "Sparkles",
        color: C.pending,
        blocks: [
          {
            type: "bullets",
            items: [
              "If the training officer adds material to a course you have already completed, a yellow NEW CONTENT badge appears on the course header.",
            ],
          },
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    id: "certificates",
    audience: "user",
    label: "CERTIFICATES",
    icon: "Award",
    color: C.approved,
    tile: "bg-[#20c997] hover:bg-[#1aa179]",
    cards: [
      {
        title: "Getting your certificate",
        icon: "Award",
        color: C.approved,
        subtitle:
          "A certificate is issued the moment a course reaches the completed state. There is nothing to request and nobody to ask.",
        blocks: [
          {
            type: "steps",
            items: [
              {
                title: "Open the COMPLETED tile",
                text: "on your User Dashboard.",
              },
              {
                title: "Find the course in the list",
                text: "the completed list carries your grade and registration date alongside each course.",
              },
              {
                title: "Use the certificate column",
                text: "the eye icon opens the certificate on screen; the download icon writes it out as a PDF file.",
              },
            ],
          },
          {
            type: "screen",
            caption:
              "The COMPLETED list. The eye opens the certificate; the arrow downloads it as a PDF.",
            panel: {
              title: "COMPLETED COURSES",
              color: C.approved,
              columns: ["COURSE NO", "COURSE NAME", "GRADE", "CERTIFICATE"],
              rows: [["TM-003", "Quality Basics", "A", "@certificate"]],
            },
          },
          {
            type: "screen",
            kind: "certificate",
            caption: "The certificate itself, as it opens on screen.",
          },
          {
            type: "notice",
            tone: "success",
            text: "The certificate on screen and the downloaded PDF are the same drawing, so what you see is exactly what prints.",
          },
        ],
      },
      {
        title: "If the certificate will not open",
        icon: "Download",
        color: C.pending,
        blocks: [
          {
            type: "bullets",
            items: [
              "A certificate only exists for a course in the COMPLETED state. If the course still sits under IN PROCESS something is outstanding — most often the feedback form.",
              "The download builds the PDF in your browser, so give it a moment on a slow connection and do not click twice.",
              "If the page says the certificate is unavailable, go back to your dashboard and check the course really is listed under COMPLETED.",
            ],
          },
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    id: "officer",
    audience: "officer",
    label: "TRAINING OFFICER",
    icon: "GraduationCap",
    color: C.brandDark,
    tile: "bg-[#2a6a8f] hover:bg-[#215875]",
    cards: [
      {
        title: "The officer dashboard",
        icon: "GraduationCap",
        color: C.brandDark,
        subtitle:
          "Four tiles run across the top of every officer screen. Three of them swap the panel below; COURSE STATUS is a screen of its own.",
        blocks: [
          {
            type: "cards",
            items: [
              { label: "ADD MODULE", color: C.brand, icon: "FilePlus" },
              { label: "ALL MODULES", color: C.pending, icon: "List" },
              { label: "COURSE STATUS", color: C.approved, icon: "ClipboardCheck" },
              { label: "FEEDBACK FORM", color: C.rejected, icon: "MessageSquareText" },
            ],
          },
          {
            type: "terms",
            items: [
              {
                term: "Add Module",
                color: C.brand,
                text: "the form for creating a new training module.",
              },
              {
                term: "All Modules",
                color: C.pending,
                text: "every module in the system, and the way in to editing one.",
              },
              {
                term: "Course Status",
                color: C.approved,
                text: "the organisation-wide report of who has completed what.",
              },
              {
                term: "Feedback Form",
                color: C.rejected,
                text: "the questions learners answer at the end of a course.",
              },
            ],
          },
          {
            type: "screen",
            chrome: true,
            caption:
              "The officer dashboard, with ALL MODULES showing. Click a course to open it.",
            tiles: [
              { label: "ADD MODULE", color: C.brand },
              { label: "ALL MODULES", color: C.pending, active: true },
              { label: "COURSE STATUS", color: C.approved },
              { label: "FEEDBACK FORM", color: C.rejected },
            ],
            panel: {
              title: "ALL MODULES",
              color: C.pending,
              columns: ["COURSE NO", "COURSE NAME", "COURSE CATEGORY", "COURSE INSTRUCTOR"],
              rows: [
                ["TM-001", "Introduction to Workplace Safety", "Safety", "R. Deshmukh"],
                ["TM-002", "Time & Stress Management", "Behavioural", "A. Joshi"],
              ],
            },
          },
          {
            type: "notice",
            tone: "info",
            text: "You also have an ordinary USER dashboard. Courses assigned to you as a learner live there — the officer screens are for administration only.",
          },
        ],
      },
      {
        title: "Creating a module",
        icon: "FilePlus",
        color: C.brand,
        blocks: [
          {
            type: "steps",
            items: [
              {
                title: "Open ADD MODULE",
                text: "the form opens in the panel below the tiles.",
              },
              {
                title: "Fill in the module details",
                text: "code, name, category, instructor, validity and description.",
              },
              {
                title: "Save",
                text: "the panel returns to ALL MODULES with the new module in the list.",
              },
              {
                title: "Add the content",
                text: "open the new module from ALL MODULES and use EDIT to build its sections, lectures, material and assignment questions.",
              },
            ],
          },
          {
            type: "form",
            title: "Course Details Form",
            fields: [
              {
                label: "Course Name",
                placeholder: "e.g. Introduction to Workplace Safety",
              },
              { label: "Course Category", placeholder: "- Select Category -" },
              { label: "Course Instructor", placeholder: "- Select Instructor -" },
              { label: "Applicable Quarter", placeholder: "- Select Quarter -" },
              { label: "Department", placeholder: "Select department(s)" },
              { label: "Grade", placeholder: "Select grade(s)" },
              {
                label: "Course Description",
                placeholder: "Enter …",
                wide: true,
                lines: 3,
              },
            ],
            actions: [{ label: "Save" }, { label: "Cancel", tone: "danger" }],
          },
          {
            type: "notice",
            tone: "info",
            text: "DEPARTMENT, GRADE and APPLICABLE QUARTER are what assign the course. Everyone in a selected department and grade gets it for that quarter — there is no separate screen for picking employees one by one.",
          },
        ],
      },
      {
        title: "Uploading lectures and material",
        icon: "MonitorPlay",
        color: C.brandDark,
        subtitle:
          "Sections hold lectures, and each lecture holds the material a learner has to get through. This is built inside the course editor.",
        blocks: [
          {
            type: "steps",
            items: [
              {
                title: "Open the course and press EDIT",
                text: "from ALL MODULES. The section and lecture editor opens under the course details.",
              },
              {
                title: "Add a section, then name it",
                text: "a section is a chapter of the course — for example Introduction, or Shop Floor Rules.",
              },
              {
                title: "Add a lecture inside it",
                text: "give it a name, then attach its material.",
              },
              {
                title: "Attach a video, a file, or a link",
                text: "an uploaded video plays inside ETMS and its watch time is measured. A link to a page ETMS cannot play — a Drive or Vimeo page — opens in a new tab and is ticked as soon as the learner opens it.",
              },
              {
                title: "Save",
                text: "the lecture appears under COURSE CONTENT for every learner the course is assigned to.",
              },
            ],
          },
          {
            type: "form",
            title: "Lecture & Material",
            fields: [
              { label: "Lecture Name", placeholder: "Lecture 1 name" },
              { label: "Upload Video", placeholder: "Choose file (mp4 / webm)" },
              { label: "Upload File", placeholder: "Choose file (PDF / image / sheet)" },
              { label: "External Link", placeholder: "https://…" },
            ],
            actions: [{ label: "Save" }, { label: "Cancel", tone: "danger" }],
          },
          {
            type: "screen",
            kind: "player",
            chrome: true,
            note: "Preview — progress is not recorded",
            lecture: "1.2 Personal Protective Equipment",
            rows: [
              {
                name: "1.1 Why safety matters",
                state: "todo",
                action: "Watch video",
              },
              {
                name: "1.2 Personal Protective Equipment",
                state: "playing",
                action: "Watch video",
              },
            ],
            caption:
              "The same card, opened as an officer. An uploaded lecture plays here so you can check what you have attached — but nothing you open is recorded, which is why the amber note stands where a learner sees their progress bar.",
          },
          {
            type: "notice",
            tone: "warn",
            text: "A lecture with both a video and a document requires the learner to finish both before its assignment unlocks. Attach only what you actually want them to work through.",
          },
        ],
      },
      {
        title: "Writing the assignment",
        icon: "ClipboardCheck",
        color: C.pending,
        subtitle:
          "Assignment questions are written per lecture, in the same editor as the content.",
        blocks: [
          {
            type: "steps",
            items: [
              {
                title: "Open the section's questions",
                text: "in the course editor, under the lecture the question belongs to.",
              },
              {
                title: "Type the question",
                text: "then fill in its four options.",
              },
              {
                title: "Mark the correct answer",
                text: "click an option to mark it correct; click it again to unmark it.",
              },
              {
                title: "Save",
                text: "the paper unlocks for a learner once they have finished that lecture's material.",
              },
            ],
          },
          {
            type: "form",
            title: "Assignment Question",
            fields: [
              { label: "Question 1", placeholder: "Question 1", wide: true },
              {
                label: "Options — click the correct one to mark it",
                options: ["Option A", "Option B", "Option C", "Option D"],
              },
            ],
            actions: [{ label: "Save" }, { label: "Cancel", tone: "danger" }],
          },
          {
            type: "notice",
            tone: "info",
            text: "A question written without a lecture of its own is spread across the section's lectures in order, so older papers still reach their learners.",
          },
        ],
      },
      {
        title: "Editing a course",
        icon: "Pencil",
        color: C.approved,
        blocks: [
          {
            type: "steps",
            items: [
              {
                title: "Go to ALL MODULES",
                text: "and click the course you want to change.",
              },
              {
                title: "Press EDIT in the course header",
                text: "EDIT only appears when you arrive from the officer module list. Opening the same course from your own learner dashboard gives the plain read-only page.",
              },
              {
                title: "Change the details and the content",
                text: "the course details form and the section / lecture editor are both open at once.",
              },
              {
                title: "Press UPDATE",
                text: "one save covers both forms. CANCEL leaves everything as it was, with nothing written.",
              },
            ],
          },
          {
            type: "notice",
            tone: "warn",
            text: "Adding material to a course learners have already completed does not revoke their certificates. They see a NEW CONTENT badge on the course instead.",
          },
          {
            type: "bullets",
            items: [
              "Course history sits at the foot of the course when you open it from the officer module list, so you can see what changed and when.",
              "Opening a lecture or an assignment as an officer never records progress. You always get the assignment paper read-only, with no way to answer or submit.",
            ],
          },
        ],
      },
      {
        title: "Course status report",
        icon: "ClipboardCheck",
        color: C.brand,
        blocks: [
          {
            type: "bullets",
            items: [
              "COURSE STATUS opens the full report of every employee against every course assigned to them.",
              "The table filters, sorts and exports — use the toolbar above it for column choice, density, full screen and export to Excel or PDF.",
              "The report is cached. Use the retry / refresh action if you have just changed something and want the numbers rebuilt.",
            ],
          },
          {
            type: "screen",
            full: true,
            officer: true,
            screenTitle: "COURSE STATUS",
            caption:
              "The COURSE STATUS screen in full — sidebar, header bar, the officer tiles, the report and the footer.",
            tiles: [
              { label: "ADD MODULE", color: C.brand },
              { label: "ALL MODULES", color: C.pending },
              { label: "COURSE STATUS", color: C.approved, active: true },
              { label: "FEEDBACK FORM", color: C.rejected },
            ],
            panel: {
              title: "COURSE STATUS",
              color: C.approved,
              columns: [
                "EMPLOYEE CODE",
                "EMPLOYEE NAME",
                "COURSE",
                "KRA QUARTER",
                "STATUS",
              ],
              rows: [
                [
                  "10234",
                  "Employee Name",
                  "Introduction to Workplace Safety",
                  "Q1",
                  { text: "Completed", pill: C.approved },
                ],
                [
                  "10235",
                  "Employee Name",
                  "Time & Stress Management",
                  "Q1",
                  { text: "In Process", pill: C.brand },
                ],
                [
                  "10236",
                  "Employee Name",
                  "Fire Drill & Evacuation",
                  "Q1",
                  { text: "Overdue", pill: C.rejected },
                ],
              ],
            },
          },
        ],
      },
      {
        title: "Feedback form",
        icon: "MessageSquareText",
        color: C.rejected,
        blocks: [
          {
            type: "bullets",
            items: [
              "The FEEDBACK FORM tile is where the end-of-course questions are maintained.",
              "Learners must submit this form before a course counts as completed, so an empty or broken form will hold up every completion in the system.",
            ],
          },
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    id: "support",
    audience: "both",
    label: "NEED HELP",
    icon: "LifeBuoy",
    color: C.rejected,
    tile: "bg-[#dc3545] hover:bg-[#c82333]",
    cards: [
      {
        title: "Common questions",
        icon: "LifeBuoy",
        color: C.rejected,
        subtitle:
          "The problems that come up most often, and what to do about them.",
        blocks: [
          { type: "heading", text: "My assignment is locked" },
          {
            type: "para",
            text: "Every piece of material in that lecture has to be finished first. Go back to COURSE CONTENT, expand the section, and check each item under the lecture for the green tick. A lecture with both a video and a document needs both.",
          },
          { type: "heading", text: "The video will not tick off" },
          {
            type: "para",
            text: "About 90% of it has to have been played, at normal speed, with the video actually running. Skipping ahead, pausing, or playing faster than 1.25× does not count.",
          },
          { type: "heading", text: "My course is still IN PROCESS" },
          {
            type: "para",
            text: "The feedback form is almost always the missing piece. Open the course and look for the FEEDBACK FORM button in the header.",
          },
          { type: "heading", text: "I cannot find my certificate" },
          {
            type: "para",
            text: "Certificates live on the COMPLETED tile of your dashboard, in the certificate column of the list — not on the course page itself.",
          },
          { type: "heading", text: "A course I need is not in my list" },
          {
            type: "para",
            text: "Courses are assigned by the training officer; you cannot add one yourself. Check the OVERDUE tile too — a lapsed course leaves the pending list.",
          },
        ],
      },
      {
        title: "Still stuck",
        icon: "MessageSquareText",
        color: C.brand,
        blocks: [
          {
            type: "bullets",
            items: [
              "Which courses are assigned to you, an overdue course you still need, or anything about a course's content: contact your training officer.",
              "Sign-in problems, a missing role, or a page that will not load: contact the IT helpdesk.",
              "When reporting a problem, include your employee code, the course name and what the screen said. It saves a round trip.",
            ],
          },
        ],
      },
    ],
  },
];

export default CHAPTERS;
