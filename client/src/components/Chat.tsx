import { useEffect, useState } from "react";
import { Buffer } from "buffer";
import OnionClient from "../lib/Creat-Onion.js";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatMessage {
  sender: string;
  content: string;
  timestamp: number;
}

export const Chat: React.FC = () => {
  const [message, setMessage] = useState("");
  const [nodes, setNodes] = useState<string[][]>([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [username] = useState(`User-${Math.floor(Math.random() * 1000)}`);
  // const [wasmModule, setWasmModule] = useState<unknown | null>(null);

  useEffect(() => {
    // const loadWasm = async () => {
    //   try {
    //     // Dynamically import the generated JS glue code
    //     const wasm = await import("../wasm/web_assembly_client.js");
    //     await wasm.default(); // Initialize the WASM module
    //
    //     // Set the WASM exports
    //     setWasmModule(wasm);
    //     setLoading(false);
    //   } catch (err) {
    //     console.error("Error loading WASM:", err);
    //     setError("Failed to load WASM module");
    //     setLoading(false);
    //   }
    // };

    const socket = new WebSocket("ws://localhost:3003");

    socket.onopen = () => {
      console.log("Connected to WebSocket server");
      setWs(socket);
    };

    socket.onmessage = (event) => {
      try {
        const receivedMessage = JSON.parse(event.data);
        setMessages((prev) => [...prev, receivedMessage]);
      } catch (err) {
        console.error("Error parsing message:", err);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setError("WebSocket connection error");
    };

    socket.onclose = () => {
      console.log("Disconnected from WebSocket server");
      setWs(null);
    };

    const fetchNodes = async () => {
      try {
        const nodeList = [
          ["node1", "http://localhost:3001"],
          ["node2", "http://localhost:3002"],
          ["node3", "http://localhost:3003"],
        ];
        setNodes(nodeList);
        setLoading(false);
      } catch (err) {
        console.log(err);
        setError("Failed to fetch nodes");
      }
    };
    fetchNodes();
  }, []);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    try {
      setLoading(true);
      const client = new OnionClient();

      for (let i = 0; i < nodes.length; i++) {
        const [nodeId, url] = nodes[i];
        console.log(`Fetching public key for ${nodeId} from ${url}`);
        const response = await axios.get(`${url}/public-key`);
        const key = Buffer.from(response.data.key, "base64");
        client.addNodeKey(nodeId, key);

        if (i < nodes.length - 1) {
          const nextUrl = nodes[i + 1][1];
          console.log(`Configuring ${nodeId} to forward to ${nextUrl}`);
          await axios.post(`${url}/config`, { nextNodeUrl: nextUrl });
        }
      }

      const chatMessage = {
        sender: username,
        content: message,
        timestamp: Date.now(),
      };

      const route = nodes.map((node) => node[0]);
      const onion = client.createOnion(JSON.stringify(chatMessage), route);

      const firstNodeUrl = nodes[0][1];
      await axios.post(`${firstNodeUrl}/forward`, {
        data: onion.toString("base64"),
      });

      setMessage("");
    } catch (err) {
      console.error("Error in handleSendMessage:", err);
      setError("Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  if (error) return <div>Error: {error}</div>;

  return (
    <Card className="w-full max-w-2xl mx-auto mt-8">
      <CardContent className="p-6">
        <div className="space-y-4">
          <ScrollArea className="h-[400px] p-4 border rounded-lg">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`mb-4 ${
                  msg.sender === username ? "text-right" : "text-left"
                }`}
              >
                <div
                  className={`inline-block max-w-[70%] p-3 rounded-lg ${
                    msg.sender === username
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100"
                  }`}
                >
                  <div className="font-bold text-sm">{msg.sender}</div>
                  <div className="break-words">{msg.content}</div>
                  <div className="text-xs opacity-75">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </ScrollArea>

          <div className="flex space-x-2">
            <input
              className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleSendMessage();
                }
              }}
            />
            <button
              className={`px-4 py-2 rounded-lg bg-blue-500 text-white font-medium ${
                loading ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-600"
              }`}
              onClick={handleSendMessage}
              disabled={loading || !message.trim()}
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Send"
              )}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
