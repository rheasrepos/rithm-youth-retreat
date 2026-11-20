import Link from "next/link";

export const metadata = { title: "Add yourself or claim a note" };

/* The static (GitHub Pages) version of /submit: there is no server to receive a form, so this points people to the Rithm team instead. */
export default function Submit() {
  const form = process.env.NEXT_PUBLIC_SUBMIT_URL;
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <section className="results">
      <div className="rhead"><span className="crumb"><Link href="/">Map</Link> · Submit</span><h2>Add yourself, your organization, or evidence</h2>
        <p>This copy of the site is a snapshot, so it can&apos;t take submissions directly.{" "}
          {form ? <>Use <a href={form} target="_blank" rel="noopener">the Rithm team&apos;s form ↗</a>; once they approve it, it joins the map at the next update.</> : email ? <>Email the Rithm team at {email} and they&apos;ll add it at the next update.</> : <>Get in touch with the Rithm team and they&apos;ll add it at the next update.</>}
        </p></div>
    </section>
  );
}
