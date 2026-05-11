import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://czgjbblkoyyojnaziyuy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_JPqw3yu6o4BBwqEVQoazpw_q1dRtc7K";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
