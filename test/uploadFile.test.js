/**
 * Tests for uploadFile function
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock fetch globally
global.fetch = jest.fn();

// Create a simple test that validates the MCP tool integration
describe('uploadFile', () => {
  beforeEach(() => {
    // Set required environment variables
    process.env.BASEROW_API_URL = 'https://api.baserow.io';
    process.env.BASEROW_API_TOKEN = 'test_token_123';
    
    // Reset fetch mock
    fetch.mockClear();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.BASEROW_API_URL;
    delete process.env.BASEROW_API_TOKEN;
  });

  describe('Environment validation', () => {
    it('should throw error when environment variables are missing', async () => {
      delete process.env.BASEROW_API_URL;
      delete process.env.BASEROW_API_TOKEN;

      // Import after clearing env vars to test the validation
      const { uploadFile } = await import('../mcp_baserow_image.js');
      
      await expect(uploadFile('/path/to/test.jpg'))
        .rejects.toThrow('BASEROW_API_URL and BASEROW_API_TOKEN environment variables are required');
    });

    it('should throw error when file does not exist', async () => {
      const { uploadFile } = await import('../mcp_baserow_image.js');
      
      await expect(uploadFile('/nonexistent/path/file.jpg'))
        .rejects.toThrow('File upload failed: File not found: /nonexistent/path/file.jpg');
    });
  });

  describe('Function export', () => {
    it('should export uploadFile function', async () => {
      const { uploadFile } = await import('../mcp_baserow_image.js');
      expect(typeof uploadFile).toBe('function');
    });
  });
});
