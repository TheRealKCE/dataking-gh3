'use client';

import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HelpButtonProps {
    onClick: () => void;
    className?: string;
}

/**
 * Help Button Component
 * Provides a button to replay the interactive tutorial
 * 
 * Features:
 * - Question mark icon with native tooltip
 * - Accessible and mobile-friendly
 * - Consistent with app design
 */
export function HelpButton({ onClick, className = '' }: HelpButtonProps) {
    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={onClick}
            className={`relative hover:bg-primary/10 ${className}`}
            aria-label="Replay Tutorial"
            title="Replay Tutorial"
        >
            <HelpCircle className="h-5 w-5 text-primary" />
        </Button>
    );
}
