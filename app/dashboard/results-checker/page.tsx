'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BadgeCheck, Search } from 'lucide-react'

export default function ResultsCheckerPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Results Checker</h2>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="col-span-full">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BadgeCheck className="w-5 h-5 text-primary" />
                            Purchase Results Checker
                        </CardTitle>
                        <CardDescription>
                            Buy scratch cards and PINs to check your examination results (WAEC, NECO, etc).
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                            <div className="bg-primary/10 p-4 rounded-full">
                                <Search className="w-10 h-10 text-primary" />
                            </div>
                            <h3 className="text-xl font-semibold">Integration in Progress</h3>
                            <p className="text-muted-foreground max-w-sm">
                                We are currently integrating with multiple examination bodies to bring you seamless results checking services.
                            </p>
                            <Button className="mt-4" disabled>
                                Coming Soon
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
