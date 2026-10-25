ALTER TABLE "quote_options" ADD COLUMN "included_in_offer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_options" ADD COLUMN "member_premiums" jsonb;