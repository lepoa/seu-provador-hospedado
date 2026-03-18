import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TemplateVariable {
    key: string;
    label: string;
}

export interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    html: string;
    variables: TemplateVariable[];
    updated_at: string;
}

export interface UpdateTemplateParams {
    id: string;
    subject: string;
    html: string;
}

// ─── Fetch all templates ──────────────────────────────────────────────────────

export function useEmailTemplates() {
    return useQuery({
        queryKey: ["email_templates"],
        queryFn: async (): Promise<EmailTemplate[]> => {
            const { data, error } = await supabase
                .from("email_templates")
                .select("*")
                .order("id");
            if (error) throw error;
            return (data ?? []) as EmailTemplate[];
        },
    });
}

// ─── Update a template ────────────────────────────────────────────────────────

export function useUpdateEmailTemplate() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, subject, html }: UpdateTemplateParams) => {
            const { error } = await supabase
                .from("email_templates")
                .update({ subject, html, updated_at: new Date().toISOString() })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Template salvo com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["email_templates"] });
        },
        onError: (err: Error) => {
            toast.error(err.message || "Erro ao salvar template.");
        },
    });
}
