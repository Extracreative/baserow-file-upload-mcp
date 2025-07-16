#!/usr/bin/env node

import { readBaserowStructure } from './mcp_baserow_image.js';

async function testStructure() {
  try {
    console.log('🔍 Reading Baserow structure...\n');
    
    // Test without rows first
    const result = await readBaserowStructure(false, 0);
    
    console.log('📊 SUCCESS:', result.message);
    console.log('\n📋 Structure Summary:');
    console.log('Workspaces:', result.structure.summary.totalWorkspaces);
    console.log('Applications:', result.structure.summary.totalApplications);
    console.log('Tables:', result.structure.summary.totalTables);
    console.log('Fields:', result.structure.summary.totalFields);
    
    console.log('\n🔍 Detailed Structure:');
    
    for (const workspace of result.structure.workspaces) {
      console.log(`\n🏢 Workspace: ${workspace.name} (ID: ${workspace.id})`);
      
      for (const app of workspace.applications) {
        console.log(`  📱 Application: ${app.name} (ID: ${app.id})`);
        
        for (const table of app.tables) {
          console.log(`    📋 Table: ${table.name} (ID: ${table.id})`);
          console.log(`       📝 Fields (${table.fields.length}):`);
          
          for (const field of table.fields) {
            console.log(`         • ${field.name} (${field.type}) - ID: ${field.id}`);
            if (field.type === 'file') {
              console.log(`           └─ File field: Multiple=${field.multipleFiles || false}`);
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testStructure();
