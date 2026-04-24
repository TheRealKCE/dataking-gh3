'use client';

import { HelpCircle, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HelpButtonProps {
    onClick: () => void;
    className?: string;
}

/**
 * Help Button Component
 * Simple button to replay the interactive tutorial
 * 
 * Features:
 * - Clear text label with icon
 * - No tooltip (removed to prevent mobile overflow)
 * - Mobile-responsive
 */
export function HelpButton({ onClick, className = '' }: HelpButtonProps) {
    return (
        <Button
            variant="outline"
            onClick={onClick}
            className={`flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border-2 border-primary/30 hover:border-primary/50 px-4 py-2 rounded-full font-semibold transition-all duration-200 shadow-sm hover:shadow-md ${className}`}
            aria-label="Click to replay the interactive tutorial"
            title="📚 Click to replay the interactive tutorial"
        >
            {/* Icon */}
            <GraduationCap className="h-5 w-5" />

            {/* Text label */}
            <span className="text-sm font-bold hidden sm:inline">
                Tutorial
            </span>

            {/* Mobile-only icon */}
            <HelpCircle className="h-4 w-4 sm:hidden" />
        </Button>
    );
}
