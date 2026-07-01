import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAutomation, resumeAutomation } from './index';
import { prisma } from '../db';

vi.mock('../db', () => ({
  prisma: {
    automation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    execution: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'exec1' }),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../anthropic', () => ({
  resolveApiKey: vi.fn().mockReturnValue('mock-key'),
}));

vi.mock('../tiers', () => ({
  getTier: vi.fn().mockReturnValue({ maxExecutionsPerMonth: null }),
  startOfMonth: vi.fn().mockReturnValue(new Date()),
}));

vi.mock('../integrations', () => ({
  loadUserIntegrations: vi.fn().mockResolvedValue({}),
}));

vi.mock('../capture-form-crm', () => ({
  captureFormToCrm: vi.fn().mockResolvedValue(undefined),
}));

describe('Loop Engine Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute a simple loop with log actions', async () => {
    const automation = {
      id: 'auto1',
      userId: 'user1',
      active: true,
      triggerJson: JSON.stringify({ type: 'webhook' }),
      actionsJson: JSON.stringify([
        {
          type: 'loop',
          params: {
            items: 'A, B, C',
            actions: [
              { type: 'log', params: { message: 'Item: {loop_item} na posicao {loop_index}' } }
            ]
          }
        }
      ]),
      user: { id: 'user1', tier: 'free' }
    };

    (prisma.automation.findUnique as any).mockResolvedValue(automation);

    const result = await runAutomation('auto1', {});

    expect(result.status).toBe('success');
    expect(result.steps).toHaveLength(4); // 1 loop start + 3 logs
    expect(result.steps[0].action).toBe('loop');
    expect(result.steps[1].detail).toContain('Item: A na posicao 0');
    expect(result.steps[2].detail).toContain('Item: B na posicao 1');
    expect(result.steps[3].detail).toContain('Item: C na posicao 2');
  });

  it('should handle nested loops and context isolation', async () => {
     const automation = {
      id: 'auto1',
      userId: 'user1',
      active: true,
      triggerJson: JSON.stringify({ type: 'webhook' }),
      actionsJson: JSON.stringify([
        {
          type: 'loop',
          params: {
            items: '1, 2',
            actions: [
              {
                type: 'loop',
                params: {
                  items: 'X, Y',
                  actions: [
                    { type: 'log', params: { message: '{loop_item}:{loop_index}' } }
                  ]
                }
              },
              { type: 'log', params: { message: 'Outer: {loop_item}' } }
            ]
          }
        }
      ]),
      user: { id: 'user1', tier: 'free' }
    };

    (prisma.automation.findUnique as any).mockResolvedValue(automation);

    const result = await runAutomation('auto1', {});

    expect(result.status).toBe('success');
    // Outer loop start (1)
    //   Iteration 0:
    //     Inner loop start (2)
    //       Inner Iteration 0: log X:0 (3)
    //       Inner Iteration 1: log Y:1 (4)
    //     Outer log 1 (5)
    //   Iteration 1:
    //     Inner loop start (6)
    //       Inner Iteration 0: log X:0 (7)
    //       Inner Iteration 1: log Y:1 (8)
    //     Outer log 2 (9)

    expect(result.steps).toHaveLength(9);
    expect(result.steps[2].detail).toBe('X:0');
    expect(result.steps[4].detail).toBe('Outer: 1');
    expect(result.steps[6].detail).toBe('X:0');
    expect(result.steps[8].detail).toBe('Outer: 2');
  });

  it('should support resumption within a loop', async () => {
    const automation = {
      id: 'auto1',
      userId: 'user1',
      active: true,
      triggerJson: JSON.stringify({ type: 'webhook' }),
      actionsJson: JSON.stringify([
        {
          type: 'loop',
          params: {
            items: 'item1, item2',
            actions: [
              { type: 'wait_for_approval', params: { to: 'test@test.com' } },
              { type: 'log', params: { message: 'Done {loop_item}' } }
            ]
          }
        }
      ]),
      user: { id: 'user1', tier: 'free' }
    };

    (prisma.automation.findUnique as any).mockResolvedValue(automation);

    // Initial run
    const result1 = await runAutomation('auto1', {});
    expect(result1.status).toBe('waiting');
    expect(result1.steps).toHaveLength(2); // Loop start + paused wait_for_approval
    const pausedPath = (prisma.execution.update as any).mock.calls[0][0].data.pausedPath;
    const resumeToken = (prisma.execution.update as any).mock.calls[0][0].data.resumeToken;
    expect(pausedPath).toBe('0.0.0'); // Index 0 (loop), Iteration 0, Index 0 (wait)

    // Resume
    (prisma.execution.findUnique as any).mockResolvedValue({
      id: 'exec1',
      status: 'waiting',
      resumeToken,
      pausedPath,
      inputJson: '{}',
      logJson: JSON.stringify(result1.steps),
      automation
    });

    const result2 = await resumeAutomation('exec1', resumeToken);
    expect(result2.status).toBe('waiting'); // Should pause again at the second iteration
    // Previous steps (2) + resumed step (success) + next log (1) + next loop iteration wait (1) = 5?
    // Actually:
    // Step 0: Loop start (success)
    // Step 1: wait (success after resume)
    // Step 2: log Done item1 (success)
    // Step 3: wait item2 (paused)
    expect(result2.steps).toHaveLength(4);
    expect(result2.steps[2].detail).toBe('Done item1');
    expect(result2.steps[3].status).toBe('paused');

    const secondPausedPath = (prisma.execution.update as any).mock.calls[1][0].data.pausedPath;
    expect(secondPausedPath).toBe('0.1.0');
  });
});
