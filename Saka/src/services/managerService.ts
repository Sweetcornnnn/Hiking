import { supabase } from '../lib/supabase';
import type { Mountain } from './mountainService';
import type { MountainTips } from '../data/mountainTips';

export interface ManagerMountainContent {
  mountain_id: string;
  tips_data: MountainTips;
}

export interface ManagedViewpoint {
  id: string;
  mountain_id: string;
  name: string;
  subtitle: string;
  description: string;
  elevation: string | null;
  distance_from_start: string | null;
  estimated_hike: string | null;
  best_time: string | null;
  difficulty: string;
  trail_status: string;
  crowd_level: string;
  tags: string[];
  features: { icon: string; text: string; safe: boolean }[];
  trail_notes: string[];
}

export const createEmptyMountainTips = (mountainId: string, mountainName: string): MountainTips => ({
  id: mountainId,
  mountainName,
  preparation: [],
  safety: [],
  transportation: [],
  trailTips: [],
  etiquette: [],
  alerts: [],
});

export function isMountainTips(value: unknown): value is MountainTips {
  if (!value || typeof value !== 'object') return false;
  const tips = value as Record<string, unknown>;
  return typeof tips.id === 'string'
    && typeof tips.mountainName === 'string'
    && isStringArray(tips.preparation)
    && isStringArray(tips.safety)
    && isStringArray(tips.transportation)
    && isStringArray(tips.trailTips)
    && isStringArray(tips.etiquette)
    && Array.isArray(tips.alerts)
    && tips.alerts.every((alert) => isRecord(alert)
      && (alert.type === 'danger' || alert.type === 'warning' || alert.type === 'info')
      && typeof alert.title === 'string'
      && typeof alert.message === 'string'
      && (alert.date === undefined || typeof alert.date === 'string'))
    && isMountainTipsShape(tips);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function hasOptionalString(record: Record<string, unknown>, key: string): boolean {
  return record[key] === undefined || typeof record[key] === 'string';
}

function isLabelArray(value: unknown, detailKey: 'value' | 'amount' | 'detail'): boolean {
  return Array.isArray(value) && value.every((item) => isRecord(item)
    && typeof item.label === 'string'
    && hasOptionalString(item, detailKey)
    && (detailKey !== 'value' && detailKey !== 'amount' || typeof item[detailKey] === 'string'));
}

function isMountainTipsShape(tips: Record<string, unknown>): boolean {
  const preparationGuide = tips.preparationGuide;
  const safetyGuide = tips.safetyGuide;
  const transportGuide = tips.transportGuide;
  const trailGuide = tips.trailGuide;
  const etiquetteGuide = tips.etiquetteGuide;

  return (preparationGuide === undefined || (isRecord(preparationGuide)
      && (preparationGuide.facts === undefined || isLabelArray(preparationGuide.facts, 'value'))
      && (preparationGuide.fees === undefined || isLabelArray(preparationGuide.fees, 'amount'))
      && (preparationGuide.bring === undefined || isStringArray(preparationGuide.bring))
      && hasOptionalString(preparationGuide, 'note')))
    && (safetyGuide === undefined || (isRecord(safetyGuide)
      && (safetyGuide.hazards === undefined || isLabelArray(safetyGuide.hazards, 'detail'))
      && hasOptionalString(safetyGuide, 'weather')
      && hasOptionalString(safetyGuide, 'emergency')
      && hasOptionalString(safetyGuide, 'note')))
    && (transportGuide === undefined || (isRecord(transportGuide)
      && typeof transportGuide.startPoint === 'string'
      && Array.isArray(transportGuide.options)
      && transportGuide.options.every((option) => isRecord(option)
        && typeof option.vehicle === 'string'
        && (option.kind === undefined || typeof option.kind === 'string')
        && (option.pricePerPerson === undefined || typeof option.pricePerPerson === 'string' || typeof option.pricePerPerson === 'number')
        && hasOptionalString(option, 'note'))
      && hasOptionalString(transportGuide, 'tip')))
    && (trailGuide === undefined || (isRecord(trailGuide)
      && typeof trailGuide.startPoint === 'string'
      && (trailGuide.stops === undefined || isLabelArray(trailGuide.stops, 'detail'))
      && (trailGuide.landmarks === undefined || isStringArray(trailGuide.landmarks))
      && hasOptionalString(trailGuide, 'dropOff')
      && hasOptionalString(trailGuide, 'water')
      && hasOptionalString(trailGuide, 'tip')))
    && (etiquetteGuide === undefined || (isRecord(etiquetteGuide)
      && (etiquetteGuide.rules === undefined || isLabelArray(etiquetteGuide.rules, 'detail'))
      && hasOptionalString(etiquetteGuide, 'local')
      && hasOptionalString(etiquetteGuide, 'note')));
}

type LegacyManagerContent = {
  transport_info?: string | null;
  permit_info?: string | null;
  operating_hours?: string | null;
  preparation_info?: string[] | null;
  safety_info?: string[] | null;
  trail_tips?: string[] | null;
  etiquette_info?: string[] | null;
  announcements?: string[] | null;
};

function applyLegacyContent(tips: MountainTips, row: LegacyManagerContent): MountainTips {
  const preparation = row.preparation_info ?? [];
  const safety = row.safety_info ?? [];
  const trailTips = row.trail_tips ?? [];
  const etiquette = row.etiquette_info ?? [];
  const announcements = (row.announcements ?? []).filter((message) => message.trim()).map((message) => ({
    type: 'info' as const,
    title: 'Official announcement',
    message,
  }));
  const hasLegacyPreparation = preparation.length > 0
    || Boolean(row.permit_info?.trim())
    || Boolean(row.operating_hours?.trim());

  return {
    ...tips,
    transportation: row.transport_info?.trim() ? [row.transport_info] : tips.transportation,
    transportGuide: row.transport_info?.trim() ? undefined : tips.transportGuide,
    preparation: hasLegacyPreparation
      ? [
          ...preparation,
          row.permit_info?.trim() ?? '',
          row.operating_hours?.trim() ? `Operating hours: ${row.operating_hours}` : '',
        ].filter(Boolean)
      : tips.preparation,
    preparationGuide: hasLegacyPreparation ? undefined : tips.preparationGuide,
    safety: safety.length > 0 ? safety : tips.safety,
    safetyGuide: safety.length > 0 ? undefined : tips.safetyGuide,
    trailTips: trailTips.length > 0 ? trailTips : tips.trailTips,
    trailGuide: trailTips.length > 0 ? undefined : tips.trailGuide,
    etiquette: etiquette.length > 0 ? etiquette : tips.etiquette,
    etiquetteGuide: etiquette.length > 0 ? undefined : tips.etiquetteGuide,
    alerts: [...announcements, ...tips.alerts],
  };
}

export const managerService = {
  async fetchAssignedMountains(userId: string): Promise<Mountain[]> {
    const { data: assignments, error: assignmentError } = await supabase
      .from('mountain_manager_assignments')
      .select('mountain_id')
      .eq('manager_id', userId);
    if (assignmentError) throw new Error(`Unable to load mountain assignments: ${assignmentError.message}`);
    const mountainIds = (assignments ?? []).map((row) => row.mountain_id);
    if (mountainIds.length === 0) return [];

    const { data, error } = await supabase
      .from('mountains')
      .select('*')
      .in('id', mountainIds);
    if (error) throw new Error(`Unable to load assigned mountains: ${error.message}`);
    return (data ?? []) as Mountain[];
  },

  async fetchContent(mountainId: string, mountainName = 'Mountain'): Promise<ManagerMountainContent> {
    const { data, error } = await supabase
      .from('mountain_manager_content')
      .select('mountain_id, tips_data, transport_info, permit_info, operating_hours, preparation_info, safety_info, trail_tips, etiquette_info, announcements')
      .eq('mountain_id', mountainId)
      .maybeSingle();
    if (error) throw new Error(`Unable to load mountain information: ${error.message}`);
    if (!data) return { mountain_id: mountainId, tips_data: createEmptyMountainTips(mountainId, mountainName) };
    if (!isMountainTips(data.tips_data)) {
      if (isRecord(data.tips_data) && Object.keys(data.tips_data).length === 0) {
        return {
          mountain_id: mountainId,
          tips_data: applyLegacyContent(createEmptyMountainTips(mountainId, mountainName), data),
        };
      }
      throw new Error('Mountain guide data in Supabase is invalid. Ask an administrator to review it.');
    }
    return { mountain_id: data.mountain_id, tips_data: applyLegacyContent(data.tips_data, data) };
  },

  async fetchAllTips(): Promise<MountainTips[]> {
    const { data, error } = await supabase
      .from('mountain_manager_content')
      .select('mountain_id, tips_data, transport_info, permit_info, operating_hours, preparation_info, safety_info, trail_tips, etiquette_info, announcements')
      .order('mountain_id');
    if (error) throw new Error(`Unable to load mountain tips: ${error.message}`);
    return (data ?? []).map((row) => {
      if (isMountainTips(row.tips_data)) return applyLegacyContent(row.tips_data, row);
      if (isRecord(row.tips_data) && Object.keys(row.tips_data).length === 0) {
        return applyLegacyContent(createEmptyMountainTips(row.mountain_id, ''), row);
      }
      throw new Error(`Mountain guide data for ${row.mountain_id} in Supabase is invalid.`);
    });
  },

  async fetchViewpoints(mountainId: string): Promise<ManagedViewpoint[]> {
    const { data, error } = await supabase
      .from('viewpoints')
      .select('id, mountain_id, name, subtitle, description, elevation, distance_from_start, estimated_hike, best_time, difficulty, trail_status, crowd_level, tags, features, trail_notes')
      .eq('mountain_id', mountainId)
      .order('name');
    if (error) throw new Error(`Unable to load viewpoints: ${error.message}`);
    return (data ?? []).map((row) => ({
      ...row,
      crowd_level: row.crowd_level ?? 'Low',
      tags: Array.isArray(row.tags) ? row.tags : [],
      features: Array.isArray(row.features)
        ? row.features.flatMap((feature) => {
            if (!feature || typeof feature !== 'object' || Array.isArray(feature)) return [];
            const record = feature as Record<string, unknown>;
            return typeof record.icon === 'string' && typeof record.text === 'string'
              ? [{ icon: record.icon, text: record.text, safe: record.safe === true }]
              : [];
          })
        : [],
      trail_notes: Array.isArray(row.trail_notes) ? row.trail_notes : [],
    })) as ManagedViewpoint[];
  },

  async saveMountain(mountainId: string, values: Pick<Mountain, 'name' | 'description' | 'difficulty' | 'elevation' | 'location'>): Promise<void> {
    const { error } = await supabase
      .from('mountains')
      .update(values)
      .eq('id', mountainId);
    if (error) throw new Error(`Unable to save mountain details: ${error.message}`);
  },

  async saveContent(content: ManagerMountainContent): Promise<void> {
    const { error } = await supabase
      .from('mountain_manager_content')
      .upsert({
        ...content,
        transport_info: '',
        permit_info: '',
        operating_hours: '',
        preparation_info: [],
        safety_info: [],
        trail_tips: [],
        etiquette_info: [],
        announcements: [],
      }, { onConflict: 'mountain_id' });
    if (error) throw new Error(`Unable to save mountain information: ${error.message}`);
  },

  async saveViewpoint(viewpoint: ManagedViewpoint): Promise<void> {
    const { error } = await supabase
      .from('viewpoints')
      .update({
        name: viewpoint.name,
        subtitle: viewpoint.subtitle,
        description: viewpoint.description,
        elevation: viewpoint.elevation,
        distance_from_start: viewpoint.distance_from_start,
        estimated_hike: viewpoint.estimated_hike,
        best_time: viewpoint.best_time,
        difficulty: viewpoint.difficulty,
        trail_status: viewpoint.trail_status,
        crowd_level: viewpoint.crowd_level,
        tags: viewpoint.tags,
        features: viewpoint.features,
        trail_notes: viewpoint.trail_notes,
      })
      .eq('id', viewpoint.id)
      .eq('mountain_id', viewpoint.mountain_id);
    if (error) throw new Error(`Unable to save viewpoint: ${error.message}`);
  },

  async isAssignedToMountain(userId: string, mountainId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('mountain_manager_assignments')
      .select('mountain_id')
      .eq('manager_id', userId)
      .eq('mountain_id', mountainId)
      .maybeSingle();
    if (error) throw new Error(`Unable to verify mountain assignment: ${error.message}`);
    return !!data;
  },

  async removeSakagramPost(postId: string): Promise<void> {
    const { error } = await supabase
      .from('hiking_journals')
      .delete()
      .eq('id', postId);
    if (error) throw new Error(`Unable to remove Sakagram post: ${error.message}`);
  },

  async removeMountainChatMessage(messageId: number): Promise<void> {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId);
    if (error) throw new Error(`Unable to remove mountain chat message: ${error.message}`);
  },
};
