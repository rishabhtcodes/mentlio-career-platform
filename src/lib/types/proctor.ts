export interface ProctorEvent {
  type:
    | 'screenshot'
    | 'tab_switch'
    | 'copy'
    | 'paste'
    | 'devtools'
    | 'right_click'
    | 'keyboard_shortcut'
    | 'mouse_inactive'
    | 'mouse_edge'
    | 'clipboard_clear'
    | 'multiple_tab'
    | 'seb_violation';
  timestamp: number;
  sessionId: string;
  userEmail?: string;
  metadata?: Record<string, any>;
}
