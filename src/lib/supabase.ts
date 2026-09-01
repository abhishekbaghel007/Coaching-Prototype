import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wtdqllletvmlikgkczqj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_va2pO_jckCOUOPnGBgv24g_zVPYWMEt';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
