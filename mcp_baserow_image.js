#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Schema for tool arguments
const UploadImageArgsSchema = z.object({
  url: z.string().url().describe("The URL of the image to upload"),
  filename: z.string().optional().describe("Optional filename for the uploaded image"),
  tableId: z.string().optional().describe("Optional Baserow table ID to update a row"),
  rowId: z.string().optional().describe("Optional row ID to update (requires tableId)"),
  fieldName: z.string().optional().describe("Optional field name, field ID, or field_ID format to update with the uploaded image (requires tableId and rowId)")
});

// Schema for file upload arguments
const UploadFileArgsSchema = z.object({
  filePath: z.string().describe("The local file path to upload (must exist on the local filesystem where the MCP server is running)"),
  filename: z.string().optional().describe("Optional filename for the uploaded file"),
  tableId: z.string().optional().describe("Optional Baserow table ID to update a row"),
  rowId: z.string().optional().describe("Optional row ID to update (requires tableId)"),
  fieldName: z.string().optional().describe("Optional field name, field ID, or field_ID format to update with the uploaded file (requires tableId and rowId)")
});

// Schema for reading Baserow structure
const ReadBaserowStructureArgsSchema = z.object({
  includeRows: z.boolean().optional().describe("Whether to include sample rows data (default: false)"),
  maxRows: z.number().optional().describe("Maximum number of rows to fetch per table (default: 5)")
});

/**
 * Upload an image from URL to Baserow
 * @param {string} url - The URL of the image to upload
 * @param {string} filename - Optional filename for the uploaded image
 * @param {string} tableId - Optional Baserow table ID
 * @param {string} rowId - Optional row ID
 * @param {string} fieldName - Optional field name
 * @returns {Promise<Object>} Upload result
 */
