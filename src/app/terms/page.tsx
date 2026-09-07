import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";

const sections = [
  { id: "t-01", title: "Acceptance of these terms" },
  { id: "t-02", title: "The service" },
  { id: "t-03", title: "Accounts and sign-in" },
  { id: "t-04", title: "Acceptable use" },
  { id: "t-05", title: "Your content" },
  { id: "t-06", title: "Text messaging (SMS)" },
  { id: "t-07", title: "Third-party services" },
  { id: "t-08", title: "Disclaimers and limitation of liability" },
  { id: "t-09", title: "Termination" },
  { id: "t-10", title: "Changes to these terms" },
  { id: "t-11", title: "Governing law" },
  { id: "t-12", title: "Contact us" },
];

function Section({
  n,
  id,
  title,
  children,
}: {
  n: string;
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-border py-10">
      <div className="mb-5 flex items-baseline gap-3.5">
        <span className="font-mono text-[11px] text-accent">{n}</span>
        <h2 className="text-3xl font-display tracking-tight text-ink">
          {title}
        </h2>
      </div>
      <div className="flex max-w-2xl flex-col gap-4 text-[15.5px] leading-relaxed text-body text-pretty">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="flex flex-1 flex-col bg-cream">
      <SiteNav />

      <div className="mx-auto w-full max-w-3xl px-6 py-16 pb-28 sm:px-10">
        <p className="mb-3 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
          Terms
        </p>
        <h1 className="mb-4 text-5xl leading-[1.06] font-display tracking-tight text-ink">
          Terms &amp; Conditions
        </h1>
        <p className="mb-12 text-[14.5px] text-muted">
          Effective: September 4, 2026 &middot; Applies to: web app &amp;
          mobile app
        </p>

        <div className="mb-14 rounded-2xl border border-border bg-card p-7">
          <p className="mb-4 font-mono text-[11px] tracking-[0.12em] text-muted uppercase">
            In these terms
          </p>
          <ol className="grid grid-cols-1 gap-x-8 gap-y-2.5 text-[15px] text-ink-body sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="hover:text-accent">
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </div>

        <Section n="01" id="t-01" title="Acceptance of these terms">
          <p>
            By creating an account or using That Friend, you agree to these
            Terms &amp; Conditions and to our{" "}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>
            . If you don&rsquo;t agree, please don&rsquo;t use the app.
          </p>
        </Section>

        <Section n="02" id="t-02" title="The service">
          <p>
            That Friend helps a group plan a trip together: everyone answers
            a few questions about budget, dates, and preferences, the app
            proposes decisions, and links/notes/photos people forward get
            organized onto a shared map and itinerary. It&rsquo;s provided
            as-is, and features may change, be added, or be removed as the
            product develops.
          </p>
        </Section>

        <Section n="03" id="t-03" title="Accounts and sign-in">
          <p>
            You can sign in with an email (magic link, no password) or a
            phone number (a one-time code sent via text). You&rsquo;re
            responsible for keeping access to that email or phone secure —
            anyone who can complete that sign-in step can access your
            account and the trips it&rsquo;s part of. Tell us at{" "}
            <a href="mailto:thatfriendapp@gmail.com" className="underline">
              thatfriendapp@gmail.com
            </a>{" "}
            if you think your account has been accessed without your
            permission.
          </p>
        </Section>

        <Section n="04" id="t-04" title="Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Use That Friend for anything unlawful, or to harass, threaten,
              or impersonate someone else.
            </li>
            <li>
              Try to access another person&rsquo;s trip or account without
              permission, or interfere with the app&rsquo;s normal operation
              (scraping, overloading, probing for vulnerabilities without
              our permission).
            </li>
            <li>
              Send anything through the app&rsquo;s texting features
              (forwarded links, notes, or photos) that you don&rsquo;t have
              the right to share.
            </li>
          </ul>
        </Section>

        <Section n="05" id="t-05" title="Your content">
          <p>
            You keep ownership of what you add to a trip — notes, photos,
            links, preferences. By adding it, you&rsquo;re giving the other
            members of that trip permission to see and use it as part of
            planning the trip, and giving us permission to store and
            process it in order to run the app&rsquo;s features (see our{" "}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>{" "}
            for how that data is handled). You&rsquo;re responsible for
            making sure you have the right to share whatever you add.
          </p>
        </Section>

        <Section n="06" id="t-06" title="Text messaging (SMS)">
          <p>
            If you provide a mobile phone number, you agree to receive text
            messages from That Friend related to your account and trips:
            a one-time code to sign in, a confirmation when something you
            forward gets added to a trip, and reminders about a trip
            you&rsquo;re part of.
          </p>
          <p>
            <strong className="text-ink">
              We do not share or sell your mobile phone number
            </strong>{" "}
            to third parties or affiliates for their own marketing or
            promotional purposes.
          </p>
          <p>
            Message frequency varies with how active your trips are, and
            is typically a handful of messages per trip. Message and data
            rates may apply. Reply STOP at any time to stop receiving
            texts, or HELP for help.
          </p>
        </Section>

        <Section n="07" id="t-07" title="Third-party services">
          <p>
            That Friend runs on top of a few third-party services to work:
            Supabase (accounts and data storage), Google Maps (place search
            and the trip map), Anthropic (turning forwarded text/links/
            photos into structured trip entries), and Twilio (text
            messaging). Your use of features built on these is also subject
            to those providers&rsquo; own terms where applicable.
          </p>
        </Section>

        <Section
          n="08"
          id="t-08"
          title="Disclaimers and limitation of liability"
        >
          <p>
            That Friend is provided &ldquo;as is,&rdquo; without warranties
            of any kind. We don&rsquo;t guarantee the app will be
            uninterrupted, error-free, or that extracted places, proposed
            decisions, or itinerary suggestions will be accurate — always
            use your own judgment, especially for anything involving money,
            bookings, or travel logistics. To the extent allowed by law,
            we&rsquo;re not liable for indirect, incidental, or
            consequential damages arising from your use of the app.
          </p>
        </Section>

        <Section n="09" id="t-09" title="Termination">
          <p>
            You can stop using That Friend and delete your account at any
            time by contacting us. We may suspend or terminate access if
            these terms are violated, or if we discontinue the service.
          </p>
        </Section>

        <Section n="10" id="t-10" title="Changes to these terms">
          <p>
            We may update these terms as That Friend develops. If we make a
            material change, we&rsquo;ll update the effective date above
            and let users know directly rather than relying on you to check
            back here.
          </p>
        </Section>

        <Section n="11" id="t-11" title="Governing law">
          <p>
            That Friend is operated from the United States, and these terms
            are governed by U.S. law, without regard to conflict-of-law
            rules.
          </p>
        </Section>

        <div id="t-12" className="scroll-mt-24 pt-10">
          <div className="mb-5 flex items-baseline gap-3.5">
            <span className="font-mono text-[11px] text-accent">12</span>
            <h2 className="text-3xl font-display tracking-tight text-ink">
              Contact us
            </h2>
          </div>
          <p className="max-w-2xl text-[15.5px] leading-relaxed text-body text-pretty">
            Questions about these terms can be sent to{" "}
            <a href="mailto:thatfriendapp@gmail.com" className="underline">
              thatfriendapp@gmail.com
            </a>
            .
          </p>
        </div>
      </div>

      <footer className="border-t border-border px-6 py-10 sm:px-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 text-[13.5px] text-muted sm:flex-row">
          <span className="text-lg font-display text-ink">
            &ldquo;that friend&rdquo;
          </span>
          <div className="flex gap-6">
            <Link href="/#how" className="hover:text-accent">
              How it works
            </Link>
            <Link href="/#workspace" className="hover:text-accent">
              Workspace
            </Link>
            <Link href="/privacy" className="hover:text-accent">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-accent">
              Terms
            </Link>
            <a
              href="https://substack.com/@thatfriendapp"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent"
            >
              Substack
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
