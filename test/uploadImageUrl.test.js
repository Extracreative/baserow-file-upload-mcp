import { uploadImageUrl } from '../mcp_baserow_image.js';
import { jest } from '@jest/globals';

// Mock fetch globally
global.fetch = jest.fn();

describe('uploadImageUrl', () => {
  const mockUrl = 'https://example.com/image.jpg';
  const mockTableId = '123';
  const mockFieldName = 'image_field';
  const mockFieldId = 789; // Add field ID for testing
  const mockRowId = '456';
  const mockFileName = 'uploaded_image.jpg';
  const mockFilename = 'custom_name.jpg';

  beforeEach(() => {
    // Set up environment variables
    process.env.BASEROW_API_URL = 'https://api.baserow.io';
    process.env.BASEROW_API_TOKEN = 'test_token';

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.BASEROW_API_URL;
    delete process.env.BASEROW_API_TOKEN;
  });

  describe('Image upload only', () => {
    test('should successfully upload image and return uploaded_file', async () => {
      // Mock successful upload response
      const mockUploadData = { 
        name: mockFileName, 
        url: 'https://api.baserow.io/media/user_files/test.jpg' 
      };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUploadData
      });

      const result = await uploadImageUrl(mockUrl);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.baserow.io/api/user-files/upload-via-url/',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Token test_token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url: mockUrl })
        }
      );

      expect(result).toEqual({
        success: true,
        uploaded_file: mockUploadData
      });
    });

    test('should upload with custom filename', async () => {
      const mockUploadData = { 
        name: mockFilename, 
        url: 'https://api.baserow.io/media/user_files/custom_name.jpg' 
      };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUploadData
      });

      const result = await uploadImageUrl(mockUrl, mockFilename);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.baserow.io/api/user-files/upload-via-url/',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Token test_token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url: mockUrl, filename: mockFilename })
        }
      );

      expect(result).toEqual({
        success: true,
        uploaded_file: mockUploadData
      });
    });

    test('should handle upload failure', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error'
      });

      await expect(uploadImageUrl(mockUrl))
        .rejects.toThrow('Upload failed: Upload failed: 500 Internal Server Error. Server error');
    });
  });

  describe('Image upload with row update', () => {
    test('should upload image and update row successfully', async () => {
      const mockUploadData = { 
        name: mockFileName, 
        url: 'https://api.baserow.io/media/user_files/test.jpg' 
      };
      const mockRowData = { 
        id: parseInt(mockRowId), 
        [`field_${mockFieldId}`]: [mockUploadData] 
      };
      const mockFieldsData = [
        { id: mockFieldId, name: mockFieldName, type: 'file' }
      ];

      // Mock field resolution response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFieldsData
      });

      // Mock upload response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUploadData
      });

      // Mock row update response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRowData
      });

      const result = await uploadImageUrl(mockUrl, mockFilename, mockTableId, mockRowId, mockFieldName);

      // Verify field resolution call
      expect(fetch).toHaveBeenNthCalledWith(1,
        `https://api.baserow.io/api/database/fields/table/${mockTableId}/`,
        {
          method: 'GET',
          headers: {
            'Authorization': 'Token test_token',
            'Content-Type': 'application/json'
          }
        }
      );

      // Verify upload call
      expect(fetch).toHaveBeenNthCalledWith(2,
        'https://api.baserow.io/api/user-files/upload-via-url/',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Token test_token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url: mockUrl, filename: mockFilename })
        }
      );

      // Verify row update call with field ID format
      expect(fetch).toHaveBeenNthCalledWith(3,
        `https://api.baserow.io/api/database/rows/table/${mockTableId}/${mockRowId}/`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': 'Token test_token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ [`field_${mockFieldId}`]: [mockUploadData] })
        }
      );

      expect(result).toEqual({
        success: true,
        uploaded_file: mockUploadData,
        updated_row: mockRowData
      });
    });

    test('should handle row update failure gracefully', async () => {
      const mockUploadData = { 
        name: mockFileName, 
        url: 'https://api.baserow.io/media/user_files/test.jpg' 
      };
      const mockFieldsData = [
        { id: mockFieldId, name: mockFieldName, type: 'file' }
      ];

      // Mock field resolution response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFieldsData
      });

      // Mock successful upload
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUploadData
      });

      // Mock failed row update
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Row not found'
      });

      const result = await uploadImageUrl(mockUrl, mockFilename, mockTableId, mockRowId, mockFieldName);

      expect(result).toEqual({
        success: true,
        uploaded_file: mockUploadData,
        row_update_error: 'Failed to update row: 404 Not Found'
      });
    });
  });

  describe('Error handling', () => {
    test('should handle network errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(uploadImageUrl(mockUrl))
        .rejects.toThrow('Upload failed: Network error');
    });

    test('should handle non-JSON response', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); }
      });

      await expect(uploadImageUrl(mockUrl))
        .rejects.toThrow('Upload failed: Invalid JSON');
    });
  });
});
