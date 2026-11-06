ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actor_table_id_arm_tables_id_fk";
--> statement-breakpoint
ALTER TABLE "match_events" DROP CONSTRAINT "match_events_actor_table_id_arm_tables_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_table_id_arm_tables_id_fk" FOREIGN KEY ("actor_table_id") REFERENCES "public"."arm_tables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_actor_table_id_arm_tables_id_fk" FOREIGN KEY ("actor_table_id") REFERENCES "public"."arm_tables"("id") ON DELETE set null ON UPDATE no action;