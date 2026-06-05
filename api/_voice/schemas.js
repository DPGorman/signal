// Signal — Per-craft output schema hints (F11)
// Ties the capture-mode `dimensions` and `invitations.duration` output fields
// to each craft's vocabulary. Injected as a short addendum in the stable prompt
// block by composePrompt() in assemble.js.
//
// dimensions: labels the AI should choose from when populating the `dimensions`
//   array in capture output. 2–3 per capture, drawn from this list.
// durations: per-category default for invitation duration_minutes. The AI uses
//   these as anchors — it can deviate when context demands, but should not
//   invent arbitrary numbers.

export const CRAFT_SCHEMAS = {
  screenwriter: {
    dimensions: [
      "form_home",
      "current_phase",
      "room_status",
      "arc_position",
      "voice_fingerprint",
      "current_irons",
    ],
    durations: {
      scene: 60, dialogue: 60, character: 60,
      arc: 120, premise: 120,
      production: 90, research: 60, business: 30,
    },
  },

  novelist: {
    dimensions: [
      "publishing_context",
      "draft_stage",
      "drafting_voice",
      "sentence_dna",
      "current_book",
    ],
    durations: {
      "structure": 120, "voice/prose": 120,
      scene: 60, character: 60,
      research: 45, production: 60, business: 30, premise: 90,
    },
  },

  fashion_designer: {
    dimensions: [
      "practice_scale",
      "production_posture",
      "current_pressure",
      "category",
      "reference_fingerprint",
    ],
    durations: {
      silhouette: 90, textile: 90, color: 60, pattern: 60,
      production: 60, merchandising: 30, reference: 45, business: 30,
    },
  },

  architect: {
    dimensions: [
      "project_type",
      "current_phase",
      "material_vocabulary",
      "bim_stack",
      "practice_scale",
    ],
    durations: {
      concept: 90, site: 60, program: 60, materials: 90,
      client: 45, regulatory: 30, precedent: 60, production: 30,
    },
  },

  interior_designer: {
    dimensions: [
      "practice_type",
      "project_scale",
      "current_pressure",
      "aesthetic_lineage",
      "sourcing_fluency",
    ],
    durations: {
      concept: 90, room: 90, "material & palette": 60,
      "specification & sourcing": 30, "reference & influence": 45,
      "project arc": 60, client: 45, business: 30,
    },
  },

  chef: {
    dimensions: [
      "restaurant_context",
      "cuisine_lineage",
      "menu_cadence",
      "current_pressure",
      "palate_fingerprint",
    ],
    durations: {
      ingredient: 60, dish: 60, technique: 60,
      menu: 90, service: 30, research: 45, restaurant: 60,
    },
  },

  illustrator: {
    dimensions: [
      "work_category",
      "medium_stack",
      "style_fingerprint",
      "ai_posture",
      "rep_status",
    ],
    durations: {
      "brief / idea": 60, "thumbnails / layout": 60, roughs: 90,
      "production WIP": 90, "AD notes / revision log": 30,
      "finals / tear sheets": 60, "business / studio": 30,
      "reference / source": 45,
    },
  },

  game_designer: {
    dimensions: [
      "game_scale",
      "genre_home",
      "platform_target",
      "production_phase",
      "design_voice",
    ],
    durations: {
      "verb / core loop": 90, "fantasy / pillars": 90,
      "systems / economy": 120, "level / pacing": 60,
      "game feel / juice": 60, "narrative / character": 60,
      "production / scope": 30, "player / market": 30,
    },
  },

  ux_designer: {
    dimensions: [
      "practice_type",
      "design_system_maturity",
      "project_phase",
      "eng_relationship",
      "craft_focus",
    ],
    durations: {
      "problem framing": 60, "research signal": 60,
      "flow / IA": 90, "component / system thinking": 60,
      "critique / decision rationale": 45,
      "eng / scope tension": 45, "QA / polish": 30,
      "career / craft state": 30,
    },
  },

  founder: {
    dimensions: [
      "stage",
      "funding_status",
      "revenue_motion",
      "team_size",
      "founder_archetype",
    ],
    durations: {
      "thesis / strategy": 120, "customer signal": 60,
      "product / roadmap": 90, "capital / runway": 45,
      "team / hiring / ops": 45,
      "narrative / deck / external story": 60,
      "decision / tradeoff": 30, "founder state": 30,
    },
  },
};
