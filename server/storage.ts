import { 
  pnms, 
  votingRounds, 
  votes,
  events,
  attendance,
  type PNM, 
  type InsertPNM, 
  type VotingRound, 
  type InsertVotingRound,
  type Vote,
  type InsertVote,
  type Event,
  type InsertEvent,
  type Attendance,
  type InsertAttendance,
  type PNMWithVotes,
  type PNMWithAttendance,
  type VotingRoundWithDetails,
  type EventWithAttendance
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, inArray, and } from "drizzle-orm";

export interface IStorage {
  // PNM methods
  getPNM(id: string): Promise<PNM | undefined>;
  getAllPNMs(): Promise<PNM[]>;
  createPNM(pnm: InsertPNM): Promise<PNM>;
  updatePNM(id: string, pnm: Partial<InsertPNM>): Promise<PNM | undefined>;
  deletePNM(id: string): Promise<boolean>;

  // Voting Round methods
  getVotingRound(id: string): Promise<VotingRound | undefined>;
  getVotingRoundByCode(roomCode: string): Promise<VotingRoundWithDetails | undefined>;
  getActiveVotingRound(): Promise<VotingRoundWithDetails | undefined>;
  createVotingRound(round: InsertVotingRound): Promise<VotingRound>;
  updateVotingRound(id: string, round: Partial<InsertVotingRound>): Promise<VotingRound | undefined>;
  endVotingRound(id: string): Promise<boolean>;

  // Vote methods
  createVote(vote: InsertVote): Promise<Vote>;
  getVotesForRound(roundId: string): Promise<Vote[]>;
  getVoteByRoundAndVoter(roundId: string, voterId: string, pnmId: string): Promise<Vote | undefined>;
  updateVote(id: string, vote: Partial<InsertVote>): Promise<Vote | undefined>;

  // Event methods
  getEvent(id: string): Promise<Event | undefined>;
  getAllEvents(): Promise<Event[]>;
  getActiveEvents(): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<boolean>;

  // Attendance methods
  markAttendance(attendance: InsertAttendance): Promise<Attendance>;
  getEventAttendance(eventId: string): Promise<EventWithAttendance>;
  getPNMAttendance(pnmId: string): Promise<PNMWithAttendance>;
  getAllPNMsWithAttendance(): Promise<PNMWithAttendance[]>;
  removeAttendance(eventId: string, pnmId: string): Promise<boolean>;

