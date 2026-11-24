
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { mssv, password } = await request.json();

    if (!mssv || !password) {
      return NextResponse.json(
        { message: "Vui lòng nhập MSSV và mật khẩu." },
        { status: 400 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const secretKey = process.env.SUPABASE_SECRET_KEY!;

    // Tra cứu hồ sơ sinh viên ở phía máy chủ
    const adminClient = createClient(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: student, error: studentError } =
      await adminClient
        .from("students")
        .select("id, mssv, email, auth_user_id")
        .eq("mssv", String(mssv).trim())
        .maybeSingle();

    if (
      studentError ||
      !student ||
      !student.email ||
      !student.auth_user_id
    ) {
      return NextResponse.json(
        { message: "MSSV chưa đăng ký tài khoản hoặc không tồn tại." },
        { status: 401 }
      );
    }

    // Chỉ chấp nhận email BMU
    if (!student.email.toLowerCase().endsWith("@bmu.edu.vn")) {
      return NextResponse.json(
        { message: "Email tài khoản không hợp lệ." },
        { status: 401 }
      );
    }

    // Đăng nhập Supabase Auth bằng email nội bộ
    const authClient = createClient(url, publishableKey);

    const { data, error } =
      await authClient.auth.signInWithPassword({
        email: student.email,
        password,
      });

    if (error || !data.session) {
      return NextResponse.json(
        { message: "MSSV hoặc mật khẩu không chính xác." },
        { status: 401 }
      );
    }

    // Kiểm tra tài khoản đăng nhập đúng với hồ sơ sinh viên
    if (data.user.id !== student.auth_user_id) {
      return NextResponse.json(
        { message: "Tài khoản không khớp với hồ sơ sinh viên." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch {
    return NextResponse.json(
      { message: "Lỗi máy chủ." },
      { status: 500 }
    );
  }
}
