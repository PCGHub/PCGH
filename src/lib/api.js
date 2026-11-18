import { action, member } from "./campaigns";
import { supabase } from "./supabase";

export const API = {
  signUp: async (
    email,
    password,
    username,
    fullName,
  ) => {
    const {
      data: signUpData,
      error: signUpError,
    } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          full_name: fullName,
        },
      },
    });

    if (signUpError) {
      throw signUpError;
    }

    return signUpData.user;
  },

  signIn: async (email, password) => {
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      throw error;
    }

    return data.user;
  },

  signOut: async () => {
    const { error } =
      await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  },

  getSession: async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    return session;
  },

  getCurrentUser: async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    return user;
  },

  getUserProfile: async (userId) => {
    const { data, error } = await supabase
      .from("users")
      .select(
        "id,email,username,full_name,credits,reserved_credits,earning_allowance,earning_reserved,earning_unlocked,total_earned_credits,total_spent_credits,reputation_score,completed_tasks_count,submitted_links_count,is_active,joined_at,is_admin,admin_role,pod_id",
      )
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      await action("ensure_profile");
      return member();
    }

    return data;
  },

  updateUserProfile: async (
    userId,
    updates,
  ) => {
    const { data, error } = await supabase
      .from("users")
      .update({
        full_name: updates.full_name,
        username: updates.username,
      })
      .eq("id", userId)
      .select("id,full_name,username")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  },

  getCreditTransactions: async (
    userId,
    limit = 20,
    offset = 0,
  ) => {
    const { data, error } = await supabase
      .from("credit_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", {
        ascending: false,
      })
      .range(
        offset,
        offset + limit - 1,
      );

    if (error) {
      throw error;
    }

    return data || [];
  },

  getPayments: async (userId) => {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw error;
    }

    return data;
  },
};
