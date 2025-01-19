import React, { useEffect, useState } from "react";
import { Buffer } from "buffer";
import OnionClient from "../lib/Creat-Onion.js";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  ArrowBigUp,
  ArrowBigDown,
  MessageSquare,
  Share2,
  MoreHorizontal,
  Shield,
} from "lucide-react";

interface Post {
  id: number;
  content: string;
  author: {
    id: string;
    name: string;
    avatar: string;
  } | null;
  isAnonymous: boolean;
  timestamp: Date;
  votes: number;
  comments: any[];
  userVote: string | null;
}

const SocialPlatform: React.FC = () => {
  const [username] = useState(`User-${Math.floor(Math.random() * 1000)}`);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [nodes, setNodes] = useState<string[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [sentPostIds] = useState(new Set<number>());
  const [processedMessageIds] = useState(new Set<number>());

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:3003");

    socket.onopen = () => {
      console.log("Connected to WebSocket server");
      setWs(socket);
    };

    socket.onmessage = (event) => {
      try {
        const receivedPost = JSON.parse(event.data);
        // Only add the post if we haven't sent it ourselves
        if (!processedMessageIds.has(receivedPost.id)) {
          processedMessageIds.add(receivedPost.id);
          setPosts((prev) => {
            // Check if the post already exists in our posts array
            const existingPost = prev.find((p) => p.id === receivedPost.id);
            if (existingPost) {
              return prev; // Skip if we already have this post
            }
            return [receivedPost, ...prev];
          });
        }
      } catch (err) {
        console.error("Error parsing post:", err);
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
        console.error(err);
        setError("Failed to fetch nodes");
      }
    };
    fetchNodes();
  }, [processedMessageIds]);

  const handleCreatePost = async () => {
    if (!newPost.trim()) return;

    const postId = Date.now();
    const post: Post = {
      id: postId,
      content: newPost,
      author: isAnonymous
        ? null
        : {
            id: username,
            name: username,
            avatar: username.slice(0, 2).toUpperCase(),
          },
      isAnonymous,
      timestamp: new Date(),
      votes: 0,
      comments: [],
      userVote: null,
    };

    try {
      setLoading(true);

      const client = new OnionClient();

      // Configure onion routing
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

      const route = nodes.map((node) => node[0]);
      const onion = client.createOnion(JSON.stringify(post), route);

      const firstNodeUrl = nodes[0][1];
      await axios.post(`${firstNodeUrl}/forward`, {
        data: onion.toString("base64"),
      });

      setNewPost("");
      setIsAnonymous(false);
    } catch (err) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      sentPostIds.delete(postId);
      console.error("Error in handleCreatePost:", err);
      setError("Failed to create post");
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (postId: number, type: "up" | "down") => {
    const voteData = {
      postId,
      voteType: type,
      userId: username,
    };

    try {
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

      const route = nodes.map((node) => node[0]);
      const onion = client.createOnion(JSON.stringify(voteData), route);

      const firstNodeUrl = nodes[0][1];
      await axios.post(`${firstNodeUrl}/forward`, {
        data: onion.toString("base64"),
      });

      // Optimistically update UI
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
        }),
      );
    } catch (err) {
      console.error("Error in handleVote:", err);
      setError("Failed to register vote");
    }
  };

  if (error) return <div>Error: {error}</div>;

  return (
    <div className="container mx-auto p-4 min-h-screen bg-gray-50">
      <Card className="max-w-4xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-gray-800">
            Social Platform
          </CardTitle>
        </CardHeader>
        <CardContent>
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
                    disabled={loading || !newPost.trim()}
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "Post"
                    )}
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
                              post.isAnonymous ? "bg-gray-100" : "bg-blue-100"
                            }
                          >
                            {post.isAnonymous ? "A" : post.author?.avatar}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="font-medium text-gray-800">
                              {post.isAnonymous
                                ? "Anonymous"
                                : post.author?.name}
                            </p>
                            {post.isAnonymous && (
                              <Badge variant="secondary" className="text-xs">
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
                        <span className="font-medium mx-1">{post.votes}</span>
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
        </CardContent>
      </Card>
    </div>
  );
};

export default SocialPlatform;
