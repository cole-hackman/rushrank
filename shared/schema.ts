import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const pnms = pgTable("pnms", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  major: text("major").notNull(),
  hometown: text("hometown"),
  year: text("year"), // freshman, sophomore, junior, senior
  photoPath: text("photo_path"), // object storage path
  tags: text("tags").array().default([]), // athlete, legacy, funny, etc
  walkoutSong: text("walkout_song"),
  weirdestTalent: text("weirdest_talent"),
  chickFilAOrder: text("chick_fil_a_order"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const votingRounds = pgTable("voting_rounds", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  roomCode: text("room_code").notNull().unique(),
  isActive: boolean("is_active").default(true),
  currentPNMId: uuid("current_pnm_id").references(() => pnms.id),
  currentPNMIndex: integer("current_pnm_index").default(0),
  selectedPNMIds: text("selected_pnm_ids").array().default([]), // PNM IDs for this round
  createdAt: timestamp("created_at").defaultNow(),
});

export const votes = pgTable("votes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  roundId: uuid("round_id").references(() => votingRounds.id).notNull(),
  pnmId: uuid("pnm_id").references(() => pnms.id).notNull(),
  voterId: text("voter_id").notNull(), // session-based voter identification
  vote: text("vote").notNull(), // 'yes', 'no', 'dont_know'
  isFavorite: boolean("is_favorite").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pnmRelations = relations(pnms, ({ many }) => ({
  votes: many(votes),
}));

export const votingRoundRelations = relations(votingRounds, ({ many, one }) => ({
  votes: many(votes),
  currentPNM: one(pnms, {
    fields: [votingRounds.currentPNMId],
    references: [pnms.id],
  }),
}));

export const voteRelations = relations(votes, ({ one }) => ({
  round: one(votingRounds, {
    fields: [votes.roundId],
    references: [votingRounds.id],
  }),
  pnm: one(pnms, {
    fields: [votes.pnmId],
    references: [pnms.id],
  }),
}));

// Insert schemas
export const insertPNMSchema = createInsertSchema(pnms).omit({
  id: true,
  createdAt: true,
});

export const insertVotingRoundSchema = createInsertSchema(votingRounds).omit({
  id: true,
  createdAt: true,
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
  createdAt: true,
});

// Types
export type PNM = typeof pnms.$inferSelect;
export type InsertPNM = z.infer<typeof insertPNMSchema>;
export type VotingRound = typeof votingRounds.$inferSelect;
export type InsertVotingRound = z.infer<typeof insertVotingRoundSchema>;
export type Vote = typeof votes.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;

// Additional types for API responses
export type PNMWithVotes = PNM & {
  voteCount: number;
  yesCount: number;
  noCount: number;
  dontKnowCount: number;
  favoriteCount: number;
  yesPercentage: number;
  controversyScore: number;
};

export type VotingRoundWithDetails = VotingRound & {
  currentPNM?: PNM;
  totalPNMs: number;
  voterCount: number;
};
