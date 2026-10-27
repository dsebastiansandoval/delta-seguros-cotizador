ALTER TABLE "claims" ALTER COLUMN "policy_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "branch" "branch" NOT NULL;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "insurer_id" uuid;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "client_name" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "client_document_number" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "policy_number" text;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_insurer_id_insurers_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "public"."insurers"("id") ON DELETE no action ON UPDATE no action;