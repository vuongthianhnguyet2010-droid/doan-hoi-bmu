
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  try {
    const token = request.headers
      .get("Authorization")
      ?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return NextResponse.json(
        { message: "Vui lòng đăng nhập." },
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

    const { data: student, error } = await adminClient
  .from("students")
  .select("id, mssv, ho_ten, lop, email, auth_user_id")
  .eq("auth_user_id", authData.user.id)
  .maybeSingle();

console.log("STUDENT API CHECK:", {
  userId: authData.user.id,
  student,
  error,
});

    if (error) {
      return NextResponse.json(
        { message: "Không thể tải thông tin sinh viên." },
        { status: 500 }
      );
    }

    if (!student) {
      return NextResponse.json(
        { message: "Không tìm thấy hồ sơ sinh viên liên kết với tài khoản." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      student,
    });
  } catch {
    return NextResponse.json(
      { message: "Lỗi máy chủ." },
      { status: 500 }
    );
  }
}
