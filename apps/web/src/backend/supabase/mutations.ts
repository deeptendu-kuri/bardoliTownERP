import { supabase } from '../db/supabaseClient';
import { EngineError } from '../engine/errors';
import type { NewLeadInput } from '../services/leads';
import type { AssignInput } from '../services/assign';
import type { ReviewInput } from '../services/review';
import type { LeadStage } from '../models/types';

function ok<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new EngineError('rpc', res.error.message);
  return res.data;
}

// ── Leads ────────────────────────────────────────────────────────────────────
export async function createLead(_actor: string, input: NewLeadInput) {
  return ok(
    await supabase
      .from('clients')
      .insert({
        name: input.name.trim(),
        company: input.company?.trim() || null,
        contact_phone: input.contact_phone?.trim() || null,
        contact_email: input.contact_email?.trim() || null,
        requirements: input.requirements?.trim() || null,
        lead_stage: input.lead_stage ?? 'new',
        source: input.source?.trim() || null,
      })
      .select()
      .single(),
  );
}

export async function setLeadStage(_actor: string, clientId: string, stage: LeadStage, lostReason?: string) {
  return ok(await supabase.rpc('set_lead_stage', { p_client: clientId, p_stage: stage, p_lost_reason: lostReason ?? null }));
}

// ── Assignment / review ──────────────────────────────────────────────────────
export async function assignTask(_actor: string, input: AssignInput) {
  return ok(await supabase.rpc('assign_task', { p_project: input.projectId, p_type: input.type, p_assignee: input.assigneeId, p_due: input.dueDate ?? null }));
}

export async function submitReview(_actor: string, input: ReviewInput) {
  return ok(await supabase.rpc('submit_review', { p_project: input.projectId, p_outcome: input.outcome, p_feedback: input.feedback ?? null, p_assignee: input.assigneeId ?? null }));
}

/** Attach proof (Drive link + screenshot URL) to any task. */
export async function setTaskProof(_actor: string, taskId: string, url: string | null, imageUrl: string | null) {
  return ok(await supabase.from('tasks').update({ proof_url: url || null, proof_image_url: imageUrl }).eq('id', taskId).select().single());
}

// ── Task state machine (RPC) ─────────────────────────────────────────────────
export async function startTask(_actor: string, taskId: string, estimateMinutes: number) {
  return ok(await supabase.rpc('task_transition', { p_task: taskId, p_to: 'in_progress', p_estimate: estimateMinutes, p_note: null }));
}
export async function completeTask(_actor: string, taskId: string, opts: { delayNote?: string; actualMinutes?: number } = {}) {
  return ok(await supabase.rpc('task_transition', { p_task: taskId, p_to: 'completed', p_estimate: null, p_note: opts.delayNote ?? null }));
}
export async function blockTask(_actor: string, taskId: string, reason: string) {
  return ok(await supabase.rpc('task_transition', { p_task: taskId, p_to: 'blocked', p_estimate: null, p_note: reason }));
}
export async function resumeTask(_actor: string, taskId: string) {
  return ok(await supabase.rpc('task_transition', { p_task: taskId, p_to: 'in_progress', p_estimate: null, p_note: null }));
}
export async function reestimate(_actor: string, taskId: string, estimateMinutes: number) {
  return ok(await supabase.from('tasks').update({ estimate_minutes: estimateMinutes }).eq('id', taskId).select().single());
}
export async function logHours(_actor: string, taskId: string, minutes: number) {
  return ok(await supabase.rpc('log_hours', { p_task: taskId, p_minutes: minutes }));
}

// ── Reassignment + upload proof (Phase B) ────────────────────────────────────
export async function reassignTask(_actor: string, taskId: string, assigneeId: string) {
  return ok(await supabase.rpc('reassign_task', { p_task: taskId, p_assignee: assigneeId }));
}

