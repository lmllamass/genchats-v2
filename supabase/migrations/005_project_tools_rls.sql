ALTER TABLE public.project_tools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_project_tools" ON public.project_tools;

CREATE POLICY "service_role_project_tools"
ON public.project_tools
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
