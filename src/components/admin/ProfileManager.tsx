import { useState, useEffect } from "react";
import { User, Shield, ShieldAlert, ShieldCheck, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserProfile {
    user_id: string;
    name: string | null;
    whatsapp: string | null;
    email?: string | null;
    roles: AppRole[];
}

export function ProfileManager() {
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isUpdating, setIsUpdating] = useState<string | null>(null);

    const loadProfiles = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch profiles
            const { data: profilesData, error: profilesError } = await supabase
                .from("profiles")
                .select("user_id, name, whatsapp")
                .order("created_at", { ascending: false });

            if (profilesError) throw profilesError;

            // 2. Fetch roles
            const { data: rolesData, error: rolesError } = await supabase
                .from("user_roles")
                .select("user_id, role");

            if (rolesError) throw rolesError;

            // 3. Fetch emails from customers
            const { data: customersData } = await supabase
                .from("customers")
                .select("user_id, email")
                .not("user_id", "is", null);

            // 4. Merge data
            const merged: UserProfile[] = (profilesData || []).map(p => {
                const userRoles = (rolesData || [])
                    .filter(r => r.user_id === p.user_id)
                    .map(r => r.role as AppRole);

                const customer = (customersData || []).find(c => c.user_id === p.user_id);

                return {
                    ...p,
                    roles: userRoles,
                    email: customer?.email
                };
            });

            setProfiles(merged);
        } catch (error) {
            console.error("Error loading profiles:", error);
            toast.error("Erro ao carregar perfis.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadProfiles();
    }, []);

    const handleRoleChange = async (userId: string, newRole: AppRole) => {
        setIsUpdating(userId);
        try {
            // Simple implementation: Replace all roles with the new one

            // Delete existing
            const { error: deleteError } = await supabase
                .from("user_roles")
                .delete()
                .eq("user_id", userId);

            if (deleteError) throw deleteError;

            // Add new
            const { error: insertError } = await supabase
                .from("user_roles")
                .insert({ user_id: userId, role: newRole });

            if (insertError) throw insertError;

            toast.success("Permissões atualizadas!");
            loadProfiles();
        } catch (error) {
            console.error("Error updating role:", error);
            toast.error("Erro ao atualizar permissões.");
        } finally {
            setIsUpdating(null);
        }
    };

    const filteredProfiles = profiles.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.whatsapp?.includes(searchTerm) ||
        p.roles.some(r => r.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const getRoleBadge = (roles: AppRole[]) => {
        if (roles.includes("admin")) {
            return <Badge className="bg-rose-100 text-rose-700 border-rose-200 gap-1"><ShieldAlert className="h-3 w-3" /> Admin</Badge>;
        }
        if (roles.includes("merchant")) {
            return <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1"><ShieldCheck className="h-3 w-3" /> Lojista</Badge>;
        }
        return <Badge variant="outline">Cliente</Badge>;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-semibold">Gestão de Perfis e Acessos</h2>
                    <p className="text-sm text-muted-foreground">Gerencie quem pode acessar o painel administrativo.</p>
                </div>

                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nome, email ou papel..."
                        className="pl-9 h-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid gap-3">
                {filteredProfiles.map((profile) => (
                    <Card key={profile.user_id} className="overflow-hidden">
                        <CardContent className="p-0">
                            <div className="flex flex-col sm:flex-row items-center sm:items-stretch">
                                <div className="p-4 flex-1 flex items-center gap-4 w-full">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <User className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-medium truncate">{profile.name || "Sem nome"}</h3>
                                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-muted-foreground mt-1">
                                            {profile.email && (
                                                <span className="truncate max-w-[150px] sm:max-w-none">{profile.email}</span>
                                            )}
                                            {profile.whatsapp && (
                                                <span className="shrink-0">{profile.whatsapp}</span>
                                            )}
                                            {getRoleBadge(profile.roles)}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-muted/30 border-t sm:border-t-0 sm:border-l w-full sm:w-auto flex items-center gap-3">
                                    <div className="flex-1 sm:w-40">
                                        <Select
                                            disabled={isUpdating === profile.user_id}
                                            value={profile.roles[0] || "customer"}
                                            onValueChange={(val) => handleRoleChange(profile.user_id, val as AppRole)}
                                        >
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Alterar papel" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="admin">Administrador</SelectItem>
                                                <SelectItem value="merchant">Lojista / Gerente</SelectItem>
                                                <SelectItem value="customer">Cliente Comum</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {isUpdating === profile.user_id && (
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {filteredProfiles.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed rounded-xl">
                        <User className="h-12 w-12 mx-auto text-muted-foreground opacity-20 mb-4" />
                        <p className="text-muted-foreground">Nenhum perfil encontrado.</p>
                    </div>
                )}
            </div>

            <Card className="bg-amber-50 border-amber-100">
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold flex items-center gap-2 text-amber-800 uppercase tracking-wider">
                        <ShieldAlert className="h-4 w-4" />
                        Atenção com Permissões
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-xs text-amber-700 leading-relaxed">
                        Alterar o papel de um usuário concede ou remove acesso imediato a áreas sensíveis do painel. <br />
                        Certifique-se da identidade do usuário antes de promover a <span className="font-bold">Administrador</span>.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
