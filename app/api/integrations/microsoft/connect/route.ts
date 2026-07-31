import { getCurrentOrganization, getCurrentUser } from "@/lib/auth/session";
import { getMicrosoftAuthUrl } from "@/lib/integrations/microsoft-graph";

const adminRoles = new Set(["owner", "admin"]);

export async function GET() {
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
          error: "Only organization owners and admins can connect Microsoft 365.",
        },
        { status: 403 },
      );
    }

    return Response.redirect(
      getMicrosoftAuthUrl({
        organizationId: organization.id,
        userId: user.id,
      }),
    );
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to start Microsoft connection.",
      },
      { status: 400 },
    );
  }
}
