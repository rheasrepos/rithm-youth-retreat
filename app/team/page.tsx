import team from "@/data/team.json";
import { Team, type TeamPerson } from "@/components/Team";

export const metadata = { title: "The team" };

/* Names, crews and what each person did or said live in data/team.json. */
export default function TeamPage() {
  const people = team.people as TeamPerson[];
  return (
    <>
      <header className="hero">
        <h1>The <em>team</em></h1>
        <p className="lede">Everyone who was at the retreat. Press a Polaroid to see who it is and something they did or said.</p>
      </header>
      <Team people={people} />
      <section className="results">
        <div className="rhead"><h2>Credits</h2></div>
        <div className="credits">
          {team.credits.map((c) => (
            <div key={c.role}><h3>{c.role}</h3><p>{c.names.length ? c.names.join(", ") : <span className="todo">Names to come</span>}</p></div>
          ))}
        </div>
      </section>
    </>
  );
}
