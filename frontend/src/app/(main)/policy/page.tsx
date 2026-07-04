import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - DiaryArchive",
  description: "How DiaryArchive handles your data, privacy, security, and your rights.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2 mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background p-5 mb-5 shadow-sm">
      {children}
    </div>
  );
}

function WarningCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/50 p-5 my-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-2">
        Important
      </p>
      {children}
    </div>
  );
}

function DataTable({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-overlay/5" : ""}>
              <td className="px-4 py-2.5 border-b border-border/50 font-medium text-foreground whitespace-nowrap">
                {row.label}
              </td>
              <td className="px-4 py-2.5 border-b border-border/50 text-muted">
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PolicyPage() {
  return (
    <div className="mx-auto max-w-3xl py-8">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-foreground mb-1">Privacy Policy</h1>
        <p className="text-sm text-subtle">Last updated - July 4, 2026</p>
      </div>

      <Section title="1. What We Collect">
        <p className="text-base leading-relaxed text-muted mb-4">
          DiaryArchive is built on a privacy-first philosophy. We collect
          only the minimum data necessary to provide the service.
        </p>
        <DataTable
          rows={[
            { label: "Username", value: "Plaintext - your public identity" },
            { label: "Password", value: "Argon2id hash - one-way, unrecoverable" },
            { label: "Email (optional)", value: "AES-256-GCM encrypted at rest - never displayed in UI" },
            { label: "Diary content", value: "Plaintext (public) or AES-256-GCM E2E encrypted (private)" },
            { label: "Uploaded media", value: "UUID filenames in object storage - EXIF stripped, WebP converted" },
            { label: "IP address", value: "Temporarily logged - deleted after 30 days" },
          ]}
        />

        <h3 className="text-base font-semibold text-foreground mt-6 mb-3">We Never Collect</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-muted">
          {[
            "Real name", "Phone number", "Birthday or age",
            "Location / address", "Government ID", "Social media accounts",
            "Browser fingerprint", "Usage analytics", "Behavioral data",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <span className="text-destructive text-xs">&#x2715;</span>
              {item}
            </div>
          ))}
        </div>
      </Section>

      <Section title="2. How Your Data Is Stored">
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoCard>
            <h3 className="text-sm font-semibold text-foreground mb-2">Public Diaries</h3>
            <p className="text-sm leading-relaxed text-muted">
              Stored in MongoDB. Visible to anyone. HTML is sanitized server-side
              to prevent XSS. Indexed in search for discovery.
            </p>
          </InfoCard>
          <InfoCard>
            <h3 className="text-sm font-semibold text-foreground mb-2">Private Diaries</h3>
            <p className="text-sm leading-relaxed text-muted">
              AES-256-GCM encrypted in your browser <em>before</em> upload. The
              server stores only ciphertext and <strong>cannot decrypt</strong> -
              even if the database is compromised.
            </p>
          </InfoCard>
          <InfoCard>
            <h3 className="text-sm font-semibold text-foreground mb-2">Passwords</h3>
            <p className="text-sm leading-relaxed text-muted">
              Argon2id with 64 MB memory, 3 iterations, 4-way parallelism.
              Resistant to GPU and ASIC cracking. We cannot recover lost passwords.
            </p>
          </InfoCard>
          <InfoCard>
            <h3 className="text-sm font-semibold text-foreground mb-2">Email (optional)</h3>
            <p className="text-sm leading-relaxed text-muted">
              AES-256-GCM encrypted at rest. Used only for recovery and security
              notices. Never displayed publicly. Never shared.
            </p>
          </InfoCard>
        </div>
      </Section>

      <Section title="3. Media &amp; Uploads">
        <InfoCard>
          <ul className="space-y-2.5 text-sm leading-relaxed text-muted">
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              Files validated by <strong className="text-foreground">magic-byte inspection</strong>
              - not file extension or claimed MIME type. Executables, PDFs,
              and ZIPs disguised as images are rejected.
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              Images converted to <strong className="text-foreground">WebP format</strong> and
              stripped of EXIF metadata (location, camera model, timestamps)
              before storage.
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              Files stored with <strong className="text-foreground">random UUID filenames</strong>
              - your original filename is never used in URLs.
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              Public media served directly. Private media uses
              <strong className="text-foreground"> 15-minute signed URLs</strong>.
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              Orphaned uploads (not attached to any diary) deleted after
              <strong className="text-foreground"> 24 hours</strong> automatically.
            </li>
            <li className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              Limits: <strong className="text-foreground">500 total files</strong> per user,
              <strong className="text-foreground"> 20 per diary</strong>,
              <strong className="text-foreground"> 50 per day</strong>.
            </li>
          </ul>
        </InfoCard>
      </Section>

      <Section title="4. Who Can See Your Data">
        <DataTable
          rows={[
            { label: "Public diary content", value: "Everyone" },
            { label: "Private diary content", value: "Owner only - server cannot decrypt" },
            { label: "Username", value: "Everyone" },
            { label: "Email address", value: "Owner only - encrypted, never shown" },
            { label: "Password", value: "Nobody - one-way hash" },
            { label: "IP address", value: "System only - 30-day temporary log" },
          ]}
        />
      </Section>

      <Section title="5. Data Retention">
        <DataTable
          rows={[
            { label: "User accounts", value: "Until deleted by you" },
            { label: "Public diaries", value: "Until deleted by you or moderated" },
            { label: "Private diaries", value: "Until deleted by you" },
            { label: "Notifications", value: "90 days (auto-cleaned)" },
            { label: "Refresh tokens", value: "7 days or until logout" },
            { label: "Audit logs", value: "1 year (legal compliance)" },
            { label: "IP address logs", value: "30 days" },
            { label: "Orphaned media", value: "24 hours (auto-cleaned)" },
          ]}
        />
      </Section>

      <Section title="6. Your Rights">
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoCard>
            <h3 className="text-sm font-semibold text-foreground mb-2">Access &amp; Export</h3>
            <p className="text-sm leading-relaxed text-muted">
              Download all your data anytime via Settings. Public diaries as
              JSON/Markdown, private diaries as encrypted JSON with decryption
              instructions, profile data as JSON.
            </p>
          </InfoCard>
          <InfoCard>
            <h3 className="text-sm font-semibold text-foreground mb-2">Delete</h3>
            <p className="text-sm leading-relaxed text-muted">
              Delete your account anytime from Settings. Removes all diaries,
              comments, likes, bookmarks, follows, notifications, and media.
              Audit logs are retained anonymized.
            </p>
          </InfoCard>
          <InfoCard>
            <h3 className="text-sm font-semibold text-foreground mb-2">Correct</h3>
            <p className="text-sm leading-relaxed text-muted">
              Update your profile, email, preferences, and notification
              settings at any time via Settings.
            </p>
          </InfoCard>
          <InfoCard>
            <h3 className="text-sm font-semibold text-foreground mb-2">Portability</h3>
            <p className="text-sm leading-relaxed text-muted">
              Your data is delivered as a downloadable zip file with
              structured, open formats. No proprietary lock-in.
            </p>
          </InfoCard>
        </div>
      </Section>

      <Section title="7. Security Measures">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-2">
          {[
            { label: "E2E Encryption", desc: "AES-256-GCM per-diary keys" },
            { label: "Password Hashing", desc: "Argon2id - 64 MB memory" },
            { label: "Auth Tokens", desc: "JWT 15-min + revocable refresh" },
            { label: "Transport", desc: "HTTPS + HSTS preload" },
            { label: "Rate Limiting", desc: "IP + per-user windows" },
            { label: "XSS Prevention", desc: "Server-side HTML sanitization" },
            { label: "CSRF Protection", desc: "SameSite Strict cookies" },
            { label: "File Validation", desc: "Magic-byte inspection" },
            { label: "Audit Logging", desc: "Immutable admin action trail" },
          ].map((item) => (
            <div key={item.label} className="rounded-md border border-border bg-background p-3">
              <p className="text-xs font-semibold text-foreground mb-0.5">{item.label}</p>
              <p className="text-xs text-muted">{item.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="8. Cookies">
        <p className="text-sm leading-relaxed text-muted mb-4">
          DiaryArchive uses a single essential cookie. We use
          <strong className="text-foreground"> no tracking cookies, no analytics
          cookies, and no advertising cookies</strong>.
        </p>
        <DataTable
          rows={[
            { label: "refresh_token", value: "Session persistence - HTTP only, Secure, SameSite Strict - 7 days" },
          ]}
        />
        <p className="text-xs text-subtle mt-3">
          Your theme preference (light/dark) is stored in your browser&apos;s
          localStorage and is never sent to the server.
        </p>
      </Section>

      <Section title="9. Third-Party Sharing">
        <InfoCard>
          <p className="text-base leading-relaxed text-muted">
            <strong className="text-foreground">None.</strong> We do not share
            data with any third party. No Google Analytics. No advertising
            networks. No social media integrations. No behavioral tracking.
            No data selling - ever. All infrastructure (database, search,
            storage, caching) is self-hosted.
          </p>
        </InfoCard>
      </Section>

      <Section title="10. Password Reset Warning">
        <WarningCard>
          <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-200">
            Password reset <strong>permanently destroys</strong> all your
            private diary content. This is by design - the encryption
            keys that protect your private diaries are derived from your
            password. We cannot recover them because we never have them.
          </p>
          <p className="text-sm leading-relaxed text-amber-700 dark:text-amber-300 mt-2">
            If you forget your password and have no email on file, your
            private diaries are <strong>permanently inaccessible</strong>.
            We recommend adding a recovery email in Settings.
          </p>
        </WarningCard>
      </Section>

      <Section title="11. Account Deletion">
        <p className="text-sm leading-relaxed text-muted mb-4">
          Delete your account at <strong className="text-foreground">Settings
          &rarr; Account &rarr; Danger Zone</strong>. This removes:
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {["User profile", "All diaries", "All comments", "Likes & bookmarks",
            "Follow relationships", "Notifications", "Uploaded media"].map((item) => (
            <span key={item} className="inline-flex items-center rounded-full bg-overlay/10 px-3 py-1 text-xs text-muted">
              {item}
            </span>
          ))}
        </div>
        <p className="text-xs text-subtle">
          Audit logs are retained anonymized for legal compliance.
        </p>
      </Section>

      <Section title="12. Children&apos;s Privacy">
        <p className="text-sm leading-relaxed text-muted">
          We do not collect age information. We recommend users be at least 13.
          If you believe a child under 13 has created an account, contact us for
          immediate removal.
        </p>
      </Section>

      <Section title="13. Changes to This Policy">
        <p className="text-sm leading-relaxed text-muted">
          Material changes will be announced via a notice on the homepage.
          Continued use after changes constitutes acceptance. Last updated
          July 4, 2026.
        </p>
      </Section>

      <Section title="14. Open Source - Verify Everything">
        <InfoCard>
          <p className="text-sm leading-relaxed text-muted mb-4">
            Every claim in this privacy policy is independently verifiable.
            DiaryArchive is <strong className="text-foreground">fully open source</strong>.
            You can inspect the code yourself to confirm:
          </p>
          <ul className="space-y-2 text-sm text-muted mb-4">
            {[
              "Password hashing uses Argon2id with the exact parameters stated",
              "Private diaries are encrypted with AES-256-GCM client-side before upload",
              "No analytics, tracking, or telemetry code exists anywhere in the codebase",
              "Rate limiting, validation, and security measures are visible in plain code",
              "All database schemas and data retention logic are publicly documented",
              "The HTML sanitizer whitelist and CSP headers are in the source",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-accent shrink-0 mt-0.5">&#x2713;</span>
                {item}
              </li>
            ))}
          </ul>
          <a
            href="https://github.com/PaullyScripter/diaryArchive"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-overlay/10 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            github.com/PaullyScripter/diaryArchive
          </a>
          <p className="text-xs text-subtle mt-3">
            Don&apos;t trust our claims. Read the source. Run it yourself.
            Every line of code that handles your data is public.
          </p>
        </InfoCard>
      </Section>

      <div className="border-t border-border pt-8 mt-4">
        <p className="text-sm text-muted leading-relaxed">
          For privacy concerns, data export requests, or account assistance:
        </p>
        <a
          href="mailto:privacy@diaryarchive.com"
          className="inline-block mt-1 text-link hover:text-link-hover text-sm font-medium"
        >
          privacy@diaryarchive.com
        </a>
      </div>
    </div>
  );
}
