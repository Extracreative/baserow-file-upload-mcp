/**
 * Tests for readBaserowStructure function
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { readBaserowStructure } from '../mcp_baserow_image.js';

// Mock fetch globally
global.fetch = jest.fn();

describe('readBaserowStructure', () => {
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

  describe('Structure reading only', () => {
    it('should successfully read Baserow structure without rows', async () => {
      // Mock workspaces response
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [
              { id: 1, name: 'Test Workspace' }
            ]
          })
        })
        // Mock applications response
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: 101, name: 'Test App', type: 'database' }
          ]
        })
        // Mock tables response
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: 201, name: 'Test Table', order: 0 }
          ]
        })
        // Mock fields response
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: 301, name: 'Name', type: 'text', primary: true, order: 0 },
            { id: 302, name: 'Image', type: 'file', primary: false, order: 1, multiple_files: false }
          ]
        });

      const result = await readBaserowStructure(false, 0);

      expect(result.success).toBe(true);
      expect(result.structure.summary.totalWorkspaces).toBe(1);
      expect(result.structure.summary.totalTables).toBe(1);
      expect(result.structure.summary.totalFields).toBe(2);
      
      const workspace = result.structure.workspaces[0];
      expect(workspace.name).toBe('Test Workspace');
      expect(workspace.applications[0].tables[0].fields).toHaveLength(2);
      expect(workspace.applications[0].tables[0].fields[1].type).toBe('file');
    });

    it('should handle file field types correctly', async () => {
      // Mock responses with file field
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [{ id: 1, name: 'Workspace' }] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 101, name: 'App', type: 'database' }]
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 201, name: 'Table', order: 0 }]
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { 
              id: 301, 
              name: 'Gallery', 
              type: 'file', 
              primary: false, 
              order: 0,
              multiple_files: true,
              file_types: ['image/*']
            }
          ]
        });

      const result = await readBaserowStructure(false, 0);
      
      const fileField = result.structure.workspaces[0].applications[0].tables[0].fields[0];
      expect(fileField.type).toBe('file');
      expect(fileField.multipleFiles).toBe(true);
      expect(fileField.fileTypes).toEqual(['image/*']);
    });

    it('should handle select field types correctly', async () => {
      // Mock responses with select fields
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [{ id: 1, name: 'Workspace' }] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 101, name: 'App', type: 'database' }]
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 201, name: 'Table', order: 0 }]
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { 
              id: 301, 
              name: 'Category', 
              type: 'single_select', 
              primary: false, 
              order: 0,
              select_options: [
                { id: 1, value: 'Electronics', color: 'blue' },
                { id: 2, value: 'Books', color: 'green' }
              ]
            }
          ]
        });

      const result = await readBaserowStructure(false, 0);
      
      const selectField = result.structure.workspaces[0].applications[0].tables[0].fields[0];
      expect(selectField.type).toBe('single_select');
      expect(selectField.selectOptions).toHaveLength(2);
      expect(selectField.selectOptions[0].value).toBe('Electronics');
    });
  });

  describe('Structure reading with rows', () => {
    it('should successfully read structure with sample rows', async () => {
      // Mock all API responses including rows
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [{ id: 1, name: 'Workspace' }] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 101, name: 'App', type: 'database' }]
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 201, name: 'Table', order: 0 }]
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: 301, name: 'Name', type: 'text', primary: true, order: 0 }
          ]
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            count: 5,
            results: [
              { id: 1, field_301: 'Test Product 1' },
              { id: 2, field_301: 'Test Product 2' }
            ]
          })
        });

      const result = await readBaserowStructure(true, 3);
      
      const table = result.structure.workspaces[0].applications[0].tables[0];
      expect(table.rowCount).toBe(5);
      expect(table.sampleRows).toHaveLength(2);
      expect(table.sampleRows[0].field_301).toBe('Test Product 1');
    });
  });

  describe('Error handling', () => {
    it('should throw error when environment variables are missing', async () => {
      delete process.env.BASEROW_API_URL;
      delete process.env.BASEROW_API_TOKEN;

      await expect(readBaserowStructure()).rejects.toThrow(
        'BASEROW_API_URL and BASEROW_API_TOKEN environment variables are required'
      );
    });

    it('should handle workspace fetch failure', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      await expect(readBaserowStructure()).rejects.toThrow(
        'Failed to read Baserow structure: Failed to fetch workspaces: 401 Unauthorized'
      );
    });

    it('should handle network errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(readBaserowStructure()).rejects.toThrow(
        'Failed to read Baserow structure: Network error'
      );
    });

    it('should continue processing when applications fetch fails', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [{ id: 1, name: 'Workspace' }] })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        });

      const result = await readBaserowStructure();
      
      expect(result.success).toBe(true);
      expect(result.structure.workspaces).toHaveLength(1);
      expect(result.structure.workspaces[0].applications).toHaveLength(0);
    });

    it('should continue processing when tables fetch fails', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [{ id: 1, name: 'Workspace' }] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 101, name: 'App', type: 'database' }]
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        });

      const result = await readBaserowStructure();
      
      expect(result.success).toBe(true);
      expect(result.structure.workspaces).toHaveLength(1);
      expect(result.structure.workspaces[0].applications).toHaveLength(1);
      expect(result.structure.workspaces[0].applications[0].tables).toHaveLength(0);
    });
  });

  describe('Non-database applications', () => {
    it('should skip non-database applications', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [{ id: 1, name: 'Workspace' }] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: 101, name: 'Database App', type: 'database' },
            { id: 102, name: 'Other App', type: 'form' }
          ]
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 201, name: 'Table', order: 0 }]
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        });

      const result = await readBaserowStructure();
      
      expect(result.structure.workspaces[0].applications).toHaveLength(1);
      expect(result.structure.workspaces[0].applications[0].type).toBe('database');
    });
  });
});
