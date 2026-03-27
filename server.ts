import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // In-memory storage for user data (keyed by sessionId)
  const userDataStore = new Map<string, any>();

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "NeoFit AI Server is running" });
  });

  // Sync user data from the browser to the server
  app.post("/api/user/sync", (req, res) => {
    const { sessionId, profile, history } = req.body;
    if (!sessionId) return res.status(400).json({ error: "sessionId is required" });
    
    userDataStore.set(sessionId, { profile, history, lastSync: new Date().toISOString() });
    console.log(`Synced data for session: ${sessionId}`);
    res.json({ success: true });
  });

  // Retrieve user data (can be called by n8n agent)
  app.get("/api/user/:sessionId", (req, res) => {
    const { sessionId } = req.params;
    const data = userDataStore.get(sessionId);
    
    if (!data) return res.status(404).json({ error: "User data not found for this session" });
    res.json(data);
  });

  // This endpoint can be called by the n8n agent via the "AI Studio App Integration" tool
  app.post("/api/ai-studio/execute", (req, res) => {
    const { action, params, sessionId } = req.body;
    console.log("n8n agent called execute with:", { action, params, sessionId });
    
    const userData = sessionId ? userDataStore.get(sessionId) : null;

    // Handle specific actions
    if (action === "get_profile" && userData) {
      return res.json({ success: true, data: userData.profile });
    }
    if (action === "get_history" && userData) {
      return res.json({ success: true, data: userData.history });
    }
    
    res.json({
      success: true,
      message: `Action '${action}' received by NeoFit server`,
      data: {
        timestamp: new Date().toISOString(),
        receivedParams: params,
        hasUserData: !!userData
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
