import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "../../components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "../../components/ui/form";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { AccountService } from "../../api/AccountService";
import type { User, Role } from "../../api/AccountService";
import { Checkbox } from "../../components/ui/checkbox";
import { Stepper } from "../../components/ui/stepper";
import { cn } from "../../lib/utils";
import { toast } from "sonner";

const steps = [
    { title: "Personal Info", description: "Basic Details" },
    { title: "Employment", description: "Designation & Role" },
    { title: "Security", description: "Password Setup" },
];

const createFormSchema = (isEditing: boolean) =>
    z
        .object({
            first_name: z.string().min(1, "First name is required"),
            middle_name: z.string().optional(),
            last_name: z.string().min(1, "Last name is required"),
            email: z.string().email("Invalid email address"),
            designation: z.string().min(1, "Designation is required"),
            section: z.string().min(1, "Section is required"),
            roles: z.array(z.number()).min(1, "Select at least one role"),
            password: z.string(),
            password_confirmation: z.string(),
        })
        .superRefine((data, ctx) => {
            const hasPassword = data.password.length > 0;

            if (!isEditing && !hasPassword) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Password is required",
                    path: ["password"],
                });
            }

            if (hasPassword) {
                if (data.password.length < 8) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "Password must be at least 8 characters",
                        path: ["password"],
                    });
                }
                if (data.password !== data.password_confirmation) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "Passwords do not match",
                        path: ["password_confirmation"],
                    });
                }
            }
        });

interface AccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    user?: User | null;
}

export const AccountModal: React.FC<AccountModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    user,
}) => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeStep, setActiveStep] = useState(0);
    const isEditing = Boolean(user);
    const formSchema = createFormSchema(isEditing);

    const form = useForm<z.infer<ReturnType<typeof createFormSchema>>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            first_name: "",
            middle_name: "",
            last_name: "",
            email: "",
            designation: "",
            section: "",
            roles: [],
            password: "",
            password_confirmation: "",
        },
    });

    useEffect(() => {
        const fetchRoles = async () => {
            try {
                const data = await AccountService.getRoles();
                setRoles(data);
            } catch (error) {
                console.error("Failed to fetch roles", error);
            }
        };
        fetchRoles();
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        setActiveStep(0);

        if (user) {
            form.reset({
                first_name: user.first_name,
                middle_name: user.middle_name || "",
                last_name: user.last_name,
                email: user.email,
                designation: user.designation,
                section: user.section,
                roles: user.roles?.map((r) => r.id) ?? [],
                password: "",
                password_confirmation: "",
            });
        } else {
            form.reset({
                first_name: "",
                middle_name: "",
                last_name: "",
                email: "",
                designation: "",
                section: "",
                roles: [],
                password: "",
                password_confirmation: "",
            });
        }
    }, [isOpen, user?.id, form]);

    const nextStep = async () => {
        let fieldsToValidate: any[] = [];

        if (activeStep === 0) {
            fieldsToValidate = ['first_name', 'last_name', 'middle_name', 'email'];
        } else if (activeStep === 1) {
            fieldsToValidate = ['designation', 'section', 'roles'];
        }

        const isValid = await form.trigger(fieldsToValidate);
        if (isValid) {
            setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
        }
    };

    const prevStep = () => {
        setActiveStep((prev) => Math.max(prev - 1, 0));
    };

    const onSubmit = async (values: z.infer<ReturnType<typeof createFormSchema>>) => {
        setLoading(true);
        try {
            if (user) {
                await AccountService.updateUser(user.id, values);
            } else {
                await AccountService.createUser(values);
            }
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error("Failed to save user", error);
            const message =
                error.response?.data?.message ||
                (user ? "Failed to update account" : "Failed to create account");
            toast.error(message);
            if (error.response?.data?.errors) {
                Object.keys(error.response.data.errors).forEach((key) => {
                    form.setError(key as any, {
                        message: error.response.data.errors[key][0],
                    });
                });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 gap-0">
                <div className="p-6 pb-2">
                    <DialogHeader>
                        <DialogTitle>{user ? "Edit Account" : "Add New Account"}</DialogTitle>
                        <DialogDescription>
                            {user ? "Update account details and permissions." : "Fill out the form below to create a new user account."}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="h-auto min-h-[7rem] shrink-0 py-2 pb-4 border-b px-6 bg-background w-full">
                    <Stepper activeStep={activeStep} steps={steps} />
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar min-h-0">
                    <Form {...form}>
                        <form id="account-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                            {/* STEP 1: Personal Info */}
                            <div className={cn("flex flex-col gap-4", activeStep === 0 ? "flex" : "hidden")}>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="first_name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>First Name *</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="First Name" className="bg-blue-50/50" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="last_name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Last Name *</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Last Name" className="bg-blue-50/50" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormField
                                    control={form.control}
                                    name="middle_name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Middle Name (Optional)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Middle Name" className="bg-gray-50/50" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="email@example.com" type="email" className="bg-green-50/50" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* STEP 2: Employment Details */}
                            <div className={cn("flex flex-col gap-4", activeStep === 1 ? "flex" : "hidden")}>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="designation"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Designation *</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. CPDC, Zoning Officer" className="bg-gray-50/50" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="section"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Section *</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. Plans, Zoning Section" className="bg-gray-50/50" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="roles"
                                    render={() => (
                                        <FormItem className="mt-4 p-4 border rounded-lg bg-gray-50/30">
                                            <div className="mb-4">
                                                <FormLabel className="text-base font-semibold">User Roles *</FormLabel>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                {roles.map((role) => (
                                                    <FormField
                                                        key={role.id}
                                                        control={form.control}
                                                        name="roles"
                                                        render={({ field }) => {
                                                            return (
                                                                <FormItem
                                                                    key={role.id}
                                                                    className="flex flex-row items-center space-x-3 space-y-0"
                                                                >
                                                                    <FormControl>
                                                                        <Checkbox
                                                                            checked={field.value?.includes(role.id)}
                                                                            onCheckedChange={(checked) => {
                                                                                return checked
                                                                                    ? field.onChange([...field.value, role.id])
                                                                                    : field.onChange(
                                                                                        field.value?.filter(
                                                                                            (value) => value !== role.id
                                                                                        )
                                                                                    );
                                                                            }}
                                                                        />
                                                                    </FormControl>
                                                                    <FormLabel className="font-normal text-sm cursor-pointer">
                                                                        {role.name}
                                                                    </FormLabel>
                                                                </FormItem>
                                                            );
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* STEP 3: Security */}
                            <div className={cn("flex flex-col gap-4", activeStep === 2 ? "flex" : "hidden")}>
                                <div className="grid grid-cols-1 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Password {user && "(Leave blank if unchanged)"}</FormLabel>
                                                <FormControl>
                                                    <Input type="password" placeholder="********" className="bg-red-50/30" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="password_confirmation"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Confirm Password</FormLabel>
                                                <FormControl>
                                                    <Input type="password" placeholder="********" className="bg-red-50/30" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        </form>
                    </Form>
                </div>

                <DialogFooter className="p-6 border-t mt-auto flex sm:justify-between items-center w-full flex-row">
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={prevStep}
                            disabled={activeStep === 0}
                            className={activeStep === 0 ? "hidden" : "block"}
                        >
                            Previous
                        </Button>

                        {activeStep < steps.length - 1 ? (
                            <Button type="button" onClick={nextStep} className="bg-green-600 hover:bg-green-700 text-white">
                                Next Step
                            </Button>
                        ) : (
                            <Button type="submit" form="account-form" disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
                                {loading ? "Saving..." : user ? "Update Account" : "Create Account"}
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
