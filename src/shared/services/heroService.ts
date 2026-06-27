import { supabase } from '@/integrations/supabase/client';

export interface HeroSettings {
  id?: string;
  title: string;
  subtitle: string;
  description: string | null;
  primary_button_text: string | null;
  primary_button_url: string | null;
  secondary_button_text: string | null;
  secondary_button_url: string | null;
  hero_image: string | null;
  background_image: string | null;
  badge_text: string | null;
  updated_at?: string;
  updated_by?: string | null;
}

export const heroService = {
  getHeroSettings: async (): Promise<HeroSettings | null> => {
    try {
      const { data, error } = await (supabase as any)
        .from('hero_settings')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000000')
        .maybeSingle();

      if (error) {
        console.warn('Postgrest error fetching hero settings:', error);
        return null;
      }
      return data as HeroSettings | null;
    } catch (err) {
      console.warn('Failed to retrieve hero settings:', err);
      return null;
    }
  },

  updateHeroSettings: async (settings: Partial<HeroSettings>): Promise<HeroSettings> => {
    const cleanSettings = { ...settings };
    delete cleanSettings.id;
    delete cleanSettings.updated_at;
    delete cleanSettings.updated_by;

    const { data, error } = await (supabase as any)
      .from('hero_settings')
      .update(cleanSettings)
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .select()
      .single();

    if (error) throw error;
    return data as HeroSettings;
  }
};
