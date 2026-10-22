      \resumeProjectHeading
        {\textbf{\href{https://github.com/PaullyScripter/diaryarchive}{\textcolor{blue}{DiaryArchive}}} $|$ \emph{React, Next.js, TypeScript, Tailwind, FastAPI, MongoDB, Docker, Meilisearch}}{Jun. 2026 -- Present}
        \resumeItemListStart
          \resumeItem{Built privacy-first encrypted diary platform with client-side E2E encryption (AES-256-GCM via Web Crypto API); master key hierarchy (PBKDF2 $\rightarrow$ AES-256-GCM $\rightarrow$ HKDF) ensures server never accesses plaintext user content.}
          \resumeItem{Designed layered RESTful API (endpoints $\rightarrow$ services $\rightarrow$ repositories) with FastAPI, async MongoDB Motor driver, Redis caching, and Meilisearch full-text search; JWT auth (15-min expiry, rotating refresh tokens) with Argon2id password hashing and sliding-window rate limiting.}
          \resumeItem{Developed Next.js 15 App Router frontend with React 19, Tailwind CSS v4, shadcn/ui, and Tiptap rich-text editor; features include autosave drafts, chapter management, template picker, and drag-and-drop media upload with MIME sniffing validation.}
          \resumeItem{Implemented community features: threaded comments, likes, bookmarks, follows, notifications, and user profiles with avatars and favorite quotes; admin suite with user management, role system, report handling, support tickets, ban appeals, warning enforcement, and audit logging.}
          \resumeItem{Deployed with Docker Compose (multi-container), Nginx (dual-vhost reverse proxy with TLS, CSP headers, rate limiting zones), GitHub Actions CI/CD with auto-rollback, Cloudflare WAF, MongoDB replica set, Prometheus/Grafana monitoring, and automated backups; 95+ tests (pytest + Vitest), WCAG AA compliance.}
          \resumeItem{
            \href{https://github.com/PaullyScripter/diaryarchive}{GitHub}
          }
        \resumeItemListEnd
