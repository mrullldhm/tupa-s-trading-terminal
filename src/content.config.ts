import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const status = z.enum(["done", "in-progress", "pending", "not-started"]);

const strategies = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/strategies" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    order: z.number(),
    dataKey: z.string().optional(),
    source: z.object({ label: z.string(), url: z.url() }).optional(),
    pine: z.string().optional(),
    // building = code written, results not in yet: it has a page but no numbers
    stage: z.enum(["tested", "building", "planned"]),
    verdict: z.string(),
    features: z.object({ f0: status.default("not-started"), f1: status, f2: status, f3: status, f4: status.default("not-started"), f5: status.default("not-started") }),
    reviews: z
      .array(z.object({ id: z.string(), kind: z.enum(["code", "replication", "plan"]), label: z.string(), date: z.coerce.date() }))
      .default([]),
    updated: z.coerce.date(),
  }),
});

const journal = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/journal" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    kind: z.enum(["milestone", "result", "dead-end", "review"]),
    strategy: z.string().optional(),
  }),
});

const strategySections = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/strategy-sections" }),
  schema: z.object({ strategy: z.string(), section: z.string(), title: z.string(), order: z.number() }),
});

export const collections = { strategies, strategySections, journal };
