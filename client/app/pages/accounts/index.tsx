import { useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../components/ui/table";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { AccountService } from "../../api/AccountService";
import type { User, Role, PaginatedResponse } from "../../api/AccountService";
import { AccountModal } from "../../components/accounts/account-modal";

export default function AccountsPage() {
    const [users, setUsers] = useState<PaginatedResponse<User> | null>(null);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
    const [deleteUserName, setDeleteUserName] = useState("");

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await AccountService.getUsers({ search, page });
            setUsers(data);
        } catch (error) {
            console.error("Failed to fetch users", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [page, search]);

    const handleCreate = () => {
        setSelectedUser(null);
        setIsModalOpen(true);
    };

    const handleEdit = (user: User) => {
        setSelectedUser(user);
        setIsModalOpen(true);
    };

    const handleDelete = (user: User) => {
        setDeleteUserId(user.id);
        setDeleteUserName(`${user.first_name} ${user.last_name}`);
    };

    const confirmDelete = async () => {
        if (!deleteUserId) return;
        try {
            await AccountService.deleteUser(deleteUserId);
            fetchUsers();
        } catch (error) {
            console.error("Failed to delete user", error);
        } finally {
            setDeleteUserId(null);
            setDeleteUserName("");
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50 border-t border-zinc-200">
            <div className="px-5 py-3 border-b bg-white shrink-0">
                <h1 className="text-[16px] font-bold text-[#1a202c] tracking-tight uppercase leading-none mt-1">
                    Account Management
                </h1>
            </div>

            <div className="flex-1 p-5 space-y-4 overflow-auto">
                <div className="flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search accounts..."
                            className="pl-8 text-[13px] h-8"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value)
                                setPage(1)
                            }}
                        />
                    </div>
                    <Button size="sm" onClick={handleCreate} className="bg-green-600 hover:bg-green-700 h-8 text-[13px] px-3">
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add Account
                    </Button>
                </div>

                <div className="rounded-md border bg-white shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader className="bg-zinc-50">
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Designation</TableHead>
                                <TableHead>Section</TableHead>
                                <TableHead>Roles</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        Loading...
                                    </TableCell>
                                </TableRow>
                            ) : users?.data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        No users found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users?.data.map((user) => (
                                    <TableRow key={user.id} className="hover:bg-zinc-50">
                                        <TableCell className="font-medium">
                                            {user.first_name} {user.middle_name ? `${user.middle_name} ` : ""}{user.last_name}
                                        </TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>{user.designation}</TableCell>
                                        <TableCell>{user.section}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {user.roles.map((role) => (
                                                    <span
                                                        key={role.id}
                                                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-800 border border-zinc-200"
                                                    >
                                                        {role.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleEdit(user)}
                                                >
                                                    <Pencil className="h-4 w-4 text-blue-600" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(user)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-600" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {users && users.last_page > 1 && (
                    <div className="flex items-center justify-between gap-4 py-4">
                        <div className="text-sm text-muted-foreground">
                            Showing {(users.current_page - 1) * users.per_page + 1} to{" "}
                            {Math.min(users.current_page * users.per_page, users.total)} of{" "}
                            {users.total} results
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(page - 1)}
                                disabled={page === 1}
                            >
                                Previous
                            </Button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: users.last_page }, (_, i) => i + 1).map((p) => (
                                    <Button
                                        key={p}
                                        variant={p === page ? "default" : "outline"}
                                        size="sm"
                                        className="w-9"
                                        onClick={() => setPage(p)}
                                    >
                                        {p}
                                    </Button>
                                ))}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(page + 1)}
                                disabled={page === users.last_page}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <AccountModal
                key={selectedUser?.id ?? "new"}
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedUser(null);
                }}
                onSuccess={fetchUsers}
                user={selectedUser}
            />

            {/* Delete Confirmation Dialog */}
            <AlertDialog
                open={deleteUserId !== null}
                onOpenChange={(open) => { if (!open) { setDeleteUserId(null); setDeleteUserName(""); } }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Account</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete the account for{" "}
                            <span className="font-semibold text-zinc-800">{deleteUserName}</span>?
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={confirmDelete}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
