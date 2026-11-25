
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
    const matKhauCu = String(body.mat_khau_cu || "");
    const matKhauMoi = String(body.mat_khau_moi || "");

    if (!matKhauCu || !matKhauMoi) {
      return NextResponse.json(
        { message: "Vui lòng nhập đầy đủ mật khẩu." },
        { status: 400 }
      );
    }

    if (matKhauMoi.length < 8) {
      return NextResponse.json(
        { message: "Mật khẩu mới phải có ít nhất 8 ký tự." },
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

    const user = authData.user;

    if (authError || !user || !user.email) {
      return NextResponse.json(
        { message: "Phiên đăng nhập không hợp lệ." },
        { status: 401 }
      );
    }

    // Kiểm tra mật khẩu hiện tại
    const { error: passwordError } =
      await authClient.auth.signInWithPassword({
        email: user.email,
        password: matKhauCu,
      });

    if (passwordError) {
      return NextResponse.json(
        { message: "Mật khẩu hiện tại không chính xác." },
        { status: 400 }
      );
    }

    // Cập nhật mật khẩu mới
    const adminClient = createClient(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { error: updateError } =
      await adminClient.auth.admin.updateUserById(user.id, {
        password: matKhauMoi,
      });

    if (updateError) {
      console.error("Lỗi đổi mật khẩu:", updateError);

      return NextResponse.json(
        { message: "Không thể đổi mật khẩu." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Đổi mật khẩu thành công.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "Lỗi máy chủ." },
      { status: 500 }
    );
  }
}
