/**
 * designTokens.ts
 *
 * All values extracted directly from ProfileCard.tsx.
 * No new values introduced — every token traces back to a
 * ProfileCard style rule. Import this instead of hard-coding.
 *
 * ProfileCard source references are noted inline.
 */

// ─── Surface colours ──────────────────────────────────────────────────────
// card.backgroundColor → '#0E1520'
export const BG_CARD        = '#0E1520';
// leftPanel.backgroundColor → '#111927'
export const BG_PANEL       = '#111927';
// avatar.backgroundColor → '#1E2D42'
export const BG_AVATAR      = '#1E2D42';
// settingsBtn.backgroundColor → 'rgba(255,255,255,0.05)'
export const BG_SUBTLE      = 'rgba(255,255,255,0.05)';
// logoutBtn.backgroundColor → 'rgba(224,112,112,0.07)'
export const BG_DANGER_SUBTLE = 'rgba(224,112,112,0.07)';

// ─── Border colours ───────────────────────────────────────────────────────
// card.borderColor → 'rgba(255,255,255,0.07)'
export const BORDER_DEFAULT  = 'rgba(255,255,255,0.07)';
// settingsBtn.borderColor → 'rgba(255,255,255,0.08)'
export const BORDER_SUBTLE   = 'rgba(255,255,255,0.08)';
// logoutBtn.borderColor → 'rgba(224,112,112,0.2)'
export const BORDER_DANGER   = 'rgba(224,112,112,0.2)';
// avatar.borderColor → 'rgba(201,169,110,0.4)'
export const BORDER_GOLD     = 'rgba(201,169,110,0.4)';

// ─── Text colours ─────────────────────────────────────────────────────────
// name.color → '#FFFFFF'
export const TEXT_PRIMARY    = '#FFFFFF';
// locationText.color → '#8A9BB0'
export const TEXT_MUTED      = '#8A9BB0';
// email.color → 'rgba(255,255,255,0.38)'
export const TEXT_FAINT      = 'rgba(255,255,255,0.38)';
// statLbl.color → 'rgba(255,255,255,0.35)'
export const TEXT_FAINT_ALT  = 'rgba(255,255,255,0.35)';
// progressLabel.color → 'rgba(255,255,255,0.28)'
export const TEXT_FAINTEST   = 'rgba(255,255,255,0.28)';
// settingsBtnText.color → 'rgba(255,255,255,0.7)'
export const TEXT_SECONDARY  = 'rgba(255,255,255,0.7)';
// logoutBtnText.color → '#E07070'
export const TEXT_DANGER     = '#E07070';
// avatarInitials.color + progressFill.backgroundColor → '#C9A96E'
export const ACCENT_GOLD     = '#C9A96E';
// summitedTag.color → '#6FAF8A'
export const ACCENT_GREEN    = '#6FAF8A';
// cardTitle.color (TrailMap) → '#76FF03'
export const ACCENT_TRAIL    = '#76FF03';

// ─── Shape ────────────────────────────────────────────────────────────────
// card.borderRadius → 16
export const RADIUS_CARD     = 16;
// settingsBtn / logoutBtn / closeBtn → 8 / 11
export const RADIUS_BTN      = 8;
export const RADIUS_PILL     = 11;

// ─── Typography ───────────────────────────────────────────────────────────
// name → 13/700 | email → 10 | locationText → 10 | statNum → 16/700
// statLbl → 9/upper | listTitle → 10/600/upper | mountainName → 12/500
export const FONT = {
  nameSize:     13,
  namWeight:   '700' as const,
  emailSize:    10,
  locationSize: 10,
  statNumSize:  16,
  statLblSize:   9,
  listTitleSize: 10,
  itemSize:     12,
  itemWeight:  '500' as const,
  tagSize:       9,
} as const;

// ─── Spacing (from padding values in ProfileCard) ─────────────────────────
export const SPACING = {
  cardPadH:  16,
  cardPadT:  16,
  cardPadB:  14,
  gap:        8,
  gapLg:     12,
} as const;

// ─── Animation (derived — matches 800ms ease-out-cubic requirement) ────────
// ProfileCard uses animationType="fade" → we honour that with CSS opacity
export const ANIM = {
  zoomMs:      800,
  zoomEasing:  'cubic-bezier(0.33, 1, 0.58, 1)',   // ease-out-cubic
  fadeMs:      300,
  fadeEasing:  'ease-out',
  imageDelayRatio: 0.6,   // fade image in at 60% of zoom (480ms)
  modalDelayMs:   2000,   // modal opens 2s after zoom completes
} as const;