import Link from "next/link";
import { BrowseSidebar } from "@/components/diary/browse-sidebar";
import { DiaryEntry } from "@/components/diary/diary-entry";

const sampleEntries = [
  {
    id: "1",
    title: "The morning light through the window reminds me of grandmother's kitchen",
    author: { username: "quiet_wanderer", id: "u1" },
    publishedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    readingTime: 5,
    commentCount: 12,
    isPublic: true,
    tags: ["life", "reflection", "family"],
    emotion: "grateful",
    excerpt:
      "There is a particular quality to the light at 7am in June. It comes in at an angle that catches the dust motes floating in the air, turning them into tiny golden planets orbiting some invisible sun...",
  },
  {
    id: "2",
    title: "Packing for a trip I never thought I'd take",
    author: { username: "nomad_heart", id: "u2" },
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    readingTime: 3,
    commentCount: 8,
    isPublic: true,
    tags: ["travel", "life"],
    emotion: "hopeful",
    excerpt:
      "The suitcase is on the bed, open and empty. It has been there for three days now. I keep walking past it, adding things one at a time—a book, a scarf, the charger—as if I am testing...",
  },
  {
    id: "3",
    title: "On letting go of the person I used to be",
    author: { username: "ink_and_tears", id: "u3" },
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    readingTime: 7,
    commentCount: 24,
    isPublic: false,
    tags: ["reflection", "mental-health", "poetry"],
    emotion: "melancholy",
    excerpt:
      "I found an old journal yesterday. Not this one—a physical one, with a cracked leather cover and pages yellowed at the edges. Reading it felt like reading the diary of a stranger who happens to share my...",
  },
  {
    id: "4",
    title: "A recipe passed down through four generations",
    author: { username: "sourdough_soul", id: "u4" },
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    readingTime: 4,
    commentCount: 15,
    isPublic: true,
    tags: ["life", "family", "art"],
    emotion: "joyful",
    excerpt:
      "My great-grandmother wrote this recipe in 1943, on the back of a ration card. The handwriting is elegant and slightly frantic, as if she was running out of ink. The ingredients are simple—flour, eggs, butter...",
  },
  {
    id: "5",
    title: "Why I stopped checking the news every morning",
    author: { username: "slow_living", id: "u5" },
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    readingTime: 6,
    commentCount: 31,
    isPublic: true,
    tags: ["reflection", "life"],
    emotion: "reflective",
    excerpt:
      "It started as an experiment. Thirty days without opening a news app before noon. I expected to feel uninformed. Instead, I found that the world continued to turn, and the things that truly mattered...",
  },
];

export default function Home() {
  return (
    <div className="flex gap-8 lg:gap-10">
      <BrowseSidebar />

      <div className="min-w-0 flex-1">
        <div className="mb-5 pb-4 border-b border-border">
          <h1 className="font-serif text-xl font-semibold text-foreground">Recent Diaries</h1>
          <p className="text-xs text-muted mt-0.5">
            Public entries from the archive
          </p>
        </div>

        <div>
          {sampleEntries.map((entry) => (
            <DiaryEntry key={entry.id} entry={entry} />
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-border">
          <Link
            href="/explore"
            className="text-sm text-muted hover:text-foreground no-underline hover:underline"
          >
            View more diaries →
          </Link>
        </div>
      </div>
    </div>
  );
}
