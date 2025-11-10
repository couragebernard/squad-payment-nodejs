import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../supabase/supabaseClient';

export type AuditStatus = 'success' | 'failure' | 'info';

export interface AuditLogEntry {
    event_type: string;
    db_table: string;
    table_id?: string | number | null;
    status: AuditStatus;
    attempted_changes?: Record<string, unknown> | null;
    error_message?: string | null;
    context?: Record<string, unknown> | null;
    user_type?: string | null;
    user_id?: string | number | null;
    trace_id?: string | null;   
}

type AuditLogResponse = {
    error: PostgrestError | null;
};

export const logAuditEvent = async (entry: AuditLogEntry): Promise<void> => {
    const payload = {
        event_type: entry.event_type,
        db_table: entry.db_table,
        table_id: entry.table_id ? String(entry.table_id) : null,
        status: entry.status,
        attempted_changes: entry.attempted_changes ?? null,
        error_message: entry.error_message ?? null,
        context: entry.context ?? null,
        user_type: entry.user_type ?? null,
        user_id: entry.user_id ? String(entry.user_id) : null,
        trace_id: entry.trace_id ?? null
    };

    const { error }: AuditLogResponse = await supabase.from('audit_log').insert(payload);

    if (error) {
        // Avoid throwing to prevent masking the original failure. Log for observability.
        console.error('Failed to write audit log entry', { error, payload });
    }
};

