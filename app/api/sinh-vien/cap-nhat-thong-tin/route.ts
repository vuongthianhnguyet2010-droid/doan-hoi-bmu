
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { message: "Bạn chưa đăng nhập." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const ho_ten = String(body.ho_ten || "").trim();
    const lop = String(body.lop || "").trim();

    if (!ho_ten) {
      return NextResponse.json(
        { message: "Họ và tên không được để trống." },
        { status: 400 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const secretKey = process.env.SUPABASE_SECRET_KEY!;

    const authClient = createClient(url, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

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

    const { error } = await adminClient
      .from("students")
      .update({
        ho_ten,
        lop: lop || null,
      })
      .eq("auth_user_id", authData.user.id);

    if (error) {
      console.error("Lỗi cập nhật hồ sơ:", error);

      return NextResponse.json(
        { message: "Không thể cập nhật thông tin cá nhân." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Cập nhật thông tin cá nhân thành công.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "Lỗi máy chủ." },
      { status: 500 }
    );
  }
}
