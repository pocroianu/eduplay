/**
 * Timing Constants for E2E Tests
 *
 * Centralized timing values for Phaser game testing.
 * All values in milliseconds.
 *
 * IMPORTANT: These values are tuned for both local development
 * and CI environments. Adjust with caution and test on CI.
 */

// ============================================
// Scene Loading & Initialization
// ============================================

/**
 * Maximum time to wait for Phaser game to boot
 * Includes: Phaser initialization + scene startup
 */
export const GAME_BOOT_TIMEOUT = 15000;

/**
 * Maximum time to wait for a scene to become active
 * Standard timeout for scene transitions
 */
export const DEFAULT_WAIT_TIMEOUT = 15000;

/**
 * Maximum time to wait for a scene to become active and ready
 * Includes: Scene loading + initial setup
 * More conservative timeout for scene readiness checks
 */
export const SCENE_READY_TIMEOUT = 20000;

/**
 * Maximum time to wait for Results scene
 * Results scene includes game completion transitions and celebrations.
 * CI bump: Docker headless rAF throttling means the Phaser scene tick that
 * processes scene.start('Results') can be delayed well beyond 2 s wall-clock.
 * 60 s gives enough headroom for the setTimeout(startResults, 2000) fallback
 * in Level.onGameComplete() to fire and be processed by the game loop.
 */
export const RESULTS_SCENE_TIMEOUT = process.env.CI ? 60000 : 30000;

/**
 * Standard scene transition duration
 * Used when waiting for transitions between scenes
 * Increased to 3000ms to account for game completion processing
 */
export const SCENE_TRANSITION_DURATION = 3000;

/**
 * Maximum time to wait for loading completion in Level scene
 * Includes config loading and initialization
 */
export const LOADING_COMPLETE_TIMEOUT = 15000;

// ============================================
// Animation & Tween Timing
// ============================================

/**
 * Card entrance animation duration
 * Includes: Staggered delays (300 + index*100) + animation (400ms)
 * Total: ~1500ms for all cards to fully animate in
 */
export const CARD_ENTRANCE_ANIMATION = 1500;

/**
 * Basic animation fallback duration
 * Used for simple animations and transitions
 */
export const BASIC_ANIMATION = 1000;

/**
 * Feedback overlay animation duration (correct/incorrect)
 * Standard feedback display time
 */
export const FEEDBACK_ANIMATION = 2500;

/**
 * Extended feedback animation (with follow-up effects)
 * Includes feedback display + next question setup
 */
export const FEEDBACK_ANIMATION_LONG = 3000;

/**
 * Short animation delay
 * Used for quick transitions and micro-animations
 */
export const SHORT_ANIMATION = 500;

/**
 * Maximum time to wait for all tweens to complete
 * Standard tween completion timeout
 */
export const TWEEN_COMPLETION_TIMEOUT = 5000;

/**
 * Maximum time to wait for tweens with extended timeout
 * Used when multiple complex animations may be running
 */
export const TWEEN_COMPLETION_TIMEOUT_LONG = 10000;

/**
 * Celebration animation duration (Results scene)
 * Includes star animations and score reveal
 */
export const CELEBRATION_ANIMATION = 2000;

// ============================================
// User Interaction Delays
// ============================================

/**
 * Micro-delay before keyboard input
 * Prevents race conditions with focus management
 * Note: Consider replacing with condition-based waiting where possible
 */
export const KEY_PRESS_DELAY = 100;

/**
 * Delay for focus to settle after keyboard navigation
 * Allows focus indicator to update before checking state
 * Note: Consider replacing with condition-based waiting where possible
 */
export const FOCUS_SETTLE_DELAY = 300;

// ============================================
// Accessibility & Announcements
// ============================================

/**
 * Time to wait for ARIA announcement to populate
 * Announcements trigger after game state changes
 */
export const ANNOUNCEMENT_SETTLE = 500;

/**
 * Maximum time to wait for specific announcement
 * Standard timeout for ARIA live region updates.
 * CI bump: 15 s covers Docker CI boot overhead (game init ~8 s + 800 ms delayedCall +
 * ANNOUNCEMENT_SETTLE). Local keeps 5 s so slow-path timing bugs stay visible on dev machines.
 */
export const ANNOUNCEMENT_TIMEOUT = process.env.CI ? 15000 : 5000;

/**
 * Short announcement timeout for quick interactions
 * Used when announcements should appear immediately
 */
export const ANNOUNCEMENT_TIMEOUT_SHORT = 3000;

// ============================================
// Choice Card Interactions
// ============================================

/**
 * Maximum time to wait for choice cards to appear
 * Includes card creation and initial layout
 */
export const CHOICE_CARDS_TIMEOUT = 10000;

/**
 * Maximum time to wait for feedback overlay to appear
 * Timeout for correct/incorrect feedback display
 */
export const FEEDBACK_OVERLAY_TIMEOUT = 5000;

// ============================================
// Test Utilities
// ============================================

/**
 * Condition-based wait timeout for game state changes
 * Used with waitForFunction for state verification
 */
export const GAME_STATE_TIMEOUT = 10000;

/**
 * Error handling delay
 * Used for network errors, missing configs, etc.
 * Gives enough time for error states to manifest
 */
export const ERROR_HANDLING_DELAY = 5000;
