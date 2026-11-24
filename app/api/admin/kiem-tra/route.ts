
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  try {
    const token = request.headers
      .get("Authorization")
      ?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return NextResponse.json(
        { message: "Chưa đăng nhập." },
        { status: 401 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const secretKey = process.env.SUPABASE_SECRET_KEY!;

    const authClient = createClient(url, publishableKey);

    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json(
        { message: "Phiên đăng nhập không hợp lệ." },
        { status: 401 }
      );
    }

    const adminClient = createClient(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: admin, error } = await adminClient
      .from("quantrivien")
      .select("id, vai_tro")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { message: "Không thể kiểm tra quyền quản trị." },
        { status: 500 }
      );
    }

    if (!admin) {
      return NextResponse.json(
        { message: "Bạn không có quyền quản trị." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      vai_tro: admin.vai_tro,
    });
  } catch {
    return NextResponse.json(
      { message: "Lỗi máy chủ." },
      { status: 500 }
    );
  }
}
