import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertPNMSchema, insertVotingRoundSchema, insertVoteSchema, insertEventSchema, insertAttendanceSchema } from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { z } from "zod";

interface WebSocketMessage {
  type: string;
  data?: any;
}

interface ExtendedWebSocket extends WebSocket {
  voterId?: string;
  roundId?: string;
  isAdmin?: boolean;
}

let wss: WebSocketServer;
const connectedClients = new Set<ExtendedWebSocket>();

function broadcastToRoom(roundId: string, message: WebSocketMessage, excludeSocket?: ExtendedWebSocket) {
  const messageStr = JSON.stringify(message);
  connectedClients.forEach((client) => {
    if (client.roundId === roundId && client !== excludeSocket && client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateVoterId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Setup WebSocket server
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: ExtendedWebSocket) => {
    connectedClients.add(ws);

    ws.on('message', async (data) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'join_round':
            ws.roundId = message.data.roundId;
            ws.voterId = message.data.voterId;
            ws.isAdmin = message.data.isAdmin || false;
            
            // Send current round state
            const round = await storage.getActiveVotingRound();
            if (round) {
              ws.send(JSON.stringify({
                type: 'round_state',
                data: round
              }));
            }
            break;

          case 'admin_next_pnm':
            if (ws.isAdmin && ws.roundId) {
              const round = await storage.getVotingRound(ws.roundId);
              if (round && round.selectedPNMIds) {
                const nextIndex = (round.currentPNMIndex || 0) + 1;
                if (nextIndex < round.selectedPNMIds.length) {
                  const nextPNMId = round.selectedPNMIds[nextIndex];
                  const nextPNM = await storage.getPNM(nextPNMId);
                  
                  await storage.updateVotingRound(ws.roundId, {
                    currentPNMId: nextPNMId,
                    currentPNMIndex: nextIndex
                  });

                  broadcastToRoom(ws.roundId, {
                    type: 'pnm_changed',
                    data: {
                      currentPNM: nextPNM,
                      currentIndex: nextIndex,
                      totalPNMs: round.selectedPNMIds.length
                    }
                  });
                }
              }
            }
            break;

          case 'vote_submitted':
            if (ws.roundId && ws.voterId) {
              broadcastToRoom(ws.roundId, {
                type: 'vote_update',
                data: message.data
              }, ws);
            }
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      connectedClients.delete(ws);
    });
  });

  // Object storage routes
  const objectStorageService = new ObjectStorageService();

  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", async (req, res) => {
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // PNM routes
  app.get("/api/pnms", async (req, res) => {
    try {
      const pnms = await storage.getAllPNMs();
      res.json(pnms);
    } catch (error) {
      console.error("Error fetching PNMs:", error);
      res.status(500).json({ error: "Failed to fetch PNMs" });
    }
  });

  app.post("/api/pnms", async (req, res) => {
    try {
      const validatedData = insertPNMSchema.parse(req.body);
      const pnm = await storage.createPNM(validatedData);
      res.json(pnm);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid PNM data", details: error.errors });
      } else {
        console.error("Error creating PNM:", error);
        res.status(500).json({ error: "Failed to create PNM" });
      }
    }
  });

  app.put("/api/pnms/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertPNMSchema.partial().parse(req.body);
      const pnm = await storage.updatePNM(id, validatedData);
      
      if (!pnm) {
        return res.status(404).json({ error: "PNM not found" });
      }
      
      res.json(pnm);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid PNM data", details: error.errors });
      } else {
        console.error("Error updating PNM:", error);
        res.status(500).json({ error: "Failed to update PNM" });
      }
    }
  });

  app.put("/api/pnm-photos", async (req, res) => {
    if (!req.body.photoURL || !req.body.pnmId) {
      return res.status(400).json({ error: "photoURL and pnmId are required" });
    }

    try {
      const objectPath = objectStorageService.normalizeObjectEntityPath(req.body.photoURL);
      const pnm = await storage.updatePNM(req.body.pnmId, { photoPath: objectPath });
      
      if (!pnm) {
        return res.status(404).json({ error: "PNM not found" });
      }

      res.json({ objectPath, pnm });
    } catch (error) {
      console.error("Error setting PNM photo:", error);
      res.status(500).json({ error: "Failed to set PNM photo" });
    }
  });

  app.delete("/api/pnms/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deletePNM(id);
      
      if (!success) {
        return res.status(404).json({ error: "PNM not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting PNM:", error);
      res.status(500).json({ error: "Failed to delete PNM" });
    }
  });

  // Voting round routes
  app.get("/api/rounds/active", async (req, res) => {
    try {
      const round = await storage.getActiveVotingRound();
      res.json(round || null);
    } catch (error) {
      console.error("Error fetching active round:", error);
      res.status(500).json({ error: "Failed to fetch active round" });
    }
  });

  app.get("/api/rounds/code/:roomCode", async (req, res) => {
    try {
      const { roomCode } = req.params;
      const round = await storage.getVotingRoundByCode(roomCode.toUpperCase());
      
      if (!round) {
        return res.status(404).json({ error: "Round not found" });
      }
      
      res.json(round);
    } catch (error) {
      console.error("Error fetching round by code:", error);
      res.status(500).json({ error: "Failed to fetch round" });
    }
  });

  app.post("/api/rounds", async (req, res) => {
    try {
      const roomCode = generateRoomCode();
      const validatedData = insertVotingRoundSchema.parse({
        ...req.body,
        roomCode,
      });
      
      // End any existing active rounds
      const activeRound = await storage.getActiveVotingRound();
      if (activeRound) {
        await storage.endVotingRound(activeRound.id);
      }

      // Set first PNM as current if selectedPNMIds provided
      if (validatedData.selectedPNMIds && validatedData.selectedPNMIds.length > 0) {
        validatedData.currentPNMId = validatedData.selectedPNMIds[0];
        validatedData.currentPNMIndex = 0;
      }
      
      const round = await storage.createVotingRound(validatedData);
      const roundWithDetails = await storage.getVotingRound(round.id);
      
      res.json(roundWithDetails);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid round data", details: error.errors });
      } else {
        console.error("Error creating round:", error);
        res.status(500).json({ error: "Failed to create round" });
      }
    }
  });

  app.put("/api/rounds/:id/end", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.endVotingRound(id);
      
      if (!success) {
        return res.status(404).json({ error: "Round not found" });
      }

      // Broadcast round ended
      broadcastToRoom(id, {
        type: 'round_ended',
        data: { roundId: id }
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error ending round:", error);
      res.status(500).json({ error: "Failed to end round" });
    }
  });

  // Vote routes
  app.post("/api/votes", async (req, res) => {
    try {
      let voterId = req.body.voterId;
      if (!voterId) {
        voterId = generateVoterId();
      }

      const validatedData = insertVoteSchema.parse({
        ...req.body,
        voterId,
      });

      // Check if vote already exists
      const existingVote = await storage.getVoteByRoundAndVoter(
        validatedData.roundId,
        voterId,
        validatedData.pnmId
      );

      let vote;
      if (existingVote) {
        vote = await storage.updateVote(existingVote.id, validatedData);
      } else {
        vote = await storage.createVote(validatedData);
      }

      // Broadcast vote update
      broadcastToRoom(validatedData.roundId, {
        type: 'vote_submitted',
        data: { pnmId: validatedData.pnmId, vote: validatedData.vote, isFavorite: validatedData.isFavorite }
      });
      
      res.json({ vote, voterId });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid vote data", details: error.errors });
      } else {
        console.error("Error creating vote:", error);
        res.status(500).json({ error: "Failed to create vote" });
      }
    }
  });

  // Results routes
  app.get("/api/rounds/:roundId/results", async (req, res) => {
    try {
      const { roundId } = req.params;
      const results = await storage.getPNMsWithVotesForRound(roundId);
      const stats = await storage.getRoundStatistics(roundId);
      
      res.json({ results, stats });
    } catch (error) {
      console.error("Error fetching results:", error);
      res.status(500).json({ error: "Failed to fetch results" });
    }
  });

  app.get("/api/rounds/:roundId/export", async (req, res) => {
    try {
      const { roundId } = req.params;
      const results = await storage.getPNMsWithVotesForRound(roundId);
      
      // Generate CSV
      const headers = ['Rank', 'Name', 'Major', 'Hometown', 'Yes%', 'Yes Votes', 'No Votes', 'Don\'t Know', 'Favorites', 'Tags'];
      const rows = results.map((result, index) => [
        index + 1,
        result.name,
        result.major,
        result.hometown || '',
        result.yesPercentage + '%',
        result.yesCount,
        result.noCount,
        result.dontKnowCount,
        result.favoriteCount,
        result.tags?.join('; ') || ''
      ]);
      
      const csv = [headers, ...rows].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="rushrank-results.csv"');
      res.send(csv);
    } catch (error) {
      console.error("Error exporting results:", error);
      res.status(500).json({ error: "Failed to export results" });
    }
  });

  // Event routes
  app.get("/api/events", async (req, res) => {
    try {
      const events = await storage.getAllEvents();
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.get("/api/events/active", async (req, res) => {
    try {
      const events = await storage.getActiveEvents();
      res.json(events);
    } catch (error) {
      console.error("Error fetching active events:", error);
      res.status(500).json({ error: "Failed to fetch active events" });
    }
  });

  app.post("/api/events", async (req, res) => {
    try {
      const validatedData = insertEventSchema.parse(req.body);
      // Generate check-in code if not provided
      if (!validatedData.checkInCode) {
        validatedData.checkInCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      }
      const event = await storage.createEvent(validatedData);
      res.json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid event data", details: error.errors });
      } else {
        console.error("Error creating event:", error);
        res.status(500).json({ error: "Failed to create event" });
      }
    }
  });

  app.put("/api/events/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertEventSchema.partial().parse(req.body);
      const event = await storage.updateEvent(id, validatedData);
      
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      
      res.json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid event data", details: error.errors });
      } else {
        console.error("Error updating event:", error);
        res.status(500).json({ error: "Failed to update event" });
      }
    }
  });

  app.delete("/api/events/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteEvent(id);
      
      if (!success) {
        return res.status(404).json({ error: "Event not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting event:", error);
      res.status(500).json({ error: "Failed to delete event" });
    }
  });

  // Attendance routes
  app.get("/api/events/:eventId/attendance", async (req, res) => {
    try {
      const { eventId } = req.params;
      const eventWithAttendance = await storage.getEventAttendance(eventId);
      res.json(eventWithAttendance);
    } catch (error) {
      console.error("Error fetching event attendance:", error);
      res.status(500).json({ error: "Failed to fetch event attendance" });
    }
  });

  app.post("/api/attendance", async (req, res) => {
    try {
      const validatedData = insertAttendanceSchema.parse(req.body);
      const attendanceRecord = await storage.markAttendance(validatedData);
      res.json(attendanceRecord);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid attendance data", details: error.errors });
      } else {
        console.error("Error marking attendance:", error);
        res.status(500).json({ error: "Failed to mark attendance" });
      }
    }
  });

  app.delete("/api/attendance/:eventId/:pnmId", async (req, res) => {
    try {
      const { eventId, pnmId } = req.params;
      const success = await storage.removeAttendance(eventId, pnmId);
      
      if (!success) {
        return res.status(404).json({ error: "Attendance record not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing attendance:", error);
      res.status(500).json({ error: "Failed to remove attendance" });
    }
  });

  app.get("/api/pnms/attendance", async (req, res) => {
    try {
      const pnmsWithAttendance = await storage.getAllPNMsWithAttendance();
      res.json(pnmsWithAttendance);
    } catch (error) {
      console.error("Error fetching PNMs with attendance:", error);
      res.status(500).json({ error: "Failed to fetch PNMs with attendance" });
    }
  });

  app.get("/api/pnms/:pnmId/attendance", async (req, res) => {
    try {
      const { pnmId } = req.params;
      const pnmWithAttendance = await storage.getPNMAttendance(pnmId);
      res.json(pnmWithAttendance);
    } catch (error) {
      console.error("Error fetching PNM attendance:", error);
      res.status(500).json({ error: "Failed to fetch PNM attendance" });
    }
  });

  // Check-in by code endpoint
  app.post("/api/events/checkin/:checkInCode", async (req, res) => {
    try {
      const { checkInCode } = req.params;
      const { pnmId, checkedInBy, notes } = req.body;

      // Find event by check-in code
      const events = await storage.getAllEvents();
      const event = events.find(e => e.checkInCode === checkInCode.toUpperCase() && e.isActive);

      if (!event) {
        return res.status(404).json({ error: "Invalid or expired check-in code" });
      }

      const attendanceRecord = await storage.markAttendance({
        eventId: event.id,
        pnmId,
        checkedInBy,
        notes,
      });

      res.json({ success: true, attendance: attendanceRecord, event });
    } catch (error) {
      console.error("Error checking in with code:", error);
      res.status(500).json({ error: "Failed to check in" });
    }
  });

  return httpServer;
}
