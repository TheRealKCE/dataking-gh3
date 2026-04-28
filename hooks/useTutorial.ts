'use client';

import { useEffect, useState, useCallback } from 'react';
import type { DriveStep } from 'driver.js';
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

export function useTutorial(userRole: UserRole, currentPage: PagePath): UseTutorialReturn {
    const [hasSeenTutorial, setHasSeenTutorial] = useState(true);
    const TUTORIAL_VERSION = 'v1';

    const pageName = currentPage.replace('/', '') || 'dashboard';
    const TUTORIAL_KEY = `tutorial_completed_${pageName}_${userRole}_${TUTORIAL_VERSION}`;

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const completed = localStorage.getItem(TUTORIAL_KEY) === 'true';
            setHasSeenTutorial(completed);
        }
    }, [TUTORIAL_KEY]);

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
                return getDashboardTutorialSteps(userRole);
        }
    }, [currentPage, userRole]);

    const markTutorialComplete = useCallback(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(TUTORIAL_KEY, 'true');
            setHasSeenTutorial(true);
        }
    }, [TUTORIAL_KEY]);

    const startTutorial = useCallback(() => {
        if (typeof window === 'undefined') return;

        void (async () => {
            const [{ driver }] = await Promise.all([
                import('driver.js'),
                // @ts-ignore
                import('driver.js/dist/driver.css'),
            ]);
            const steps = getStepsForPage();

            const driverObj = driver({
                steps,
                showProgress: true,
                showButtons: ['next', 'previous', 'close'],
                nextBtnText: 'Next',
                prevBtnText: 'Previous',
                doneBtnText: 'Done',
                progressText: '{{current}} of {{total}}',
                overlayColor: 'rgba(0, 0, 0, 0.2)',
                smoothScroll: true,
                animate: true,
                disableActiveInteraction: false,
                allowClose: true,
                popoverOffset: 20,
                onDestroyStarted: () => {
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

            driverObj.drive();
        })();
    }, [getStepsForPage, markTutorialComplete]);

    useEffect(() => {
        if (!hasSeenTutorial) {
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
