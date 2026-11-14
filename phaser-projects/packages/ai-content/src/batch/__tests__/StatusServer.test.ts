/**
 * Unit tests for StatusServer
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StatusServer } from '../StatusServer';
import WebSocket from 'ws';
import { BatchState, BatchStatus } from '../types';

describe('StatusServer', () => {
  let server: StatusServer;
  const TEST_PORT = 3002;

  beforeEach(async () => {
    server = new StatusServer({ port: TEST_PORT, heartbeatInterval: 1000 });
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('start and stop', () => {
    it('should start server successfully', async () => {
      await server.start();

      const status = server.getStatus();
      expect(status.running).toBe(true);
      expect(status.port).toBe(TEST_PORT);
    });

    it('should stop server successfully', async () => {
      await server.start();
      await server.stop();

      const status = server.getStatus();
      expect(status.running).toBe(false);
    });

    it('should not start if already running', async () => {
      await server.start();
      await server.start(); // Should not error

      const status = server.getStatus();
      expect(status.running).toBe(true);
    });
  });

  describe('client connections', () => {
    it('should accept client connections', async () => {
      await server.start();

      const client = new WebSocket(`ws://localhost:${TEST_PORT}`);

      await new Promise((resolve, reject) => {
        client.on('open', resolve);
        client.on('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      expect(server.getClientCount()).toBe(1);

      client.close();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(server.getClientCount()).toBe(0);
    });

    it('should send welcome message on connection', async () => {
      await server.start();

      const client = new WebSocket(`ws://localhost:${TEST_PORT}`);

      const message = await new Promise<any>((resolve, reject) => {
        client.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
        client.on('error', reject);
        setTimeout(() => reject(new Error('Message timeout')), 5000);
      });

      expect(message.type).toBe('connected');
      expect(message.payload).toBeDefined();
      expect(message.payload.clientId).toBeDefined();

      client.close();
    });

    it('should handle multiple concurrent clients', async () => {
      await server.start();

      const clients = [
        new WebSocket(`ws://localhost:${TEST_PORT}`),
        new WebSocket(`ws://localhost:${TEST_PORT}`),
        new WebSocket(`ws://localhost:${TEST_PORT}`)
      ];

      await Promise.all(
        clients.map(
          client =>
            new Promise((resolve, reject) => {
              client.on('open', resolve);
              client.on('error', reject);
              setTimeout(() => reject(new Error('Connection timeout')), 5000);
            })
        )
      );

      expect(server.getClientCount()).toBe(3);

      clients.forEach(client => client.close());
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(server.getClientCount()).toBe(0);
    });
  });

  describe('broadcasting', () => {
    it('should broadcast progress to all clients', async () => {
      await server.start();

      const client1 = new WebSocket(`ws://localhost:${TEST_PORT}`);
      const client2 = new WebSocket(`ws://localhost:${TEST_PORT}`);

      await Promise.all([
        new Promise((resolve, reject) => {
          client1.on('open', resolve);
          client1.on('error', reject);
        }),
        new Promise((resolve, reject) => {
          client2.on('open', resolve);
          client2.on('error', reject);
        })
      ]);

      // Skip welcome messages
      await Promise.all([
        new Promise(resolve => client1.once('message', resolve)),
        new Promise(resolve => client2.once('message', resolve))
      ]);

      const messages = await Promise.all([
        new Promise<any>(resolve => {
          client1.once('message', data => resolve(JSON.parse(data.toString())));
        }),
        new Promise<any>(resolve => {
          client2.once('message', data => resolve(JSON.parse(data.toString())));
        }),
        server.broadcastProgress('test-batch', {
          total: 10,
          completed: 5,
          failed: 0,
          pending: 5,
          running: 0,
          percentage: 50,
          estimatedTimeRemaining: 5000,
          averageJobDuration: 1000
        })
      ]);

      expect(messages[0].type).toBe('progress');
      expect(messages[0].payload.progress.completed).toBe(5);
      expect(messages[1].type).toBe('progress');
      expect(messages[1].payload.progress.completed).toBe(5);

      client1.close();
      client2.close();
    });

    it('should broadcast state updates', async () => {
      await server.start();

      const client = new WebSocket(`ws://localhost:${TEST_PORT}`);

      await new Promise((resolve, reject) => {
        client.on('open', resolve);
        client.on('error', reject);
      });

      // Skip welcome message
      await new Promise(resolve => client.once('message', resolve));

      const message = await new Promise<any>((resolve, reject) => {
        client.once('message', data => resolve(JSON.parse(data.toString())));

        server.broadcastState({
          batchId: 'test-batch',
          name: 'Test Batch',
          status: BatchStatus.RUNNING,
          jobs: [],
          progress: {} as any,
          metrics: {} as any,
          createdAt: new Date()
        });

        setTimeout(() => reject(new Error('Broadcast timeout')), 5000);
      });

      expect(message.type).toBe('state');
      expect(message.payload.state.batchId).toBe('test-batch');

      client.close();
    });

    it('should broadcast job completed events', async () => {
      await server.start();

      const client = new WebSocket(`ws://localhost:${TEST_PORT}`);

      await new Promise((resolve, reject) => {
        client.on('open', resolve);
        client.on('error', reject);
      });

      // Skip welcome message
      await new Promise(resolve => client.once('message', resolve));

      const message = await new Promise<any>((resolve) => {
        client.once('message', data => resolve(JSON.parse(data.toString())));
        server.broadcastJobCompleted('batch-1', 'job-1', 'game-1');
      });

      expect(message.type).toBe('job-completed');
      expect(message.payload.batchId).toBe('batch-1');
      expect(message.payload.jobId).toBe('job-1');
      expect(message.payload.gameId).toBe('game-1');

      client.close();
    });
  });

  describe('ping/pong', () => {
    it('should respond to ping messages', async () => {
      await server.start();

      const client = new WebSocket(`ws://localhost:${TEST_PORT}`);

      await new Promise((resolve, reject) => {
        client.on('open', resolve);
        client.on('error', reject);
      });

      // Skip welcome message
      await new Promise(resolve => client.once('message', resolve));

      const response = await new Promise<any>((resolve) => {
        client.once('message', data => resolve(JSON.parse(data.toString())));
        client.send(JSON.stringify({ type: 'ping' }));
      });

      expect(response.type).toBe('pong');

      client.close();
    });
  });
});