async function uploadImageUrl(url, filename, tableId, rowId, fieldName) {
  // Environment variables
  const BASEROW_API_URL = process.env.BASEROW_API_URL;
  const BASEROW_API_TOKEN = process.env.BASEROW_API_TOKEN;

  if (!BASEROW_API_URL || !BASEROW_API_TOKEN) {
    throw new Error("BASEROW_API_URL and BASEROW_API_TOKEN environment variables are required");
  }

  try {
    // Step 1: Upload the image via URL
    const uploadPayload = { url };
    if (filename) {
      uploadPayload.filename = filename;
    }

    const uploadResponse = await fetch(`${BASEROW_API_URL}/api/user-files/upload-via-url/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${BASEROW_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(uploadPayload)
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}. ${errorText}`);
    }

    const uploadResult = await uploadResponse.json();
    
    // Step 2: If table/row/field info provided, update the row
    if (tableId && rowId && fieldName) {
      // First, resolve field name to field ID
      const fieldId = await getFieldId(tableId, fieldName, BASEROW_API_URL, BASEROW_API_TOKEN);
      if (!fieldId) {
        return {
          success: true,
          uploaded_file: uploadResult,
          row_update_error: `Failed to resolve field "${fieldName}" in table ${tableId}`
        };
      }

      const updatePayload = {
        [`field_${fieldId}`]: [uploadResult]
      };

      const updateResponse = await fetch(`${BASEROW_API_URL}/api/database/rows/table/${tableId}/${rowId}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Token ${BASEROW_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatePayload)
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.warn(`Row update failed: ${updateResponse.status} ${updateResponse.statusText}. ${errorText}`);
        // Return upload result even if row update fails
        return {
          success: true,
          uploaded_file: uploadResult,
          row_update_error: `Failed to update row: ${updateResponse.status} ${updateResponse.statusText}`
        };
      }

      const updateResult = await updateResponse.json();
      return {
        success: true,
        uploaded_file: uploadResult,
        updated_row: updateResult
      };
    }

    return {
      success: true,
      uploaded_file: uploadResult
    };
  } catch (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
}

/**
 * Upload a file directly to Baserow
 * @param {string} filePath - The local file path to upload
 * @param {string} filename - Optional filename for the uploaded file
 * @param {string} tableId - Optional Baserow table ID
 * @param {string} rowId - Optional row ID
 * @param {string} fieldName - Optional field name
 * @returns {Promise<Object>} Upload result
 */
async function uploadFile(filePath, filename, tableId, rowId, fieldName) {
  // Environment variables
  const BASEROW_API_URL = process.env.BASEROW_API_URL;
  const BASEROW_API_TOKEN = process.env.BASEROW_API_TOKEN;

  if (!BASEROW_API_URL || !BASEROW_API_TOKEN) {
    throw new Error("BASEROW_API_URL and BASEROW_API_TOKEN environment variables are required");
  }

  const fs = await import('fs');
  const path = await import('path');

  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Read file
    const fileBuffer = fs.readFileSync(filePath);
    const originalFilename = filename || path.basename(filePath);

    // Create FormData for file upload
    const FormData = (await import('formdata-node')).FormData;
    const { Blob } = await import('buffer');
    
    const formData = new FormData();
    formData.append('file', new Blob([fileBuffer]), originalFilename);

    // Step 1: Upload the file
    const uploadResponse = await fetch(`${BASEROW_API_URL}/api/user-files/upload-file/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${BASEROW_API_TOKEN}`
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}. ${errorText}`);
    }

    const uploadResult = await uploadResponse.json();
    
    // Step 2: If table/row/field info provided, update the row
    if (tableId && rowId && fieldName) {
      // First, resolve field name to field ID
      const fieldId = await getFieldId(tableId, fieldName, BASEROW_API_URL, BASEROW_API_TOKEN);
      if (!fieldId) {
        return {
          success: true,
          uploaded_file: uploadResult,
          row_update_error: `Failed to resolve field "${fieldName}" in table ${tableId}`
        };
      }

      const updatePayload = {
        [`field_${fieldId}`]: [uploadResult]
      };

      const updateResponse = await fetch(`${BASEROW_API_URL}/api/database/rows/table/${tableId}/${rowId}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Token ${BASEROW_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatePayload)
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.warn(`Row update failed: ${updateResponse.status} ${updateResponse.statusText}. ${errorText}`);
        // Return upload result even if row update fails
        return {
          success: true,
          uploaded_file: uploadResult,
          row_update_error: `Failed to update row: ${updateResponse.status} ${updateResponse.statusText}`
        };
      }

      const updateResult = await updateResponse.json();
      return {
        success: true,
        uploaded_file: uploadResult,
        updated_row: updateResult
      };
    }

    return {
      success: true,
      uploaded_file: uploadResult
    };
  } catch (error) {
    throw new Error(`File upload failed: ${error.message}`);
  }
}

/**
 * Read all tables and fields structure from Baserow
 * @param {boolean} includeRows - Whether to include sample rows data
 * @param {number} maxRows - Maximum number of rows to fetch per table
 * @returns {Promise<Object>} Complete Baserow structure
 */
async function readBaserowStructure(includeRows = false, maxRows = 5) {
  const BASEROW_API_URL = process.env.BASEROW_API_URL;
  const BASEROW_API_TOKEN = process.env.BASEROW_API_TOKEN;

  if (!BASEROW_API_URL || !BASEROW_API_TOKEN) {
    throw new Error("BASEROW_API_URL and BASEROW_API_TOKEN environment variables are required");
  }

  try {
    const structure = {
      workspaces: [],
      summary: {
        totalWorkspaces: 0,
        totalApplications: 0,
        totalTables: 0,
        totalFields: 0
      }
    };

    // Step 1: Get all workspaces
    const workspacesResponse = await fetch(`${BASEROW_API_URL}/api/workspaces/`, {
      headers: {
        'Authorization': `Token ${BASEROW_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!workspacesResponse.ok) {
      throw new Error(`Failed to fetch workspaces: ${workspacesResponse.status} ${workspacesResponse.statusText}`);
    }

    const workspacesData = await workspacesResponse.json();
    structure.summary.totalWorkspaces = workspacesData.results?.length || 0;

    // Step 2: For each workspace, get applications and tables
    for (const workspace of workspacesData.results || []) {
      const workspaceInfo = {
        id: workspace.id,
        name: workspace.name,
        applications: []
      };

      // Get applications for this workspace
      const appsResponse = await fetch(`${BASEROW_API_URL}/api/applications/workspace/${workspace.id}/`, {
        headers: {
          'Authorization': `Token ${BASEROW_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!appsResponse.ok) {
        console.warn(`Failed to fetch applications for workspace ${workspace.id}: ${appsResponse.status}`);
        // Still add the workspace with empty applications
        structure.workspaces.push(workspaceInfo);
        continue;
      }

      const appsData = await appsResponse.json();
      structure.summary.totalApplications += appsData.length || 0;

      // Step 3: For each application, get tables
      for (const application of appsData || []) {
        if (application.type !== 'database') continue;

        const appInfo = {
          id: application.id,
          name: application.name,
          type: application.type,
          tables: []
        };

        const tablesResponse = await fetch(`${BASEROW_API_URL}/api/database/tables/database/${application.id}/`, {
          headers: {
            'Authorization': `Token ${BASEROW_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });

        if (!tablesResponse.ok) {
          console.warn(`Failed to fetch tables for application ${application.id}: ${tablesResponse.status}`);
          // Still add the application with empty tables
          workspaceInfo.applications.push(appInfo);
          continue;
        }

        const tablesData = await tablesResponse.json();
        structure.summary.totalTables += tablesData.length || 0;

        // Step 4: For each table, get fields and optionally rows
        for (const table of tablesData || []) {
          const tableInfo = {
            id: table.id,
            name: table.name,
            order: table.order,
            fields: [],
            rowCount: 0,
            sampleRows: []
          };

          // Get fields for this table
          const fieldsResponse = await fetch(`${BASEROW_API_URL}/api/database/fields/table/${table.id}/`, {
            headers: {
              'Authorization': `Token ${BASEROW_API_TOKEN}`,
              'Content-Type': 'application/json'
            }
          });

          if (fieldsResponse.ok) {
            const fieldsData = await fieldsResponse.json();
            structure.summary.totalFields += fieldsData.length || 0;

            tableInfo.fields = fieldsData.map(field => ({
              id: field.id,
              name: field.name,
              type: field.type,
              primary: field.primary || false,
              order: field.order,
              description: field.description || null,
              // Include type-specific properties
              ...(field.type === 'file' && {
                fileTypes: field.file_types || null,
                multipleFiles: field.multiple_files || false
              }),
              ...(field.type === 'single_select' && {
                selectOptions: field.select_options || []
              }),
              ...(field.type === 'multiple_select' && {
                selectOptions: field.select_options || []
              }),
              ...(field.type === 'link_row' && {
                linkRowTable: field.link_row_table || null,
                linkRowTableId: field.link_row_table_id || null
              })
            }));
          }

          // Get sample rows if requested
          if (includeRows) {
            const rowsResponse = await fetch(`${BASEROW_API_URL}/api/database/rows/table/${table.id}/?size=${maxRows}`, {
              headers: {
                'Authorization': `Token ${BASEROW_API_TOKEN}`,
                'Content-Type': 'application/json'
              }
            });

            if (rowsResponse.ok) {
              const rowsData = await rowsResponse.json();
              tableInfo.rowCount = rowsData.count || 0;
              tableInfo.sampleRows = rowsData.results || [];
            }
          }

          appInfo.tables.push(tableInfo);
        }

        workspaceInfo.applications.push(appInfo);
      }

      structure.workspaces.push(workspaceInfo);
    }

    return {
      success: true,
      structure,
      message: `Found ${structure.summary.totalWorkspaces} workspaces, ${structure.summary.totalApplications} applications, ${structure.summary.totalTables} tables, and ${structure.summary.totalFields} fields`
    };

  } catch (error) {
    throw new Error(`Failed to read Baserow structure: ${error.message}`);
  }
}

// Helper function to get field ID from field name or return ID if already provided
async function getFieldId(tableId, fieldNameOrId, apiUrl, apiToken) {
  try {
    // If it's already a number or looks like a field ID, return it directly
    if (!isNaN(fieldNameOrId) || /^\d+$/.test(fieldNameOrId)) {
      return parseInt(fieldNameOrId);
    }
    
    // If it's in field_XXX format, extract the ID
    if (fieldNameOrId.startsWith('field_')) {
      const idPart = fieldNameOrId.replace('field_', '');
      if (!isNaN(idPart)) {
        return parseInt(idPart);
      }
    }
    
    // Otherwise, treat it as a field name and resolve to ID
    const fieldsResponse = await fetch(`${apiUrl}/api/database/fields/table/${tableId}/`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!fieldsResponse.ok) {
      throw new Error(`Failed to get fields: ${fieldsResponse.status}`);
    }

    const fields = await fieldsResponse.json();
    const field = fields.find(f => f.name === fieldNameOrId);
    
    if (!field) {
      throw new Error(`Field "${fieldNameOrId}" not found in table ${tableId}`);
    }
    
    return field.id;
  } catch (error) {
    console.warn(`Field resolution failed: ${error.message}`);
    return null;
  }
}

// Create MCP server
const server = new Server(
  {
    name: "baserow-image-upload",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "upload_image_url",
        description: "Upload an image from a URL to Baserow and optionally update a table row with the uploaded image. Returns the uploaded file information and optionally updates a specified row in a table.",
        inputSchema: zodToJsonSchema(UploadImageArgsSchema),
      },
      {
        name: "upload_file",
        description: "Upload a file directly from the local filesystem to Baserow and optionally update a table row with the uploaded file. The file must exist on the local filesystem where the MCP server is running. Returns the uploaded file information and optionally updates a specified row in a table.",
        inputSchema: zodToJsonSchema(UploadFileArgsSchema),
      },
      {
        name: "read_baserow_structure",
        description: "Read the structure of all tables and fields in Baserow, optionally including sample rows data. Returns a summary of workspaces, applications, tables, and fields, along with their detailed structure.",
        inputSchema: zodToJsonSchema(ReadBaserowStructureArgsSchema),
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "upload_image_url") {
    const parsed = UploadImageArgsSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(`Invalid arguments: ${parsed.error.message}`);
    }

    const { url, filename, tableId, rowId, fieldName } = parsed.data;
    
    // Validate that if any optional params are provided, they're provided together when needed
    if ((tableId || rowId || fieldName) && !(tableId && rowId && fieldName)) {
      throw new Error("If providing table update parameters, tableId, rowId, and fieldName are all required");
    }

    try {
      const result = await uploadImageUrl(url, filename, tableId, rowId, fieldName);
      
      let message = `✅ Successfully uploaded image from ${url}`;
      if (result.uploaded_file) {
        message += `\n📁 File ID: ${result.uploaded_file.name}`;
        message += `\n🔗 File URL: ${result.uploaded_file.url}`;
      }
      if (result.updated_row) {
        message += `\n📝 Updated row ${rowId} in table ${tableId}`;
      }
      if (result.row_update_error) {
        message += `\n⚠️ ${result.row_update_error}`;
      }

      return {
        content: [
          {
            type: "text",
            text: message
          }
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Error: ${error.message}`
          }
        ],
        isError: true,
      };
    }
  } else if (name === "upload_file") {
    const parsed = UploadFileArgsSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(`Invalid arguments: ${parsed.error.message}`);
    }

    const { filePath, filename, tableId, rowId, fieldName } = parsed.data;
    
    // Validate that if any optional params are provided, they're provided together when needed
    if ((tableId || rowId || fieldName) && !(tableId && rowId && fieldName)) {
      throw new Error("If providing table update parameters, tableId, rowId, and fieldName are all required");
    }

    try {
      const result = await uploadFile(filePath, filename, tableId, rowId, fieldName);
      
      let message = `✅ Successfully uploaded file from ${filePath}`;
      if (result.uploaded_file) {
        message += `\n📁 File ID: ${result.uploaded_file.name}`;
        message += `\n🔗 File URL: ${result.uploaded_file.url}`;
      }
      if (result.updated_row) {
        message += `\n📝 Updated row ${rowId} in table ${tableId}`;
      }
      if (result.row_update_error) {
        message += `\n⚠️ ${result.row_update_error}`;
      }

      return {
        content: [
          {
            type: "text",
            text: message
          }
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Error: ${error.message}`
          }
        ],
        isError: true,
      };
    }
  } else if (name === "read_baserow_structure") {
    const parsed = ReadBaserowStructureArgsSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(`Invalid arguments: ${parsed.error.message}`);
    }

    const { includeRows, maxRows } = parsed.data;

    try {
      const result = await readBaserowStructure(includeRows, maxRows);

      let message = result.message;
      
      // Create a detailed structure report
      message += '\n\n📊 **BASEROW STRUCTURE REPORT**\n';
      
      for (const workspace of result.structure.workspaces) {
        message += `\n🏢 **Workspace: ${workspace.name}** (ID: ${workspace.id})\n`;
        
        for (const app of workspace.applications) {
          message += `\n  📱 **Application: ${app.name}** (ID: ${app.id}, Type: ${app.type})\n`;
          
          for (const table of app.tables) {
            message += `\n    📋 **Table: ${table.name}** (ID: ${table.id})\n`;
            message += `       🔢 Row Count: ${table.rowCount || 'Unknown'}\n`;
            message += `       📝 Fields (${table.fields.length}):\n`;
            
            for (const field of table.fields) {
              message += `         • **${field.name}** (${field.type})`;
              if (field.primary) message += ' [PRIMARY]';
              if (field.description) message += ` - ${field.description}`;
              message += `\n           ID: ${field.id}, Order: ${field.order}\n`;
              
              // Add type-specific details
              if (field.type === 'file') {
                message += `           File Types: ${field.fileTypes || 'Any'}, Multiple: ${field.multipleFiles || false}\n`;
              } else if (field.type === 'single_select' || field.type === 'multiple_select') {
                if (field.selectOptions?.length > 0) {
                  message += `           Options: ${field.selectOptions.map(opt => opt.value).join(', ')}\n`;
                }
              } else if (field.type === 'link_row') {
                message += `           Links to Table ID: ${field.linkRowTableId}\n`;
              }
            }
            
            // Add sample rows if requested
            if (includeRows && table.sampleRows.length > 0) {
              message += `\n       📄 Sample Rows (showing ${table.sampleRows.length}):\n`;
              for (let i = 0; i < Math.min(3, table.sampleRows.length); i++) {
                const row = table.sampleRows[i];
                message += `         Row ${row.id}: `;
                const rowData = [];
                for (const field of table.fields.slice(0, 3)) { // Show first 3 fields
                  const value = row[`field_${field.id}`];
                  if (value !== undefined && value !== null) {
                    rowData.push(`${field.name}: ${typeof value === 'object' ? JSON.stringify(value).slice(0, 50) : String(value).slice(0, 50)}`);
                  }
                }
                message += rowData.join(', ') + '\n';
              }
            }
            message += '\n';
          }
        }
      }

      return {
        content: [
          {
            type: "text",
            text: message
          }
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Error: ${error.message}`
          }
        ],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start the server
async function main() {
  // Check environment variables when starting
  const BASEROW_API_URL = process.env.BASEROW_API_URL;
  const BASEROW_API_TOKEN = process.env.BASEROW_API_TOKEN;

  if (!BASEROW_API_URL || !BASEROW_API_TOKEN) {
    console.error("Error: BASEROW_API_URL and BASEROW_API_TOKEN environment variables are required");
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Baserow Image Upload MCP Server running on stdio");
}

// Only start the server if this module is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
  });
}

// Export for testing
export { uploadImageUrl, uploadFile, readBaserowStructure };
