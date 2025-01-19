import express, { Express, Request, Response } from "express";
import axios from "axios";
import { Crypto } from "@peculiar/webcrypto";
import { Buffer } from "buffer";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";

// Initialize crypto for Node.js environment
const crypto = new Crypto();

// Types
interface IMessage {
  data: string; // Base64 encoded encrypted data
}

interface INodeConfig {
  nextNodeUrl?: string;
}

interface IPublicKeyResponse {
  nodeId: string;
  key: string;
}

class Node {
  id: string;
  key: Buffer;
  nextNodeUrl?: string;
  fernet: any; // Type would depend on crypto implementation

  constructor(nodeId: string, nextNodeUrl?: string) {
    this.id = nodeId;
    // Convert Uint8Array to Buffer for the key
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    this.key = Buffer.from(randomBytes);
    this.nextNodeUrl = nextNodeUrl;
    // Initialize encryption - in real implementation, use proper crypto
    this.fernet = {
      encrypt: (data: Buffer): Buffer => {
        // Simplified encryption
        return Buffer.concat([this.key, data]);
      },
      decrypt: (data: Buffer): Buffer => {
        // Simplified decryption
        return data.slice(32);
      },
    };
  }
}

// initialize express app
const app: Express = express();
app.use(express.json());
dotenv.config();

const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

const clients = new Set<WebSocket>();

wss.on("connection", (ws: WebSocket) => {
  console.log("New client connected");
  clients.add(ws);

  ws.on("close", () => {
    console.log("Client disconnected");
    clients.delete(ws);
  });
});

export function broadcastMessage(message: string) {
  console.log("Broadcasting message:", message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
  }),
);
// Initialize node
const NODE_ID = process.env.NODE_ID || "node1";
const node = new Node(NODE_ID);

// Routes
app.get("/", (_req: Request, res: Response) => {
  res.json({
    nodeId: node.id,
    nextNode: node.nextNodeUrl,
  });
});

app.post("/config", (req: Request<{}, {}, INodeConfig>, res: Response) => {
  const { nextNodeUrl } = req.body;
  console.log(nextNodeUrl);
  node.nextNodeUrl = nextNodeUrl;
  res.json({
    status: "configured",
    nextNode: node.nextNodeUrl,
  });
});

app.get("/public-key", (_req: Request, res: Response<IPublicKeyResponse>) => {
  res.json({
    nodeId: node.id,
    key: node.key.toString("base64"),
  });
});

// Fix the forward endpoint type definition
app.post(
  "/forward",
  async (req: Request<{}, any, IMessage>, res: Response): Promise<void> => {
    try {
      console.log(`[Node ${node.id}] Received onion packet`);

      // Decode the base64 message
      const encryptedData = Buffer.from(req.body.data, "base64");
      console.log("Received Base64 onion:", req.body.data);
      console.log("Decoded onion buffer:", encryptedData);

      // Decrypt this layer
      const decryptedData = node.fernet.decrypt(encryptedData);

      // Split routing info and remaining data
      const colonIndex = decryptedData.indexOf(":");
      const routingInfo = decryptedData.slice(0, colonIndex);
      const remainingData = decryptedData.slice(colonIndex + 1);
      const nextHop = routingInfo.toString();

      console.log(`[Node ${node.id}] Routing Info: ${nextHop}`);
      console.log(`[Node ${node.id}] Remaining Data: ${remainingData}`);

      if (nextHop === "FINAL") {
        // We're the final node - return the decrypted message
        console.log(`[Node ${node.id}] Final destination reached`);
        res.json({
          status: "delivered",
          message: remainingData.toString(),
        });
        broadcastMessage(remainingData.toString());
        return;
      }

      if (!node.nextNodeUrl) {
        throw new Error(`[Node ${node.id}] No next node configured`);
      }

      // Forward to next node
      const forwardData = remainingData.toString("base64");
      console.log(`[Node ${node.id}] Forwarding to ${node.nextNodeUrl}`);
      const response = await axios.post(`${node.nextNodeUrl}/forward`, {
        data: forwardData,
      });

      res.json(response.data);
    } catch (error) {
      console.error(`[Node ${node.id}] Error:`, error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`WebSocket server is running on ws://localhost:${PORT}`);
});
