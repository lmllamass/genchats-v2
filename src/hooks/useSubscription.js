import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { Proyecto } from "@/api/entidades";

const LIMITS = {
  free: { max_projects: 1 },
  gratis: { max_projects: 1 },
  basico: { max_projects: 3 },
  pro: { max_projects: 3 },
  'super-pro': { max_projects: 3 },
};

export function useSubscription() {
  const { user, isLoadingAuth } = useAuth();

  const { data: proyectos = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["proyectos", user?.id],
    queryFn: () => Proyecto.list(user.id),
    enabled: !!user?.id,
    initialData: [],
  });

  const isAdmin = user?.role === "admin";
  const plan = user?.plan || "free";
  const isPaid = plan !== "free" && plan !== "gratis";

  // Trial logic (only for free users)
  const trialEndsAt = user?.trial_ends_at ? new Date(user.trial_ends_at) : null;
  const now = new Date();
  const trialActive = trialEndsAt ? now < trialEndsAt : true;
  const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24))) : 7;
  const trialExpired = trialEndsAt ? now >= trialEndsAt : false;

  // Access: admin always, paid always, free within trial
  const hasAccess = isAdmin || isPaid || trialActive;

  // Project limits
  const planLimits = LIMITS[plan] || LIMITS.free;
  const limit = isAdmin ? 999999 : planLimits.max_projects;
  const projectCount = proyectos.length;
  const canCreateProject = isAdmin || projectCount < limit;

  return {
    user,
    isAdmin,
    plan,
    isPaid,
    trialEndsAt,
    trialActive,
    trialDaysLeft,
    trialExpired,
    hasAccess,
    canCreateProject,
    projectCount,
    limit,
    proyectos,
    loading: isLoadingAuth || loadingProjects,
  };
}
