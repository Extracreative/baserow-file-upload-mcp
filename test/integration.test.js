import { spawn } from 'child_process';
import { jest } from '@jest/globals';

describe('MCP Server Integration', () => {
  let env;

  beforeAll(() => {
    env = {
      ...process.env,
      BASEROW_API_URL: 'https://api.baserow.io',
      BASEROW_API_TOKEN: 'test_token'
    };
  });

  test('should start without errors', (done) => {
    const child = spawn('node', ['mcp_baserow_image.js'], {
      cwd: process.cwd(),
      env: env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stderr = '';
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    setTimeout(() => {
      child.kill();
      expect(stderr).toContain('Baserow Image Upload MCP Server running on stdio');
      done();
    }, 1000);
  }, 10000);

  test('server exports uploadImageUrl function', async () => {
    const { uploadImageUrl } = await import('../mcp_baserow_image.js');
    expect(typeof uploadImageUrl).toBe('function');
  });

  test('server exports uploadFile function', async () => {
    const { uploadFile } = await import('../mcp_baserow_image.js');
    expect(typeof uploadFile).toBe('function');
  });

  test('server exports readBaserowStructure function', async () => {
    const { readBaserowStructure } = await import('../mcp_baserow_image.js');
    expect(typeof readBaserowStructure).toBe('function');
  });
});