import React, { useEffect, useState } from "react";
import { Buffer } from "buffer";
import OnionClient from "../lib/Creat-Onion.js";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  ArrowBigUp,
  ArrowBigDown,
  MessageSquare,
  Share2,
  MoreHorizontal,
  Send,
  Shield,
} from "lucide-react";

interface ChatMessage {
  sender: string;
  content: string;
  timestamp: number;
}

interface Post {
  id: number;
  content: string;
  author: {
    id: string;
    name: string;
    avatar: string;
  };
  isAnonymous: boolean;
  timestamp: Date;
  votes: number;
  comments: any[];
  userVote: string | null;
}

const defaultPost: Post = {
  id: 1,
  content: "Welcome to the platform!",
  author: {
    id: "1",
    name: "System",
    avatar: "S",
  },
  isAnonymous: false,
  timestamp: new Date(),
  votes: 0,
  comments: [],
  userVote: null,
};

const SocialChatPlatform: React.FC = () => {
  // Chat states
  const [message, setMessage] = useState("");
  const [nodes, setNodes] = useState<string[][]>([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [username] = useState(`User-${Math.floor(Math.random() * 1000)}`);

  // Social posts states
  const [posts, setPosts] = useState<Post[]>([defaultPost]);
  const [newPost, setNewPost] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
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
        const response = await axios.get(`${url}/public-key`);
        const key = Buffer.from(response.data.key, "base64");
        client.addNodeKey(nodeId, key);

        if (i < nodes.length - 1) {
          const nextUrl = nodes[i + 1][1];
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

  const handleCreatePost = () => {
    if (!newPost.trim()) return;

    const post: Post = {
      id: Date.now(),
      content: newPost,
      author: {
        id: username,
        name: username,
        avatar: username.slice(0, 2).toUpperCase(),
      },
      isAnonymous: isAnonymous,
      timestamp: new Date(),
      votes: 0,
      comments: [],
      userVote: null,
    };

    setPosts((prev) => [post, ...prev]);
    setNewPost("");
    setIsAnonymous(false);
  };

  const handleVote = (postId: number, type: "up" | "down") => {
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id === postId) {
          return {
            ...post,
            votes: post.votes + (type === "up" ? 1 : -1),
            userVote: type,
          };
        }
        return post;
      })
    );
  };

  if (error) return <div>Error: {error}</div>;

  return (
    <div className="container mx-auto p-4 min-h-screen bg-gray-50">
      <Card className="max-w-4xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-gray-800">
            Social Chat Platform
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="chat" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="chat" className="text-lg">
                💬 Chat
              </TabsTrigger>
              <TabsTrigger value="social" className="text-lg">
                🌍 Social Feed
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat">
              <Card className="border-0 shadow-none">
                <CardContent className="p-6 space-y-4">
                  <ScrollArea className="h-[500px] px-4 rounded-lg border bg-white">
                    {messages.map((msg, index) => (
                      <div
                        key={index}
                        className={`mb-4 ${
                          msg.sender === username ? "text-right" : "text-left"
                        }`}
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="text-xs">
                              {msg.sender.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-gray-600">
                            {msg.sender}
                          </span>
                        </div>
                        <div
                          className={`inline-block max-w-[70%] p-4 rounded-2xl ${
                            msg.sender === username
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          <div className="break-words">{msg.content}</div>
                          <div className="text-xs opacity-75 mt-1">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>

                  <div className="flex space-x-2 items-center">
                    <Input
                      className="flex-1"
                      placeholder="Type your message..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") handleSendMessage();
                      }}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={loading || !message.trim()}
                      className="px-6"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="social">
              <div className="space-y-6">
                <Card className="border shadow-sm">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-blue-100 text-blue-600">
                            {username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-gray-800">
                            {isAnonymous ? "Anonymous" : username}
                          </p>
                          <p className="text-sm text-gray-500">
                            {isAnonymous ? (
                              <span className="flex items-center">
                                <Shield className="w-3 h-3 mr-1" />
                                Anonymous Mode
                              </span>
                            ) : (
                              "Public Post"
                            )}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant={isAnonymous ? "default" : "outline"}
                        size="sm"
                        onClick={() => setIsAnonymous(!isAnonymous)}
                        className="transition-all"
                      >
                        {isAnonymous ? "🔒 Anonymous" : "👤 Public"}
                      </Button>
                    </div>

                    <Textarea
                      value={newPost}
                      onChange={(e) => setNewPost(e.target.value)}
                      placeholder="Share your thoughts..."
                      className="min-h-[120px] resize-none"
                    />

                    <div className="flex justify-end">
                      <Button
                        onClick={handleCreatePost}
                        className="px-6"
                        disabled={!newPost.trim()}
                      >
                        Post
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  {posts.map((post) => (
                    <Card
                      key={post.id}
                      className="border shadow-sm hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <Avatar className="w-10 h-10">
                              <AvatarFallback
                                className={
                                  post.isAnonymous
                                    ? "bg-gray-100"
                                    : "bg-blue-100"
                                }
                              >
                                {post.isAnonymous ? "A" : post.author.avatar}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center space-x-2">
                                <p className="font-medium text-gray-800">
                                  {post.isAnonymous
                                    ? "Anonymous"
                                    : post.author.name}
                                </p>
                                {post.isAnonymous && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    Anonymous
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">
                                {new Date(post.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:bg-gray-100"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </div>

                        <p className="text-gray-800 mb-6 whitespace-pre-wrap">
                          {post.content}
                        </p>

                        <Separator className="mb-4" />

                        <div className="flex items-center space-x-6">
                          <div className="flex items-center space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleVote(post.id, "up")}
                              className={`hover:text-blue-600 ${
                                post.userVote === "up"
                                  ? "text-blue-600"
                                  : "text-gray-600"
                              }`}
                            >
                              <ArrowBigUp className="w-5 h-5" />
                            </Button>
                            <span className="font-medium mx-1">
                              {post.votes}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleVote(post.id, "down")}
                              className={`hover:text-red-600 ${
                                post.userVote === "down"
                                  ? "text-red-600"
                                  : "text-gray-600"
                              }`}
                            >
                              <ArrowBigDown className="w-5 h-5" />
                            </Button>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-600 hover:text-blue-600"
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            {post.comments.length} Comments
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-600 hover:text-blue-600"
                          >
                            <Share2 className="w-4 h-4 mr-2" />
                            Share
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default SocialChatPlatform;
