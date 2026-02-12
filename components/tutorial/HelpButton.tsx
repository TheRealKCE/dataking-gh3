'use client';

import { useState, useEffect } from 'react';
import { HelpCircle, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HelpButtonProps {
    onClick: () => void;
    className?: string;
}

/**
 * Help Button Component
 * Professional badge-style button to replay the interactive tutorial
 * 
 * Features:
 * - Clear text label with icon
 * - Auto-showing tooltip (appears after 3s, disappears after 10s)
 * - Positioned above and left to prevent mobile overflow
 * - Mobile-responsive and accessible
 */
export function HelpButton({ onClick, className = '' }: HelpButtonProps) {
    const [showTooltip, setShowTooltip] = useState(false);

    useEffect(() => {
        // Show tooltip after 3 seconds
        const showTimer = setTimeout(() => {
            setShowTooltip(true);
        }, 3000);

        // Hide tooltip after 10 seconds (3s delay + 7s visible)
        const hideTimer = setTimeout(() => {
            setShowTooltip(false);
        }, 10000);

        return () => {
            clearTimeout(showTimer);
            clearTimeout(hideTimer);
        };
    }, []);

    return (
        <Button
            onClick={onClick}
            className={`group relative flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border-2 border-primary/30 hover:border-primary/50 px-4 py-2 rounded-full font-semibold transition-all duration-200 shadow-sm hover:shadow-md ${className}`}
            aria-label="Start Interactive Tutorial"
            title="📚 Interactive Tutorial"
        >
            {/* Icon */}
            <GraduationCap className="h-5 w-5 relative z-10" />

            {/* Text label */}
            <span className="relative z-10 text-sm font-bold hidden sm:inline">
                Tutorial
            </span>

            {/* Mobile-only icon */}
            <HelpCircle className="h-4 w-4 relative z-10 sm:hidden" />

            {/* Tooltip - Positioned ABOVE and LEFT to prevent overflow */}
            <div className={`absolute bottom-full left-0 mb-3 w-48 sm:w-56 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl transition-all duration-300 z-50 pointer-events-none transform text-left leading-relaxed border border-gray-700 ${showTooltip || false ? 'opacity-100 visible -translate-y-0' : 'opacity-0 invisible translate-y-2'
                } group-hover:opacity-100 group-hover:visible group-hover:-translate-y-0`}>
                <div className="font-bold mb-1 text-yellow-400">Interactive Guide</div>
                Click to start a step-by-step tour of the features on this page.
                {/* Arrow pointing DOWN since tooltip is above */}
                <div className="absolute -bottom-1 left-6 w-2 h-2 bg-gray-900 transform rotate-45 border-r border-b border-gray-700"></div>
            </div>
        </Button>
    );
}
