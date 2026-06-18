import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

export default function ProjectDeleteDialog({ project, open, onClose, onConfirm, deleting }) {
  if (!project) return null;
  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar proyecto?</AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminará permanentemente <strong>{project.nombre}</strong>. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(project.id)} disabled={deleting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            {deleting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null} Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}