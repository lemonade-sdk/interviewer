#!/usr/bin/env node

/**
 * Quick Persona Test CLI
 * 
 * Test persona generation without the full app.
 * Reads job description and resume from files or stdin.
 * 
 * Usage:
 *   node src/test/test-persona.js --job job.txt --resume resume.txt
 *   cat job.txt | node src/test/test-persona.js --resume resume.txt
 *   node src/test/test-persona.js --natural (uses prompt2.json)
 */

const fs = require('fs');
const path = require('path');

// Simple argument parsing
const args = process.argv.slice(2);
const flags = {
  job: getArg('--job', '-j'),
  resume: getArg('--resume', '-r'),
  natural: args.includes('--natural') || args.includes('-n'),
  output: getArg('--output', '-o') || 'json',
  help: args.includes('--help') || args.includes('-h'),
};

function getArg(long, short) {
  const idx = args.findIndex(a => a === long || a === short);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

function showHelp() {
  console.log(`
Quick Persona Test CLI
======================

Test persona generation without running the full Electron app.

Usage:
  node src/test/test-persona.js --job job.txt --resume resume.txt
  node src/test/test-persona.js --job job.txt --resume resume.txt --natural
  node src/test/test-persona.js --job job.txt --resume resume.txt --output pretty

Options:
  --job, -j <file>      Path to job description file (txt, md, pdf text)
  --resume, -r <file>   Path to resume file (txt, md, pdf text)
  --natural, -n         Use natural language prompts (prompt2.json)
  --output, -o <format>  Output format: json (default), pretty, or minimal
  --help, -h            Show this help

Environment Variables:
  LEMONADE_API_URL      Server URL (default: http://localhost:8000)
  LEMONADE_API_KEY      API key if required

Examples:
  # Test with files
  node src/test/test-persona.js --job ./examples/stripe-job.txt --resume ./examples/john-resume.txt

  # Test with natural language prompts
  node src/test/test-persona.js --job job.txt --resume resume.txt --natural

  # Pretty print output
  node src/test/test-persona.js --job job.txt --resume resume.txt --output pretty
`);
  process.exit(0);
}

if (flags.help) {
  showHelp();
}

// Load prompts
const promptFile = flags.natural ? 'prompt2.json' : 'prompts.json';
const promptPath = path.join(__dirname, '..', 'data', promptFile);

if (!fs.existsSync(promptPath)) {
  console.error(`Error: Prompt file not found: ${promptPath}`);
  process.exit(1);
}

const prompts = JSON.parse(fs.readFileSync(promptPath, 'utf-8'));
console.log(`Loaded ${flags.natural ? 'natural language' : 'UCL/coded'} prompts from ${promptFile}\n`);

// Read input files
let jobDescription = '';
let resumeText = '';

if (flags.job) {
  if (!fs.existsSync(flags.job)) {
    console.error(`Error: Job file not found: ${flags.job}`);
    process.exit(1);
  }
  jobDescription = fs.readFileSync(flags.job, 'utf-8');
  console.log(`✓ Loaded job description from ${flags.job} (${jobDescription.length} chars)`);
}

if (flags.resume) {
  if (!fs.existsSync(flags.resume)) {
    console.error(`Error: Resume file not found: ${flags.resume}`);
    process.exit(1);
  }
  resumeText = fs.readFileSync(flags.resume, 'utf-8');
  console.log(`✓ Loaded resume from ${flags.resume} (${resumeText.length} chars)`);
}

// If missing inputs, show interactive prompt
if (!jobDescription || !resumeText) {
  console.log('\n⚠ Missing required inputs.');
  console.log('Use --job and --resume flags, or provide example files.\n');
  
  // Create example mock data for testing
  console.log('Using example mock data for demonstration...\n');
  
  jobDescription = `Senior Frontend Engineer at Stripe

We are looking for an experienced frontend engineer to build scalable payment interfaces.

Responsibilities:
- Build and maintain React-based payment components
- Lead TypeScript migration initiatives
- Optimize performance for high-traffic checkout flows
- Mentor junior engineers

Requirements:
- 5+ years experience with React and TypeScript
- Experience with design systems and component libraries
- Strong understanding of web performance optimization
- Experience with payment processing or fintech preferred
- Leadership experience a plus`;

  resumeText = `Jane Doe - Senior Frontend Engineer

Experience:
- 6 years at TechFirm building React applications
- Led TypeScript migration for 50+ component library
- Improved checkout performance by 45%
- Mentored 3 junior engineers
- Built design system used across 3 products

Skills:
- React, TypeScript, Next.js
- Performance optimization, Webpack, CSS-in-JS
- Testing: Jest, React Testing Library
- Payment integration experience with Stripe API`;
}

// Extract company and position from job description
const companyMatch = jobDescription.match(/^([A-Z][A-Za-z\s]+?)\s*(?:is hiring|hiring|looking|seeks)/m) ||
                     jobDescription.match(/at\s+([A-Z][A-Z\-a-z]+)/) ||
                     jobDescription.match(/([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)?)(?:\s+is|\s*\n)/);
const positionMatch = jobDescription.match(/^(Senior|Staff|Principal|Lead|Junior)?\s*(Software|Frontend|Backend|Full-?stack|Engineering|DevOps|ML|Data)\s*(Engineer|Developer|Manager|Architect)/im) ||
                      jobDescription.match(/(Engineer|Developer|Manager)\s*\n/i);

const company = companyMatch ? companyMatch[1].trim() : 'TechCorp';
const position = positionMatch ? positionMatch[0].trim() : 'Software Engineer';

console.log(`\nDetected: ${position} at ${company}\n`);

// Build user prompt
const userPrompt = prompts.persona.generation.userPrompt
  .join('\n')
  .replace('${company}', company)
  .replace('${position}', position)
  .replace('${interviewType}', 'technical')
  .replace('${numberOfQuestions}', '5 phases')
  .replace('${jobDescription}', jobDescription.substring(0, 2000))
  .replace('${resume}', resumeText.substring(0, 2000));

// Display system prompt excerpt
const systemPrompt = prompts.persona.generation.systemPrompt.join('\n');

if (flags.output === 'pretty') {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    SYSTEM PROMPT EXCERPT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(systemPrompt.substring(0, 1500));
  console.log('... (truncated)\n');
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    USER PROMPT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(userPrompt);
  console.log('\n');
}

// Generate mock persona (in real use, this would call Lemonade API)
console.log('═══════════════════════════════════════════════════════════════');
console.log('                    GENERATED PERSONA');
console.log('═══════════════════════════════════════════════════════════════');

const mockPersona = {
  personaName: "Sarah Chen",
  personaRole: `Engineering Manager at ${company}, 8 years building payment systems`,
  gender: "female",
  interviewStyle: "challenging",
  questionDifficulty: "medium",
  primaryProbeArea: `Frontend architecture and technical leadership for ${position}`,
  mustCoverTopic1: "TypeScript and large-scale component architecture",
  mustCoverTopic2: "Performance optimization for high-traffic applications",
  mustCoverTopic3: "Technical mentorship and team leadership",
  validateClaim1: "Led TypeScript migration for 50+ components — probe for actual leadership vs. execution",
  validateClaim2: "Improved checkout performance by 45% — ask for specific metrics and measurement methodology",
  watchSignal1: "Level of ownership vs. credit-sharing in team accomplishments",
  watchSignal2: "Depth of performance optimization knowledge vs. surface-level familiarity",
  q1Topic: `Tell me about your background and what drew you to frontend infrastructure roles at companies like ${company}. This is a baseline question — calibrate your follow-up depth based on how clearly they communicate their experience. If vague, probe deeper in subsequent phases; if strong, proceed with full planned depth.`,
  q2Topic: `Describe your TypeScript migration initiative. What was the scale? What architectural decisions did you make? [Probe 2-4 times]: Why did you choose that approach? What alternatives did you consider? How did you measure success? What would you do differently? Follow their answers — if they give depth, go deeper; if shallow, probe until you hit bedrock or they admit limits.`,
  q3Topic: `Tell me about a time you had to advocate for technical quality (like the TypeScript migration) when product or leadership wanted speed. Use STAR structure. [Probe 2-3 times]: What was your specific contribution? What was the measurable outcome? What resistance did you face and how did you handle it? Look for genuine ownership, not just participation.`,
  q4Topic: `You mention leading a team and improving performance by 45% — let's validate those claims. Walk me through a specific decision you made on the TypeScript migration. What was your exact role versus the team's? What specific metrics proved the 45% improvement? [Challenge vague answers]: What was the baseline? How did you measure? What would you do differently? Probe until you have specifics or they acknowledge exaggeration.`,
  q5Topic: `How would you design a scalable design system for a company like ${company} processing millions of transactions? Walk me through your architecture thinking — component structure, testing strategy, performance considerations. [Let them demonstrate expertise] Then: What questions do you have for me about the team, challenges, or role? Engage genuinely with 1-2 exchanges. Close warmly referencing something specific they mentioned.`,
  jobAnalysis: `This ${position} role at ${company} requires deep React/TypeScript expertise, experience with large-scale frontend architecture, performance optimization skills, and leadership capability. The ideal candidate has led technical initiatives, mentored others, and can balance technical excellence with product delivery.`,
  resumeAnalysis: `Candidate profile shows strong alignment with role requirements. 6 years React experience matches senior level. Led TypeScript migration demonstrates technical leadership. 45% performance improvement claim needs validation — probe for specifics on metrics and measurement. Mentoring experience aligns with team leadership expectations. Payment integration experience is a plus.`,
};

// Output based on format
if (flags.output === 'json') {
  console.log(JSON.stringify(mockPersona, null, 2));
} else if (flags.output === 'minimal') {
  console.log(`Name: ${mockPersona.personaName}`);
  console.log(`Role: ${mockPersona.personaRole}`);
  console.log(`Style: ${mockPersona.interviewStyle} | Difficulty: ${mockPersona.questionDifficulty}`);
  console.log('\n5-Phase Interview Arc:');
  console.log(`  Phase 1: ${mockPersona.q1Topic.substring(0, 80)}...`);
  console.log(`  Phase 2: ${mockPersona.q2Topic.substring(0, 80)}...`);
  console.log(`  Phase 3: ${mockPersona.q3Topic.substring(0, 80)}...`);
  console.log(`  Phase 4: ${mockPersona.q4Topic.substring(0, 80)}...`);
  console.log(`  Phase 5: ${mockPersona.q5Topic.substring(0, 80)}...`);
} else {
  // Pretty format
  console.log(`\n🎭 Persona: ${mockPersona.personaName}`);
  console.log(`   ${mockPersona.personaRole}`);
  console.log(`   Style: ${mockPersona.interviewStyle} | Difficulty: ${mockPersona.questionDifficulty} | Gender: ${mockPersona.gender}`);
  
  console.log(`\n🎯 Primary Focus: ${mockPersona.primaryProbeArea}`);
  
  console.log('\n📋 Must Cover Topics:');
  console.log(`   1. ${mockPersona.mustCoverTopic1}`);
  console.log(`   2. ${mockPersona.mustCoverTopic2}`);
  console.log(`   3. ${mockPersona.mustCoverTopic3}`);
  
  console.log('\n🔍 Resume Validation Targets:');
  console.log(`   1. ${mockPersona.validateClaim1}`);
  console.log(`   2. ${mockPersona.validateClaim2}`);
  
  console.log('\n👁️  Behavioral Signals to Watch:');
  console.log(`   1. ${mockPersona.watchSignal1}`);
  console.log(`   2. ${mockPersona.watchSignal2}`);
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                    5-PHASE INTERVIEW ARC');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const phases = [
    { num: 1, title: 'Warm-up / Baseline', field: 'q1Topic' },
    { num: 2, title: 'Core Technical', field: 'q2Topic' },
    { num: 3, title: 'Behavioral / Leadership', field: 'q3Topic' },
    { num: 4, title: 'Resume Validation', field: 'q4Topic' },
    { num: 5, title: 'Deep Dive / Closing', field: 'q5Topic' },
  ];
  
  phases.forEach(phase => {
    console.log(`\nPhase ${phase.num} — ${phase.title}:`);
    const text = mockPersona[phase.field];
    // Wrap text at 70 chars
    const wrapped = text.match(/.{1,70}(\s|$)|.{1,70}/g) || [text];
    wrapped.forEach(line => console.log(`   ${line.trim()}`));
  });
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                    ANALYSIS SUMMARIES');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\nJob Analysis:');
  const jobWrapped = mockPersona.jobAnalysis.match(/.{1,70}(\s|$)|.{1,70}/g) || [mockPersona.jobAnalysis];
  jobWrapped.forEach(line => console.log(`   ${line.trim()}`));
  
  console.log('\nResume Analysis:');
  const resumeWrapped = mockPersona.resumeAnalysis.match(/.{1,70}(\s|$)|.{1,70}/g) || [mockPersona.resumeAnalysis];
  resumeWrapped.forEach(line => console.log(`   ${line.trim()}`));
}

console.log('\n');

// Show prompt comparison info if natural language
if (flags.natural) {
  console.log('💡 Using natural language prompts (prompt2.json)');
  console.log('   These prompts use plain English instead of coded UCL syntax.');
  console.log('   Compare with: node src/test/test-persona.js --job job.txt --resume resume.txt\n');
}
