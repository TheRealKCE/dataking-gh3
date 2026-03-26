'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface UIContextType {
    isInternalSidebarOpen: boolean
    isCollapsed: boolean
    toggleSidebar: () => void
    closeSidebar: () => void
    toggleCollapse: () => void
}

const UIContext = createContext<UIContextType | undefined>(undefined)

export function UIProvider({ children }: { children: ReactNode }) {
    const [isInternalSidebarOpen, setIsInternalSidebarOpen] = useState(false)
    const [isCollapsed, setIsCollapsed] = useState(false)

    const toggleSidebar = () => setIsInternalSidebarOpen(prev => !prev)
    const closeSidebar = () => setIsInternalSidebarOpen(false)
    const toggleCollapse = () => setIsCollapsed(prev => !prev)

    return (
        <UIContext.Provider value={{ 
            isInternalSidebarOpen, 
            isCollapsed, 
            toggleSidebar, 
            closeSidebar, 
            toggleCollapse 
        }}>
            {children}
        </UIContext.Provider>
    )
}

export function useUI() {
    const context = useContext(UIContext)
    if (context === undefined) {
        throw new Error('useUI must be used within a UIProvider')
    }
    return context
}
