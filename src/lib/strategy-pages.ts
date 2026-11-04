import { getCollection } from "astro:content";
import { STAGES } from "./stages";

export async function strategyPages(slug: string) {
  const sections = (await getCollection("strategySections", (s) => s.data.strategy === slug))
    .sort((a, b) => a.data.order - b.data.order);
  const link = (section: string, title: string) => ({ section, title, href: `/strategies/${slug}/${section}/` });
  return [
    { section: "overview", title: "Overview", href: `/strategies/${slug}/` },
    ...sections.filter((s) => !/^feature-|^exit-study$/.test(s.data.section))
      .map((s) => link(s.data.section, s.data.title)),
    ...Object.values(STAGES).map((s, i) => link(`feature-${i}`, `${s.tag} · ${s.name}`)),
    ...sections.filter((s) => s.data.section === "exit-study").map((s) => link(s.data.section, "Exit study")),
    link("evidence", "Evidence and reviews"),
  ];
}
