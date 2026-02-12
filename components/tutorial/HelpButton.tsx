'use client';

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
 * - Descriptive tooltip on hover
 * - Pulsing animation for visibility
 * - Professional badge design
 * - Accessible and mobile-friendly
 */
export function HelpButton({ onClick, className = '' }: HelpButtonProps) {
    return (
        <Button
            onClick={onClick}
            className={`group relative flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border-2 border-primary/30 hover:border-primary/50 px-4 py-2 rounded-full font-semibold transition-all duration-200 shadow-sm hover:shadow-md ${className}`}
            aria-label="Start Interactive Tutorial - Click to start a guided tour of this page and learn how to use all features step-by-step"
            title="📚 Interactive Tutorial - Click to start a guided tour of this page and learn how to use all features step-by-step!"
        >
            {/* Pulsing ring animation */}
            <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-75" style={{ animationDuration: '2s' }}></span>

            {/* Icon */}
            <GraduationCap className="h-5 w-5 relative z-10" />

            {/* Text label */}
            <span className="relative z-10 text-sm font-bold hidden sm:inline">
                Tutorial
            </span>

            {/* Mobile-only icon */}
            <HelpCircle className="h-4 w-4 relative z-10 sm:hidden" />
        </Button>
    );
}
