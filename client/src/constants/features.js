/**
 * Feature phases and Pro feature gating
 * Phase 1: Easy (free) | Phase 2: Medium (free) | Phase 3: Pro (real-money subscription)
 */

export const PHASE_1 = {
  typingIndicator: true,
  conversationTimer: true,
  quickReactions: true,
};

export const PHASE_2 = {
  voiceMessages: false, // TODO: implement
  conversationRating: true,
  smartMatching: false, // TODO: implement
};

/** Phase 3 – Pro features (require paid Pro subscription) */
export const PHASE_3_PRO = {
  aiMoodDetection: true,
  reconnectToken: true,
  miniChatGames: true,
};

/** Check if user has Pro access (paid subscription) */
export function isProUser(user) {
  return user?.isPro === true || user?.subscription === 'pro';
}
