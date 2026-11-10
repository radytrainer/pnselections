/**
 * Hand-authored to match docs/04-schema.sql. Once the schema is applied to
 * a live project, prefer regenerating from the source of truth:
 *
 *   npx supabase gen types typescript --project-id <project-ref> > types/database.types.ts
 *
 * (or `--local` against `supabase start`). Keep this file's shape in sync
 * with docs/04-schema.sql until then.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      provinces: {
        Row: {
          id: string;
          code: string;
          name_en: string;
          name_kh: string | null;
          geojson_property_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name_en: string;
          name_kh?: string | null;
          geojson_property_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["provinces"]["Insert"]>;
        Relationships: [];
      };
      districts: {
        Row: {
          id: string;
          province_id: string;
          name_en: string;
          name_kh: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          province_id: string;
          name_en: string;
          name_kh?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["districts"]["Insert"]>;
        Relationships: [];
      };
      communes: {
        Row: {
          id: string;
          district_id: string;
          name_en: string;
          name_kh: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          district_id: string;
          name_en: string;
          name_kh?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["communes"]["Insert"]>;
        Relationships: [];
      };
      villages: {
        Row: {
          id: string;
          commune_id: string;
          name_en: string;
          name_kh: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          commune_id: string;
          name_en: string;
          name_kh?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["villages"]["Insert"]>;
        Relationships: [];
      };
      selection_cycles: {
        Row: {
          id: string;
          year: number;
          name: string;
          start_date: string;
          end_date: string | null;
          exam_pass_threshold: number;
          status: "planning" | "active" | "closed" | "archived";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          year: number;
          name: string;
          start_date: string;
          end_date?: string | null;
          exam_pass_threshold?: number;
          status?: "planning" | "active" | "closed" | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["selection_cycles"]["Insert"]>;
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          firebase_uid: string;
          email: string;
          full_name: string;
          phone: string | null;
          avatar_url: string | null;
          status: "active" | "suspended" | "invited";
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          firebase_uid: string;
          email: string;
          full_name: string;
          phone?: string | null;
          avatar_url?: string | null;
          status?: "active" | "suspended" | "invited";
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
      roles: {
        Row: { id: string; name: string; description: string | null };
        Insert: { id?: string; name: string; description?: string | null };
        Update: Partial<Database["public"]["Tables"]["roles"]["Insert"]>;
        Relationships: [];
      };
      user_roles: {
        Row: {
          user_id: string;
          role_id: string;
          granted_at: string;
          granted_by: string | null;
        };
        Insert: {
          user_id: string;
          role_id: string;
          granted_at?: string;
          granted_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Insert"]>;
        Relationships: [];
      };
      ngo_partners: {
        Row: {
          id: string;
          organization_name: string;
          contact_person: string | null;
          phone: string | null;
          email: string | null;
          website: string | null;
          province_id: string | null;
          district_name: string | null;
          lat: number | null;
          lng: number | null;
          notes: string | null;
          logo_url: string | null;
          outreach_status: "not_contacted" | "contacted" | "in_discussion" | "active_partner" | "inactive";
          last_contacted_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_name: string;
          contact_person?: string | null;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          province_id?: string | null;
          district_name?: string | null;
          lat?: number | null;
          lng?: number | null;
          notes?: string | null;
          logo_url?: string | null;
          outreach_status?: "not_contacted" | "contacted" | "in_discussion" | "active_partner" | "inactive";
          last_contacted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["ngo_partners"]["Insert"]>;
        Relationships: [];
      };
      ngo_projects: {
        Row: {
          id: string;
          ngo_id: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          ngo_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ngo_projects"]["Insert"]>;
        Relationships: [];
      };
      user_ngo_link: {
        Row: { user_id: string; ngo_id: string };
        Insert: { user_id: string; ngo_id: string };
        Update: Partial<Database["public"]["Tables"]["user_ngo_link"]["Insert"]>;
        Relationships: [];
      };
      school_partners: {
        Row: {
          id: string;
          school_name: string;
          principal_name: string | null;
          phone: string | null;
          email: string | null;
          province_id: string | null;
          district_name: string | null;
          lat: number | null;
          lng: number | null;
          logo_url: string | null;
          outreach_status: "not_contacted" | "contacted" | "in_discussion" | "active_partner" | "inactive";
          last_contacted_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          school_name: string;
          principal_name?: string | null;
          phone?: string | null;
          email?: string | null;
          province_id?: string | null;
          district_name?: string | null;
          lat?: number | null;
          lng?: number | null;
          logo_url?: string | null;
          outreach_status?: "not_contacted" | "contacted" | "in_discussion" | "active_partner" | "inactive";
          last_contacted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["school_partners"]["Insert"]>;
        Relationships: [];
      };
      students: {
        Row: {
          id: string;
          student_global_id: string;
          student_code: string;
          cycle_id: string;
          first_name: string;
          last_name: string;
          gender: "male" | "female" | "lgbtqia+";
          dob: string | null;
          phone: string | null;
          photo_drive_url: string | null;
          province_id: string | null;
          district_name: string | null;
          commune_name: string | null;
          village_name: string | null;
          school_id: string | null;
          grade: string | null;
          gpa: number | null;
          english_level: "none" | "beginner" | "intermediate" | "advanced" | null;
          father_name: string | null;
          mother_name: string | null;
          parent_occupation: string | null;
          family_income_monthly: number | null;
          siblings_count: number | null;
          referred_by_ngo_id: string | null;
          information_session: string | null;
          exam_center: string | null;
          eligible_for_social_investigation: boolean;
          status:
            | "registered"
            | "exam_completed"
            | "interview_completed"
            | "home_visit_completed"
            | "committee_review"
            | "selected"
            | "waitlisted"
            | "rejected"
            | "eliminated"
            | "declined"
            | "dropped_out";
          elimination_reason: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          student_global_id?: string;
          student_code: string;
          cycle_id: string;
          first_name: string;
          last_name: string;
          gender: "male" | "female" | "lgbtqia+";
          dob?: string | null;
          phone?: string | null;
          photo_drive_url?: string | null;
          province_id?: string | null;
          district_name?: string | null;
          commune_name?: string | null;
          village_name?: string | null;
          school_id?: string | null;
          grade?: string | null;
          gpa?: number | null;
          english_level?: "none" | "beginner" | "intermediate" | "advanced" | null;
          father_name?: string | null;
          mother_name?: string | null;
          parent_occupation?: string | null;
          family_income_monthly?: number | null;
          siblings_count?: number | null;
          referred_by_ngo_id?: string | null;
          information_session?: string | null;
          exam_center?: string | null;
          eligible_for_social_investigation?: boolean;
          status?:
            | "registered"
            | "exam_completed"
            | "interview_completed"
            | "home_visit_completed"
            | "committee_review"
            | "selected"
            | "waitlisted"
            | "rejected"
            | "eliminated"
            | "declined"
            | "dropped_out";
          elimination_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["students"]["Insert"]>;
        Relationships: [];
      };
      student_documents: {
        Row: {
          id: string;
          student_id: string;
          doc_type: "photo" | "id_card" | "transcript" | "certificate" | "other";
          file_path: string;
          uploaded_by: string | null;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          doc_type: "photo" | "id_card" | "transcript" | "certificate" | "other";
          file_path: string;
          uploaded_by?: string | null;
          uploaded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["student_documents"]["Insert"]>;
        Relationships: [];
      };
      exam_results: {
        Row: {
          id: string;
          student_id: string;
          cycle_id: string;
          math_score: number;
          english_score: number;
          logic_score: number;
          computer_score: number;
          /** Generated column (math+english+logic+computer); read-only. */
          total_score: number;
          rank_in_province: number | null;
          rank_in_cycle: number | null;
          pass_status: "pass" | "fail" | null;
          exam_date: string;
          entered_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          cycle_id: string;
          math_score: number;
          english_score: number;
          logic_score: number;
          computer_score: number;
          rank_in_province?: number | null;
          rank_in_cycle?: number | null;
          pass_status?: "pass" | "fail" | null;
          exam_date?: string;
          entered_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["exam_results"]["Insert"]>;
        Relationships: [];
      };
      interviews: {
        Row: {
          id: string;
          student_id: string;
          cycle_id: string;
          q1_score: number | null;
          q2_score: number | null;
          q3_score: number | null;
          q4_score: number | null;
          q5_score: number | null;
          q6_score: number | null;
          q7_score: number | null;
          q8_score: number | null;
          q9_score: number | null;
          q10_score: number | null;
          q11_score: number | null;
          q12_score: number | null;
          q13_score: number | null;
          q14_score: number | null;
          q15_score: number | null;
          q16_score: number | null;
          comments: string | null;
          recommendation: "A1" | "A2" | "not_recommended" | null;
          interviewer_id: string | null;
          interview_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          cycle_id: string;
          q1_score?: number | null;
          q2_score?: number | null;
          q3_score?: number | null;
          q4_score?: number | null;
          q5_score?: number | null;
          q6_score?: number | null;
          q7_score?: number | null;
          q8_score?: number | null;
          q9_score?: number | null;
          q10_score?: number | null;
          q11_score?: number | null;
          q12_score?: number | null;
          q13_score?: number | null;
          q14_score?: number | null;
          q15_score?: number | null;
          q16_score?: number | null;
          comments?: string | null;
          recommendation?: "A1" | "A2" | "not_recommended" | null;
          interviewer_id?: string | null;
          interview_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["interviews"]["Insert"]>;
        Relationships: [];
      };
      interview_categories: {
        Row: {
          id: string;
          name: string;
          display_order: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["interview_categories"]["Insert"]>;
        Relationships: [];
      };
      interview_questions: {
        Row: {
          id: string;
          category_id: string;
          text_en: string;
          text_km: string | null;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          category_id: string;
          text_en: string;
          text_km?: string | null;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["interview_questions"]["Insert"]>;
        Relationships: [];
      };
      interview_answers: {
        Row: {
          id: string;
          interview_id: string;
          question_id: string;
          score: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          interview_id: string;
          question_id: string;
          score: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["interview_answers"]["Insert"]>;
        Relationships: [];
      };
      home_visits: {
        Row: {
          id: string;
          student_id: string;
          cycle_id: string;
          visit_number: number;
          house_type: string | null;
          family_income: number | null;
          transportation: string | null;
          electricity_access: boolean;
          internet_access: boolean;
          family_condition_notes: string | null;
          recommendation:
            | "strongly_recommend"
            | "recommend"
            | "neutral"
            | "not_recommend"
            | null;
          visitor_id: string | null;
          visit_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          cycle_id: string;
          visit_number?: number;
          house_type?: string | null;
          family_income?: number | null;
          transportation?: string | null;
          electricity_access?: boolean;
          internet_access?: boolean;
          family_condition_notes?: string | null;
          recommendation?:
            | "strongly_recommend"
            | "recommend"
            | "neutral"
            | "not_recommend"
            | null;
          visitor_id?: string | null;
          visit_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["home_visits"]["Insert"]>;
        Relationships: [];
      };
      home_visit_media: {
        Row: {
          id: string;
          home_visit_id: string;
          media_type: "house_photo" | "family_photo" | "report";
          file_path: string;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          home_visit_id: string;
          media_type: "house_photo" | "family_photo" | "report";
          file_path: string;
          uploaded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["home_visit_media"]["Insert"]>;
        Relationships: [];
      };
      social_assessments: {
        Row: {
          id: string;
          student_id: string;
          cycle_id: string;
          visit_number: number;
          age: number | null;
          health_status: "healthy" | "simple_disease" | "chronic_disease" | null;
          ok_to_join_training: string | null;
          academic_rank: "outstanding_ab" | "good_cd" | "average_e" | null;
          academic_note: string | null;
          major: "science" | "social_science" | null;
          household_size_band: "1_3" | "4_6" | "7_plus" | null;
          household_size_note: string | null;
          dependents_band: "none" | "1_2" | "3_plus" | null;
          dependents_note: string | null;
          father_age: number | null;
          father_job: string | null;
          father_income: string | null;
          mother_age: number | null;
          mother_job: string | null;
          mother_income: string | null;
          child1_income: string | null;
          child2_income: string | null;
          child3_income: string | null;
          parent_occupation_band:
            | "unemployed"
            | "daily_laborer"
            | "farmer"
            | "mother"
            | "small_business"
            | "stable_salaried"
            | null;
          father_occupation_band:
            | "unemployed"
            | "daily_laborer"
            | "farmer"
            | "mother"
            | "small_business"
            | "stable_salaried"
            | null;
          mother_occupation_band:
            | "unemployed"
            | "daily_laborer"
            | "farmer"
            | "mother"
            | "small_business"
            | "stable_salaried"
            | null;
          house_owner: string | null;
          housing_type_band: "makeshift" | "wooden_zinc" | "brick_concrete" | "permanent" | null;
          house_status_band: "rented" | "family_fragile" | "family_fair" | "family_strong" | null;
          water_access_band: "river_pond" | "communal_well" | "own_well" | "piped" | null;
          electricity_access_band: "none" | "shared_solar" | "regular" | null;
          assets_furniture: number | null;
          assets_furniture_note: string | null;
          assets_transport: number | null;
          assets_transport_note: string | null;
          assets_electronics: number | null;
          assets_electronics_note: string | null;
          assets_livestock: number | null;
          assets_livestock_note: string | null;
          income_band: "lt_100" | "101_200" | "201_400" | "gt_400" | null;
          income_note: string | null;
          expenses_band: "lt_100" | "101_200" | "201_400" | "gt_400" | null;
          expenses_note: string | null;
          education_support_band: "no" | "maybe" | "yes" | null;
          education_support_note: string | null;
          father_education_band: "none" | "primary" | "secondary" | "high_school_above" | null;
          mother_education_band: "none" | "primary" | "secondary" | "high_school_above" | null;
          school_aged_children_studying: number | null;
          school_aged_children_working: number | null;
          school_attendance_band: "none" | "some_irregular" | "most_attend" | "all_attend" | null;
          debt_band: "no_debt" | "small_manageable" | "high_burden" | "very_high_risk" | null;
          debt_amount: string | null;
          debt_note: string | null;
          farm_land_band: "landless" | "small" | "medium" | "large" | null;
          farm_land_note: string | null;
          farm_income_band: "none" | "minimal" | "moderate" | "major" | null;
          plantation_land_band: "landless" | "small" | "medium" | "large" | null;
          plantation_income_band: "none" | "minimal" | "moderate" | "major" | null;
          vulnerability_orphan_single_parent: boolean;
          vulnerability_disability: boolean;
          vulnerability_chronic_illness: boolean;
          vulnerability_debt_burden: boolean;
          vulnerability_landless: boolean;
          vulnerability_note: string | null;
          husbandry_band: "none" | "small" | "medium" | "large" | null;
          husbandry_note: string | null;
          total_score: number;
          vulnerability_deduction: number;
          final_score: number;
          category: "very_poor" | "poor" | "medium" | "relatively_well_off";
          manual_failed: boolean;
          vac_income_employment: number | null;
          vac_food_security: number | null;
          vac_housing_conditions: number | null;
          vac_health_services: number | null;
          vac_education: number | null;
          vac_debt_finance: number | null;
          vac_assets_livelihoods: number | null;
          vac_social_protection: number | null;
          vac_family_structure: number | null;
          vac_shocks_risks: number | null;
          vac_water_sanitation: number | null;
          vac_psychological_vulnerability: number | null;
          vac_total_score: number | null;
          poverty_certificate: string | null;
          distance_from_town: string | null;
          visitor_name: string | null;
          visitor_comments: string | null;
          visitor_id: string | null;
          visit_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          cycle_id: string;
          visit_number?: number;
          age?: number | null;
          health_status?: "healthy" | "simple_disease" | "chronic_disease" | null;
          ok_to_join_training?: string | null;
          academic_rank?: "outstanding_ab" | "good_cd" | "average_e" | null;
          academic_note?: string | null;
          major?: "science" | "social_science" | null;
          household_size_band?: "1_3" | "4_6" | "7_plus" | null;
          household_size_note?: string | null;
          dependents_band?: "none" | "1_2" | "3_plus" | null;
          dependents_note?: string | null;
          father_age?: number | null;
          father_job?: string | null;
          father_income?: string | null;
          mother_age?: number | null;
          mother_job?: string | null;
          mother_income?: string | null;
          child1_income?: string | null;
          child2_income?: string | null;
          child3_income?: string | null;
          parent_occupation_band?:
            | "unemployed"
            | "daily_laborer"
            | "farmer"
            | "mother"
            | "small_business"
            | "stable_salaried"
            | null;
          father_occupation_band?:
            | "unemployed"
            | "daily_laborer"
            | "farmer"
            | "mother"
            | "small_business"
            | "stable_salaried"
            | null;
          mother_occupation_band?:
            | "unemployed"
            | "daily_laborer"
            | "farmer"
            | "mother"
            | "small_business"
            | "stable_salaried"
            | null;
          house_owner?: string | null;
          housing_type_band?: "makeshift" | "wooden_zinc" | "brick_concrete" | "permanent" | null;
          house_status_band?: "rented" | "family_fragile" | "family_fair" | "family_strong" | null;
          water_access_band?: "river_pond" | "communal_well" | "own_well" | "piped" | null;
          electricity_access_band?: "none" | "shared_solar" | "regular" | null;
          assets_furniture?: number | null;
          assets_furniture_note?: string | null;
          assets_transport?: number | null;
          assets_transport_note?: string | null;
          assets_electronics?: number | null;
          assets_electronics_note?: string | null;
          assets_livestock?: number | null;
          assets_livestock_note?: string | null;
          income_band?: "lt_100" | "101_200" | "201_400" | "gt_400" | null;
          income_note?: string | null;
          expenses_band?: "lt_100" | "101_200" | "201_400" | "gt_400" | null;
          expenses_note?: string | null;
          education_support_band?: "no" | "maybe" | "yes" | null;
          education_support_note?: string | null;
          father_education_band?: "none" | "primary" | "secondary" | "high_school_above" | null;
          mother_education_band?: "none" | "primary" | "secondary" | "high_school_above" | null;
          school_aged_children_studying?: number | null;
          school_aged_children_working?: number | null;
          school_attendance_band?: "none" | "some_irregular" | "most_attend" | "all_attend" | null;
          debt_band?: "no_debt" | "small_manageable" | "high_burden" | "very_high_risk" | null;
          debt_amount?: string | null;
          debt_note?: string | null;
          farm_land_band?: "landless" | "small" | "medium" | "large" | null;
          farm_land_note?: string | null;
          farm_income_band?: "none" | "minimal" | "moderate" | "major" | null;
          plantation_land_band?: "landless" | "small" | "medium" | "large" | null;
          plantation_income_band?: "none" | "minimal" | "moderate" | "major" | null;
          vulnerability_orphan_single_parent?: boolean;
          vulnerability_disability?: boolean;
          vulnerability_chronic_illness?: boolean;
          vulnerability_debt_burden?: boolean;
          vulnerability_landless?: boolean;
          vulnerability_note?: string | null;
          husbandry_band?: "none" | "small" | "medium" | "large" | null;
          husbandry_note?: string | null;
          total_score: number;
          vulnerability_deduction?: number;
          final_score: number;
          category: "very_poor" | "poor" | "medium" | "relatively_well_off";
          manual_failed?: boolean;
          vac_income_employment?: number | null;
          vac_food_security?: number | null;
          vac_housing_conditions?: number | null;
          vac_health_services?: number | null;
          vac_education?: number | null;
          vac_debt_finance?: number | null;
          vac_assets_livelihoods?: number | null;
          vac_social_protection?: number | null;
          vac_family_structure?: number | null;
          vac_shocks_risks?: number | null;
          vac_water_sanitation?: number | null;
          vac_psychological_vulnerability?: number | null;
          vac_total_score?: number | null;
          poverty_certificate?: string | null;
          distance_from_town?: string | null;
          visitor_name?: string | null;
          visitor_comments?: string | null;
          visitor_id?: string | null;
          visit_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["social_assessments"]["Insert"]>;
        Relationships: [];
      };
      committee_decisions: {
        Row: {
          id: string;
          student_id: string;
          cycle_id: string;
          decision: "selected" | "waitlisted" | "rejected" | "eliminated" | "declined" | null;
          decision_date: string | null;
          poor_level: "A+" | "A" | "A-" | "B+" | "B" | "B-" | null;
          approval_status: "pending" | "approved" | "rejected";
          approved_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          cycle_id: string;
          decision?: "selected" | "waitlisted" | "rejected" | "eliminated" | "declined" | null;
          decision_date?: string | null;
          poor_level?: "A+" | "A" | "A-" | "B+" | "B" | "B-" | null;
          approval_status?: "pending" | "approved" | "rejected";
          approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["committee_decisions"]["Insert"]>;
        Relationships: [];
      };
      committee_notes: {
        Row: {
          id: string;
          committee_decision_id: string;
          author_id: string;
          note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          committee_decision_id: string;
          author_id: string;
          note: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["committee_notes"]["Insert"]>;
        Relationships: [];
      };
      committee_ratings: {
        Row: {
          id: string;
          student_id: string;
          cycle_id: string;
          rated_by: string;
          criterion: "overall";
          score: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          cycle_id: string;
          rated_by?: string;
          criterion?: "overall";
          score: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["committee_ratings"]["Insert"]>;
        Relationships: [];
      };
      ai_summaries: {
        Row: {
          id: string;
          student_id: string;
          summary_type: "profile_summary" | "home_visit_report" | "selection_recommendation";
          content: string;
          model_version: string;
          generated_by: string | null;
          generated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          summary_type: "profile_summary" | "home_visit_report" | "selection_recommendation";
          content: string;
          model_version: string;
          generated_by?: string | null;
          generated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_summaries"]["Insert"]>;
        Relationships: [];
      };
      ai_query_logs: {
        Row: {
          id: string;
          user_id: string | null;
          question: string;
          generated_sql: string;
          row_count: number | null;
          was_executed: boolean;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          question: string;
          generated_sql: string;
          row_count?: number | null;
          was_executed?: boolean;
          error?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_query_logs"]["Insert"]>;
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          report_type: "province" | "gender" | "selection" | "ngo_performance" | "school_performance";
          format: "pdf" | "xlsx" | "csv";
          params: Json;
          file_path: string | null;
          generated_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_type: "province" | "gender" | "selection" | "ngo_performance" | "school_performance";
          format: "pdf" | "xlsx" | "csv";
          params?: Json;
          file_path?: string | null;
          generated_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reports"]["Insert"]>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          table_name: string;
          record_id: string;
          action: "insert" | "update" | "delete" | "soft_delete";
          changed_by: string | null;
          changed_at: string;
          old_data: Json | null;
          new_data: Json | null;
        };
        Insert: {
          id?: string;
          table_name: string;
          record_id: string;
          action: "insert" | "update" | "delete" | "soft_delete";
          changed_by?: string | null;
          changed_at?: string;
          old_data?: Json | null;
          new_data?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
        Relationships: [];
      };
      information_session_stats: {
        Row: {
          cycle_id: string;
          sessions_done: number;
          sessions_planned: number;
          sessions_without_date: number;
          sessions_without_hosting_partner: number;
          attendees_expected_boys: number;
          attendees_expected_girls: number;
          attendees_actual_boys: number;
          attendees_actual_girls: number;
          additional_expected_boys: number;
          additional_expected_girls: number;
          sessions_without_expected_number: number;
          applicants_total: number;
          applicants_girls: number;
          applicants_boys: number;
          updated_at: string;
        };
        Insert: {
          cycle_id: string;
          sessions_done?: number;
          sessions_planned?: number;
          sessions_without_date?: number;
          sessions_without_hosting_partner?: number;
          attendees_expected_boys?: number;
          attendees_expected_girls?: number;
          attendees_actual_boys?: number;
          attendees_actual_girls?: number;
          additional_expected_boys?: number;
          additional_expected_girls?: number;
          sessions_without_expected_number?: number;
          applicants_total?: number;
          applicants_girls?: number;
          applicants_boys?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["information_session_stats"]["Insert"]>;
        Relationships: [];
      };
      exam_center_stats: {
        Row: {
          cycle_id: string;
          centers_total: number;
          sessions_done: number;
          sessions_not_done: number;
          info_sessions_not_linked: number;
          applicants_total: number;
          applicants_not_assigned: number;
          applicants_without_schedule: number;
          updated_at: string;
        };
        Insert: {
          cycle_id: string;
          centers_total?: number;
          sessions_done?: number;
          sessions_not_done?: number;
          info_sessions_not_linked?: number;
          applicants_total?: number;
          applicants_not_assigned?: number;
          applicants_without_schedule?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["exam_center_stats"]["Insert"]>;
        Relationships: [];
      };
      exam_result_stats: {
        Row: {
          cycle_id: string;
          attended: number;
          absent: number;
          partially_attended: number;
          still_to_be_done: number;
          passed: number;
          passed_girls: number;
          passed_boys: number;
          updated_at: string;
        };
        Insert: {
          cycle_id: string;
          attended?: number;
          absent?: number;
          partially_attended?: number;
          still_to_be_done?: number;
          passed?: number;
          passed_girls?: number;
          passed_boys?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["exam_result_stats"]["Insert"]>;
        Relationships: [];
      };
      interview_center_stats: {
        Row: {
          cycle_id: string;
          centers_total: number;
          sessions_done: number;
          sessions_not_done: number;
          exam_centers_not_linked: number;
          applicants_eligible: number;
          applicants_not_assigned: number;
          applicants_without_schedule: number;
          updated_at: string;
        };
        Insert: {
          cycle_id: string;
          centers_total?: number;
          sessions_done?: number;
          sessions_not_done?: number;
          exam_centers_not_linked?: number;
          applicants_eligible?: number;
          applicants_not_assigned?: number;
          applicants_without_schedule?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["interview_center_stats"]["Insert"]>;
        Relationships: [];
      };
      interview_result_stats: {
        Row: {
          cycle_id: string;
          attended: number;
          absent: number;
          still_to_be_done: number;
          passed: number;
          passed_girls: number;
          passed_boys: number;
          updated_at: string;
        };
        Insert: {
          cycle_id: string;
          attended?: number;
          absent?: number;
          still_to_be_done?: number;
          passed?: number;
          passed_girls?: number;
          passed_boys?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["interview_result_stats"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      mv_province_stats: {
        Row: {
          cycle_id: string;
          province_id: string;
          province_name: string;
          total_students: number;
          male_students: number;
          female_students: number;
          exam_completed: number;
          interview_completed: number;
          home_visit_completed: number;
          selected_students: number;
        };
        Relationships: [];
      };
    };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
  };
};
