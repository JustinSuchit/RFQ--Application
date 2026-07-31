import { getCurrentUser } from "@/lib/auth/session";
import {
  decodeMicrosoftState,
  exchangeMicrosoftCodeForToken,
  getMicrosoftMe,
  getMicrosoftTokenExpiry,
} from "@/lib/integrations/microsoft-graph";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  try {
    if (!code) {
      throw new Error("Microsoft authorization missing code.");
    }

    if (!state) {
      throw new Error("Microsoft authorization missing state.");
    }

    const user = await getCurrentUser();
    if (!user) {
      throw new Error("Not authenticated. Please log in again.");
    }

    const decodedState = decodeMicrosoftState(state);
    if (decodedState.userId !== user.id) {
      throw new Error("Microsoft authorization state does not match the logged-in user.");
    }

    const supabase = await createClient();
    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("role, status")
      .eq("organization_id", decodedState.organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (membershipError || !membership) {
      throw new Error(
        membershipError?.message ?? "No active organization membership found.",
      );
    }

    if (!["owner", "admin"].includes(membership.role)) {
      throw new Error("Only organization owners and admins can connect Microsoft 365.");
    }

    const token = await exchangeMicrosoftCodeForToken(code);
    const me = await getMicrosoftMe(token.access_token);
    const mailboxEmail = me.mail || me.userPrincipalName;

    if (!mailboxEmail) {
      throw new Error("Graph /me failed: mailbox email was not returned.");
    }

    // TODO: Encrypt Microsoft tokens before public production release.
    const { error: connectionError } = await supabase
      .from("email_connections")
      .upsert(
        {
          organization_id: decodedState.organizationId,
          provider: "microsoft_graph",
          mailbox_email: mailboxEmail,
          access_token: token.access_token,
          refresh_token: token.refresh_token ?? null,
          token_expires_at: getMicrosoftTokenExpiry(token.expires_in),
          is_active: true,
          created_by: user.id,
        },
        { onConflict: "organization_id,provider" },
      );

    if (connectionError) {
      throw new Error(connectionError.message);
    }

    const { error: integrationError } = await supabase
      .from("integration_settings")
      .upsert(
        {
          organization_id: decodedState.organizationId,
          provider: "microsoft_graph",
          status: "connected",
          config: {
            mailbox_email: mailboxEmail,
            connected_at: new Date().toISOString(),
          },
        },
        { onConflict: "organization_id,provider" },
      );

    if (integrationError) {
      throw new Error(integrationError.message);
    }

    const { error: activityError } = await supabase.from("activity_logs").insert({
      organization_id: decodedState.organizationId,
      user_id: user.id,
      action: "Microsoft 365 mailbox connected",
      details: {
        mailbox_email: mailboxEmail,
      },
    });

    if (activityError) {
      console.error("Activity log insert failed", activityError.message);
    }

    return Response.redirect(new URL("/settings/email?microsoft=connected", url.origin));
  } catch (error) {
    const redirectUrl = new URL("/settings/email", url.origin);
    redirectUrl.searchParams.set(
      "microsoft_error",
      error instanceof Error ? error.message : "Microsoft connection failed.",
    );
    return Response.redirect(redirectUrl);
  }
}
