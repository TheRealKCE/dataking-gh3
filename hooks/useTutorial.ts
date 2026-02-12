'use client';

import { useEffect, useState, useCallback } from 'react';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { getCustomerTutorialSteps, getAgentTutorialSteps } from '@/lib/tutorial-steps';

type UserRole = 'customer' | 'agent';

interface UseTutorialReturn {
    hasSeenTutorial: boolean;
    startTutorial: () => void;
    markTutorialComplete: () => void;
}

/**
 * Tutorial Hook
 * Manages tutorial state and logic for customer and agent roles
 * 
 * Features:
 * - Auto-starts tutorial for first-time users (per role)
 * - Detects role upgrades and triggers agent tutorial
 * - Provides manual replay functionality
 * - Tracks completion separately for customer and agent tutorials
 */
export function useTutorial(userRole: UserRole): UseTutorialReturn {
    const [hasSeenTutorial, setHasSeenTutorial] = useState(true); // Default true to prevent flash
    const TUTORIAL_VERSION = 'v1';

    // Separate tracking keys for each role
    const TUTORIAL_KEY = `tutorial_completed_${userRole}_${TUTORIAL_VERSION}`;
    const PREVIOUS_ROLE_KEY = 'previous_user_role';

    // Check if user has seen the tutorial for their current role
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const completed = localStorage.getItem(TUTORIAL_KEY) === 'true';
            setHasSeenTutorial(completed);
        }
    }, [TUTORIAL_KEY]);

    // Detect role upgrades (customer -> agent) and auto-start agent tutorial
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const previousRole = localStorage.getItem(PREVIOUS_ROLE_KEY);
            const currentRole = userRole;

            // If role changed from customer to agent, trigger agent tutorial
            if (previousRole === 'customer' && currentRole === 'agent') {
                const hasSeenAgentTutorial = localStorage.getItem(`tutorial_completed_agent_${TUTORIAL_VERSION}`) === 'true';

                // Only show if they haven't seen agent tutorial before
                if (!hasSeenAgentTutorial) {
                    // Delay to let dashboard load
                    setTimeout(() => {
                        startTutorial();
                    }, 1500);
                }
            }

            // Update stored role for next check
            localStorage.setItem(PREVIOUS_ROLE_KEY, currentRole);
        }
    }, [userRole]);

    /**
     * Start the tutorial
     * Can be called manually for replay or automatically on first visit
     */
    const startTutorial = useCallback(() => {
        if (typeof window === 'undefined') return;

        // Get role-specific steps
        const steps: DriveStep[] = userRole === 'agent'
            ? getAgentTutorialSteps()
            : getCustomerTutorialSteps();

        // Initialize Driver.js
        const driverObj = driver({
            steps: steps,
            showProgress: true,
            showButtons: ['next', 'previous', 'close'],
            nextBtnText: 'Next →',
            prevBtnText: '← Previous',
            doneBtnText: 'Done ✓',
            progressText: '{{current}} of {{total}}',
            overlayColor: 'rgba(0, 0, 0, 0.5)',
            smoothScroll: true,
            animate: true,
            disableActiveInteraction: false,
            allowClose: true,
            onDestroyStarted: () => {
                // When user completes or closes tutorial
                if (driverObj.isLastStep() || driverObj.getActiveIndex() === steps.length - 1) {
                    markTutorialComplete();
                } else {
                    // User skipped, still mark as seen
                    markTutorialComplete();
                }
                driverObj.destroy();
            },
            onNextClick: () => {
                driverObj.moveNext();
            },
            onPrevClick: () => {
                driverObj.movePrevious();
            }
        });

        // Start the tour
        driverObj.drive();
    }, [userRole]);

    /**
     * Mark tutorial as complete
     * Saves completion state to localStorage
     */
    const markTutorialComplete = useCallback(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(TUTORIAL_KEY, 'true');
            setHasSeenTutorial(true);
        }
    }, [TUTORIAL_KEY]);

    return {
        hasSeenTutorial,
        startTutorial,
        markTutorialComplete
    };
}
