CREATE TYPE "public"."bracket_side" AS ENUM('winners', 'losers', 'grand_final', 'third_place');--> statement-breakpoint
CREATE TYPE "public"."bracket_status" AS ENUM('draft', 'locked', 'in_progress', 'finished');--> statement-breakpoint
CREATE TYPE "public"."bracket_type" AS ENUM('single', 'double');--> statement-breakpoint
CREATE TYPE "public"."category_kind" AS ENUM('weight', 'all_around');--> statement-breakpoint
CREATE TYPE "public"."entry_status" AS ENUM('active', 'moved', 'withdrawn', 'disqualified');--> statement-breakpoint
CREATE TYPE "public"."finance_visibility" AS ENUM('off', 'organizers', 'athletes', 'public');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'open');--> statement-breakpoint
CREATE TYPE "public"."hand" AS ENUM('left', 'right');--> statement-breakpoint
CREATE TYPE "public"."match_event_type" AS ENUM('assign_table', 'start', 'foul', 'warning', 'result', 'undo', 'note');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('pending', 'ready', 'on_table', 'in_progress', 'finished', 'bye', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'page_banner', 'zalo_copy');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('postpone', 'broadcast', 'payment_reminder');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('owner', 'staff');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('vietqr', 'cash', 'manual');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('none', 'sepay', 'casso');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'partial', 'paid', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."platform_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."price_tier_kind" AS ENUM('online', 'onsite');--> statement-breakpoint
CREATE TYPE "public"."registration_source" AS ENUM('online', 'onsite');--> statement-breakpoint
CREATE TYPE "public"."registration_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."slot" AS ENUM('red', 'blue');--> statement-breakpoint
CREATE TYPE "public"."arm_table_status" AS ENUM('active', 'paused');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('draft', 'published', 'ongoing', 'finished', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transaction_match" AS ENUM('matched', 'unmatched', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."weigh_result" AS ENUM('pass', 'fail');--> statement-breakpoint
CREATE TABLE "all_around_sources" (
	"all_around_category_id" uuid NOT NULL,
	"source_category_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arm_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "arm_table_status" DEFAULT 'active' NOT NULL,
	"referee_name" text,
	"access_token_hash" text,
	"sort_order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "athletes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"phone" varchar(20) NOT NULL,
	"email" text,
	"birth_year" smallint NOT NULL,
	"gender" "gender" NOT NULL,
	"club" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "athlete_gender_chk" CHECK ("athletes"."gender" <> 'open')
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid,
	"actor_user_id" uuid,
	"actor_table_id" uuid,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brackets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"type" "bracket_type" NOT NULL,
	"status" "bracket_status" DEFAULT 'draft' NOT NULL,
	"draw_seed" integer,
	"third_place_match" boolean DEFAULT true NOT NULL,
	"grand_final_reset" boolean DEFAULT true NOT NULL,
	"generated_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	CONSTRAINT "brackets_category_id_unique" UNIQUE("category_id")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"session_id" uuid,
	"kind" "category_kind" DEFAULT 'weight' NOT NULL,
	"hand" "hand" NOT NULL,
	"gender" "gender" NOT NULL,
	"label" text NOT NULL,
	"weight_min_kg" numeric(5, 2),
	"weight_max_kg" numeric(5, 2),
	"birth_year_min" smallint,
	"birth_year_max" smallint,
	"capacity" integer,
	"bracket_type" "bracket_type" DEFAULT 'single' NOT NULL,
	"all_around_max_place" smallint,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "all_around_place_chk" CHECK ("categories"."kind" <> 'all_around' OR "categories"."all_around_max_place" BETWEEN 1 AND 3)
);
--> statement-breakpoint
CREATE TABLE "category_results" (
	"category_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"place" smallint NOT NULL,
	"finalized_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"title" text NOT NULL,
	"amount" bigint NOT NULL,
	"spent_on" date,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"type" "match_event_type" NOT NULL,
	"entry_id" uuid,
	"payload" jsonb,
	"client_event_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_table_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_events_client_event_id_unique" UNIQUE("client_event_id")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bracket_id" uuid NOT NULL,
	"side" "bracket_side" DEFAULT 'winners' NOT NULL,
	"round" smallint NOT NULL,
	"position" smallint NOT NULL,
	"number" smallint NOT NULL,
	"red_entry_id" uuid,
	"blue_entry_id" uuid,
	"winner_entry_id" uuid,
	"status" "match_status" DEFAULT 'pending' NOT NULL,
	"table_id" uuid,
	"queue_position" integer,
	"next_match_id" uuid,
	"next_slot" "slot",
	"loser_next_match_id" uuid,
	"loser_next_slot" "slot",
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"channels" "notification_channel"[] NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"recipients_count" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "org_role" DEFAULT 'staff' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contacts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"bank_bin" varchar(8),
	"bank_account_no" varchar(32),
	"bank_account_name" text,
	"payment_provider" "payment_provider" DEFAULT 'none' NOT NULL,
	"provider_api_key_enc" text,
	"webhook_secret" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"registration_id" uuid,
	"method" "payment_method" NOT NULL,
	"provider" "payment_provider" DEFAULT 'none' NOT NULL,
	"provider_txn_id" text,
	"amount" bigint NOT NULL,
	"transfer_content" text,
	"match_status" "transaction_match" DEFAULT 'matched' NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"recorded_by" uuid,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"kind" "price_tier_kind" NOT NULL,
	"name" text NOT NULL,
	"valid_until" timestamp with time zone,
	"single_hand_price" bigint NOT NULL,
	"both_hands_price" bigint,
	"sort_order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prizes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"category_id" uuid,
	"place" smallint NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"cash_amount" bigint
);
--> statement-breakpoint
CREATE TABLE "registration_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"athlete_id" uuid NOT NULL,
	"status" "entry_status" DEFAULT 'active' NOT NULL,
	"moved_from_entry_id" uuid,
	"fee" bigint DEFAULT 0 NOT NULL,
	"price_tier_id" uuid,
	"weigh_result" "weigh_result",
	"auto_added" boolean DEFAULT false NOT NULL,
	"seed" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"athlete_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"transfer_ref" varchar(30) NOT NULL,
	"ticket_token" varchar(40) NOT NULL,
	"status" "registration_status" DEFAULT 'pending' NOT NULL,
	"source" "registration_source" DEFAULT 'online' NOT NULL,
	"price_tier_id" uuid,
	"amount_due" bigint NOT NULL,
	"amount_paid" bigint DEFAULT 0 NOT NULL,
	"payment_status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"age_warning" boolean DEFAULT false NOT NULL,
	"consent_at" timestamp with time zone,
	"checked_in_at" timestamp with time zone,
	"weighed_kg" numeric(5, 2),
	"weighed_at" timestamp with time zone,
	"weighed_by" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registrations_transfer_ref_unique" UNIQUE("transfer_ref"),
	CONSTRAINT "registrations_ticket_token_unique" UNIQUE("ticket_token")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"name" text NOT NULL,
	"weigh_in_start" timestamp with time zone,
	"weigh_in_end" timestamp with time zone,
	"compete_start" timestamp with time zone,
	"compete_end" timestamp with time zone,
	"sort_order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"slug" varchar(60) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"rules" text,
	"notes" text,
	"cover_image_key" text NOT NULL,
	"og_image_key" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"timezone" text DEFAULT 'Asia/Ho_Chi_Minh' NOT NULL,
	"venue_name" text NOT NULL,
	"venue_address" text,
	"maps_url" text,
	"contacts" jsonb,
	"status" "tournament_status" DEFAULT 'draft' NOT NULL,
	"registration_deadline" timestamp with time zone,
	"capacity" integer,
	"birth_year_min" smallint,
	"birth_year_max" smallint,
	"weight_tolerance_kg" numeric(5, 2) DEFAULT '0' NOT NULL,
	"finance_visibility" "finance_visibility" DEFAULT 'off' NOT NULL,
	"registration_seq" integer DEFAULT 0 NOT NULL,
	"code_prefix" varchar(8) NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournaments_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_subject" text NOT NULL,
	"email" text,
	"full_name" text,
	"phone" varchar(20),
	"role" "platform_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_auth_subject_unique" UNIQUE("auth_subject"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "all_around_sources" ADD CONSTRAINT "all_around_sources_all_around_category_id_categories_id_fk" FOREIGN KEY ("all_around_category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "all_around_sources" ADD CONSTRAINT "all_around_sources_source_category_id_categories_id_fk" FOREIGN KEY ("source_category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arm_tables" ADD CONSTRAINT "arm_tables_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athletes" ADD CONSTRAINT "athletes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_table_id_arm_tables_id_fk" FOREIGN KEY ("actor_table_id") REFERENCES "public"."arm_tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brackets" ADD CONSTRAINT "brackets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_results" ADD CONSTRAINT "category_results_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_results" ADD CONSTRAINT "category_results_entry_id_registration_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."registration_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_entry_id_registration_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."registration_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_actor_table_id_arm_tables_id_fk" FOREIGN KEY ("actor_table_id") REFERENCES "public"."arm_tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_bracket_id_brackets_id_fk" FOREIGN KEY ("bracket_id") REFERENCES "public"."brackets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_red_entry_id_registration_entries_id_fk" FOREIGN KEY ("red_entry_id") REFERENCES "public"."registration_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_blue_entry_id_registration_entries_id_fk" FOREIGN KEY ("blue_entry_id") REFERENCES "public"."registration_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_entry_id_registration_entries_id_fk" FOREIGN KEY ("winner_entry_id") REFERENCES "public"."registration_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_table_id_arm_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."arm_tables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_next_match_id_matches_id_fk" FOREIGN KEY ("next_match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_loser_next_match_id_matches_id_fk" FOREIGN KEY ("loser_next_match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_tiers" ADD CONSTRAINT "price_tiers_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prizes" ADD CONSTRAINT "prizes_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prizes" ADD CONSTRAINT "prizes_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_entries" ADD CONSTRAINT "registration_entries_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_entries" ADD CONSTRAINT "registration_entries_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_entries" ADD CONSTRAINT "registration_entries_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_entries" ADD CONSTRAINT "registration_entries_moved_from_entry_id_registration_entries_id_fk" FOREIGN KEY ("moved_from_entry_id") REFERENCES "public"."registration_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_entries" ADD CONSTRAINT "registration_entries_price_tier_id_price_tiers_id_fk" FOREIGN KEY ("price_tier_id") REFERENCES "public"."price_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_price_tier_id_price_tiers_id_fk" FOREIGN KEY ("price_tier_id") REFERENCES "public"."price_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_weighed_by_users_id_fk" FOREIGN KEY ("weighed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "all_around_src_uq" ON "all_around_sources" USING btree ("all_around_category_id","source_category_id");--> statement-breakpoint
CREATE INDEX "arm_table_tournament_idx" ON "arm_tables" USING btree ("tournament_id");--> statement-breakpoint
CREATE UNIQUE INDEX "athlete_identity_uq" ON "athletes" USING btree ("phone","name_normalized");--> statement-breakpoint
CREATE INDEX "athlete_user_idx" ON "athletes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_tournament_idx" ON "audit_logs" USING btree ("tournament_id","created_at");--> statement-breakpoint
CREATE INDEX "category_tournament_idx" ON "categories" USING btree ("tournament_id");--> statement-breakpoint
CREATE UNIQUE INDEX "result_entry_uq" ON "category_results" USING btree ("category_id","entry_id");--> statement-breakpoint
CREATE INDEX "match_event_match_idx" ON "match_events" USING btree ("match_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "match_position_uq" ON "matches" USING btree ("bracket_id","side","round","position");--> statement-breakpoint
CREATE INDEX "match_table_idx" ON "matches" USING btree ("table_id","status","queue_position");--> statement-breakpoint
CREATE UNIQUE INDEX "org_member_uq" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_provider_txn_uq" ON "payments" USING btree ("provider","provider_txn_id") WHERE "payments"."provider_txn_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "payment_registration_idx" ON "payments" USING btree ("registration_id");--> statement-breakpoint
CREATE INDEX "payment_unmatched_idx" ON "payments" USING btree ("tournament_id","match_status");--> statement-breakpoint
CREATE INDEX "price_tier_tournament_idx" ON "price_tiers" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "prize_tournament_idx" ON "prizes" USING btree ("tournament_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entry_athlete_category_uq" ON "registration_entries" USING btree ("category_id","athlete_id") WHERE "registration_entries"."status" = 'active';--> statement-breakpoint
CREATE INDEX "entry_registration_idx" ON "registration_entries" USING btree ("registration_id");--> statement-breakpoint
CREATE UNIQUE INDEX "registration_athlete_uq" ON "registrations" USING btree ("tournament_id","athlete_id");--> statement-breakpoint
CREATE UNIQUE INDEX "registration_code_uq" ON "registrations" USING btree ("tournament_id","code");--> statement-breakpoint
CREATE INDEX "registration_status_idx" ON "registrations" USING btree ("tournament_id","status","payment_status");--> statement-breakpoint
CREATE INDEX "session_tournament_idx" ON "sessions" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "tournament_org_idx" ON "tournaments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tournament_status_idx" ON "tournaments" USING btree ("status","starts_at");