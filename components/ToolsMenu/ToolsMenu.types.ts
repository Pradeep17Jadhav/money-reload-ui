/** A navbar destination the Tools menu expands into. */
export type ToolsMenuItem = {
  to: string;
  label: string;
};

export type ToolsMenuProps = {
  items: ToolsMenuItem[];
  /** Current route, so the open tool and its trigger can be marked. */
  activePath: string;
};