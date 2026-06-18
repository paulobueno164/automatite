import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './auth';

describe('auth module - password functions', () => {
  describe('hashPassword', () => {
    it('should hash a password successfully', async () => {
      const password = 'mySuperSecretPassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(typeof hash).toBe('string');
      // bcrypt hashes are typically 60 characters and start with $2a$, $2b$, or $2y$
      expect(hash.length).toBe(60);
      expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it('should produce different hashes for the same password due to salting', async () => {
      const password = 'password123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);

      // both should still be valid for the same password
      expect(await verifyPassword(password, hash1)).toBe(true);
      expect(await verifyPassword(password, hash2)).toBe(true);
    });

    it('should handle empty strings', async () => {
      const hash = await hashPassword('');
      expect(hash).toBeDefined();
      expect(hash.length).toBe(60);
      expect(await verifyPassword('', hash)).toBe(true);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for a correct password', async () => {
      const password = 'myPassword123';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should return false for an incorrect password', async () => {
      const password = 'myPassword123';
      const wrongPassword = 'wrongPassword123';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it('should return false for an invalid hash', async () => {
      // bcrypt.compare usually throws an error if the hash is not a valid bcrypt hash,
      // but if it just fails gracefully, it returns false. Let's test with a valid-looking but wrong hash.
      const password = 'test';
      const fakeHash = '$2a$10$12345678901234567890123456789012345678901234567890123';

      const isValid = await verifyPassword(password, fakeHash);
      expect(isValid).toBe(false);
    });
  });
});
