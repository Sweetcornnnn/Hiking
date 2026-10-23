import { supabase } from '../lib/supabase';

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
}

export const emergencyContactsService = {
  async load(): Promise<EmergencyContact[]> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw new Error(userError.message);
    if (!user) throw new Error('Sign in to manage emergency contacts.');

    const { data, error } = await supabase
      .from('emergency_contact_lists')
      .select('contacts')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.contacts ?? [];
  },

  async save(contacts: EmergencyContact[]): Promise<void> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw new Error(userError.message);
    if (!user) throw new Error('Sign in to save emergency contacts.');

    const { error } = await supabase
      .from('emergency_contact_lists')
      .upsert(
        { user_id: user.id, contacts, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
    if (error) throw new Error(error.message);
  },
};
