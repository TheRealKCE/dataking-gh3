'use client';

import { useEffect, useState, useCallback } from 'react';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import {
    getDashboardTutorialSteps,
    getOrderHistoryTutorialSteps,
    getComplaintsTutorialSteps,
    getProfileTutorialSteps,
    getUpgradeTutorialSteps,
    getWalletTutorialSteps,
    getDataPackagesTutorialSteps
} from '@/lib/tutorial-steps';

type UserRole = 'customer' | 'agent';
type PagePath = '/dashboard' | '/orders' | '/complaints' | '/profile' | '/upgrade' | '/wallet' | '/data-packages' | string;

interface UseTutorialReturn {
    hasSeenTutorial: boolean;
    startTutorial: () => void;
    markTutorialComplete: () => void;
}

/**
 * Page-Specific Tutorial Hook
 * Manages tutorial state and logic for each page independently
 * 
 * Features:
 * - Page-aware tutorial steps
 * - Auto-starts tutorial on first visit to each page
 * - Separate tracking per page and role
 * - Provides manual replay functionality
 */
export function useTutorial(userRole: UserRole, currentPage: PagePath): UseTutorialReturn {
    const [hasSeenTutorial, setHasSeenTutorial] = useState(true); // Default true to prevent flash
    const TUTORIAL_VERSION = 'v1';

    // Page-specific tracking key
    const pageName = currentPage.replace('/', '') || 'dashboard';
    const TUTORIAL_KEY = `tutorial_completed_${pageName}_${userRole}_${TUTORIAL_VERSION}`;

    // Check if user has seen the tutorial for current page
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const completed = localStorage.getItem(TUTORIAL_KEY) === 'true';
            setHasSeenTutorial(completed);
        }
    }, [TUTORIAL_KEY]);



    /**
     * Get tutorial steps for current page
     */
    const getStepsForPage = useCallback((): DriveStep[] => {
        switch (currentPage) {
            case '/dashboard':
                return getDashboardTutorialSteps(userRole);
            case '/orders':
                return getOrderHistoryTutorialSteps();
            case '/complaints':
                return getComplaintsTutorialSteps();
            case '/profile':
                return getProfileTutorialSteps();
            case '/upgrade':
                return getUpgradeTutorialSteps();
            case '/wallet':
                return getWalletTutorialSteps(userRole);
            case '/data-packages':
                return getDataPackagesTutorialSteps(userRole);
            default:
                // Default to dashboard steps if page not recognized
                return getDashboardTutorialSteps(userRole);
        }
    }, [currentPage, userRole]);

    /**
     * Start the tutorial for current page
     */
    const startTutorial = useCallback(() => {
        if (typeof window === 'undefined') return;

        const steps = getStepsForPage();

        // Initialize Driver.js
        const driverObj = driver({
            steps: steps,
            showProgress: true,
            showButtons: ['next', 'previous', 'close'],
            nextBtnText: 'Next →',
            prevBtnText: '← Previous',
            doneBtnText: 'Done ✓',
            progressText: '{{current}} of {{total}}',
            overlayColor: 'rgba(0, 0, 0, 0.2)',
            smoothScroll: true,
            animate: true,
            disableActiveInteraction: false,
            allowClose: true,
            popoverOffset: 20, // Add 20px space between popover and highlighted element
            onDestroyStarted: () => {
                // Mark as complete when user finishes or closes
                markTutorialComplete();
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
    }, [getStepsForPage]);

    /**
     * Mark tutorial as complete for current page
     */
    const markTutorialComplete = useCallback(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(TUTORIAL_KEY, 'true');
            setHasSeenTutorial(true);
        }
    }, [TUTORIAL_KEY]);

    // Auto-start tutorial if not seen
    useEffect(() => {
        if (!hasSeenTutorial) {
            // Small delay to ensure elements are rendered
            const timer = setTimeout(() => {
                startTutorial();
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [hasSeenTutorial, startTutorial]);

    return {
        hasSeenTutorial,
        startTutorial,
        markTutorialComplete
    };
}
