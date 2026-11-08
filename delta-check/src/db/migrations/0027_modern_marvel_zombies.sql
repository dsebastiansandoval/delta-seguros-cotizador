ALTER TABLE "roles" ALTER COLUMN "code" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."role_code";--> statement-breakpoint
CREATE TYPE "public"."role_code" AS ENUM('PLATFORM_ADMIN', 'ADMIN', 'SUPERVISOR', 'AGENTE', 'FREELANCE');--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "code" SET DATA TYPE "public"."role_code" USING "code"::"public"."role_code";