# Lemonade Design System - UI/UX Standards

**Version:** 1.0  
**Last Updated:** February 17, 2026  
**Status:** Active

## Overview

This document defines the UI/UX standards for the Lemonade Interviewer application. These standards ensure visual consistency, professional polish, and optimal user experience across all components.

## Core Principles

1. **Consistency** - Use standardized patterns across all components
2. **Clarity** - Visual hierarchy guides user attention
3. **Accessibility** - High contrast ratios and readable typography
4. **Polish** - Attention to spacing, rounding, and transitions
5. **Brand** - Lemonade accent color (#FFD23F) as primary interaction color

---

## 1. Border Radius Standards

Border radius creates visual hierarchy and defines interactive boundaries. Use consistently across components.

### Hierarchy

```css
rounded-xl    → Main content areas (cards, panels, modals)
rounded-lg    → Interactive elements (buttons, inputs, small cards)
rounded-full  → Badges, pills, avatars, progress indicators
```

### Usage Guidelines

#### ✅ DO

```tsx
// Main content containers
<div className="rounded-xl border border-gray-200/50 dark:border-white/[0.08]">
  {/* Content */}
</div>

// Interactive buttons and cards
<button className="rounded-lg px-4 py-3 hover:bg-gray-50">
  Click me
</button>

// Badges and status indicators
<span className="rounded-full px-2 py-0.5 bg-green-100">
  Ready
</span>
```

#### ❌ DON'T

```tsx
// Don't use rounded-2xl (too large, inconsistent)
<div className="rounded-2xl">...</div>

// Don't use arbitrary values
<div className="rounded-[18px]">...</div>

// Don't mix rounding on similar elements
<button className="rounded-xl">Save</button>
<button className="rounded-lg">Cancel</button>  // ❌ Inconsistent
```

### Decision Rationale

- **rounded-xl (0.75rem)**: Large enough for prominent containers, not excessive
- **rounded-lg (0.5rem)**: Softer than sharp corners, professional appearance
- **rounded-full**: Clear affordance for non-critical informational elements

---

## 2. Spacing System

Consistent spacing creates visual rhythm and improves scannability.

### Container Padding Standards

```css
px-6  → Standard horizontal padding for all containers
py-3  → Header/footer vertical padding
py-4  → Content section vertical padding
```

### Element Spacing

```css
gap-3     → Standard spacing between related elements
space-y-4 → Vertical spacing between sections
mt-0.5    → Tight spacing for subtitles/captions
mb-5      → Medium spacing before major sections
```

### Usage Guidelines

#### ✅ DO

```tsx
// Consistent container padding
<div className="px-6 py-4">
  <h2 className="text-xs font-semibold uppercase tracking-wider mb-3">
    Section Title
  </h2>
  <div className="space-y-4">
    {/* Content with consistent vertical spacing */}
  </div>
</div>

// Consistent element gaps
<div className="flex items-center gap-3">
  <Icon size={16} />
  <span>Label</span>
</div>
```

#### ❌ DON'T

```tsx
// Don't mix padding values for similar containers
<div className="px-5 py-4">...</div>  // ❌ Use px-6
<div className="px-6 py-3">...</div>  // Different purpose, inconsistent

// Don't use arbitrary spacing
<div className="space-y-5">...</div>  // ❌ Use space-y-4
<div className="space-y-3">...</div>
```

### Decision Rationale

- **px-6**: Provides comfortable margins without wasting space
- **gap-3 (0.75rem)**: Goldilocks spacing - not cramped, not excessive
- **space-y-4**: Creates clear section separation while maintaining flow

---

## 3. Typography Standards

Typography creates hierarchy and ensures readability.

### Text Size Scale

```css
text-sm       → Body text, paragraph content (14px)
text-xs       → Secondary text, labels, captions (12px)
text-base     → Emphasized body text (16px)
```

### Font Weight Patterns

```css
font-semibold → Headings, important labels
font-medium   → Secondary labels, button text
font-normal   → Body text, descriptions
```

### Usage Guidelines

#### ✅ DO

```tsx
// Clear hierarchy
<div>
  <h1 className="text-sm font-semibold">Primary Heading</h1>
  <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">
    Secondary description
  </p>
</div>

// Consistent labeling
<label className="text-xs font-medium text-gray-500 dark:text-white/40">
  Field Label
</label>

// Section headers
<h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/30">
  Section Title
</h2>
```

#### ❌ DON'T

```tsx
// Don't use arbitrary text sizes
<p className="text-[11px]">...</p>  // ❌ Use text-xs

// Don't over-emphasize
<p className="text-lg font-bold">Normal paragraph</p>  // ❌ Too heavy

// Don't under-emphasize headings
<h2 className="text-xs font-normal">Section Title</h2>  // ❌ Too light
```

### Decision Rationale

- **text-xs over text-[11px]**: Semantic sizing from Tailwind scale
- **Uppercase section headers**: Clear visual separation, industry standard
- **tracking-wider on uppercase**: Improves readability of all-caps text

---

## 4. Dark Mode Color Standards

Consistent opacity values ensure proper contrast and visual hierarchy in dark mode.

### Color Palette

```css
// Surfaces
bg-lemonade-bg           → Light mode background
dark:bg-lemonade-dark-bg → Dark mode background

// Interactive surfaces
dark:bg-white/[0.04]     → Resting state (cards, inputs)
dark:bg-white/[0.08]     → Hover state

// Borders
dark:border-white/[0.08] → Standard borders (consistent with hover state)

// Text
dark:text-white          → Primary text
dark:text-white/60       → Secondary text
dark:text-white/40       → Tertiary text (labels, captions)
dark:text-white/30       → Disabled/subtle text
```

### Usage Guidelines

#### ✅ DO

```tsx
// Standard card with proper hierarchy
<div className="bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.08] rounded-lg p-4">
  <h3 className="text-sm font-semibold">Card Title</h3>
  <p className="text-xs text-gray-500 dark:text-white/40 mt-1">
    Description text
  </p>
</div>

// Hover states
<button className="bg-gray-100 dark:bg-white/[0.04] hover:bg-gray-200 dark:hover:bg-white/[0.08] rounded-lg px-4 py-2 transition-colors">
  Click me
</button>
```

#### ❌ DON'T

```tsx
// Don't use inconsistent opacity values
<div className="dark:bg-white/[0.03]">...</div>  // ❌ Use [0.04]
<div className="dark:bg-white/5">...</div>       // ❌ Use [0.08] for hover

// Don't use border-white/5 (too subtle)
<div className="dark:border-white/5">...</div>   // ❌ Use [0.08]

// Don't mix opacity patterns
<div className="dark:bg-white/[0.04] dark:border-white/5">  // ❌ Inconsistent
```

### Decision Rationale

- **white/[0.04]**: Subtle but visible surface elevation
- **white/[0.08]**: Clear hover feedback, doubles the resting state
- **Consistent border opacity**: Matches hover state for visual coherence

---

## 5. Icon Sizing Standards

Consistent icon sizes create visual harmony and proper hierarchy.

### Size Standards

```tsx
size={16}  → Standard UI icons (navigation, small badges)
size={20}  → Feature icons (primary actions, loading states)
size={14}  → Inline icons (step indicators, tight spaces)
size={48}  → Large placeholder icons (empty states)
```

### Usage Guidelines

#### ✅ DO

```tsx
// Navigation and UI controls
<button className="p-2 rounded-lg">
  <ChevronLeft size={16} />
</button>

// Feature presentation
<div className="w-12 h-12 rounded-lg bg-lemonade-accent/10 flex items-center justify-center">
  <Download size={20} className="text-lemonade-accent-hover" />
</div>

// Inline with text
<span className="inline-flex items-center gap-2">
  <Star size={10} />
  Suggested
</span>
```

#### ❌ DON'T

```tsx
// Don't use arbitrary sizes
<Icon size={13} />  // ❌ Use 14
<Icon size={22} />  // ❌ Use 20

// Don't use oversized icons for UI
<button>
  <Icon size={24} />  // ❌ Too large for button
</button>

// Don't mix sizes for similar elements
<Check size={14} />  // ✓ In one place
<Check size={13} />  // ❌ In another place (inconsistent)
```

### Decision Rationale

- **16px**: Standard click target with 2px padding = 20px (WCAG minimum)
- **20px**: Visually prominent without overwhelming
- **Even numbers**: Aligns with design grid, renders sharper

---

## 6. Component Patterns

### Badges and Pills

```tsx
// Status badge
<span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 rounded-full font-medium">
  <Icon size={10} />
  Ready
</span>

// Info badge
<span className="text-xs px-2 py-0.5 border border-gray-200/50 dark:border-white/[0.08] rounded-full text-gray-500 dark:text-white/40">
  Label
</span>
```

### Interactive Cards

```tsx
<button
  className={`
    w-full text-left px-4 py-3 rounded-lg border transition-all duration-200
    ${selected 
      ? 'border-lemonade-accent bg-lemonade-accent/[0.06]' 
      : 'border-gray-200/50 dark:border-white/[0.08] bg-lemonade-bg dark:bg-white/[0.04] hover:border-gray-300 dark:hover:border-white/[0.12] hover:bg-gray-50 dark:hover:bg-white/[0.06]'
    }
  `}
>
  {/* Content */}
</button>
```

### Section Headers

```tsx
<h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/30 mb-3">
  Section Title
</h2>
```

### Dividers

```tsx
<div className="border-t border-gray-200/50 dark:border-white/[0.08]" />
```

---

## 7. Accessibility Standards

### Contrast Ratios

- **Primary text**: Minimum 4.5:1 contrast ratio
- **Secondary text**: Minimum 3:1 contrast ratio
- **Interactive elements**: Clear visual distinction

### Touch Targets

- **Minimum size**: 44x44px for touch interfaces
- **Spacing**: Minimum 8px between interactive elements

### Focus States

```tsx
// Always include focus states for keyboard navigation
<button className="focus:ring-2 focus:ring-lemonade-accent focus:ring-offset-2">
  Button
</button>
```

---

## 8. Transition Standards

### Duration

```css
duration-200  → Quick interactions (hover, focus)
duration-300  → Medium transitions (theme switching, page transitions)
duration-500  → Slow transitions (complex animations)
```

### Easing

```css
ease-out      → Natural deceleration
ease-in-out   → Smooth start and end
```

---

## 9. Lemonade Brand Colors

### Primary Accent

```css
lemonade-accent       → #FFD23F (Primary yellow)
lemonade-accent-hover → #FFC107 (Hover state, darker yellow)
```

### Usage

- **Primary actions**: Buttons, selected states
- **Emphasis**: Highlighted information, active indicators
- **Brand moments**: Loading states, success feedback

```tsx
// Primary button
<button className="bg-lemonade-accent hover:bg-lemonade-accent-hover text-black font-semibold rounded-lg px-4 py-2 transition-colors">
  Start Interview
</button>
```

---

## 10. Implementation Checklist

When creating or updating components, verify:

- [ ] Border radius follows hierarchy (xl → lg → full)
- [ ] Padding uses px-6 for containers
- [ ] Text sizes use semantic scale (no arbitrary values)
- [ ] Dark mode uses consistent opacity values
- [ ] Icons use standard sizes (16, 20, 14)
- [ ] Hover states have clear visual feedback
- [ ] Spacing between elements uses gap-3 or space-y-4
- [ ] Color contrast meets accessibility standards
- [ ] Transitions use standard durations

---

## 11. Common Mistakes to Avoid

### ❌ Incorrect

```tsx
// Mixed border radius
<div className="rounded-2xl">...</div>

// Arbitrary text size
<p className="text-[11px]">...</p>

// Inconsistent padding
<div className="px-5 py-3">...</div>

// Wrong dark mode opacity
<div className="dark:bg-white/[0.03]">...</div>

// Arbitrary icon size
<Icon size={13} />
```

### ✅ Correct

```tsx
// Consistent border radius
<div className="rounded-xl">...</div>

// Semantic text size
<p className="text-xs">...</p>

// Standard padding
<div className="px-6 py-4">...</div>

// Correct dark mode opacity
<div className="dark:bg-white/[0.04]">...</div>

// Standard icon size
<Icon size={14} />
```

---

## 12. Example: Complete Component

Here's a complete example demonstrating all standards:

```tsx
<div className="w-[400px] border-l border-gray-200/50 dark:border-white/[0.08] bg-lemonade-bg dark:bg-lemonade-dark-surface flex flex-col">
  {/* Header */}
  <div className="px-6 py-3 border-b border-gray-200/50 dark:border-white/[0.08]">
    <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/30">
      Choose a Model
    </h2>
    <p className="text-xs text-gray-500 dark:text-white/40 mt-1 leading-relaxed">
      Select your AI model
    </p>
  </div>

  {/* Content */}
  <div className="flex-1 overflow-y-auto px-6 py-4">
    <div className="space-y-3">
      {/* Interactive card */}
      <button className="w-full text-left px-4 py-3 rounded-lg border border-gray-200/50 dark:border-white/[0.08] bg-lemonade-bg dark:bg-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-white/20" />
          <div className="flex-1">
            <p className="text-xs font-semibold">Model Name</p>
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 rounded-full font-medium mt-1">
              <HardDrive size={10} />
              Ready
            </span>
          </div>
        </div>
      </button>
    </div>
  </div>

  {/* Action bar */}
  <div className="px-6 py-4 border-t border-gray-200/50 dark:border-white/[0.08]">
    <button className="w-full flex items-center justify-center gap-2 py-3 bg-lemonade-accent text-black font-semibold text-sm rounded-lg hover:bg-lemonade-accent-hover transition-colors active:scale-[0.98]">
      <ArrowRight size={16} />
      Continue
    </button>
  </div>
</div>
```

---

## 13. When to Deviate

These standards should be followed in 95% of cases. Acceptable deviations:

1. **Unique brand moments**: Landing page hero sections
2. **Complex data visualization**: Charts, graphs requiring custom styling
3. **Third-party component constraints**: When library doesn't support standards
4. **Performance optimization**: Rare cases where standards impact performance

**Always document deviations** and provide rationale in code comments.

---

## 14. Maintenance

This design system should be reviewed and updated:

- After major UI refactors
- When new patterns emerge repeatedly
- When accessibility standards change
- When brand guidelines update

**Last Review:** February 17, 2026  
**Next Review:** Quarterly or as needed

---

## Questions?

For clarification or to propose changes to these standards, open a discussion in the project repository with the `design-system` label.
