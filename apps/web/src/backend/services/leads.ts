import { getDb, commit, nextProjectNo } from '../db/store';
import { requireAdmin } from './rbac';
import { fail } from '../engine/errors';
import { isLegalLeadMove } from '../engine/transitions';
import { appendEvent, notifyAdmins, broadcast, projectLabel } from '../engine/effects';
import { uid, nowIso } from '../lib/ids';
import type { Client, LeadStage, Project } from '../models/types';

export interface NewLeadInput {
  name: string;
  company?: string;
  contact_phone?: string;
  contact_email?: string;
  requirements?: string;
  lead_stage?: LeadStage;
  source?: string;
}

export function createLead(actorId: string, input: NewLeadInput): Client {
  const db = getDb();
  requireAdmin(db, actorId);
  if (!input.name?.trim()) return fail('validation', 'Client name is required.');

  const client: Client = {
    id: uid(),
    name: input.name.trim(),
    company: input.company?.trim() || null,
    contact_phone: input.contact_phone?.trim() || null,
    contact_email: input.contact_email?.trim() || null,
    requirements: input.requirements?.trim() || null,
    lead_stage: input.lead_stage ?? 'new',
    lost_reason: null,
    source: input.source?.trim() || null,
    created_by: actorId,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.clients.push(client);
  appendEvent(db, { event_type: 'lead_created', actor_id: actorId, payload: { client_id: client.id, stage: client.lead_stage } });
  commit();
  return client;
}

/** Move a lead through the pipeline. Reaching `won` creates a project (doc 04 §1). */
export function setLeadStage(
  actorId: string,
  clientId: string,
  stage: LeadStage,
  lostReason?: string,
): { client: Client; project?: Project } {
  const db = getDb();
  requireAdmin(db, actorId);
  const client = db.clients.find((c) => c.id === clientId);
  if (!client) return fail('not_found', 'Client not found.');
  if (client.lead_stage === stage) return { client };

  if (!isLegalLeadMove(client.lead_stage, stage)) {
    return fail('illegal_move', `A lead cannot move from "${client.lead_stage}" to "${stage}".`);
  }
  if (stage === 'lost' && !lostReason?.trim()) {
    return fail('reason_required', 'Add a reason when marking a lead lost.');
  }

  const from = client.lead_stage;
  client.lead_stage = stage;
  client.lost_reason = stage === 'lost' ? lostReason!.trim() : null;
  client.updated_at = nowIso();
  appendEvent(db, { event_type: 'lead_stage', actor_id: actorId, from_state: from, to_state: stage, payload: { client_id: client.id } });

  let project: Project | undefined;
  if (stage === 'won') {
    project = {
      id: uid(),
      project_no: nextProjectNo(),
      client_id: client.id,
      title: client.requirements?.slice(0, 80) || `${client.name} — video`,
      video_type: null,
      priority: 'medium',
      current_stage: 'confirmed',
      status: 'pending',
      client_approval: 'pending',
      revision_count: 0,
      shoot_date: null,
      editing_date: null,
      upload_date: null,
      created_at: nowIso(),
    };
    db.projects.push(project);
    appendEvent(db, { event_type: 'project_created', actor_id: actorId, project_id: project.id, payload: { client_id: client.id } });
    notifyAdmins(db, 'lead_won', 'New project to assign', projectLabel(db, project));
    broadcast(db, 'lead_won', `🎬 New project confirmed: ${projectLabel(db, project)}`);
  }

  commit();
  return { client, project };
}
