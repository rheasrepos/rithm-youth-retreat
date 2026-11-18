import { redirect } from "next/navigation";

/* The list of everyone now lives inside the Changemaker Network map. Old links land on that section. */
export default function People() { redirect("/#everyone"); }
