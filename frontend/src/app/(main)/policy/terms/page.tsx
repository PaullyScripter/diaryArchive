"use client";

import {
  DataTable,
  InfoCard,
  LegalDocShell,
  Section,
  WarningCard,
} from "@/components/policy/legal-doc";

const SECTIONS = [
  "1. Acceptance of These Terms",
  "2. Definitions",
  "3. Eligibility",
  "4. Account Registration and Security",
  "5. Privacy and Your Data",
  "6. End-to-End Encryption and Data Loss",
  "7. Acceptable Use",
  "8. User-Generated Content and Your License to Us",
  "9. Intellectual Property",
  "10. Moderation and Enforcement",
  "11. Third-Party Services",
  "12. Service Availability and Changes",
  "13. License to the Platform and BUSL-1.1",
  "14. Fees and Payments",
  "15. Disclaimer of Warranties",
  "16. Limitation of Liability",
  "17. Indemnification",
  "18. Termination",
  "19. Severability",
  "20. Waiver",
  "21. Entire Agreement",
  "22. Governing Law and Dispute Resolution",
  "23. Our Relationship to You",
  "24. Force Majeure",
  "25. Survival",
  "26. Assignment",
  "27. Notice and Contact",
  "28. Changes to These Terms",
];

export default function TermsPage() {
  return (
    <LegalDocShell
      title="Terms of Service"
      subtitle="The agreement that governs your use of the DiaryArchive platform."
      updated="August 13, 2026"
      sections={SECTIONS}
    >
      <WarningCard>
        <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-200">
          These Terms of Service are a legally binding agreement between you and
          the operator of DiaryArchive. Please read them carefully before using
          the platform. By creating an account, accessing, or using any part of
          DiaryArchive, you acknowledge that you have read, understood, and agree
          to be bound by these Terms. If you do not agree, you must not create an
          account or use the service.
        </p>
      </WarningCard>

      <Section title="1. Acceptance of These Terms">
        <p className="text-sm leading-relaxed text-muted mb-3">
          By accessing or using DiaryArchive, you agree to be bound by these Terms
          of Service (the &quot;Terms&quot;), together with the
          <strong className="text-foreground"> Privacy Policy</strong> and any other
          policies we publish, which are incorporated into these Terms by reference.
        </p>
        <p className="text-sm leading-relaxed text-muted mb-3">
          If you use the service on behalf of an organization, you represent and
          warrant that you have the authority to bind that organization to these
          Terms, and &quot;you&quot; in these Terms refers to both you individually
          and that organization.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          We may update these Terms from time to time as described in Section 28.
          Your continued use of DiaryArchive after any changes take effect
          constitutes your acceptance of the revised Terms.
        </p>
      </Section>

      <Section title="2. Definitions">
        <DataTable
          rows={[
            { label: "Account", value: "Your registered profile on DiaryArchive, accessed with your credentials" },
            { label: "Content", value: "Any text, image, audio, video, or other material you submit, post, or upload" },
            { label: "Diary", value: "A dated entry created through the editor, which may be Public, Private, or a Draft" },
            { label: "Public Diary", value: "A diary that is stored unencrypted and visible to all users and visitors" },
            { label: "Private Diary", value: "A diary encrypted end-to-end in your browser before upload; the server cannot read it" },
            { label: "We / Us / Our", value: "The operator of the DiaryArchive service" },
            { label: "You / Your", value: "The individual or entity using the service or creating an account" },
          ]}
        />
      </Section>

      <Section title="3. Eligibility">
        <ul className="space-y-2 text-sm leading-relaxed text-muted">
          {[
            "You must be at least 13 years of age to use DiaryArchive.",
            "You must not be located in a country subject to a U.S. or comparable trade embargo, or listed on any restricted or sanctioned party list.",
            "You must not have been previously banned from the service or have had your account terminated by us.",
            "You must provide accurate and lawful registration information and keep it current.",
            "You must have the legal capacity to enter into a binding agreement.",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="text-sm leading-relaxed text-muted mt-3">
          If you are between 13 and the age of majority in your jurisdiction, you
          confirm you have obtained the consent of a parent or legal guardian, or
          that you are old enough to enter into this agreement under applicable law.
        </p>
      </Section>

      <Section title="4. Account Registration and Security">
        <InfoCard>
          <p className="text-sm leading-relaxed text-muted mb-3">
            You are responsible for maintaining the confidentiality of your
            password and for all activity that occurs under your account.
          </p>
          <ul className="space-y-2 text-sm leading-relaxed text-muted">
            {[
              "You must not share your login credentials or permit third parties to access your account.",
              "You must notify us immediately of any unauthorized access or security breach involving your account.",
              "You may have only one account unless we authorize additional accounts in writing.",
              "Passwords are stored as Argon2id one-way hashes; under no circumstances can we recover or reset a lost password without a recovery email on file (see Section 6).",
              "You must use a strong, unique password and not use the same password you use on other services.",
              "Accounts that are created, bought, sold, or transferred in violation of these Terms may be terminated.",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              {item}
            </li>
          ))}
          </ul>
        </InfoCard>
        <p className="text-sm leading-relaxed text-muted">
          We are not liable for losses arising from unauthorized access to your
          account that results from your failure to keep passwords confidential or
          from your reuse of passwords across services.
        </p>
      </Section>

      <Section title="5. Privacy and Your Data">
        <p className="text-sm leading-relaxed text-muted mb-3">
          Our collection, storage, and handling of your personal data is governed
          by our
          <strong className="text-foreground"> Privacy Policy</strong>. By using the
          service you consent to the practices described there.
        </p>
        <p className="text-sm leading-relaxed text-muted mb-3">
          You retain ownership of all Content you create. We only use your Content
          to the extent necessary to operate and improve the service, as detailed
          in Section 8.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          We are committed to privacy-first principles: we do not sell your data,
          we do not run advertising or behavioral analytics, and all core
          infrastructure is self-hosted. See the Privacy Policy for full details
          on data retention, your rights (including access, correction, export,
          and deletion), and the security measures we employ.
        </p>
      </Section>

      <Section title="6. End-to-End Encryption and Data Loss">
        <WarningCard>
          <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-200 mb-2">
            <strong>Read this section carefully. It has irreversible consequences.</strong>
          </p>
          <p className="text-sm leading-relaxed text-amber-700 dark:text-amber-300">
            Private diaries are encrypted in your browser with AES-256-GCM before
            they are uploaded. The encryption keys are derived from your password.
            Because we never see your password in plaintext and never store your
            keys, <strong>we cannot decrypt, recover, or reset private diary
            content for you under any circumstances</strong>.
          </p>
        </WarningCard>
        <ul className="space-y-2.5 text-sm leading-relaxed text-muted mt-4">
          {[
            "If you forget your password AND you do not have a recovery email on file, your account and all private diary content are permanently and irreversibly lost. No administrator, support ticket, or exception can recover it.",
            "Initiating a password reset permanently destroys the keys protecting your private diaries, thereby rendering that content unrecoverable, even though the ciphertext may remain in our database.",
            "An encrypted master key is stored on the server, but it is unwrap-able only with your password-derived key. We cannot use it to decrypt your data without your password.",
            "BY USING PRIVATE DIARIES, YOU ACKNOWLEDGE AND ACCEPT THAT LOSS OF YOUR PASSWORD WITHOUT A RECOVERY EMAIL RESULTS IN PERMANENT, IRREVERSIBLE LOSS OF YOUR PRIVATE DIARY CONTENT, AND YOU RELEASE US FROM ANY LIABILITY ARISING FROM SUCH LOSS.",
            "Public diaries and drafts are not protected by this encryption and can be restored more readily, but you remain responsible for keeping your account secure.",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-destructive shrink-0 mt-0.5">&#x2022;</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="text-sm leading-relaxed text-muted mt-3">
          We strongly encourage you to add a recovery email and to maintain your
          own independent backups of any content that is of particular importance
          to you.
        </p>
      </Section>

      <Section title="7. Acceptable Use">
        <p className="text-sm leading-relaxed text-muted mb-3">
          You agree not to use DiaryArchive to, or to assist or encourage anyone
          else to:
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoCard>
            <h3 className="text-sm font-semibold text-foreground mb-2">Prohibited Content</h3>
            <ul className="space-y-2 text-sm leading-relaxed text-muted">
              {[
                "Harass, threaten, or target any individual or group with abuse",
                "Publish illegal content or content that violates applicable laws",
                "Post spam, mass-produced, automated, or repetitive content",
                "Impersonate another person, entity, or falsify attribution",
                "Promote violence, self-harm, or hate speech",
                "Share content you do not have the right to share",
                "Distribute malware, trackers, or malicious scripts",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
                  {item}
                </li>
              ))}
            </ul>
          </InfoCard>
          <InfoCard>
            <h3 className="text-sm font-semibold text-foreground mb-2">Prohibited Conduct</h3>
            <ul className="space-y-2 text-sm leading-relaxed text-muted">
              {[
                "Attempting to access, decrypt, or retrieve other users' private data",
                "Reverse-engineering, probing, or circumventing security controls",
                "Attempting to overload, disrupt, or degrade the service (denial of service)",
                "Scraping, crawling, or harvesting user data at scale without permission",
                "Creating accounts to evade a ban or restriction",
                "Misrepresenting your identity or affiliation",
                "Using the service in violation of applicable local, national, or international law",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
                  {item}
                </li>
              ))}
            </ul>
          </InfoCard>
        </div>
      </Section>

      <Section title="8. User-Generated Content and Your License to Us">
        <p className="text-sm leading-relaxed text-muted mb-3">
          You retain ownership of and full responsibility for the Content you post.
        </p>
        <InfoCard>
          <p className="text-sm leading-relaxed text-muted mb-3">
            By submitting or publishing Content, you grant us a
            <strong className="text-foreground"> non-exclusive, worldwide,
            royalty-free, sublicensable, and transferable license</strong> to use,
            reproduce, modify, adapt, publish, and display that Content solely for
            the purpose of operating, providing, improving, and promoting the
            service. This license does not give us ownership of your Content.
          </p>
          <ul className="space-y-2 text-sm leading-relaxed text-muted">
            {[
              "Public Content will be stored in plaintext, displayed to other users, and indexed in search for discovery.",
              "Private Content is encrypted client-side; we store only ciphertext and cannot read, license, or display the underlying plaintext to anyone.",
              "You represent and warrant that you own or have the necessary rights, licenses, and permissions to post your Content and to grant the license above.",
              "You agree that your Content does not infringe the intellectual property rights, privacy rights, or contractual rights of any third party.",
              "We may remove or moderate Content that violates these Terms, as described in Section 10.",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              {item}
            </li>
          ))}
          </ul>
        </InfoCard>
      </Section>

      <Section title="9. Intellectual Property">
        <p className="text-sm leading-relaxed text-muted mb-3">
          Except for your Content, DiaryArchive and its software, design, source
          code, documentation, trademarks, logos, and all related intellectual
          property rights are owned by or licensed to us. Nothing in these Terms
          transfers to you any ownership interest in the platform.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          We ask that you do not copy, reproduce, or create derivative works of the
          platform&apos;s proprietary branding or assets except as expressly
          permitted under the platform license described in Section 13.
        </p>
      </Section>

      <Section title="10. Moderation and Enforcement">
        <p className="text-sm leading-relaxed text-muted mb-3">
          DiaryArchive uses a light-touch, human-led moderation model. We do not
          deploy automated content scanners or AI flagging against your writing.
          Content is reviewed only when a user submits a report, and each report is
          assessed individually by an administrator.
        </p>
        <p className="text-sm leading-relaxed text-muted mb-3">
          We take action only against clear violations of Section 7, including:
        </p>
        <ul className="space-y-2 text-sm leading-relaxed text-muted mb-3">
          {[
            "Harassment or targeted abuse of another user",
            "Illegal content",
            "Spam or automated posting",
            "Impersonation",
            "Content that promotes self-harm",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="text-sm leading-relaxed text-muted">
          Depending on the severity of a violation, we may issue a warning, hide or
          remove content, temporarily restrict your account, or permanently ban
          you. A banned user may submit a ban appeal using the appeals flow. We
          reserve the right to suspend or terminate accounts for repeated or severe
          violations, and we are not obligated to provide prior notice where doing
          so would be impractical or unlawful.
        </p>
      </Section>

      <Section title="11. Third-Party Services">
        <p className="text-sm leading-relaxed text-muted mb-3">
          DiaryArchive may integrate with or link to third-party services (for
          example, for authentication or media handling). Your use of any
          third-party service is subject to that service&apos;s own terms and
          privacy practices.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          We are not responsible for the content, policies, or practices of any
          third-party service, and we do not control which data (if any) they
          receive. We will always disclose any third-party data recipients in our
          Privacy Policy.
        </p>
      </Section>

      <Section title="12. Service Availability and Changes">
        <p className="text-sm leading-relaxed text-muted mb-3">
          We aim to keep DiaryArchive available and reliable, but we do not
          guarantee that the service will be uninterrupted, error-free, or free
          from data loss. The service is provided on an &quot;as is&quot; and
          &quot;as available&quot; basis (see Section 15).
        </p>
        <ul className="space-y-2 text-sm leading-relaxed text-muted mb-3">
          {[
            "We may modify, suspend, or discontinue any feature or function at any time, with or without notice.",
            "We may perform scheduled maintenance that affects availability.",
            "We may change, limit, or remove functionality, and we are not liable for any resulting loss or inconvenience.",
            "In the event of discontinuation of the service, we will use reasonable efforts to provide a reasonable window for you to export your data.",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              {item}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="13. License to the Platform and BUSL-1.1">
        <InfoCard>
          <p className="text-sm leading-relaxed text-muted mb-3">
            The DiaryArchive source code is made available under the
            <strong className="text-foreground"> Business Source License 1.1
            (BUSL-1.1)</strong>. Under the BUSL, the source is publicly available
            for inspection, and non-production, non-commercial, evaluative,
            personal, and internal-inclusive use is permitted free of charge.
          </p>
          <p className="text-sm leading-relaxed text-muted mb-3">
            <strong className="text-foreground">Production or commercial use,
            hosting, or deployment of the software requires a separate commercial
            license from the licensor.</strong> Please contact us for commercial
            licensing details.
          </p>
          <p className="text-sm leading-relaxed text-muted mb-3">
            After the Change Date specified in the license, the Licensed Work
            converts to the
            <strong className="text-foreground"> MIT License</strong> and becomes
            fully open source.
          </p>
          <p className="text-xs leading-relaxed text-subtle">
            These Terms govern your use of the hosted DiaryArchive service. Your
            rights to use, modify, and redistribute the source code are governed
            separately by the BUSL-1.1 and any applicable Change License. In the
            event of a conflict between these Terms and the BUSL with respect to
            source-code rights, the BUSL governs.
          </p>
        </InfoCard>
      </Section>

      <Section title="14. Fees and Payments">
        <p className="text-sm leading-relaxed text-muted">
          DiaryArchive is currently provided free of charge for individual,
          non-commercial use. If we introduce paid tiers, paid features, or
          commercial licenses in the future, we will update these Terms and provide
          clear pricing before you incur any obligation. Any fees are exclusive of
          applicable taxes, and you are responsible for all taxes arising from your
          use of paid services.
        </p>
      </Section>

      <Section title="15. Disclaimer of Warranties">
        <InfoCard>
          <p className="text-sm leading-relaxed text-muted">
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, DIARYARCHIVE AND ITS
            OPERATORS, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND AFFILIATES
            PROVIDE THE SERVICE &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;
            WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING
            BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
            PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT
            THE SERVICE WILL MEET YOUR REQUIREMENTS, BE UNINTERRUPTED, TIMELY,
            SECURE, OR FREE OF ERROR, OR THAT ANY DATA WILL NOT BE LOST OR
            CORRUPTED. NO ADVICE OR INFORMATION OBTAINED FROM US OR THE SERVICE
            CREATES ANY WARRANTY NOT EXPRESSLY STATED IN THESE TERMS.
          </p>
        </InfoCard>
      </Section>

      <Section title="16. Limitation of Liability">
        <InfoCard>
          <p className="text-sm leading-relaxed text-muted">
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL WE
            BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
            PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL
            (INCLUDING, WITHOUT LIMITATION, PERMANENT LOSS OF PRIVATE DIARY CONTENT
            RESULTING FROM LOSS OF YOUR PASSWORD, AS DESCRIBED IN SECTION 6),
            ARISING OUT OF OR RELATED TO YOUR USE OF OR INABILITY TO USE THE
            SERVICE, WHETHER BASED ON CONTRACT, TORT, NEGLIGENCE, STATUTE, OR ANY
            OTHER THEORY OF LIABILITY, EVEN IF WE HAVE BEEN ADVISED OF THE
            POSSIBILITY OF SUCH DAMAGES. IN NO EVENT SHALL OUR TOTAL AGGREGATE
            LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICE EXCEED THE GREATER OF
            THE AMOUNT YOU PAID US IN THE SIX (6) MONTHS PRECEDING THE CLAIM OR ONE
            HUNDRED DOLLARS ($100.00).
          </p>
          <p className="text-sm leading-relaxed text-muted mt-3">
            SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION OF CERTAIN
            DAMAGES OR LIABILITY, SO SOME OF THE ABOVE LIMITATIONS MAY NOT APPLY TO
            YOU.
          </p>
        </InfoCard>
      </Section>

      <Section title="17. Indemnification">
        <p className="text-sm leading-relaxed text-muted">
          You agree to indemnify, defend, and hold harmless DiaryArchive and its
          operators, officers, directors, employees, agents, and affiliates from
          and against any and all claims, liabilities, damages, losses, costs, and
          expenses (including reasonable attorneys&apos; fees) arising out of or
          related to (a) your access to or use of the service, (b) your Content,
          (c) your violation of these Terms, or (d) your violation of any rights of
          a third party. We reserve the right, at your expense, to assume exclusive
          defense and control of any matter subject to indemnification, in which
          case you agree to cooperate with us in asserting any available defenses.
        </p>
      </Section>

      <Section title="18. Termination">
        <ul className="space-y-2.5 text-sm leading-relaxed text-muted mb-3">
          {[
            "You may terminate these Terms at any time by deleting your account and discontinuing use of the service.",
            "We may suspend or terminate your access and account, in whole or in part, at any time and for any reason, including, without limitation, for breach of these Terms or as required by law.",
            "Upon termination, your right to access the service ceases immediately. We will use reasonable efforts to honor data export requests that are pending at the time of termination, subject to the encryption limitations in Section 6.",
            "Deleting your account removes your profile, diaries, comments, interactions, and media as described in the Privacy Policy. Audit logs are retained anonymized for legal compliance.",
            "Sections that by their nature should survive termination will survive, including Sections 6, 9, 15, 16, 17, 21, 22, and 25.",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-accent shrink-0 mt-0.5">&#x2022;</span>
              {item}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="19. Severability">
        <p className="text-sm leading-relaxed text-muted">
          If any provision of these Terms is held to be invalid, illegal, or
          unenforceable, that provision shall be enforced to the maximum extent
          permitted by law and shall be deemed reformed to conform to applicable
          law, and such invalidity shall not affect the validity and enforceability
          of the remaining provisions.
        </p>
      </Section>

      <Section title="20. Waiver">
        <p className="text-sm leading-relaxed text-muted">
          Our failure to exercise or enforce any right or provision of these Terms
          shall not operate as a waiver of such right or provision. No waiver of
          any term shall be effective unless in writing and signed by the party to
          be bound, and no single or partial waiver shall waive or affect any other
          or future breach.
        </p>
      </Section>

      <Section title="21. Entire Agreement">
        <p className="text-sm leading-relaxed text-muted">
          These Terms, together with the Privacy Policy and any other policies we
          incorporate by reference, constitute the entire agreement between you and
          us regarding the use of DiaryArchive and supersede all prior agreements
          and understandings, whether written or oral.
        </p>
      </Section>

      <Section title="22. Governing Law and Dispute Resolution">
        <p className="text-sm leading-relaxed text-muted mb-3">
          These Terms and your use of the service shall be governed by and construed
          in accordance with the laws of the jurisdiction in which the operator of
          DiaryArchive is established, without regard to its conflict-of-law
          principles.
        </p>
        <p className="text-sm leading-relaxed text-muted mb-3">
          We encourage you to contact us to resolve any dispute informally before
          pursuing other remedies. If a dispute cannot be resolved informally, you
          agree that it shall be resolved in the courts of that jurisdiction, and
          you consent to the exclusive jurisdiction and venue of those courts.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          Nothing in this section shall prevent us from seeking injunctive or other
          equitable relief in any jurisdiction of competent jurisdiction to protect
          our intellectual property or other proprietary rights. If applicable law
          permits, you waive any right to participate in a class action or
          class-wide arbitration.
        </p>
      </Section>

      <Section title="23. Our Relationship to You">
        <p className="text-sm leading-relaxed text-muted">
          These Terms do not create any partnership, joint venture, employment,
          franchise, or agency relationship between you and us. Neither party has
          any authority to bind the other or to incur obligations on the other&apos;s
          behalf.
        </p>
      </Section>

      <Section title="24. Force Majeure">
        <p className="text-sm leading-relaxed text-muted">
          We shall not be liable for any failure or delay in performing our
          obligations under these Terms due to events beyond our reasonable control,
          including without limitation natural disasters, acts of government,
          war, terrorism, cyberattacks, power failures, internet disruptions, labor
          disputes, or failure of third-party service providers.
        </p>
      </Section>

      <Section title="25. Survival">
        <p className="text-sm leading-relaxed text-muted">
          The provisions of these Terms that by their nature are intended to survive
          termination, including but not limited to Sections 6, 9, 15, 16, 17, 21,
          22, and 25, shall survive any termination or expiration of these Terms.
        </p>
      </Section>

      <Section title="26. Assignment">
        <p className="text-sm leading-relaxed text-muted">
          You may not assign or transfer your rights or obligations under these
          Terms without our prior written consent. We may assign or transfer these
          Terms, in whole or in part, without restriction, including in connection
          with a merger, acquisition, reorganization, or sale of all or
          substantially all of our assets.
        </p>
      </Section>

      <Section title="27. Notice and Contact">
        <p className="text-sm leading-relaxed text-muted mb-3">
          We may provide notices to you through the service, by email to the address
          associated with your account, or by posting on the homepage.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          For legal notices, commercial licensing inquiries, or other questions
          regarding these Terms, please contact us at:
        </p>
        <a
          href="mailto:legal@diaryarchive.com"
          className="inline-block mt-1 text-link hover:text-link-hover text-sm font-medium"
        >
          legal@diaryarchive.com
        </a>
      </Section>

      <Section title="28. Changes to These Terms">
        <p className="text-sm leading-relaxed text-muted mb-3">
          We may revise these Terms from time to time. Material changes will be
          announced via a notice on the homepage. The &quot;Last updated&quot;
          date at the top of this page reflects the most recent revision.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          Your continued use of DiaryArchive after any changes take effect
          constitutes your acceptance of the revised Terms. If you do not agree to
          the revised Terms, you must stop using the service and may delete your
          account.
        </p>
      </Section>

      <div className="border-t border-border pt-8 mt-4">
        <p className="text-sm text-muted leading-relaxed">
          These Terms were last updated on August 13, 2026. If you have questions
          about these Terms, please contact{" "}
          <a href="mailto:legal@diaryarchive.com" className="text-link hover:text-link-hover font-medium">
            legal@diaryarchive.com
          </a>
          .
        </p>
      </div>
    </LegalDocShell>
  );
}