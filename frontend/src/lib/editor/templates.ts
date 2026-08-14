export interface DiaryTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  title: string;
  contentHtml: string;
  tags: string[];
  emotion?: string;
  chapters: string[];
}

function chapter(title: string): string {
  return `<h1>${title}</h1>`;
}

function prose(...paragraphs: string[]): string {
  return paragraphs.map((p) => `<p>${p}</p>`).join("\n");
}

export const DIARY_TEMPLATES: DiaryTemplate[] = [
  {
    id: "blank",
    name: "Blank Page",
    description: "Start from an empty page and write freely.",
    icon: "file-text",
    title: "",
    contentHtml: "",
    tags: [],
    chapters: [],
  },
  {
    id: "daily-journal",
    name: "Daily Journal",
    description: "Capture a full day - morning, highlights, challenges, and gratitude.",
    icon: "notebook-pen",
    title: "A Day in My Life",
    contentHtml: [
      chapter("Morning Notes"),
      prose(
        "What did the morning feel like? Jot down your first thoughts, the weather, or whatever was on your mind.",
        "",
      ),
      chapter("Highlights"),
      prose(
        "The moments that stood out today, big or small.",
        "",
      ),
      chapter("Challenges"),
      prose(
        "What was difficult today, and how did you get through it?",
        "",
      ),
      chapter("Gratitude"),
      prose(
        "Three things you are grateful for today.",
        "",
      ),
      chapter("Looking Ahead"),
      prose(
        "What do you hope for tomorrow?",
        "",
      ),
    ].join("\n"),
    tags: ["journal", "daily"],
    emotion: "reflective",
    chapters: ["Morning Notes", "Highlights", "Challenges", "Gratitude", "Looking Ahead"],
  },
  {
    id: "travel-log",
    name: "Travel Log",
    description: "Document a trip day by day with space for places and impressions.",
    icon: "plane",
    title: "My Travel Diary",
    contentHtml: [
      chapter("Trip Overview"),
      prose(
        "Where are you going, with whom, and for how long? What is the mood before departure?",
        "",
      ),
      chapter("Day 1"),
      prose(
        "Arrivals, first impressions, and the sights of the day.",
        "",
      ),
      chapter("Day 2"),
      prose(
        "What did you discover today? People, food, places, detours.",
        "",
      ),
      chapter("Day 3"),
      prose(
        "The rhythm is setting in. What is surprising you now?",
        "",
      ),
    ].join("\n"),
    tags: ["travel"],
    emotion: "excited",
    chapters: ["Trip Overview", "Day 1", "Day 2", "Day 3"],
  },
  {
    id: "gratitude",
    name: "Gratitude Journal",
    description: "A gentle practice of noticing the good in each day.",
    icon: "heart-handshake",
    title: "Gratitude Journal",
    contentHtml: [
      chapter("Today I'm Grateful For"),
      prose(
        "List what lifted you today, however small.",
        "",
      ),
      chapter("Small Wins"),
      prose(
        "What went better than expected? What did you finish or begin?",
        "",
      ),
      chapter("Words of Kindness"),
      prose(
        "Something kind said to you - or something kind you can do for someone else.",
        "",
      ),
    ].join("\n"),
    tags: ["gratitude"],
    emotion: "grateful",
    chapters: ["Today I'm Grateful For", "Small Wins", "Words of Kindness"],
  },
  {
    id: "reflection",
    name: "Reflections",
    description: "Long-form space to make sense of where you are and where you're heading.",
    icon: "pen-line",
    title: "Reflections",
    contentHtml: [
      chapter("Where I Am Now"),
      prose(
        "Take stock of the present - thoughts, work, relationships, peace of mind.",
        "",
      ),
      chapter("Lessons Learned"),
      prose(
        "What have recent weeks taught you? What would you tell your past self?",
        "",
      ),
      chapter("Wishes for the Future"),
      prose(
        "What are you hoping for? What small step could you take today?",
        "",
      ),
    ].join("\n"),
    tags: ["reflection"],
    emotion: "reflective",
    chapters: ["Where I Am Now", "Lessons Learned", "Wishes for the Future"],
  },
];