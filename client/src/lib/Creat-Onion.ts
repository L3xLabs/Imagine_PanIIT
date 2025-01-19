import { Buffer } from "buffer";

export default class OnionClient {
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
