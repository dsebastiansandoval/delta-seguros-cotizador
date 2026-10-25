ALTER TABLE "insurers" ADD COLUMN "supports_km" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "insurers" SET "supports_km" = true WHERE "code" = 'AIG';
