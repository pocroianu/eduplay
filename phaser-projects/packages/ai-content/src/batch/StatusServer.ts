/**
 * WebSocket server for real-time batch status updates.
 *
 * Provides real-time progress updates to monitoring clients via WebSocket.
 *
 * @module batch/StatusServer
 */

import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { BatchState, BatchProgress, WebSocketMessage, WebSocketMessageType } from './types';

/**
 * Status server options
 */
export interface StatusServerOptions {
  /** Server port */
  port: number;
  /** Heartbeat interval (ms) */
  heartbeatInterval: number;
  /** Client timeout (ms) */
  clientTimeout: number;
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: StatusServerOptions = {
  port: 3001,
  heartbeatInterval: 30000, // 30 seconds
  clientTimeout: 60000 // 60 seconds
};

/**
 * Client connection info
 */
interface ClientInfo {
  ws: WebSocket;
  id: string;
  connectedAt: Date;
  lastPing: Date;
  isAlive: boolean;
}

/**
 * WebSocket server for real-time batch status updates.
 *
 * Features:
 * - Multiple concurrent clients
 * - Real-time progress broadcasts
 * - Heartbeat/ping-pong
 * - Connection management
 * - Message types: progress, state, batch-started, etc.
 */
export class StatusServer extends EventEmitter {
  private wss?: WebSocketServer;
  private clients: Map<string, ClientInfo> = new Map();
  private options: StatusServerOptions;
  private heartbeatTimer?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(options: Partial<StatusServerOptions> = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Start the status server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Status server already running');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ port: this.options.port });

        this.wss.on('listening', () => {
          this.isRunning = true;
          console.log(`Status server listening on port ${this.options.port}`);
          this.startHeartbeat();
          resolve();
        });

        this.wss.on('connection', (ws) => {
          this.handleConnection(ws);
        });

        this.wss.on('error', (error) => {
          console.error('WebSocket server error:', error);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.stopHeartbeat();

    // Close all client connections
    for (const [clientId, client] of this.clients.entries()) {
      client.ws.close();
    }
    this.clients.clear();

    // Close server
    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss!.close(() => {
          this.isRunning = false;
          console.log('Status server stopped');
          resolve();
        });
      });
    }
  }

  /**
   * Broadcast batch progress to all clients
   */
  broadcastProgress(batchId: string, progress: BatchProgress): void {
    this.broadcast({
      type: 'progress',
      payload: { batchId, progress },
      timestamp: new Date()
    });
  }

  /**
   * Broadcast batch state to all clients
   */
  broadcastState(state: BatchState): void {
    this.broadcast({
      type: 'state',
      payload: { state },
      timestamp: new Date()
    });
  }

  /**
   * Broadcast batch started event
   */
  broadcastBatchStarted(batchId: string, name: string): void {
    this.broadcast({
      type: 'batch-started',
      payload: { batchId, name },
      timestamp: new Date()
    });
  }

  /**
   * Broadcast batch completed event
   */
  broadcastBatchCompleted(batchId: string, metrics: any): void {
    this.broadcast({
      type: 'batch-completed',
      payload: { batchId, metrics },
      timestamp: new Date()
    });
  }

  /**
   * Broadcast job completed event
   */
  broadcastJobCompleted(batchId: string, jobId: string, gameId: string): void {
    this.broadcast({
      type: 'job-completed',
      payload: { batchId, jobId, gameId },
      timestamp: new Date()
    });
  }

  /**
   * Broadcast job failed event
   */
  broadcastJobFailed(batchId: string, jobId: string, error: string): void {
    this.broadcast({
      type: 'job-failed',
      payload: { batchId, jobId, error },
      timestamp: new Date()
    });
  }

  /**
   * Broadcast error message
   */
  broadcastError(error: string): void {
    this.broadcast({
      type: 'error',
      payload: { error },
      timestamp: new Date()
    });
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get server status
   */
  getStatus(): {
    running: boolean;
    port: number;
    clients: number;
  } {
    return {
      running: this.isRunning,
      port: this.options.port,
      clients: this.clients.size
    };
  }

  // Private methods

  private handleConnection(ws: WebSocket): void {
    const clientId = this.generateClientId();

    const clientInfo: ClientInfo = {
      ws,
      id: clientId,
      connectedAt: new Date(),
      lastPing: new Date(),
      isAlive: true
    };

    this.clients.set(clientId, clientInfo);

    console.log(`Client connected: ${clientId} (total: ${this.clients.size})`);

    // Setup event handlers
    ws.on('message', (message) => {
      this.handleMessage(clientInfo, message.toString());
    });

    ws.on('pong', () => {
      clientInfo.isAlive = true;
      clientInfo.lastPing = new Date();
    });

    ws.on('close', () => {
      this.clients.delete(clientId);
      console.log(`Client disconnected: ${clientId} (total: ${this.clients.size})`);
    });

    ws.on('error', (error) => {
      console.error(`Client error (${clientId}):`, error);
    });

    // Send welcome message
    this.sendToClient(clientInfo, {
      type: 'connected',
      payload: {
        clientId,
        serverTime: new Date()
      },
      timestamp: new Date()
    });
  }

  private handleMessage(client: ClientInfo, message: string): void {
    try {
      const data = JSON.parse(message);

      if (data.type === 'ping') {
        this.sendToClient(client, {
          type: 'pong',
          payload: {},
          timestamp: new Date()
        });
      }

    } catch (error) {
      console.error('Invalid message:', error);
    }
  }

  private broadcast(message: WebSocketMessage): void {
    const payload = JSON.stringify(message);

    for (const [clientId, client] of this.clients.entries()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(payload);
        } catch (error) {
          console.error(`Failed to send to client ${clientId}:`, error);
        }
      }
    }
  }

  private sendToClient(client: ClientInfo, message: WebSocketMessage): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Failed to send to client ${client.id}:`, error);
      }
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.performHeartbeat();
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private performHeartbeat(): void {
    const now = Date.now();

    for (const [clientId, client] of this.clients.entries()) {
      // Check for timeout
      const elapsed = now - client.lastPing.getTime();
      if (elapsed > this.options.clientTimeout) {
        console.log(`Client timeout: ${clientId}`);
        client.ws.terminate();
        this.clients.delete(clientId);
        continue;
      }

      // Send ping
      if (client.ws.readyState === WebSocket.OPEN) {
        client.isAlive = false;
        client.ws.ping();
      }
    }
  }

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
