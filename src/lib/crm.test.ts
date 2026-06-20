import { describe, it, expect, vi, beforeEach } from 'vitest';
import { upsertLead } from './crm';
import { prisma } from './db';

// Prisma mock
vi.mock('./db', () => ({
  prisma: {
    lead: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    leadEvent: {
      create: vi.fn(),
    },
  },
}));

describe('upsertLead optimization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call findFirst with OR condition when both email and phone are provided', async () => {
    const input = {
      userId: 'user123',
      email: 'test@example.com',
      phone: '123456789',
      name: 'Test Lead',
    };

    (prisma.lead.findFirst as any).mockResolvedValue(null);
    (prisma.lead.create as any).mockResolvedValue({ id: 'lead123', name: 'Test Lead', email: 'test@example.com' });

    await upsertLead(input);

    expect(prisma.lead.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user123',
        OR: [
          { email: 'test@example.com' },
          { phone: '123456789' }
        ],
      },
    });
  });

  it('should call findFirst with only email when phone is missing', async () => {
    const input = {
      userId: 'user123',
      email: 'test@example.com',
      name: 'Test Lead',
    };

    (prisma.lead.findFirst as any).mockResolvedValue(null);
    (prisma.lead.create as any).mockResolvedValue({ id: 'lead123', name: 'Test Lead', email: 'test@example.com' });

    await upsertLead(input);

    expect(prisma.lead.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user123',
        OR: [
          { email: 'test@example.com' }
        ],
      },
    });
  });

  it('should update existing lead if found', async () => {
    const input = {
      userId: 'user123',
      email: 'test@example.com',
      name: 'Updated Name',
    };

    const existingLead = {
      id: 'lead123',
      userId: 'user123',
      email: 'test@example.com',
      phone: null,
      name: 'Old Name',
      dataJson: '{}',
    };

    (prisma.lead.findFirst as any).mockResolvedValue(existingLead);
    (prisma.lead.update as any).mockResolvedValue({ ...existingLead, name: 'Updated Name' });

    await upsertLead(input);

    expect(prisma.lead.update).toHaveBeenCalled();
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it('should call findFirst with email only if phone is null/empty string', async () => {
    const input = {
      userId: 'user123',
      email: 'test@example.com',
      phone: '',
      name: 'Test Lead',
    };

    (prisma.lead.findFirst as any).mockResolvedValue(null);
    (prisma.lead.create as any).mockResolvedValue({ id: 'lead123', name: 'Test Lead', email: 'test@example.com' });

    await upsertLead(input);

    expect(prisma.lead.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user123',
        OR: [
          { email: 'test@example.com' }
        ],
      },
    });
  });
});
