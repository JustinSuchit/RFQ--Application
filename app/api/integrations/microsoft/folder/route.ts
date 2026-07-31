import { revalidatePath } from "next/cache";
import { getCurrentOrganization, getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const adminRoles = new Set(["owner", "admin"]);

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json(
        { success: false, error: "Not authenticated. Please log in again." },
        { status: 401 },
      );
    }

    const organization = await getCurrentOrganization();
    if (!organization) {
      return Response.json(
        { success: false, error: "No active organization found." },
        { status: 400 },
      );
    }

    if (!adminRoles.has(organization.role)) {
      return Response.json(
        {
          success: false,
          error: "Only organization owners and admins can update the Microsoft scan folder.",
        },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      graph_scan_folder?: unknown;
    };
    const graphScanFolder =
      typeof body.graph_scan_folder === "string"
        ? body.graph_scan_folder.trim()
        : "";

    if (!graphScanFolder) {
      return Response.json(
        { success: false, error: "Microsoft scan folder missing." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: connection, error: connectionError } = await supabase
      .from("email_connections")
      .select("id, graph_scan_folder")
      .eq("organization_id", organization.id)
      .eq("provider", "microsoft_graph")
      .eq("is_active", true)
      .maybeSingle();

    if (connectionError) {
      return Response.json(
        { success: false, error: connectionError.message },
        { status: 400 },
      );
    }

    if (!connection) {
      return Response.json(
        { success: false, error: "No Microsoft connection configured." },
        { status: 400 },
      );
    }

    const folderChanged =
      (connection.graph_scan_folder ?? "inbox").trim().toLowerCase() !==
      graphScanFolder.toLowerCase();
    const updatePayload: {
      graph_scan_folder: string;
      graph_scan_folder_id?: string | null;
    } = {
      graph_scan_folder: graphScanFolder,
    };

    if (folderChanged) {
      updatePayload.graph_scan_folder_id = null;
    }

    const { error: updateError } = await supabase
      .from("email_connections")
      .update(updatePayload)
      .eq("id", connection.id)
      .eq("organization_id", organization.id);

    if (updateError) {
      return Response.json(
        { success: false, error: updateError.message },
        { status: 400 },
      );
    }

    const { error: activityError } = await supabase.from("activity_logs").insert({
      organization_id: organization.id,
      user_id: user.id,
      action: "Microsoft scan folder updated",
      details: {
        graph_scan_folder: graphScanFolder,
      },
    });

    if (activityError) {
      console.error("Activity log insert failed", activityError.message);
    }

    revalidatePath("/settings/email");
    revalidatePath("/settings");

    return Response.json({
      success: true,
      graph_scan_folder: graphScanFolder,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update Microsoft scan folder.",
      },
      { status: 400 },
    );
  }
}
