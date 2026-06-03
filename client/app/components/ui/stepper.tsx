import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "~/lib/utils"

interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
    activeStep: number
    steps: { title: string; description?: string }[]
}

export function Stepper({ activeStep, steps, className, ...props }: StepperProps) {
    return (
        <div className={cn("flex flex-row items-center justify-between pointer-events-none", className)} {...props}>
            {steps.map((step, index) => {
                const isActive = index === activeStep
                const isCompleted = index < activeStep

                return (
                    <div key={step.title} className={cn("flex relative items-center", index < steps.length - 1 ? "w-full" : "")}>
                        <div className="flex flex-col items-center relative z-10 w-10">
                            <div
                                className={cn(
                                    "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                                    isActive && "border-green-600 bg-green-600 text-white",
                                    isCompleted && "border-green-600 bg-green-600 text-white",
                                    !isActive && !isCompleted && "border-muted-foreground/30 bg-background text-muted-foreground"
                                )}
                            >
                                {isCompleted ? <Check className="h-4 w-4" /> : <span className="text-sm font-medium">{index + 1}</span>}
                            </div>
                            <div className="absolute top-10 flex flex-col items-center w-32 text-center pointer-events-none">
                                <span className={cn("text-xs font-medium", isActive || isCompleted ? "text-foreground" : "text-muted-foreground")}>
                                    {step.title}
                                </span>
                                {step.description && (
                                    <span className="text-[10px] text-muted-foreground">{step.description}</span>
                                )}
                            </div>
                        </div>
                        {index < steps.length - 1 && (
                            <div
                                className={cn(
                                    "h-[2px] w-full mx-2 transition-colors",
                                    isCompleted ? "bg-green-600" : "bg-muted-foreground/30"
                                )}
                            />
                        )}
                    </div>
                )
            })}
        </div>
    )
}
