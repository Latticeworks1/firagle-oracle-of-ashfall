#!/usr/bin/env node

/**
 * Automatic Fixer/Linter for Firagle Codebase
 * Integrates with existing hooks and patterns to fix common issues
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class FiragleAutoFixer {
  constructor() {
    this.basePath = process.cwd();
    this.issues = [];
    this.fixes = [];
    this.patterns = {
      // Template literal issues in HTML/JS strings
      corruptedTemplateInHTML: /\$\{([^}]+)\}/g,
      // Malformed HTML tags
      invalidHTMLTags: /<\s*([^>\s]+)[^>]*>/g,
      // TypeScript/React issues
      missingImports: /(?:useRef|useState|useEffect|useMemo|useCallback)\s*\(/g,
      // Three.js common issues
      threeJSMissingImports: /(?:THREE\.|new THREE)/g,
      // EventBus integration issues
      eventBusUsage: /eventBus\.(?:dispatch|subscribe)/g,
      // Multiplayer ECS patterns
      ecsPatterns: /(?:getComponent|addComponent|removeComponent)/g
    };
  }

  async run() {
    console.log('🔧 Starting Firagle Auto-Fixer...');
    
    // Scan for issues
    await this.scanFiles();
    
    // Apply fixes
    await this.applyFixes();
    
    // Run additional checks
    await this.runQualityChecks();
    
    // Generate report
    this.generateReport();
  }

  async scanFiles() {
    console.log('📁 Scanning files...');
    
    const filesToCheck = [
      '**/*.tsx',
      '**/*.ts', 
      '**/*.html',
      '**/*.js'
    ];
    
    for (const pattern of filesToCheck) {
      const files = this.glob(pattern);
      for (const file of files) {
        await this.checkFile(file);
      }
    }
  }

  async checkFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const issues = [];
      
      // Check for HTML parsing issues
      if (filePath.endsWith('.html')) {
        issues.push(...this.checkHTMLIssues(content, filePath));
      }
      
      // Check for TypeScript/React issues
      if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        issues.push(...this.checkTypeScriptIssues(content, filePath));
      }
      
      // Check for common patterns
      issues.push(...this.checkCommonPatterns(content, filePath));
      
      if (issues.length > 0) {
        this.issues.push(...issues.map(issue => ({ ...issue, file: filePath })));
      }
    } catch (error) {
      console.warn(`⚠️  Could not read ${filePath}: ${error.message}`);
    }
  }

  checkHTMLIssues(content, filePath) {
    const issues = [];
    
    // Fix template literals in HTML contexts
    const templateMatches = [...content.matchAll(this.patterns.corruptedTemplateInHTML)];
    for (const match of templateMatches) {
      const line = this.getLineNumber(content, match.index);
      issues.push({
        type: 'template_literal_in_html',
        line,
        message: `Template literal ${match[0]} should use string concatenation in HTML context`,
        fix: () => this.fixTemplateLiteral(match[0], match[1])
      });
    }
    
    // Check for malformed HTML tags  
    const htmlMatches = [...content.matchAll(/<\s*([^>\s]+)[^>]*>/g)];
    for (const match of htmlMatches) {
      const tagName = match[1];
      if (tagName.includes('$') || tagName.includes('{') || tagName.includes('}')) {
        const line = this.getLineNumber(content, match.index);
        issues.push({
          type: 'malformed_html_tag',
          line,
          message: `Malformed HTML tag: ${match[0]}`,
          fix: () => this.fixHTMLTag(match[0], tagName)
        });
      }
    }
    
    return issues;
  }

  checkTypeScriptIssues(content, filePath) {
    const issues = [];
    
    // Check for missing React imports
    const reactHooks = [...content.matchAll(this.patterns.missingImports)];
    if (reactHooks.length > 0 && !content.includes("import React") && !content.includes("import {")) {
      issues.push({
        type: 'missing_react_import',
        line: 1,
        message: 'Missing React imports for hooks used',
        fix: () => this.addReactImports(content, reactHooks)
      });
    }
    
    // Check for missing Three.js imports
    const threeUsage = [...content.matchAll(this.patterns.threeJSMissingImports)];
    if (threeUsage.length > 0 && !content.includes("import * as THREE")) {
      issues.push({
        type: 'missing_threejs_import',
        line: 1,
        message: 'Missing Three.js import',
        fix: () => this.addThreeJSImport(content)
      });
    }
    
    // Check for EventBus integration
    const eventBusUsage = [...content.matchAll(this.patterns.eventBusUsage)];
    if (eventBusUsage.length > 0 && !content.includes("import { eventBus }")) {
      issues.push({
        type: 'missing_eventbus_import',
        line: 1,
        message: 'Missing EventBus import',
        fix: () => this.addEventBusImport(content)
      });
    }
    
    return issues;
  }

  checkCommonPatterns(content, filePath) {
    const issues = [];
    
    // Check for hardcoded values that should use constants
    const hardcodedColors = content.match(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}/g);
    if (hardcodedColors && !filePath.includes('constants')) {
      issues.push({
        type: 'hardcoded_colors',
        line: 0,
        message: `Found hardcoded colors: ${hardcodedColors.join(', ')}. Consider using constants.`,
        fix: () => this.suggestConstants(hardcodedColors)
      });
    }
    
    return issues;
  }

  async applyFixes() {
    console.log('🔨 Applying automatic fixes...');
    
    const groupedIssues = this.groupIssuesByFile();
    
    for (const [filePath, fileIssues] of Object.entries(groupedIssues)) {
      console.log(`  📄 Fixing ${filePath}...`);
      await this.fixFile(filePath, fileIssues);
    }
  }

  async fixFile(filePath, issues) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Sort issues by line number (descending) to avoid offset issues
    const sortedIssues = issues.sort((a, b) => (b.line || 0) - (a.line || 0));
    
    for (const issue of sortedIssues) {
      if (issue.fix && typeof issue.fix === 'function') {
        try {
          const fixResult = issue.fix();
          if (fixResult && fixResult.newContent) {
            content = fixResult.newContent;
            modified = true;
            this.fixes.push({
              file: filePath,
              type: issue.type,
              message: issue.message,
              applied: true
            });
          } else if (fixResult && fixResult.suggestion) {
            console.log(`  💡 Suggestion for ${filePath}: ${fixResult.suggestion}`);
          }
        } catch (error) {
          console.warn(`  ⚠️  Could not apply fix for ${issue.type}: ${error.message}`);
        }
      }
    }
    
    if (modified) {
      // Backup original
      fs.writeFileSync(`${filePath}.backup`, fs.readFileSync(filePath));
      fs.writeFileSync(filePath, content);
      console.log(`  ✅ Fixed ${filePath}`);
    }
  }

  // Fix implementations
  fixTemplateLiteral(original, variable) {
    return {
      newContent: null, // Will be handled by specialized HTML fixer
      suggestion: `Replace ${original} with ' + ${variable} + ' in HTML contexts`
    };
  }

  fixHTMLTag(original, tagName) {
    if (tagName.includes('${')) {
      const cleanTag = tagName.replace(/\$\{([^}]+)\}/g, "' + $1 + '");
      return {
        suggestion: `Replace ${original} with proper string concatenation`
      };
    }
    return { suggestion: `Review HTML tag: ${original}` };
  }

  addReactImports(content, hooks) {
    const usedHooks = new Set();
    hooks.forEach(match => {
      const hookName = match[0].replace('(', '');
      usedHooks.add(hookName);
    });
    
    const importLine = `import React, { ${Array.from(usedHooks).join(', ')} } from 'react';`;
    const newContent = importLine + '\n' + content;
    
    return { newContent };
  }

  addThreeJSImport(content) {
    const importLine = "import * as THREE from 'three';";
    const newContent = importLine + '\n' + content;
    return { newContent };
  }

  addEventBusImport(content) {
    const importLine = "import { eventBus } from '../systems/eventBus';";
    const newContent = importLine + '\n' + content;
    return { newContent };
  }

  suggestConstants(colors) {
    return {
      suggestion: `Consider adding these colors to constants.ts: ${colors.map(c => `COLOR_${c.replace('#', '').toUpperCase()}: '${c}'`).join(', ')}`
    };
  }

  async runQualityChecks() {
    console.log('🔍 Running quality checks...');
    
    // Check if TypeScript compiles
    try {
      execSync('npx tsc --noEmit --skipLibCheck', { stdio: 'pipe' });
      console.log('  ✅ TypeScript compilation check passed');
    } catch (error) {
      console.log('  ⚠️  TypeScript compilation has issues');
      const output = error.stdout?.toString() || error.stderr?.toString() || '';
      if (output) {
        console.log('     ' + output.split('\n').slice(0, 5).join('\n     '));
      }
    }
    
    // Check if build succeeds  
    try {
      execSync('npm run build', { stdio: 'pipe' });
      console.log('  ✅ Build check passed');
    } catch (error) {
      console.log('  ⚠️  Build has issues');
    }
  }

  // Helper methods
  groupIssuesByFile() {
    const grouped = {};
    for (const issue of this.issues) {
      if (!grouped[issue.file]) {
        grouped[issue.file] = [];
      }
      grouped[issue.file].push(issue);
    }
    return grouped;
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  glob(pattern) {
    // Simple glob implementation - in production use a proper glob library
    try {
      const result = execSync(`find . -name "${pattern}" -type f`, { encoding: 'utf8' });
      return result.trim().split('\n').filter(f => f && !f.includes('node_modules') && !f.includes('.git'));
    } catch {
      return [];
    }
  }

  generateReport() {
    console.log('\n📊 Auto-Fixer Report');
    console.log('====================');
    console.log(`🔍 Issues found: ${this.issues.length}`);
    console.log(`🔧 Fixes applied: ${this.fixes.length}`);
    
    if (this.issues.length > 0) {
      console.log('\n📋 Issue Summary:');
      const issueTypes = {};
      this.issues.forEach(issue => {
        issueTypes[issue.type] = (issueTypes[issue.type] || 0) + 1;
      });
      
      Object.entries(issueTypes).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    }
    
    if (this.fixes.length > 0) {
      console.log('\n✅ Applied Fixes:');
      this.fixes.forEach(fix => {
        console.log(`  ${fix.file}: ${fix.type}`);
      });
    }
    
    console.log('\n🎯 Recommendations:');
    console.log('  1. Review backup files (.backup) before committing');
    console.log('  2. Test functionality after automatic fixes');
    console.log('  3. Run linter and tests to verify fixes');
  }
}

// CLI interface
if (require.main === module) {
  const fixer = new FiragleAutoFixer();
  fixer.run().catch(console.error);
}

module.exports = FiragleAutoFixer;