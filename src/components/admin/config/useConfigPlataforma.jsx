import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ConfigPlataforma } from "@/api/entidades";
import { toast } from "sonner";

export function useConfigPlataforma() {
  const queryClient = useQueryClient();

  const { data: config = null, isLoading } = useQuery({
    queryKey: ["config-plataforma"],
    queryFn: () => ConfigPlataforma.get(),
    initialData: null,
  });

  const saveMut = useMutation({
    mutationFn: async (data) => {
      if (config) {
        return ConfigPlataforma.update(config.id, data);
      } else {
        // Singleton — create if missing (should not normally happen)
        const { supabase } = await import("@/api/supabaseClient");
        const { data: created, error } = await supabase
          .from("config_plataforma")
          .insert({ clave: "plataforma", ...data })
          .select()
          .single();
        if (error) throw error;
        return created;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config-plataforma"] });
      toast.success("✅ Configuración guardada");
    },
    onError: (err) => toast.error(err.message),
  });

  return { config, isLoading, saveMut };
}