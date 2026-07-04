import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — DiaryArchive",
  description: "How DiaryArchive handles your data, privacy, security, and your rights.",
};

export default function PolicyPage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1>Privacy Policy</h1>
      <p className="text-sm text-muted">Last updated: July 4, 2026</p>

      <h2>1. What We Collect</h2>
      <p>
        DiaryArchive is built on a privacy-first philosophy. We collect
        only the minimum data necessary to provide the service:
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>Data</th>
            <th>Purpose</th>
            <th>Storage</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Username</td>
            <td>Identity and display</td>
            <td>Plaintext</td>
          </tr>
          <tr>
            <td>Password</td>
            <td>Authentication</td>
            <td>Argon2id hash (one-way)</td>
          </tr>
          <tr>
            <td>Email (optional)</td>
            <td>Account recovery, security notices</td>
            <td>AES-256-GCM encrypted</td>
          </tr>
          <tr>
            <td>Diary content</td>
            <td>Your writing</td>
            <td>Plaintext (public) or AES-256-GCM encrypted (private)</td>
          </tr>
          <tr>
            <td>Uploaded media</td>
            <td>Images and files in diaries</td>
            <td>Object storage with UUID filenames</td>
          </tr>
        </tbody>
      </table>

      <h3>What We <em>Never</em> Collect</h3>
      <ul>
        <li>Real name</li>
        <li>Phone number</li>
        <li>Birthday or age</li>
        <li>Address or location</li>
        <li>Government ID</li>
        <li>Social media accounts</li>
        <li>Browser fingerprint</li>
        <li>Usage analytics (beyond basic server metrics)</li>
      </ul>

      <h2>2. How Your Data Is Stored</h2>
      <p>
        <strong>Public diaries:</strong> Stored in MongoDB. Content is
        visible to anyone visiting DiaryArchive. HTML is sanitized
        server-side to prevent XSS attacks.
      </p>
      <p>
        <strong>Private diaries:</strong> Encrypted in your browser
        using AES-256-GCM <em>before</em> upload. The server stores
        only ciphertext and <strong>cannot decrypt</strong> your
        private content — even if the database is compromised.
      </p>
      <p>
        <strong>Passwords:</strong> Hashed with Argon2id (memory: 64 MB,
        iterations: 3, parallelism: 4). We cannot recover your password.
      </p>
      <p>
        <strong>Email (if provided):</strong> Encrypted at rest with
        AES-256-GCM. Stored alongside a SHA-256 hash for uniqueness checks.
        Your actual email address is never displayed in the UI.
      </p>

      <h2>3. Media &amp; Uploads</h2>
      <p>
        When you upload images or files to DiaryArchive:
      </p>
      <ul>
        <li>Files are validated by <strong>magic-byte inspection</strong>
          — not by file extension or claimed MIME type. Executables, PDFs,
          and ZIPs disguised as images are rejected.</li>
        <li>Images are converted to WebP format and stripped of EXIF
          metadata (location, camera model, timestamps) before storage.</li>
        <li>Files receive <strong>random UUID filenames</strong> —
          your original filename is stored in the database but never
          used in the URL.</li>
        <li><strong>Public diary media</strong> is served directly from
          object storage. <strong>Private diary media</strong> uses
          time-limited (15-minute) signed URLs that only you can access.</li>
        <li>Orphaned uploads (not attached to any diary) are
          automatically deleted after 24 hours.</li>
        <li>Per-user upload limits: 500 total files, 20 per diary,
          50 per day. This prevents abuse.</li>
      </ul>

      <h2>4. Data Visibility</h2>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>Data</th>
            <th>Visible To</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Public diary contents</td>
            <td>Everyone</td>
          </tr>
          <tr>
            <td>Private diary contents</td>
            <td><strong>Owner only</strong> (server cannot decrypt)</td>
          </tr>
          <tr>
            <td>Username</td>
            <td>Everyone</td>
          </tr>
          <tr>
            <td>Email</td>
            <td>Owner only (encrypted, never displayed)</td>
          </tr>
          <tr>
            <td>Password hash</td>
            <td>Nobody (one-way hash)</td>
          </tr>
          <tr>
            <td>IP address</td>
            <td>System (temporary in logs, deleted after 30 days)</td>
          </tr>
        </tbody>
      </table>

      <h2>5. Data Retention</h2>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>Data</th>
            <th>Retention</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>User accounts</td>
            <td>Until deleted by you or banned</td>
          </tr>
          <tr>
            <td>Public diaries</td>
            <td>Until deleted by you or moderated</td>
          </tr>
          <tr>
            <td>Private diaries</td>
            <td>Until deleted by you</td>
          </tr>
          <tr>
            <td>Notifications</td>
            <td>90 days (auto-cleaned)</td>
          </tr>
          <tr>
            <td>Audit logs</td>
            <td>1 year</td>
          </tr>
          <tr>
            <td>IP address logs</td>
            <td>30 days</td>
          </tr>
          <tr>
            <td>Refresh tokens</td>
            <td>7 days or until logout</td>
          </tr>
          <tr>
            <td>Orphaned media</td>
            <td>24 hours (auto-cleaned)</td>
          </tr>
        </tbody>
      </table>

      <h2>6. Your Rights</h2>
      <ul>
        <li><strong>Access:</strong> You can export all your data at any
          time via Settings. Public diaries as JSON/Markdown, private
          diaries as encrypted JSON with decryption instructions, and
          profile data as JSON.</li>
        <li><strong>Delete:</strong> You can delete your account at any
          time from Settings. This removes all diaries, comments, likes,
          bookmarks, follows, notifications, and media files. Audit logs
          are retained (anonymized) for legal purposes.</li>
        <li><strong>Correct:</strong> You can update your profile, email,
          and preferences at any time via Settings.</li>
        <li><strong>Portability:</strong> Your data is delivered as a
          downloadable zip file with structured formats.</li>
      </ul>

      <h2>7. Security Measures</h2>
      <ul>
        <li><strong>End-to-end encryption:</strong> Private diaries are
          encrypted with AES-256-GCM using per-diary keys derived via
          HKDF-SHA256 from a master key that never leaves your device.</li>
        <li><strong>Password hashing:</strong> Argon2id with 64 MB memory,
          3 iterations, and 4-way parallelism — resistant to GPU and ASIC
          cracking.</li>
        <li><strong>Authentication:</strong> Short-lived JWT access tokens
          (15 minutes) with revocable refresh tokens stored as SHA-256
          hashes.</li>
        <li><strong>Transport:</strong> All traffic is served over HTTPS
          with HSTS preload. Cookies use Secure, HttpOnly, and SameSite
          flags.</li>
        <li><strong>Rate limiting:</strong> Auth endpoints are rate-limited
          per IP (5 attempts/minute). Uploads are limited per user (10/minute,
          50/day).</li>
        <li><strong>XSS prevention:</strong> All diary HTML is sanitized
          server-side. Content-Security-Policy headers restrict script
          sources. Uploaded files are validated by magic bytes, not
          extensions.</li>
        <li><strong>CSRF protection:</strong> SameSite=Strict cookies.
          State-changing endpoints require Authorization headers.</li>
        <li><strong>Injection prevention:</strong> Parameterized MongoDB
          queries. No shell commands in application code. UUID-based file
          paths prevent directory traversal.</li>
        <li><strong>Audit logging:</strong> All administrative actions
          are logged immutably: bans, content deletions, report resolutions,
          role changes.</li>
      </ul>

      <h2>8. Cookies</h2>
      <p>DiaryArchive uses a single essential cookie:</p>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>Cookie</th>
            <th>Purpose</th>
            <th>Duration</th>
            <th>Accessible</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>refresh_token</code></td>
            <td>Session persistence</td>
            <td>7 days</td>
            <td>HTTP only (not accessible to JavaScript)</td>
          </tr>
        </tbody>
      </table>
      <p>
        We use <strong>no tracking cookies, no analytics cookies, and
        no advertising cookies</strong>. Your theme preference (light/dark)
        is stored in your browser&apos;s localStorage — not sent to the server.
      </p>

      <h2>9. Third-Party Services</h2>
      <p><strong>We do not share data with any third party.</strong></p>
      <ul>
        <li>No analytics providers (Google Analytics, etc.)</li>
        <li>No advertising networks</li>
        <li>No social media integrations</li>
        <li>No behavioral tracking</li>
        <li>No data selling — ever</li>
      </ul>
      <p>
        All infrastructure (database, search, storage, caching) is
        self-hosted. Meilisearch indexes only public diary content.
        MinIO/S3 is used solely for user-uploaded media.
      </p>

      <h2>10. Password Reset &amp; Recovery</h2>
      <p>
        If you registered with an email address, you can request a
        password reset. A time-limited link is sent to your email.
      </p>
      <div className="border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950 rounded-md px-4 py-3 my-4">
        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
          Important warning
        </p>
        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
          Password reset <strong>permanently destroys</strong> all your
          private diary content. This is by design — the encryption keys
          that protect your private diaries are derived from your password.
          We cannot recover them because we never have them. If you forget
          your password and have no email on file, your private diaries are
          permanently inaccessible.
        </p>
      </div>

      <h2>11. Account Deletion</h2>
      <p>
        You can delete your account at any time from Settings → Account →
        Danger Zone. Account deletion removes:
      </p>
      <ul>
        <li>Your user profile</li>
        <li>All diary entries (public and private)</li>
        <li>All comments you wrote</li>
        <li>All likes and bookmarks</li>
        <li>All follow relationships</li>
        <li>All notifications</li>
        <li>All uploaded media files</li>
      </ul>
      <p>
        Audit logs are retained (anonymized) for legal compliance.
        Your username may become available for reuse.
      </p>

      <h2>12. Children&apos;s Privacy</h2>
      <p>
        We do not collect age information. We recommend users be at
        least 13 years old. If you believe a child under 13 has created
        an account, please contact us for removal.
      </p>

      <h2>13. Changes to This Policy</h2>
      <p>
        We will notify users of material changes via a notice on the
        homepage. Continued use after changes constitutes acceptance.
        This policy was last updated on July 4, 2026.
      </p>

      <h2>14. Contact</h2>
      <p>
        For privacy concerns, data export requests, or account deletion
        assistance, contact us at{" "}
        <a href="mailto:privacy@diaryarchive.com" className="text-link">
          privacy@diaryarchive.com
        </a>.
      </p>
    </article>
  );
}
