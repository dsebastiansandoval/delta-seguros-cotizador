import { boolean, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_helpers";

/**
 * El tenant. No lleva organization_id — ES el tenant. Ver ARCHITECTURE.md §1b.
 */
export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 63 }).notNull().unique(),
  logoUrl: text("logo_url"),
  brandPrimaryColor: varchar("brand_primary_color", { length: 7 }),
  brandSecondaryColor: varchar("brand_secondary_color", { length: 7 }),
  plan: text("plan").notNull().default("standard"),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});