/** Upload a proof screenshot to Storage and return its public URL. */
export async function uploadProofImage(file: File): Promise<string | null> {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${safe}`;
  const { error } = await supabase.storage.from('proofs').upload(path, file);
  if (error) throw new EngineError('upload', error.message);
  return supabase.storage.from('proofs').getPublicUrl(path).data.publicUrl;
}

export async function completeUpload(_actor: string, taskId: string, url: string, imageUrl: string | null) {
  return ok(await supabase.rpc('complete_upload', { p_task: taskId, p_url: url, p_image_url: imageUrl }));
}

export async function completeOnboarding(_actor: string, fullName: string, phone: string, role: string, employment: string) {
  return ok(await supabase.rpc('complete_onboarding', { p_full_name: fullName, p_phone: phone, p_role: role, p_employment: employment }));
}

// ── Team directory + role management (admin) ─────────────────────────────────
export interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: 'ceo' | 'admin' | 'staff' | 'anchor' | 'scriptwriter' | 'salesperson';
  employment_type: 'employee' | 'freelancer';
  is_active: boolean;
  onboarded: boolean;
}
export async function teamMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase.rpc('team_members');
  if (error) throw new EngineError('rpc', error.message);
  return (data ?? []) as TeamMember[];
}
export async function setUserRole(_actor: string, userId: string, role: string) {
  return ok(await supabase.from('profiles').update({ role }).eq('id', userId).select());
}

// ── Cancel project / stop-work (manager) ─────────────────────────────────────
export async function cancelProject(_a: string, projectId: string, reason: string) {
  return ok(await supabase.rpc('cancel_project', { p_project: projectId, p_reason: reason || null }));
}

// ── Guided workflow controls ─────────────────────────────────────────────────
export async function waiveScript(_a: string, projectId: string) {
  return ok(await supabase.rpc('waive_script', { p_project: projectId }));
}
/** Admin OR CEO delivers the final video with proof. */
export async function managerDeliver(_a: string, projectId: string, url: string, imageUrl: string | null) {
  return ok(await supabase.rpc('manager_deliver', { p_project: projectId, p_url: url, p_image_url: imageUrl }));
}
/** Manager manual forward-only stage advance (skip a step). */
export async function advanceStage(_a: string, projectId: string, note?: string) {
  return ok(await supabase.rpc('advance_stage', { p_project: projectId, p_note: note ?? null }));
}

// ── Scriptwriter deliverable ─────────────────────────────────────────────────
export async function requestScript(_a: string, projectId: string, writerId: string, brief?: string, note?: string) {
  return ok(await supabase.rpc('request_script', { p_project: projectId, p_writer: writerId, p_brief: brief ?? null, p_note: note ?? null }));
}
export async function respondScript(_a: string, requestId: string, accept: boolean) {
  return ok(await supabase.rpc('respond_script', { p_request: requestId, p_accept: accept }));
}
export async function submitScript(_a: string, requestId: string, text: string) {
  return ok(await supabase.rpc('submit_script', { p_request: requestId, p_text: text }));
}
export async function completeScript(_a: string, requestId: string) {
  return ok(await supabase.rpc('complete_script', { p_request: requestId }));
}

/** Upload an arbitrary doc to Storage (reuses the proofs bucket) → public URL. */
export async function uploadDoc(file: File): Promise<string | null> {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `docs/${Date.now()}-${Math.random().toString(36).slice(2)}-${safe}`;
  const { error } = await supabase.storage.from('proofs').upload(path, file);
  if (error) throw new EngineError('upload', error.message);
  return supabase.storage.from('proofs').getPublicUrl(path).data.publicUrl;
}

// ── Salesperson lead intake (submit-only) ────────────────────────────────────
export interface SubmitLeadInput {
  name: string;
  company?: string;
  contact_phone?: string;
  contact_email?: string;
  requirements?: string;
  source?: string;
}
export async function submitLead(_a: string, input: SubmitLeadInput) {
  return ok(
    await supabase.rpc('submit_lead', {
      p_name: input.name.trim(),
      p_company: input.company?.trim() || null,
      p_phone: input.contact_phone?.trim() || null,
      p_email: input.contact_email?.trim() || null,
      p_requirements: input.requirements?.trim() || null,
      p_source: input.source?.trim() || null,
    }),
  );
}

// ── Anchors ──────────────────────────────────────────────────────────────────
export async function requestAnchor(_a: string, projectId: string, anchorId: string, location: string, note?: string) {
  return ok(await supabase.rpc('request_anchor', { p_project: projectId, p_anchor: anchorId, p_location: location || null, p_note: note ?? null }));
}
export async function respondAnchor(_a: string, requestId: string, accept: boolean) {
  return ok(await supabase.rpc('respond_anchor', { p_request: requestId, p_accept: accept }));
}
export async function anchorReport(_a: string, requestId: string) {
  return ok(await supabase.rpc('anchor_report', { p_request: requestId }));
}
export async function anchorComplete(_a: string, requestId: string) {
  return ok(await supabase.rpc('anchor_complete', { p_request: requestId }));
}

// ── Attachments (links + images) ─────────────────────────────────────────────
export async function addAttachment(userId: string, parentType: string, parentId: string, kind: 'link' | 'image', url: string, caption?: string) {
  return ok(await supabase.from('attachments').insert({ parent_type: parentType, parent_id: parentId, kind, url, caption: caption ?? null, created_by: userId }).select().single());
}

// ── Notes + notifications ────────────────────────────────────────────────────
export async function addProjectNote(_actor: string, projectId: string, body: string, isQuestion = false) {
  return ok(await supabase.rpc('add_project_note', { p_project: projectId, p_body: body, p_is_question: isQuestion }));
}
export async function markRead(_userId: string, id: string) {
  return ok(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).select());
}
export async function markAllRead(userId: string) {
  return ok(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null).eq('recipient_id', userId).select());
}
