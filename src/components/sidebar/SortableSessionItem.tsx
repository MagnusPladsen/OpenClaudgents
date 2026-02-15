import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SessionItem } from "./SessionItem";
import type { Session } from "../../lib/types";

interface SortableSessionItemProps {
  session: Session;
  isActive: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onRename?: (newName: string) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onClick: () => void;
}

export function SortableSessionItem(props: SortableSessionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.session.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <SessionItem {...props} />
    </div>
  );
}