  // Analytics methods
  getPNMsWithVotesForRound(roundId: string): Promise<PNMWithVotes[]>;
  getRoundStatistics(roundId: string): Promise<{
    totalVotes: number;
    uniqueVoters: number;
    avgYesPercentage: number;
    totalFavorites: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getPNM(id: string): Promise<PNM | undefined> {
    const [pnm] = await db.select().from(pnms).where(eq(pnms.id, id));
    return pnm || undefined;
  }

  async getAllPNMs(): Promise<PNM[]> {
    return await db.select().from(pnms).orderBy(desc(pnms.createdAt));
  }

  async createPNM(insertPNM: InsertPNM): Promise<PNM> {
    const [pnm] = await db.insert(pnms).values(insertPNM).returning();
    return pnm;
  }

  async updatePNM(id: string, updatePNM: Partial<InsertPNM>): Promise<PNM | undefined> {
    const [pnm] = await db
      .update(pnms)
      .set(updatePNM)
      .where(eq(pnms.id, id))
      .returning();
    return pnm || undefined;
  }

  async deletePNM(id: string): Promise<boolean> {
    const result = await db.delete(pnms).where(eq(pnms.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getVotingRound(id: string): Promise<VotingRound | undefined> {
    const [round] = await db.select().from(votingRounds).where(eq(votingRounds.id, id));
    return round || undefined;
  }

  async getVotingRoundByCode(roomCode: string): Promise<VotingRoundWithDetails | undefined> {
    const [round] = await db
      .select({
        id: votingRounds.id,
        roomCode: votingRounds.roomCode,
        isActive: votingRounds.isActive,
        currentPNMId: votingRounds.currentPNMId,
        currentPNMIndex: votingRounds.currentPNMIndex,
        selectedPNMIds: votingRounds.selectedPNMIds,
        createdAt: votingRounds.createdAt,
        currentPNM: pnms,
      })
      .from(votingRounds)
      .leftJoin(pnms, eq(votingRounds.currentPNMId, pnms.id))
      .where(eq(votingRounds.roomCode, roomCode));

    if (!round) return undefined;

    const voterCount = await db
      .select({ count: sql<number>`count(distinct ${votes.voterId})` })
      .from(votes)
      .where(eq(votes.roundId, round.id));

    return {
      ...round,
      currentPNM: round.currentPNM || undefined,
      totalPNMs: round.selectedPNMIds?.length || 0,
      voterCount: voterCount[0]?.count || 0,
    };
  }

  async getActiveVotingRound(): Promise<VotingRoundWithDetails | undefined> {
    const [round] = await db
      .select({
        id: votingRounds.id,
        roomCode: votingRounds.roomCode,
        isActive: votingRounds.isActive,
        currentPNMId: votingRounds.currentPNMId,
        currentPNMIndex: votingRounds.currentPNMIndex,
        selectedPNMIds: votingRounds.selectedPNMIds,
        createdAt: votingRounds.createdAt,
        currentPNM: pnms,
      })
      .from(votingRounds)
      .leftJoin(pnms, eq(votingRounds.currentPNMId, pnms.id))
      .where(eq(votingRounds.isActive, true))
      .orderBy(desc(votingRounds.createdAt));

    if (!round) return undefined;

    const voterCount = await db
      .select({ count: sql<number>`count(distinct ${votes.voterId})` })
      .from(votes)
      .where(eq(votes.roundId, round.id));

    return {
      ...round,
      currentPNM: round.currentPNM || undefined,
      totalPNMs: round.selectedPNMIds?.length || 0,
      voterCount: voterCount[0]?.count || 0,
    };
  }

  async createVotingRound(insertRound: InsertVotingRound): Promise<VotingRound> {
    const [round] = await db.insert(votingRounds).values(insertRound).returning();
    return round;
  }

  async updateVotingRound(id: string, updateRound: Partial<InsertVotingRound>): Promise<VotingRound | undefined> {
    const [round] = await db
      .update(votingRounds)
      .set(updateRound)
      .where(eq(votingRounds.id, id))
      .returning();
    return round || undefined;
  }

  async endVotingRound(id: string): Promise<boolean> {
    const result = await db
      .update(votingRounds)
      .set({ isActive: false })
      .where(eq(votingRounds.id, id));
    return (result.rowCount || 0) > 0;
  }

  async createVote(insertVote: InsertVote): Promise<Vote> {
    const [vote] = await db.insert(votes).values(insertVote).returning();
    return vote;
  }

  async getVotesForRound(roundId: string): Promise<Vote[]> {
    return await db.select().from(votes).where(eq(votes.roundId, roundId));
  }

  async getVoteByRoundAndVoter(roundId: string, voterId: string, pnmId: string): Promise<Vote | undefined> {
    const [vote] = await db
      .select()
      .from(votes)
      .where(
        and(
          eq(votes.roundId, roundId),
          eq(votes.voterId, voterId),
          eq(votes.pnmId, pnmId)
        )
      );
    return vote || undefined;
  }

  async updateVote(id: string, updateVote: Partial<InsertVote>): Promise<Vote | undefined> {
    const [vote] = await db
      .update(votes)
      .set(updateVote)
      .where(eq(votes.id, id))
      .returning();
    return vote || undefined;
  }

  async getPNMsWithVotesForRound(roundId: string): Promise<PNMWithVotes[]> {
    const results = await db
      .select({
        id: pnms.id,
        name: pnms.name,
        major: pnms.major,
        hometown: pnms.hometown,
        year: pnms.year,
        photoPath: pnms.photoPath,
        tags: pnms.tags,
        walkoutSong: pnms.walkoutSong,
        weirdestTalent: pnms.weirdestTalent,
        chickFilAOrder: pnms.chickFilAOrder,
        createdAt: pnms.createdAt,
        voteCount: sql<number>`count(${votes.id})`,
        yesCount: sql<number>`sum(case when ${votes.vote} = 'yes' then 1 else 0 end)`,
        noCount: sql<number>`sum(case when ${votes.vote} = 'no' then 1 else 0 end)`,
        dontKnowCount: sql<number>`sum(case when ${votes.vote} = 'dont_know' then 1 else 0 end)`,
        favoriteCount: sql<number>`sum(case when ${votes.isFavorite} = true then 1 else 0 end)`,
      })
      .from(pnms)
      .leftJoin(votes, and(eq(votes.pnmId, pnms.id), eq(votes.roundId, roundId)))
      .groupBy(pnms.id)
      .orderBy(sql`sum(case when ${votes.vote} = 'yes' then 1 else 0 end) desc`);

    return results.map(result => ({
      ...result,
      yesPercentage: result.voteCount > 0 ? Math.round((result.yesCount / result.voteCount) * 100) : 0,
      controversyScore: this.calculateControversyScore(result.yesCount, result.noCount, result.dontKnowCount),
    }));
  }

  private calculateControversyScore(yesCount: number, noCount: number, dontKnowCount: number): number {
    const totalVotes = yesCount + noCount + dontKnowCount;
    if (totalVotes === 0) return 0;
    
    // Calculate variance in votes - higher variance = more controversial
    const yesRatio = yesCount / totalVotes;
    const noRatio = noCount / totalVotes;
    const dontKnowRatio = dontKnowCount / totalVotes;
    
    const mean = (yesRatio + noRatio + dontKnowRatio) / 3;
    const variance = ((yesRatio - mean) ** 2 + (noRatio - mean) ** 2 + (dontKnowRatio - mean) ** 2) / 3;
    
    return Math.round(variance * 1000); // Scale for readability
  }

  async getRoundStatistics(roundId: string): Promise<{
    totalVotes: number;
    uniqueVoters: number;
    avgYesPercentage: number;
    totalFavorites: number;
  }> {
    const [stats] = await db
      .select({
        totalVotes: sql<number>`count(${votes.id})`,
        uniqueVoters: sql<number>`count(distinct ${votes.voterId})`,
        avgYesPercentage: sql<number>`round(avg(case when ${votes.vote} = 'yes' then 100 else 0 end))`,
        totalFavorites: sql<number>`sum(case when ${votes.isFavorite} = true then 1 else 0 end)`,
      })
      .from(votes)
      .where(eq(votes.roundId, roundId));

    return {
      totalVotes: stats?.totalVotes || 0,
      uniqueVoters: stats?.uniqueVoters || 0,
      avgYesPercentage: stats?.avgYesPercentage || 0,
      totalFavorites: stats?.totalFavorites || 0,
    };
  }

  // Event methods
  async getEvent(id: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event || undefined;
  }

  async getAllEvents(): Promise<Event[]> {
    return await db.select().from(events).orderBy(desc(events.date));
  }

  async getActiveEvents(): Promise<Event[]> {
    return await db.select().from(events).where(eq(events.isActive, true)).orderBy(desc(events.date));
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const [event] = await db.insert(events).values(insertEvent).returning();
    return event;
  }

  async updateEvent(id: string, updateEvent: Partial<InsertEvent>): Promise<Event | undefined> {
    const [event] = await db
      .update(events)
      .set(updateEvent)
      .where(eq(events.id, id))
      .returning();
    return event || undefined;
  }

  async deleteEvent(id: string): Promise<boolean> {
    const result = await db.delete(events).where(eq(events.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Attendance methods
  async markAttendance(insertAttendance: InsertAttendance): Promise<Attendance> {
    const [attendanceRecord] = await db
      .insert(attendance)
      .values(insertAttendance)
      .onConflictDoNothing({ target: [attendance.eventId, attendance.pnmId] })
      .returning();
    
    if (!attendanceRecord) {
      // Already exists, return existing record
      const [existing] = await db
        .select()
        .from(attendance)
        .where(and(
          eq(attendance.eventId, insertAttendance.eventId),
          eq(attendance.pnmId, insertAttendance.pnmId)
        ));
      return existing;
    }
    
    return attendanceRecord;
  }

  async getEventAttendance(eventId: string): Promise<EventWithAttendance> {
    const event = await this.getEvent(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    const attendanceRecords = await db
      .select({
        attendance,
        pnm: pnms,
      })
      .from(attendance)
      .innerJoin(pnms, eq(attendance.pnmId, pnms.id))
      .where(eq(attendance.eventId, eventId));

    return {
      ...event,
      attendeeCount: attendanceRecords.length,
      attendees: attendanceRecords.map(record => ({
        ...record.attendance,
        pnm: record.pnm,
      })),
    };
  }

  async getPNMAttendance(pnmId: string): Promise<PNMWithAttendance> {
    const pnm = await this.getPNM(pnmId);
    if (!pnm) {
      throw new Error('PNM not found');
    }

    const [attendanceStats] = await db
      .select({
        totalEvents: sql<number>`count(distinct ${events.id})`,
        attendedEvents: sql<number>`count(distinct ${attendance.eventId})`,
        missedMandatoryEvents: sql<number>`
          count(distinct case when ${events.type} = 'mandatory' and ${attendance.eventId} is null then ${events.id} end)
        `,
      })
      .from(events)
      .leftJoin(attendance, and(
        eq(attendance.eventId, events.id),
        eq(attendance.pnmId, pnmId)
      ))
      .where(eq(events.isActive, true));

    const totalEvents = attendanceStats?.totalEvents || 0;
    const attendedEvents = attendanceStats?.attendedEvents || 0;
    const attendancePercentage = totalEvents > 0 ? Math.round((attendedEvents / totalEvents) * 100) : 0;

    return {
      ...pnm,
      totalEvents,
      attendedEvents,
      attendancePercentage,
      missedMandatoryEvents: attendanceStats?.missedMandatoryEvents || 0,
    };
  }

  async getAllPNMsWithAttendance(): Promise<PNMWithAttendance[]> {
    const allPNMs = await this.getAllPNMs();
    const pnmsWithAttendance = await Promise.all(
      allPNMs.map(pnm => this.getPNMAttendance(pnm.id))
    );
    return pnmsWithAttendance;
  }

  async removeAttendance(eventId: string, pnmId: string): Promise<boolean> {
    const result = await db
      .delete(attendance)
      .where(and(
        eq(attendance.eventId, eventId),
        eq(attendance.pnmId, pnmId)
      ));
    return (result.rowCount || 0) > 0;
  }
}

export const storage = new DatabaseStorage();
