#!/usr/bin/env node

/**
 * Demo script showing how to use the MCP Baserow server tools
 * This script demonstrates the workflow for reading structure and uploading files
 */

console.log('🎯 MCP Baserow Server Demo\n');

console.log('📋 Step 1: Read Baserow Structure');
console.log('Command: read_baserow_structure');
console.log('Purpose: Discover all tables, fields, and their IDs\n');

console.log('Example output:');
console.log(`
🏢 Workspace: My Business (ID: 123)
  📱 Application: Product Database (ID: 456) 
    📋 Table: Products (ID: 789)
       🔢 Row Count: 45
       📝 Fields (6):
         • Name (text) [PRIMARY] - ID: 1001, Order: 0
         • Description (long_text) - ID: 1002, Order: 1  
         • Main Image (file) - ID: 1003, Order: 2
           File Types: image/*, Multiple: false
         • Gallery (file) - ID: 1004, Order: 3
           File Types: image/*, Multiple: true
         • Price (number) - ID: 1005, Order: 4
         • Category (single_select) - ID: 1006, Order: 5
           Options: Electronics, Clothing, Books, Home

    📋 Table: Orders (ID: 890)
       🔢 Row Count: 128
       📝 Fields (5):
         • Order ID (text) [PRIMARY] - ID: 2001, Order: 0
         • Customer (text) - ID: 2002, Order: 1
         • Product (link_row) - ID: 2003, Order: 2
           Links to Table ID: 789
         • Quantity (number) - ID: 2004, Order: 3
         • Invoice (file) - ID: 2005, Order: 4
           File Types: application/pdf, Multiple: false
`);

console.log('📤 Step 2: Upload Files to Specific Rows');
console.log('Now that you know the structure, you can upload files:\n');

console.log('Example 1: Upload product image from URL');
console.log(`Command: upload_image_url
Parameters:
  url: "https://example.com/new-product.jpg"
  tableId: "789"  (Products table)
  rowId: "42"     (specific product row)
  fieldName: "Main Image"  (the file field)
`);

console.log('Example 2: Upload local invoice PDF');
console.log(`Command: upload_file
Parameters:
  filePath: "/Users/me/invoices/order-123.pdf"
  tableId: "890"  (Orders table)
  rowId: "15"     (specific order row)  
  fieldName: "Invoice"  (the file field)
`);

console.log('\n💡 Pro Tips:');
console.log('• Use read_baserow_structure first to discover available tables and fields');
console.log('• Look for fields with type="file" - these can accept uploaded files');
console.log('• File fields can be single (multiple: false) or multi-file (multiple: true)');
console.log('• Some file fields restrict file types (fileTypes property)');
console.log('• Table and row IDs are required for updating existing rows');
console.log('• Field names must match exactly (case-sensitive)');

console.log('\n🔐 Setup Required:');
console.log('• Set BASEROW_API_URL environment variable');
console.log('• Set BASEROW_API_TOKEN environment variable'); 
console.log('• Configure Claude Desktop with the MCP server path');

console.log('\n✅ Ready to use! Run the MCP server and use these tools in Claude.');
