import axios from "axios";

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

class OnionClient {
  private nodeKeys: Map<string, Buffer>;

  constructor() {
    this.nodeKeys = new Map();
  }

  addNodeKey(nodeId: string, key: Buffer): void {
    this.nodeKeys.set(nodeId, key);
  }

  createOnion(message: string, route: string[]): Buffer {
    let currentData = Buffer.from(message);

    // Build the onion from the inside out
    for (let i = route.length - 1; i >= 0; i--) {
      const nodeId = route[i];
      const key = this.nodeKeys.get(nodeId);

      if (!key) {
        throw new Error(`Missing key for node ${nodeId}`);
      }

      // Add routing information and encrypt
      const routingInfo = Buffer.from(
        i === route.length - 1 ? "FINAL:" : `${route[i + 1]}:`,
      );

      currentData = Buffer.concat([routingInfo, currentData]);
      // In real implementation, use proper encryption
      currentData = Buffer.concat([key, currentData]);
    }

    return currentData;
  }
}
async function main() {
  // Create client
  const client = new OnionClient();

  // Define nodes
  const nodes = [
    ["node1", "http://localhost:3001"],
    ["node2", "http://localhost:3002"],
    ["node3", "http://localhost:3003"],
  ];

  // Configure route
  for (let i = 0; i < nodes.length; i++) {
    const [nodeId, url] = nodes[i];

    // Get node's key
    const response = await axios.get(`${url}/public-key`);
    const key = Buffer.from(response.data.key, "base64");
    client.addNodeKey(nodeId, key);

    // Configure next hop
    if (i < nodes.length - 1) {
      const nextUrl = nodes[i + 1][1];
      await axios.post(`${url}/config`, { nextNodeUrl: nextUrl });
    }
  }

  // Create and send message
  const message = "Hello, world!";
  const route = ["node1", "node2", "node3"];
  const onion = client.createOnion(message, route);
  console.log(onion.toString("base64"));

  // Send to first node
  const response = await axios.post("http://localhost:3001/forward", {
    data: onion.toString("base64"),
  });

  console.log(response.data);
}

main().catch(console.error);
