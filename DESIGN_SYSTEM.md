# Interviewer Design System
## Premium Spacing & Layout Guidelines

---

## 🎯 Design Philosophy

**"Bold Generosity"** - Every element deserves space to breathe. We embrace generous whitespace, oversized touch targets, and editorial-scale typography to create a premium, awe-inspiring experience.

### Core Principles

1. **Full Screen Utilization** - Use the entire viewport. No cramped cards.
2. **3x Rule** - When you think spacing is enough, triple it.
3. **Oversized Typography** - Headlines should command attention (text-4xl to text-6xl)
4. **Generous Touch Targets** - Buttons minimum h-16 (64px), ideally h-20 (80px)
5. **Editorial Layouts** - Think magazine spreads, not dashboards

---

## 📏 Spacing Scale

### Outer Spacing (Margins & Page Padding)

| Token | Class | Pixels | Usage |
|-------|-------|--------|-------|
| `px-16` | px-16 | 64px | Page-level horizontal padding |
| `py-12` | py-12 | 48px | Page-level vertical padding |
| `mb-20` | mb-20 | 80px | Major section separation |
| `mb-16` | mb-16 | 64px | Hero to content transition |
| `mb-12` | mb-12 | 48px | Section to content |
| `gap-12` | gap-12 | 48px | Major element groups |
| `gap-8` | gap-8 | 32px | Standard element separation |

### Inner Spacing (Container Padding)

| Token | Class | Pixels | Usage |
|-------|-------|--------|-------|
| `p-10` | p-10 | 40px | Card/container interior |
| `p-12` | p-12 | 48px | Premium card interior |
| `px-8` | px-8 | 32px | Input/button horizontal |
| `py-5` | py-5 | 20px | Input/button vertical |

### Component Gaps

| Context | Gap Class | Pixels |
|---------|-----------|--------|
| Form fields | `gap-8` | 32px |
| Label to input | `mb-4` | 16px |
| Button groups | `gap-4` | 16px |
| Icon to text | `gap-5` | 20px |
| Steps/process | `gap-5` | 20px |

---

## 📐 Typography Scale

### Headlines

| Level | Class | Line-Height | Usage |
|-------|-------|-------------|-------|
| Hero | `text-6xl` | tight | Main page titles |
| Page Title | `text-4xl` | tight | Primary section headers |
| Section | `text-2xl` | tight | Major sections |
| Subsection | `text-xl` | normal | Minor sections |

### Body Text

| Level | Class | Usage |
|-------|-------|-------|
| Large | `text-lg` | Hero subtitles, important context |
| Base | `text-base` | Primary reading text |
| Small | `text-sm` | Secondary text, captions |
| XS | `text-xs` | Labels, metadata |

### Font Weights

- **Bold/Semibold**: `font-bold`, `font-semibold` - Headlines, CTAs
- **Medium**: `font-medium` - Interactive elements, emphasis
- **Regular/Light**: `font-light` - Body text, subtitles

### Letter Spacing

- **Tight**: `tracking-tight` - Headlines (text-xl and above)
- **Wide**: `tracking-wider` - Labels, uppercase text
- **Widest**: `tracking-widest` - Uppercase labels only

---

## 🎨 Component Specifications

### Buttons

```tsx
// Primary CTA - Large
className="h-16 px-12 rounded-full font-semibold text-lg tracking-wide"

// Primary CTA - Medium
className="px-8 py-5 rounded-2xl font-semibold text-base"

// Secondary
className="px-8 py-5 border border-gray-200/60 rounded-2xl"
```

### Inputs

```tsx
className="w-full px-8 py-5 rounded-2xl text-base"
// Label: mb-4 (16px)
```

### Cards

```tsx
className="rounded-3xl p-10 shadow-sm"
// Border: border-gray-200/60 dark:border-white/[0.08]
```

### Upload Buttons

```tsx
className="w-72 h-32 rounded-3xl border-2 border-dashed"
// Icon container: w-14 h-14 rounded-2xl
```

---

## 📱 Layout Patterns

### Centered Hero Layout

```tsx
<div className="flex-1 flex flex-col items-center justify-center px-16">
  <div className="flex flex-col items-center mb-20">
    {/* Hero content */}
  </div>
  <div className="flex items-center gap-12 mb-16">
    {/* Action elements */}
  </div>
</div>
```

### Split Panel Layout

```tsx
<div className="h-screen flex">
  {/* Left panel - Content */}
  <div className="flex-1 p-12 flex items-center justify-center">
    {/* Main content */}
  </div>

  {/* Right panel - Sidebar */}
  <aside className="w-[600px] border-l p-10">
    {/* Sidebar content */}
  </aside>
</div>
```

### Centered Form Layout

```tsx
<div className="flex-1 flex flex-col items-center justify-center px-16 py-12">
  <div className="flex flex-col items-center mb-16">
    <h1 className="text-4xl font-bold mb-3">Title</h1>
    <p className="text-base text-gray-500">Subtitle</p>
  </div>
  <div className="w-full max-w-5xl">
    {/* Form content */}
  </div>
</div>
```

---

## ✅ Checklist for Page Overhauls

### Spacing
- [ ] Page padding is `px-16` minimum
- [ ] Section margins are `mb-12` or `mb-16`
- [ ] Card padding is `p-10` or `p-12`
- [ ] Form field gaps are `gap-8`
- [ ] Label margins are `mb-4`

### Typography
- [ ] Page titles are `text-4xl` or larger
- [ ] Section titles are `text-2xl` or `text-xl`
- [ ] Body text is `text-base`
- [ ] Labels are `text-xs` with `tracking-wider`

### Components
- [ ] Primary buttons are `h-16` or `px-8 py-5`
- [ ] Inputs are `px-8 py-5` with `text-base`
- [ ] Cards are `rounded-3xl` with `p-10`
- [ ] Icons are sized proportionally (18-28px)

### Overall Feel
- [ ] Uses full screen width/height
- [ ] Content is centered with generous whitespace
- [ ] No cramped or condensed sections
- [ ] Premium, editorial aesthetic achieved

---

## 📋 Page Status Tracker

| Page | Status | Notes |
|------|--------|-------|
| Landing.tsx | ✅ Complete | Full hero redesign, spacious form |
| Preparing.tsx | 🔄 In Progress | Need wider sidebar, larger steps |
| Dashboard.tsx | ⏳ Pending | |
| Interview.tsx | ⏳ Pending | |
| Feedback.tsx | ⏳ Pending | |
| InterviewHistory.tsx | ⏳ Pending | |
| Jobs.tsx | ⏳ Pending | |
| Settings.tsx | ⏳ Pending | |

---

## 🔧 Quick Reference

**Before (WRONG):**
```tsx
className="p-4 mb-4 gap-2 text-sm"
```

**After (RIGHT):**
```tsx
className="p-10 mb-12 gap-8 text-base"
```

**Rule of thumb:**
- If it looks "big enough" → make it 50% bigger
- If text feels "readable" → increase font-size one level
- If spacing feels "generous" → add one more increment

---

*Last updated: 2026-03-14*
*Version: 1.0 - Premium Spacing Overhaul*
