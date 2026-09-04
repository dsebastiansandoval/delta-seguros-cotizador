CREATE TYPE "public"."arco_request_status" AS ENUM('RECIBIDA', 'EN_PROCESO', 'COMPLETADA', 'RECHAZADA');--> statement-breakpoint
CREATE TYPE "public"."arco_request_type" AS ENUM('ACCESO', 'RECTIFICACION', 'CANCELACION', 'OPOSICION');--> statement-breakpoint
CREATE TABLE "arco_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"type" "arco_request_type" NOT NULL,
	"status" "arco_request_status" DEFAULT 'RECIBIDA' NOT NULL,
	"channel" text,
	"notes" text,
	"requested_by_user_id" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_by_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"resolution_notes" text
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "is_anonymized" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "anonymized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "marketing_opt_out" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "arco_requests" ADD CONSTRAINT "arco_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arco_requests" ADD CONSTRAINT "arco_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arco_requests" ADD CONSTRAINT "arco_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arco_requests" ADD CONSTRAINT "arco_requests_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;