import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";

const sections = [
  { id: "pp-01", title: "Information we collect" },
  { id: "pp-02", title: "How we use it" },
  { id: "pp-03", title: "How it's shared" },
  { id: "pp-04", title: "Signing in with Google or Apple" },
  { id: "pp-05", title: "How long we keep it" },
  { id: "pp-06", title: "Your choices & rights" },
  { id: "pp-07", title: "Security" },
  { id: "pp-08", title: "Minors and family/friend accounts" },
  { id: "pp-09", title: "International use" },
  { id: "pp-10", title: "Changes to this policy" },
  { id: "pp-11", title: "Text messaging (SMS)" },
  { id: "pp-12", title: "Contact us" },
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

export default function PrivacyPage() {
  return (
    <div className="flex flex-1 flex-col bg-cream">
      <SiteNav />

      <div className="mx-auto w-full max-w-3xl px-6 py-16 pb-28 sm:px-10">
        <p className="mb-3 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
          Privacy
        </p>
        <h1 className="mb-4 text-5xl leading-[1.06] font-display tracking-tight text-ink">
          Privacy Policy
        </h1>
        <p className="mb-12 text-[14.5px] text-muted">
          Effective: August 28, 2026 &middot; Applies to: web app &amp;
          mobile app
        </p>

        <div className="mb-14 rounded-2xl border border-border bg-card p-7">
          <p className="mb-4 font-mono text-[11px] tracking-[0.12em] text-muted uppercase">
            In this policy
          </p>
          <ol className="grid grid-cols-1 gap-x-8 gap-y-2.5 text-[15px] text-ink-soft sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="hover:text-accent">
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </div>

        <Section n="01" id="pp-01" title="Information we collect">
          <p className="text-lg font-display text-ink">
            Information you give us
          </p>
          <p>
            <strong className="text-ink">Account information:</strong> your
            name and email address, and, if you sign in through Google or
            Apple, the basic profile information they share with us (see
            Section 4).
          </p>
          <p>
            <strong className="text-ink">Trip and calendar information:</strong>{" "}
            the trips you create or join, dates and availability you provide,
            itinerary details, preferences (like budget range, dietary needs,
            or lodging preferences), and messages or comments you post within
            a trip.
          </p>
          <p>
            <strong className="text-ink">
              Budget and expense information:
            </strong>{" "}
            budget amounts, cost estimates, and expense entries you or your
            group add for planning and splitting costs. That Friend does not
            currently move real money on your behalf; if we add real payment
            processing in the future, it will be handled by a licensed
            payment provider and this policy will be updated to name them and
            describe how that works.
          </p>
          <p>
            <strong className="text-ink">
              Location, if you choose to share it:
            </strong>{" "}
            for features like suggesting nearby activities or letting your
            group see where you are during a trip. Location sharing is
            optional and can be turned off in your device or app settings.
          </p>
          <p>
            <strong className="text-ink">
              Photos and other content:
            </strong>{" "}
            any photos, files, or notes you choose to upload to a trip.
          </p>
          <p className="mt-3 text-lg font-display text-ink">
            Information collected automatically
          </p>
          <p>
            Basic device and usage data: things like device type, operating
            system, app version, and general usage logs (for example, when
            you log in, or which screens you visit) that help us keep the
            app running and fix bugs. We are not currently using third-party
            analytics or advertising tools. If that changes, we&rsquo;ll
            update this section to name the tools we use.
          </p>
        </Section>

        <Section n="02" id="pp-02" title="How we use it">
          <p>We use your information to:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Run the core features of the app, such as creating trips,
              coordinating schedules, tracking budgets, and letting your
              group communicate.
            </li>
            <li>
              Let you sign in securely and keep your account tied to the
              right trips and friends.
            </li>
            <li>
              Fix bugs, improve reliability, and understand how the app is
              being used so we can decide what to build next.
            </li>
            <li>
              Communicate with you about the app, for example to ask for
              feedback, tell you about a new feature, or let you know about a
              change to this policy.
            </li>
            <li>
              Meet legal obligations, and protect the security of the app and
              its users.
            </li>
          </ul>
          <p>
            We do not sell your personal information, and we do not use your
            trip content or budget information to sell you ads.
          </p>
        </Section>

        <Section n="03" id="pp-03" title="How it's shared">
          <p className="text-lg font-display text-ink">
            With the people in your trip
          </p>
          <p>
            That Friend is built around planning trips with people, so
            information you add to a shared trip, such as your availability,
            your stated budget, your itinerary suggestions, and your
            comments and messages, is visible to the other members of that
            trip. Think of a shared trip like a shared document: anyone you
            or the trip organizer has added can see what&rsquo;s in it.
          </p>
          <p>
            Budgets are the exception, and how they are shared depends on the
            setting the organizer chooses when the trip is created. On a
            Private trip, the amount you enter is never shown next to your
            name; the group only sees the combined range everyone&rsquo;s
            numbers produce. On an Open trip, your amount is visible to the
            other members as you enter it. The trip&rsquo;s current setting
            is shown to you before you answer, and changing it applies to
            everyone on that trip.
          </p>
          <p className="mt-3 text-lg font-display text-ink">
            With service providers
          </p>
          <p>
            We may share limited information with vendors who help us run
            the app, for example cloud hosting to store app data, or (as
            noted in Section 4) Google or Apple for sign-in. These providers
            only receive what they need to do their job and are not
            permitted to use your information for their own purposes.
          </p>
          <p className="mt-3 text-lg font-display text-ink">
            For legal reasons
          </p>
          <p>
            We may disclose information if required by law, or if we believe
            in good faith it&rsquo;s necessary to protect the rights,
            safety, or property of That Friend, our users, or others.
          </p>
          <p className="mt-3 text-lg font-display text-ink">
            If the business changes hands
          </p>
          <p>
            If That Friend is ever involved in a merger, acquisition, or sale
            of assets, your information may be transferred as part of that
            transaction. We&rsquo;ll let users know if that happens and if it
            changes how your data is handled.
          </p>
          <p>
            We do not sell or rent your personal information to third
            parties for their marketing purposes.
          </p>
        </Section>

        <Section n="04" id="pp-04" title="Signing in with Google or Apple">
          <p>
            If you choose to sign in with Google or Apple, they will share
            basic profile information with us (such as your name and email
            address) so we can create and secure your account, based on the
            permissions you approve during sign-in. We don&rsquo;t receive
            your Google or Apple password. Your use of those sign-in
            services is also governed by Google&rsquo;s or Apple&rsquo;s own
            privacy policies.
          </p>
        </Section>

        <Section n="05" id="pp-05" title="How long we keep it">
          <p>
            We keep your information for as long as your account is active,
            or as needed to provide the app&rsquo;s features (for example,
            keeping past trip details so you can look back on them). If you
            delete your account, we will delete or de-identify your personal
            information within a reasonable time, except where we need to
            keep limited records for legal, security, or fraud-prevention
            reasons.
          </p>
        </Section>

        <Section n="06" id="pp-06" title="Your choices & rights">
          <p>Whatever your location, you can ask us to:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Access a copy of the personal information we hold about you.</li>
            <li>Correct information that&rsquo;s inaccurate or incomplete.</li>
            <li>Delete your account and associated personal information.</li>
            <li>Export your trip data in a portable format.</li>
          </ul>
          <p>
            To do any of this, email us at{" "}
            <a href="mailto:thatfriendapp@gmail.com" className="underline">
              thatfriendapp@gmail.com
            </a>
            . Because we&rsquo;re a small team, requests are currently
            handled by hand rather than through an automated tool.
            We&rsquo;ll get back to you as quickly as we can, and no later
            than 30 days.
          </p>
          <p>
            If you&rsquo;re a resident of California, the EU/EEA, UK, or
            another jurisdiction with its own privacy law, you may have
            additional specific rights under laws like the CCPA or GDPR. We
            intend to honor the spirit of those rights for all users
            regardless of where the law technically applies; this section
            will be expanded with jurisdiction-specific detail as That
            Friend grows.
          </p>
        </Section>

        <Section n="07" id="pp-07" title="Security">
          <p>
            We take reasonable technical and organizational measures to
            protect your information, such as restricting who can access app
            data and using reputable hosting providers. That said, no method
            of storing or transmitting data is completely secure, and we
            can&rsquo;t guarantee absolute security, especially while the
            product is still evolving.
          </p>
        </Section>

        <Section
          n="08"
          id="pp-08"
          title="Minors and family/friend accounts"
        >
          <p>
            That Friend is not directed at children under 13, and we do not
            knowingly collect personal information from children under 13.
            If you believe a child under 13 has provided us with personal
            information, please contact us at{" "}
            <a href="mailto:thatfriendapp@gmail.com" className="underline">
              thatfriendapp@gmail.com
            </a>{" "}
            and we will delete it.
          </p>
          <p>
            If you are between 13 and 18 years old, please make sure you
            have a parent&rsquo;s or guardian&rsquo;s permission before using
            That Friend, since trip details you enter (including location
            and budget information) may be visible to other members of your
            trip. Parents or guardians who believe their teen has shared
            personal information through the app and would like it removed
            can also contact us at the email above.
          </p>
        </Section>

        <Section n="09" id="pp-09" title="International use">
          <p>
            That Friend is currently operated from the United States. If you
            use the app from outside the U.S., your information will be
            transferred to and processed in the U.S., where privacy laws may
            differ from those in your country.
          </p>
        </Section>

        <Section n="10" id="pp-10" title="Changes to this policy">
          <p>
            We may update this policy as That Friend develops, especially as
            we add features like real payment processing. If we make a
            material change, we&rsquo;ll update the effective date above and
            let users know directly (for example, by email or in-app notice)
            rather than relying on you to check back here.
          </p>
        </Section>

        <Section n="11" id="pp-11" title="Text messaging (SMS)">
          <p>
            If you provide a mobile phone number, we use it to send you text
            messages related to the app: a one-time code to sign in, a
            confirmation when a link, note, or photo you forward gets added
            to your trip, and reminders about a trip you're part of.
          </p>
          <p>
            <strong className="text-ink">We do not share or sell your
            mobile phone number</strong> to third parties for their own
            marketing or promotional purposes.
          </p>
          <p>
            Message frequency varies with how active your trips are, and
            is typically a handful of messages per trip. Message and data
            rates may apply. Reply STOP at any time to stop receiving texts,
            or HELP for help.
          </p>
        </Section>

        <div id="pp-12" className="scroll-mt-24 pt-10">
          <div className="mb-5 flex items-baseline gap-3.5">
            <span className="font-mono text-[11px] text-accent">12</span>
            <h2 className="text-3xl font-display tracking-tight text-ink">
              Contact us
            </h2>
          </div>
          <p className="max-w-2xl text-[15.5px] leading-relaxed text-body text-pretty">
            Questions, requests, or concerns about this policy or your
            information can be sent to{" "}
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
          </div>
        </div>
      </footer>
    </div>
  );
}
