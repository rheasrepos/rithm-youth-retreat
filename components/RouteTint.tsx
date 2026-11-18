"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Tells the stylesheet which section is showing, so each one can have its own colours. */
export function RouteTint() {
  const path = usePathname();
  useEffect(() => {
    const seg = path.split("/")[1] || "map";
    document.documentElement.dataset.page = ["wall", "words", "zine", "team", "submit", "login"].includes(seg) ? seg : "map";
  }, [path]);
  return null;
}
