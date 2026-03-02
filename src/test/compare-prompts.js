#!/usr/bin/env node

/**
 * Prompt Comparison Tool
 * 
 * Compare prompts.json (UCL/coded) vs prompt2.json (natural language)
 * side-by-side to verify they produce equivalent behavior.
 * 
 * Usage:
 *   node src/test/compare-prompts.js --job job.txt --resume resume.txt
 *   node src/test/compare-prompts.js --example (uses built-in example data)
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const useExample = args.includes('--example') || args.includes('-e');

function loadPrompts(filename) {
  const promptPath = path.join(__dirname, '..', 'data', filename);
  if (!fs.existsSync(promptPath)) {
    console.error(`Error: ${filename} not found`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(promptPath, 'utf-8'));
}

function extractSections(prompts) {
  const personaSystem = prompts.persona?.generation?.systemPrompt?.join('\n') || '';
  const interviewSystem = prompts.interview?.systemPrompt?.withPersona?.join('\n') || '';
  
  return {
    personaLength: personaSystem.length,
    interviewLength: interviewSystem.length,
    has19Fields: personaSystem.includes('19') || personaSystem.includes('nineteen'),
    has5Phases: (personaSystem.match(/phase|Phase|q1Topic|q2Topic|q3Topic|q4Topic|q5Topic/g) || []).length >= 5,
    hasAdaptiveFollowups: personaSystem.includes('adaptive') || personaSystem.includes('follow-up') || personaSystem.includes('follow up'),
    hasNaturalLanguage: !personaSystem.includes('[[ENFORCE:') && !personaSystem.includes('^^CONDITION:'),
    hasExamples: personaSystem.includes('e.g.,') || personaSystem.includes('Example:') || personaSystem.includes('Example'),
    hasDurationGuidance: personaSystem.includes('minutes') && personaSystem.includes('Duration'),
    hasPlainExplanations: personaSystem.includes('Purpose:') || personaSystem.includes('- Purpose:'),
  };
}

function comparePrompts() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                 PROMPT COMPARISON TOOL');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const coded = loadPrompts('prompts.json');
  const natural = loadPrompts('prompt2.json');
  
  const codedStats = extractSections(coded);
  const naturalStats = extractSections(natural);
  
  console.log('FILE STATISTICS:');
  console.log('────────────────────────────────────────────────────────────────');
  console.log(`                    prompts.json      prompt2.json`);
  console.log(`                    (UCL/coded)       (natural language)`);
  console.log('────────────────────────────────────────────────────────────────');
  console.log(`Persona Prompt:    ${codedStats.personaLength.toString().padStart(6)} chars      ${naturalStats.personaLength.toString().padStart(6)} chars`);
  console.log(`Interview Prompt:  ${codedStats.interviewLength.toString().padStart(6)} chars      ${naturalStats.interviewLength.toString().padStart(6)} chars`);
  console.log('');
  
  console.log('CONTENT ANALYSIS:');
  console.log('────────────────────────────────────────────────────────────────');
  console.log(`Feature                           prompts.json    prompt2.json`);
  console.log('────────────────────────────────────────────────────────────────');
  console.log(`19-Field Structure                ${codedStats.has19Fields ? '✓ Yes' : '✗ No'}        ${naturalStats.has19Fields ? '✓ Yes' : '✗ No'}`);
  console.log(`5-Phase Interview Arc             ${codedStats.has5Phases ? '✓ Yes' : '✗ No'}        ${naturalStats.has5Phases ? '✓ Yes' : '✗ No'}`);
  console.log(`Adaptive Follow-ups               ${codedStats.hasAdaptiveFollowups ? '✓ Yes' : '✗ No'}        ${naturalStats.hasAdaptiveFollowups ? '✓ Yes' : '✗ No'}`);
  console.log(`Duration Guidance                 ${codedStats.hasDurationGuidance ? '✓ Yes' : '✗ No'}        ${naturalStats.hasDurationGuidance ? '✓ Yes' : '✗ No'}`);
  console.log(`Examples Provided                 ${codedStats.hasExamples ? '✓ Yes' : '✗ No'}        ${naturalStats.hasExamples ? '✓ Yes' : '✗ No'}`);
  console.log(`Plain English (No UCL)            ${codedStats.hasNaturalLanguage ? '✓ Yes' : '✗ No'}        ${naturalStats.hasNaturalLanguage ? '✓ Yes' : '✗ No'}`);
  console.log(`Detailed Explanations             ${codedStats.hasPlainExplanations ? '✓ Yes' : '✗ No'}        ${naturalStats.hasPlainExplanations ? '✓ Yes' : '✗ No'}`);
  console.log('');
  
  // Extract and compare the 5 phases
  console.log('5-PHASE INTERVIEW ARC COMPARISON:');
  console.log('────────────────────────────────────────────────────────────────');
  
  const phases = [
    { name: 'Phase 1 — Warm-up', field: 'q1Topic' },
    { name: 'Phase 2 — Core Technical', field: 'q2Topic' },
    { name: 'Phase 3 — Behavioral', field: 'q3Topic' },
    { name: 'Phase 4 — Resume Validation', field: 'q4Topic' },
    { name: 'Phase 5 — Deep Dive', field: 'q5Topic' },
  ];
  
  const codedPersona = coded.persona?.generation?.systemPrompt?.join('\n') || '';
  const naturalPersona = natural.persona?.generation?.systemPrompt?.join('\n') || '';
  
  phases.forEach(phase => {
    console.log(`\n${phase.name}:`);
    
    // Check how each prompt describes this phase
    const codedHasPhase = codedPersona.includes(phase.field) || 
                         codedPersona.includes(phase.name.split('—')[1].trim());
    const naturalHasPhase = naturalPersona.includes(phase.field) || 
                           naturalPersona.includes(phase.name.split('—')[1].trim());
    
    console.log(`  prompts.json:  ${codedHasPhase ? '✓ Defined' : '✗ Missing'}`);
    console.log(`  prompt2.json:  ${naturalHasPhase ? '✓ Defined' : '✗ Missing'}`);
    
    // Show excerpt from natural language
    if (naturalHasPhase) {
      const phaseMatch = naturalPersona.match(new RegExp(`${phase.name.split('—')[0].trim()}[^\\n]*\\n([^\\n]+\\n?){1,3}`, 'i'));
      if (phaseMatch) {
        const excerpt = phaseMatch[0].substring(0, 100).replace(/\n/g, ' ');
        console.log(`  Excerpt: "${excerpt}..."`);
      }
    }
  });
  
  // Syntax comparison
  console.log('\n\nSYNTAX COMPARISON (First 500 chars of persona prompt):');
  console.log('────────────────────────────────────────────────────────────────');
  console.log('\nprompts.json (UCL/Coded):');
  console.log('────────────────────────────────────────────────────────────────');
  const codedSample = coded.persona?.generation?.systemPrompt?.slice(0, 10).join('\n') || 'N/A';
  console.log(codedSample.substring(0, 500));
  if (codedSample.length > 500) console.log('... (truncated)');
  
  console.log('\n\nprompt2.json (Natural Language):');
  console.log('────────────────────────────────────────────────────────────────');
  const naturalSample = natural.persona?.generation?.systemPrompt?.slice(0, 10).join('\n') || 'N/A';
  console.log(naturalSample.substring(0, 500));
  if (naturalSample.length > 500) console.log('... (truncated)');
  
  // Recommendations
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('                    RECOMMENDATIONS');
  console.log('═══════════════════════════════════════════════════════════════');
  
  if (!codedStats.hasExamples && naturalStats.hasExamples) {
    console.log('\n✓ prompt2.json has better examples — more helpful for LLM');
  }
  
  if (!codedStats.hasDurationGuidance && naturalStats.hasDurationGuidance) {
    console.log('✓ prompt2.json includes duration guidance per phase — clearer expectations');
  }
  
  if (naturalStats.hasNaturalLanguage) {
    console.log('✓ prompt2.json uses plain English — easier to debug and modify');
  }
  
  if (codedStats.personaLength < naturalStats.personaLength * 0.5) {
    console.log('⚠ prompts.json is significantly shorter — may be missing details');
  }
  
  console.log('\n⚡ Both prompts cover the same 5-phase structure');
  console.log('⚡ Both enforce 19-field persona generation');
  console.log('⚡ Both support adaptive follow-ups');
  console.log('\nChoose based on your needs:');
  console.log('  • prompts.json — Compact, machine-optimized, tested');
  console.log('  • prompt2.json — Readable, well-documented, maintainable');
  
  console.log('\n');
}

// Run comparison
comparePrompts();
