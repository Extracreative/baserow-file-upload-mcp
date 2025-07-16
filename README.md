# MCP Baserow File Upload Server

A Model Context Protocol (MCP) server for uploading files to Baserow. Supports both URL-based uploads and direct file uploads from the local filesystem.

## Installation

```bash
npm install
```

## Usage

Set environment variables:
```bash
export BASEROW_API_URL="https://api.baserow.io"
export BASEROW_API_TOKEN="your_token_here"
```

Run the server:
```bash
npx mcp-baserow-image
```

## Claude MCP Configuration

To use this server with Claude Desktop, add the following to your Claude MCP configuration file:

### Location
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

### Configuration
```json
{
  "mcpServers": {
    "baserow-file-upload": {
      "command": "node",
      "args": ["/absolute/path/to/mcp_baserow_image.js"],
      "env": {
        "BASEROW_API_URL": "https://api.baserow.io",
        "BASEROW_API_TOKEN": "your_baserow_token_here"
      }
    }
  }
}
```

### Alternative: Global Installation
If you prefer to install globally:

```bash
npm install -g mcp-baserow-image
```

Then use this configuration:
```json
{
  "mcpServers": {
    "baserow-file-upload": {
      "command": "mcp-baserow-image",
      "env": {
        "BASEROW_API_URL": "https://api.baserow.io", 
        "BASEROW_API_TOKEN": "your_baserow_token_here"
      }
    }
  }
}
```

### Getting Your Baserow Token
1. Log into your Baserow account
2. Go to Settings → Account → API tokens
3. Create a new token with appropriate permissions
4. Copy the token value

After adding the configuration, restart Claude Desktop to load the MCP server.

## MCP Protocol

This server provides two tools for uploading files to Baserow:

### Available Tools

#### 1. upload_image_url
Upload an image from a URL to Baserow and optionally update a table row.

#### 2. upload_file  
Upload a file directly from the local filesystem to Baserow and optionally update a table row.

#### 3. read_baserow_structure
Read the structure of all tables and fields in Baserow to understand what's available for updates.

## Tool Selection Guide

- **URL-based uploads**: Use `upload_image_url` for images available on the web
- **Local file uploads**: Use `upload_file` for files on your local system
- **Structure discovery**: Use `read_baserow_structure` to explore your Baserow setup

### Reading Baserow Structure

Before uploading files and updating rows, you can explore your Baserow structure:

```
read_baserow_structure
```

With sample data:
```
read_baserow_structure includeRows=true maxRows=3
```

This will show you:
- All workspaces and their IDs
- All applications (databases) and their IDs  
- All tables and their IDs
- All fields, their types, and IDs
- File fields and their configuration
- Sample row data (if requested)

Use this information to identify the correct `tableId`, `rowId`, and `fieldName` for your uploads.

### 1. upload_image_url
Upload an image from a URL to Baserow.

**Input Format:**
```json
{
  "tool": "upload_image_url",
  "args": {
    "url": "https://example.com/image.jpg",
    "filename": "custom_name.jpg",
    "tableId": "123",
    "rowId": "456", 
    "fieldName": "image_field"
  }
}
```

### 2. upload_file
Upload a file directly from the local filesystem to Baserow.

**Important:** This tool requires the file to be physically present on the local filesystem where the MCP server is running. The file path must be accessible to the server process.

**Input Format:**
```json
{
  "tool": "upload_file", 
  "args": {
    "filePath": "/path/to/local/file.jpg",
    "filename": "custom_name.jpg",
    "tableId": "123",
    "rowId": "456",
    "fieldName": "file_field"
  }
}
```

**Note:** The `filePath` parameter must point to an existing file on the local filesystem. Remote URLs or cloud storage paths are not supported for this tool - use `upload_image_url` for URL-based uploads instead.

### Output Format
Both tools return the same format:
```json
{
  "success": true,
  "uploaded_file": {
    "name": "uploaded_file_name.jpg",
    "url": "https://api.baserow.io/media/user_files/..."
  },
  "updated_row": { 
    "id": 456, 
    "file_field": [...] 
  }
}
```

## Development

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Linting
```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

## API

### upload_image_url(url, filename?, tableId?, rowId?, fieldName?)

Uploads an image from a URL to Baserow and optionally updates a row.

**Parameters:**
- `url` (string) - The image URL to upload
- `filename` (string, optional) - Custom filename for the uploaded file
- `tableId` (string, optional) - Baserow table ID
- `rowId` (string, optional) - Existing row ID to update
- `fieldName` (string, optional) - The field name for the file field

**Returns:**
Promise<object> - `{ success: true, uploaded_file: object, updated_row?: object }`

### upload_file(filePath, filename?, tableId?, rowId?, fieldName?)

Uploads a file from the local filesystem to Baserow and optionally updates a row.

**Important:** The file must exist on the local filesystem where the MCP server is running.

**Parameters:**
- `filePath` (string) - The local file path to upload (must be an existing file on the filesystem)
- `filename` (string, optional) - Custom filename for the uploaded file
- `tableId` (string, optional) - Baserow table ID
- `rowId` (string, optional) - Existing row ID to update
- `fieldName` (string, optional) - The field name for the file field

**Returns:**
Promise<object> - `{ success: true, uploaded_file: object, updated_row?: object }`

**Example file paths:**
- `/Users/username/Documents/image.jpg` (macOS/Linux)
- `C:\Users\username\Documents\image.jpg` (Windows)
- `./uploads/file.pdf` (relative to server working directory)

### read_baserow_structure(includeRows?, maxRows?)

Reads the complete structure of your Baserow workspace including all tables and fields.

**Parameters:**
- `includeRows` (boolean, optional) - Whether to include sample row data (default: false)
- `maxRows` (number, optional) - Maximum number of sample rows per table (default: 5)

**Returns:**
Promise<object> - Complete workspace structure with workspaces, applications, tables, and fields

## Complete Workflow Example

Here's a typical workflow for uploading files to your Baserow database:

### Step 1: Explore Your Baserow Structure
```
read_baserow_structure
```

This will show you something like:
```
🏢 Workspace: My Workspace (ID: 123)
  📱 Application: My Database (ID: 456)
    📋 Table: Products (ID: 789)
       📝 Fields (5):
         • Name (text) - ID: 1001
         • Description (long_text) - ID: 1002  
         • Image (file) - ID: 1003
           File Types: Any, Multiple: false
         • Price (number) - ID: 1004
         • Category (single_select) - ID: 1005
```

### Step 2: Upload File and Update Row
Once you know your structure, upload a file to a specific row:

```javascript
// Upload from URL and update row 42 in the Products table
upload_image_url(
  url="https://example.com/product.jpg",
  tableId="789", 
  rowId="42",
  fieldName="Image"
)

// Or upload from local file
upload_file(
  filePath="/Users/me/product-photo.jpg",
  tableId="789",
  rowId="42", 
  fieldName="Image"
)
```

The file will be uploaded to Baserow and the specified row will be updated with the file reference.

## Environment Variables

- `BASEROW_API_URL` - Baserow API base URL (e.g., "https://api.baserow.io")
- `BASEROW_API_TOKEN` - Baserow API authentication token
