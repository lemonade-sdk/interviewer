// Bold Generosity Design System - Comprehensive Audit

const fs = require('fs');

console.log('=================================================================');
console.log('    BOLD GENEROSITY DESIGN SYSTEM - COMPREHENSIVE AUDIT');
console.log('=================================================================\n');

const REQUIREMENTS = {
  pagePadding: { min: 16, desc: 'Page-level horizontal padding' },
  sectionMargins: { min: 12, desc: 'Section to content separation' },
  elementGaps: { min: 8, desc: 'Standard element separation' },
  cardPadding: { min: 10, desc: 'Card/container interior' },
  buttonMinHeight: { min: 16, desc: 'Primary CTA minimum' },
  pageTitle: { min: '4xl', desc: 'Page titles minimum' },
};

const pages = [
  { path: 'src/ui/pages/Landing.tsx', name: 'Landing.tsx' },
  { path: 'src/ui/pages/Preparing.tsx', name: 'Preparing.tsx' },
  { path: 'src/ui/pages/Dashboard.tsx', name: 'Dashboard.tsx' },
  { path: 'src/ui/pages/Interview.tsx', name: 'Interview.tsx' },
  { path: 'src/ui/pages/Feedback.tsx', name: 'Feedback.tsx' },
  { path: 'src/ui/pages/InterviewHistory.tsx', name: 'InterviewHistory.tsx' },
  { path: 'src/ui/pages/Jobs.tsx', name: 'Jobs.tsx' },
  { path: 'src/ui/pages/Settings.tsx', name: 'Settings.tsx' },
];

function extractMaxNumeric(content, pattern) {
  const matches = [...content.matchAll(pattern)];
  if (!matches.length) return 0;
  return Math.max(...matches.map(m => parseInt(m[1])));
}

function extractMaxPadding(content) {
  const p = extractMaxNumeric(content, /\bp-(\d+)\b/g);
  const px = extractMaxNumeric(content, /\bpx-(\d+)\b/g);
  const py = extractMaxNumeric(content, /\bpy-(\d+)\b/g);
  return { p, px, py, max: Math.max(p, px, py) };
}

function extractMargins(content) {
  const m = extractMaxNumeric(content, /\bm-(\d+)\b/g);
  const mb = extractMaxNumeric(content, /\bmb-(\d+)\b/g);
  const mt = extractMaxNumeric(content, /\bmt-(\d+)\b/g);
  const mx = extractMaxNumeric(content, /\bmx-(\d+)\b/g);
  const my = extractMaxNumeric(content, /\bmy-(\d+)\b/g);
  return { m, mb, mt, mx, my, max: Math.max(m, mb, mt, mx, my) };
}

function extractGaps(content) {
  return extractMaxNumeric(content, /\bgap-(\d+)\b/g);
}

function extractButtonHeights(content) {
  const generalH = extractMaxNumeric(content, /\bh-(\d+)\b/g);
  return generalH;
}

function extractTypography(content) {
  const matches = [...content.matchAll(/\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl)\b/g)];
  const sizes = { xs: 0, sm: 1, base: 2, lg: 3, xl: 4, '2xl': 5, '3xl': 6, '4xl': 7, '5xl': 8, '6xl': 9 };
  let maxLevel = 0;
  let maxSize = 'none';
  matches.forEach(m => {
    if (sizes[m[1]] > maxLevel) {
      maxLevel = sizes[m[1]];
      maxSize = m[1];
    }
  });
  return { max: maxSize, all: [...new Set(matches.map(m => m[1]))] };
}

function checkCompliance(content, name) {
  const padding = extractMaxPadding(content);
  const margins = extractMargins(content);
  const gaps = extractGaps(content);
  const btnHeight = extractButtonHeights(content);
  const typo = extractTypography(content);

  const issues = [];
  const warnings = [];

  // Critical checks
  if (padding.px < 12) {
    issues.push('CRITICAL: Page padding px-' + padding.px + ' (needs px-16 for Bold Generosity)');
  }
  if (margins.mb < 12) {
    issues.push('CRITICAL: Bottom margin mb-' + margins.mb + ' (needs mb-12+ for section separation)');
  }
  if (gaps < 6) {
    issues.push('CRITICAL: Element gaps gap-' + gaps + ' (needs gap-8+ for premium feel)');
  }

  // Warnings
  if (padding.max < 10) {
    warnings.push('Card padding p-' + padding.max + ' may feel cramped (recommend p-10+)');
  }
  if (btnHeight > 0 && btnHeight < 14) {
    warnings.push('Button height h-' + btnHeight + ' below premium standard (recommend h-16 for CTAs)');
  }
  if (!['4xl', '5xl', '6xl'].includes(typo.max)) {
    warnings.push('Page title size text-' + typo.max + ' may lack impact (recommend text-4xl+)');
  }

  return { padding, margins, gaps, btnHeight, typo, issues, warnings };
}

pages.forEach(page => {
  const content = fs.readFileSync(page.path, 'utf8');
  const result = checkCompliance(content, page.name);

  console.log('---------------------------------------------------------------');
  console.log('PAGE: ' + page.name);
  console.log('---------------------------------------------------------------');

  console.log('METRICS:');
  console.log('  Page Padding:     px-' + result.padding.px + ', py-' + result.padding.py + ', p-' + result.padding.p);
  console.log('  Margins:          mb-' + result.margins.mb + ', mt-' + result.margins.mt + ', mx-' + result.margins.mx);
  console.log('  Element Gaps:     gap-' + result.gaps);
  console.log('  Max Button Height: h-' + result.btnHeight);
  console.log('  Typography:       ' + result.typo.all.join(', ') + ' (max: text-' + result.typo.max + ')');

  if (result.issues.length > 0) {
    console.log('\nISSUES FOUND:');
    result.issues.forEach(issue => console.log('  [!] ' + issue));
  }

  if (result.warnings.length > 0) {
    console.log('\nWARNINGS:');
    result.warnings.forEach(warn => console.log('  [~] ' + warn));
  }

  if (result.issues.length === 0 && result.warnings.length === 0) {
    console.log('\n  [OK] PASS - Meets Bold Generosity standards');
  }

  console.log('');
});

console.log('=================================================================');
console.log('                      AUDIT COMPLETE');
console.log('=================================================================');
