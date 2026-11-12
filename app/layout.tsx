import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { CopyEmail } from "@/components/CopyEmail";

export const metadata: Metadata = {
  title: { default: "Rithm Youth Retreat", template: "%s · Rithm Youth Retreat" },
  description: "What young changemakers wrote at the Rithm retreat, word for word, and who in the network is already working on each concern.",
};

export const READYMAG = "https://readymag.website/u918716038/6521655/";
const EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "info@therithmproject.org";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Lato:wght@400;700&display=swap" />
      </head>
      <body>
        <div className="wrap">
          <nav>
            <a className="brand" href="https://www.therithmproject.org/" target="_blank" rel="noopener">The Rithm Project</a>
            <div className="topnav">
              <Link href="/">Map</Link>
              <Link href="/wall">The wall</Link>
              <Link href="/zine">The zine</Link>
              <Link href="/untapped">Untapped problems</Link>
              <Link href="/people">Everyone</Link>
              <Link href="/submit">Add yourself / claim a note</Link>
              <a href={READYMAG} target="_blank" rel="noopener">Rithm&apos;s work ↗</a>
            </div>
          </nav>
          {children}
          <footer>
            <p><strong style={{ color: "var(--ink)" }}>Part of Rithm&apos;s work.</strong> This map and wall extend what the Rithm Project already does with young people; see <a href={READYMAG} target="_blank" rel="noopener">Rithm&apos;s Readymag page ↗</a> for the bigger picture.</p>
            <p><strong style={{ color: "var(--ink)" }}>How to reach someone.</strong> Each organization links to its website. For a warm introduction to a specific person, email the Rithm team at <span className="mail">{EMAIL}</span> <CopyEmail email={EMAIL} /> and say who you&apos;d like to meet and why.</p>
            <p><strong style={{ color: "var(--ink)" }}>How the links were made.</strong> Sticky notes are transcribed verbatim from photos of the retreat wall (spelling and all; <em>[illegible]</em> and <em>[crossed out]</em> mark what couldn&apos;t be read). An organization is placed next to a note only when there is a named project, report, product or law that addresses it; that evidence is linked on every connection. “Nearby” means the organization works in the area but nothing specific to that note was found, so treat it as a lead, not a match. New people, organizations and evidence come in through the <Link href="/submit">submission form</Link> and are reviewed by the Rithm team before they appear.</p>
            <p>Sources: the public Changemaker Network roster, Rithm&apos;s team, youth fellows and facilitators, the sticky notes from the October 2026 youth retreat, and the organizations&apos; own websites and reports. Personal contact details aren&apos;t published here; ask Rithm for those.</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
